import { tool } from "ai";
import { z } from "zod";

import { approval } from "../../approvals/index.ts";
import { resolveChannelId, slackErrorMessage, slackWebClient, tsToISO } from "./client.ts";

const SNIPPET_MAX = 600;
function truncate(text: string | undefined): string {
  const t = text ?? "";
  return t.length > SNIPPET_MAX ? `${t.slice(0, SNIPPET_MAX - 1)}…` : t;
}

export const slack_channel_history = tool({
  description:
    "Read recent top-level messages from a Slack channel. Best for recent context in a known/current channel ('what happened here', 'latest'). Accepts a channel ID, #name, mention, or bare name. Returns messages oldest-first with author IDs, text, ts, and reply counts.",
  inputSchema: z.object({
    channel: z.string().describe("Channel ID, #name, <#C..> mention, or bare name"),
    limit: z.number().int().min(1).max(100).default(25),
  }),
  execute: async ({ channel, limit }) => {
    try {
      const client = slackWebClient();
      const id = await resolveChannelId(client, channel);
      if (!id) return `Could not find or access a channel matching "${channel}".`;
      const res = await client.conversations.history({ channel: id, limit });
      const messages = (res.messages ?? [])
        .slice()
        .reverse()
        .map((m) => ({
          ts: m.ts,
          author: m.user ?? m.bot_id ?? "unknown",
          text: truncate(m.text),
          threadTs: m.thread_ts,
          replyCount: m.reply_count,
          timestamp: tsToISO(m.ts),
        }));
      return JSON.stringify({ channelId: id, count: messages.length, messages });
    } catch (e) {
      return slackErrorMessage(e, "Failed to read channel history");
    }
  },
});

export const slack_get_permalink = tool({
  description: "Get the permalink URL for a Slack message, given its channel and ts.",
  inputSchema: z.object({
    channel: z.string().describe("Channel ID, #name, mention, or bare name"),
    ts: z.string().describe("Message ts, e.g. 1712345678.000100"),
  }),
  execute: async ({ channel, ts }) => {
    try {
      const client = slackWebClient();
      const id = await resolveChannelId(client, channel);
      if (!id) return `Could not find channel "${channel}".`;
      const res = await client.chat.getPermalink({ channel: id, message_ts: ts });
      return JSON.stringify({ permalink: res.permalink });
    } catch (e) {
      return slackErrorMessage(e, "Failed to get permalink");
    }
  },
});

export const slack_post_message = approval(
  tool({
    description:
      "Post a message to a Slack channel or thread. Supports Slack mrkdwn. To reply in a thread, pass thread_ts. Returns the new message ts and permalink.",
    inputSchema: z.object({
      channel: z.string().describe("Channel ID, #name, mention, or bare name"),
      text: z.string().describe("Message content (Slack mrkdwn)"),
      thread_ts: z.string().optional().describe("Parent message ts to reply in-thread"),
    }),
    execute: async ({ channel, text, thread_ts }) => {
      try {
        const client = slackWebClient();
        const id = await resolveChannelId(client, channel);
        if (!id) return `Could not find channel "${channel}".`;
        const res = await client.chat.postMessage({
          channel: id,
          text,
          ...(thread_ts ? { thread_ts } : {}),
        });
        return JSON.stringify({ ok: res.ok, ts: res.ts, channelId: id });
      } catch (e) {
        return slackErrorMessage(e, "Failed to post message");
      }
    },
  }),
);

export const slack_update_message = approval(
  tool({
    description:
      "Edit a Slack message the bot previously sent. Replaces its text. Requires channel and ts.",
    inputSchema: z.object({
      channel: z.string().describe("Channel ID, #name, mention, or bare name"),
      ts: z.string().describe("Message ts to edit (must be a bot message)"),
      text: z.string().describe("New message content (Slack mrkdwn)"),
    }),
    execute: async ({ channel, ts, text }) => {
      try {
        const client = slackWebClient();
        const id = await resolveChannelId(client, channel);
        if (!id) return `Could not find channel "${channel}".`;
        const res = await client.chat.update({ channel: id, ts, text });
        return JSON.stringify({ ok: res.ok, ts: res.ts });
      } catch (e) {
        return slackErrorMessage(e, "Failed to update message");
      }
    },
  }),
);

export const slack_delete_message = approval(
  tool({
    description: "Delete a Slack message the bot sent. Irreversible. Requires channel and ts.",
    inputSchema: z.object({
      channel: z.string().describe("Channel ID, #name, mention, or bare name"),
      ts: z.string().describe("Message ts to delete"),
    }),
    execute: async ({ channel, ts }) => {
      try {
        const client = slackWebClient();
        const id = await resolveChannelId(client, channel);
        if (!id) return `Could not find channel "${channel}".`;
        await client.chat.delete({ channel: id, ts });
        return JSON.stringify({ ok: true, deleted: ts });
      } catch (e) {
        return slackErrorMessage(e, "Failed to delete message");
      }
    },
  }),
);

export const slack_pin_message = approval(
  tool({
    description: "Pin a message to a Slack channel. Requires channel and ts.",
    inputSchema: z.object({
      channel: z.string().describe("Channel ID, #name, mention, or bare name"),
      ts: z.string().describe("Message ts to pin"),
    }),
    execute: async ({ channel, ts }) => {
      try {
        const client = slackWebClient();
        const id = await resolveChannelId(client, channel);
        if (!id) return `Could not find channel "${channel}".`;
        await client.pins.add({ channel: id, timestamp: ts });
        return JSON.stringify({ ok: true, pinned: ts });
      } catch (e) {
        return slackErrorMessage(e, "Failed to pin message");
      }
    },
  }),
);

export const slack_unpin_message = approval(
  tool({
    description: "Remove a pinned message from a Slack channel. Requires channel and ts.",
    inputSchema: z.object({
      channel: z.string().describe("Channel ID, #name, mention, or bare name"),
      ts: z.string().describe("Message ts to unpin"),
    }),
    execute: async ({ channel, ts }) => {
      try {
        const client = slackWebClient();
        const id = await resolveChannelId(client, channel);
        if (!id) return `Could not find channel "${channel}".`;
        await client.pins.remove({ channel: id, timestamp: ts });
        return JSON.stringify({ ok: true, unpinned: ts });
      } catch (e) {
        return slackErrorMessage(e, "Failed to unpin message");
      }
    },
  }),
);
