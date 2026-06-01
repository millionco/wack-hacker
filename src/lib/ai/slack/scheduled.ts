import type { SlackAdapter } from "@chat-adapter/slack";

import { fromFullStream } from "chat";

import { slackBot } from "@/lib/slack/bot";
import { resolveSlackIdentity } from "@/lib/slack/roles";

import { AgentContext } from "../context.ts";
import { createOrchestrator } from "../orchestrator.ts";
import { openRepogrepTools } from "../tools/repogrep/client.ts";
import { slackWebClient } from "../tools/slack/client.ts";
import { TurnUsageTracker } from "../turn-usage.ts";
import { buildSlackSystemPrompt } from "./system-prompt.ts";

/**
 * Slack channel ids start with C (public), G (private), or D (DM). Discord
 * channel ids are numeric snowflakes. Used by the scheduled-task fire handler
 * to route a task to the right platform without a schema/migration change.
 */
export function isSlackChannelId(id: string): boolean {
  return /^[CGD][A-Z0-9]{7,}$/i.test(id);
}

/** Post a static scheduled message to a Slack channel (new top-level message). */
export async function deliverSlackScheduledMessage(
  channelId: string,
  content: string,
  taskId: string,
): Promise<void> {
  await slackWebClient().chat.postMessage({
    channel: channelId,
    text: `${content}\n\n_Task: ${taskId}_`,
  });
}

/**
 * Run a scheduled agent prompt as a headless Slack turn and post the result as
 * a new top-level message in the channel. Role is re-resolved at fire time so a
 * privilege change between scheduling and firing is honored.
 */
export async function runSlackScheduledAgent(args: {
  taskId: string;
  userId: string;
  channelId: string;
  prompt: string;
  timezone?: string;
}): Promise<void> {
  const adapter = slackBot.getAdapter("slack") as SlackAdapter;
  const identity = await resolveSlackIdentity(adapter, args.userId);

  const context = AgentContext.fromSlack({
    userId: args.userId,
    username: "Scheduled Task",
    channel: { id: args.channelId, name: "scheduled" },
    role: identity.role,
    timezone: args.timezone ?? identity.timezone,
    slackThreadId: `slack:${args.channelId}`,
  });

  const tracker = new TurnUsageTracker();
  const repogrep = await openRepogrepTools();
  try {
    const agent = createOrchestrator(
      context,
      tracker,
      { "chat.platform": "slack", "task.id": args.taskId },
      { systemPrompt: buildSlackSystemPrompt({}), extraTools: repogrep.tools },
    );
    const result = await agent.stream({ messages: [{ role: "user", content: args.prompt }] });

    let text = "";
    for await (const chunk of fromFullStream(result.fullStream)) {
      if (typeof chunk === "string") text += chunk;
    }

    await slackWebClient().chat.postMessage({
      channel: args.channelId,
      text: `${text || "(no response)"}\n\n_Task: ${args.taskId}_`,
    });
  } finally {
    await repogrep.close().catch(() => {});
  }
}
