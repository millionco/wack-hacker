import type { SlackAdapter } from "@chat-adapter/slack";
import type { Message, Thread } from "chat";

import { fromFullStream } from "chat";

import type { RecentMessage, ChatMessage, TelemetryMetadata } from "@/lib/ai/types";

import { AgentContext } from "@/lib/ai/context";
import { createOrchestrator } from "@/lib/ai/orchestrator";
import { openRepogrepTools } from "@/lib/ai/tools/repogrep/client";
import { TurnUsageTracker } from "@/lib/ai/turn-usage";
import { slackBot, type SlackThreadState } from "@/lib/slack/bot";
import { extractSlackEventContext } from "@/lib/slack/event-context";
import { resolveSlackIdentity } from "@/lib/slack/roles";

import { detectPetMode, pickRandomCatEmoji } from "./pet-mode.ts";
import { buildSlackSystemPrompt } from "./system-prompt.ts";

/** Cap on accumulated user+assistant turns — 25 exchanges. Drops oldest pairs. */
const MAX_HISTORY_MESSAGES = 50;
/** Recent thread/channel messages handed to the orchestrator as lead-in context. */
const MAX_RECENT_MESSAGES = 15;

function capHistory(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_HISTORY_MESSAGES) return messages;
  const excess = messages.length - MAX_HISTORY_MESSAGES;
  return messages.slice(excess + (excess % 2));
}

/** Strip a leading `<@BOTID>` mention so the model doesn't see its own handle. */
function stripBotMention(text: string, botUserId: string | undefined): string {
  if (!botUserId) return text.trim();
  return text.replaceAll(`<@${botUserId}>`, "").trim();
}

function toRecentMessages(
  messages: readonly Message[],
  excludeId: string | undefined,
): RecentMessage[] {
  return messages
    .filter((m) => m.id !== excludeId && !m.author.isMe)
    .slice(-MAX_RECENT_MESSAGES)
    .map((m) => ({
      id: m.id,
      author: m.author.fullName || m.author.userName,
      content: m.text,
      timestamp: m.metadata.dateSent.toISOString(),
    }));
}

function readStoredHistory(state: SlackThreadState | null): ChatMessage[] {
  const raw = state?.messages;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m): m is ChatMessage =>
      Boolean(m) &&
      typeof m === "object" &&
      (m as ChatMessage).role !== undefined &&
      typeof (m as ChatMessage).content === "string",
  );
}

/**
 * Run one orchestrator turn for a Slack message and stream the reply back
 * through the Chat SDK (native Slack streaming). Conversation history lives in
 * the thread's Chat SDK state, so this needs no durable workflow — each call is
 * a self-contained turn.
 */
export async function handleSlackTurn(
  thread: Thread<SlackThreadState>,
  message?: Message,
): Promise<void> {
  const adapter = slackBot.getAdapter("slack") as SlackAdapter;
  const { teamId, userId, channelId } = extractSlackEventContext(message?.raw);

  const [identity, channelInfo, state] = await Promise.all([
    resolveSlackIdentity(adapter, userId),
    thread.channel
      .fetchMetadata()
      .catch(() => ({ id: channelId ?? thread.channelId, name: channelId ?? "channel" })),
    thread.state.catch(() => null),
  ]);

  const userText = stripBotMention(message?.text ?? "", adapter.botUserId);
  const petMode = detectPetMode([userText]);

  const context = AgentContext.fromSlack({
    userId: userId ?? message?.author.userId ?? "unknown",
    username: message?.author.fullName || message?.author.userName || "someone",
    channel: { id: channelInfo.id, name: channelInfo.name ?? channelInfo.id },
    role: identity.role,
    timezone: identity.timezone,
    recentMessages: toRecentMessages(thread.recentMessages, message?.id),
    slackThreadId: thread.id,
  });

  const stored = readStoredHistory(state);
  const turnMessages: ChatMessage[] = [...stored, { role: "user", content: userText }];

  const tracker = new TurnUsageTracker();
  const metadata: TelemetryMetadata = {
    "chat.platform": "slack",
    "chat.team_id": teamId,
    "chat.channel_id": channelId,
    "chat.user_id": userId,
  };
  // Repogrep is a vendored public-GitHub search MCP server (the one capability
  // that's only available over MCP). Open it per turn and inject its tools flat
  // onto the orchestrator; closed in `finally`.
  const repogrep = await openRepogrepTools();

  const agent = createOrchestrator(context, tracker, metadata, {
    systemPrompt: buildSlackSystemPrompt({ petMode }),
    extraTools: repogrep.tools,
  });

  await thread.startTyping();

  // Pet-mode auto-react fires deterministically — the model is unreliable about
  // remembering to react while it's busy composing a chatty reply.
  if (petMode && message?.id) {
    void adapter.addReaction(thread.id, message.id, pickRandomCatEmoji()).catch(() => {});
  }

  try {
    const result = await agent.stream({ messages: turnMessages });

    // Stream to Slack natively while capturing the final text for history. The
    // SDK's fromFullStream yields plain strings for text and StreamChunks for
    // structured progress; accumulate the strings.
    let finalText = "";
    async function* relay() {
      for await (const chunk of fromFullStream(result.fullStream)) {
        if (typeof chunk === "string") finalText += chunk;
        yield chunk;
      }
    }
    await thread.post(relay());

    const nextHistory = capHistory([
      ...turnMessages,
      { role: "assistant", content: finalText || "(no response)" },
    ]);
    await thread.setState({ messages: nextHistory }).catch(() => {});

    // Best-effort telemetry — a metadata hiccup must not fail the turn.
    try {
      const [totalUsage, steps] = await Promise.all([result.totalUsage, result.steps]);
      tracker.recordOrchestrator({
        usage: totalUsage as { inputTokens?: number; outputTokens?: number; totalTokens?: number },
        steps: steps as readonly { toolCalls: readonly unknown[] }[],
      });
    } catch {
      // ignore
    }
  } finally {
    await repogrep.close().catch(() => {});
  }
}
