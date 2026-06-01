import type { SlackAdapter } from "@chat-adapter/slack";

import { ApprovalStore } from "@/lib/ai/approvals";
import { convergeSlackApproval } from "@/lib/ai/approvals/slack";
import { handleSlackTurn } from "@/lib/ai/slack/run-turn";
import { slackBot } from "@/lib/slack/bot";
import { isSlackBotAddressed } from "@/lib/slack/routing";

export { slackBot };

const HELP_TEXT = `hi, i'm pookie — million's ai teammate in slack.

*how to reach me*
- @mention me in any channel i'm in, or just DM me
- pull me into a thread and i'll keep up with the conversation

*what i can do*
- search the workspace, summarize channels, read threads + files, make canvases
- engineering: github, linear, sentry, vercel
- money: stripe + mercury · analytics: posthog · logs: axiom
- infra: cloudflare + planetscale · research: web search + public repo search

invite me to a channel with \`/invite @pookie\`.`;

const SUGGESTED_PROMPTS = [
  { title: "Search the workspace", message: "Find the thread where we discussed ..." },
  { title: "Summarize this channel", message: "Summarize the recent activity in this channel" },
];

const slack = () => slackBot.getAdapter("slack") as SlackAdapter;

// ── Slash commands ──

slackBot.onSlashCommand("/help", async (event) => {
  try {
    await event.channel.postEphemeral(event.user, HELP_TEXT, { fallbackToDM: true });
  } catch (error) {
    console.error("[slack:/help]", error);
  }
});

// ── Tool approval buttons ──

slackBot.onAction(async (event) => {
  const actionId = event.actionId;
  if (!actionId.startsWith("tool-approval:")) return;

  const [, action, id] = actionId.split(":");
  if (!id || (action !== "approve" && action !== "deny")) return;

  try {
    const store = new ApprovalStore();
    const state = await store.get(id);
    if (!state) return;

    const clickerId = event.user.userId;
    if (clickerId !== state.requesterUserId) {
      await event.thread
        ?.postEphemeral(clickerId, `Only <@${state.requesterUserId}> can decide this request.`, {
          fallbackToDM: true,
        })
        .catch(() => {});
      return;
    }

    if (state.status !== "pending") {
      await convergeSlackApproval(state).catch(() => {});
      return;
    }

    const updated = await store.decide(id, action === "approve" ? "approved" : "denied", clickerId);
    await convergeSlackApproval(updated ?? state).catch(() => {});
  } catch (error) {
    console.error("[slack:tool-approval]", error);
  }
});

// ── Assistant pane ──

slackBot.onAssistantThreadStarted(async (event) => {
  await slack()
    .setSuggestedPrompts(event.channelId, event.threadTs, SUGGESTED_PROMPTS)
    .catch((error: unknown) => console.error("[slack:assistant-start]", error));
});

slackBot.onAssistantContextChanged(async (event) => {
  await slack()
    .setSuggestedPrompts(event.channelId, event.threadTs, SUGGESTED_PROMPTS)
    .catch((error: unknown) => console.error("[slack:assistant-context]", error));
});

// ── Messages ──

slackBot.onDirectMessage(async (thread, message) => {
  if (message?.author?.isMe || message?.author?.isBot === true) return;
  await thread.subscribe();
  await handleSlackTurn(thread, message);
});

slackBot.onNewMention(async (thread, message) => {
  await thread.subscribe();
  await handleSlackTurn(thread, message);
});

// Once subscribed, every follow-up routes here — including non-mention replies.
// Pookie only speaks when explicitly addressed, so plain replies in a
// subscribed thread are two humans talking. Keep the thread subscribed so the
// next @mention still lands here.
slackBot.onSubscribedMessage(async (thread, message) => {
  if (message?.author?.isMe || message?.author?.isBot === true) return;
  if (!isSlackBotAddressed(message, slack().botUserId)) return;
  await thread.refresh();
  await handleSlackTurn(thread, message);
});

// Catch-all for @mentions the typed handlers miss (the Slack `message` vs
// `app_mention` dedupe race, or a first-time @mention inside a thread the bot
// hasn't joined yet). Non-mention messages are ignored.
slackBot.onNewMessage(/.*/, async (thread, message) => {
  if (message?.author?.isMe || message?.author?.isBot === true) return;
  if (!isSlackBotAddressed(message, slack().botUserId)) return;
  await thread.subscribe();
  await handleSlackTurn(thread, message);
});
