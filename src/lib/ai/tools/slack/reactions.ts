import { tool } from "ai";
import { z } from "zod";

import { resolveChannelId, slackErrorMessage, slackWebClient } from "./client.ts";

/** Normalize a unicode emoji or :shortcode: to a bare Slack shortcode. */
function normalizeEmoji(input: string): string {
  return input.trim().replace(/^:/, "").replace(/:$/, "");
}

export const slack_react_to_message = tool({
  description:
    "Add an emoji reaction to a Slack message. Great for lightweight acknowledgements or status signals. Pass a Slack shortcode without colons (e.g. 'white_check_mark', 'eyes', 'tada') or a unicode emoji.",
  inputSchema: z.object({
    channel: z.string().describe("Channel ID, #name, mention, or bare name"),
    ts: z.string().describe("Message ts to react to"),
    emoji: z
      .string()
      .default("white_check_mark")
      .describe("Shortcode (no colons) or unicode emoji"),
  }),
  execute: async ({ channel, ts, emoji }) => {
    try {
      const client = slackWebClient();
      const id = await resolveChannelId(client, channel);
      if (!id) return `Could not find channel "${channel}".`;
      await client.reactions.add({ channel: id, timestamp: ts, name: normalizeEmoji(emoji) });
      return JSON.stringify({ ok: true, reacted: normalizeEmoji(emoji) });
    } catch (e) {
      const msg = slackErrorMessage(e, "Failed to react");
      // already_reacted is a benign outcome — surface as success.
      if (msg.includes("already_reacted"))
        return JSON.stringify({ ok: true, reacted: normalizeEmoji(emoji) });
      return msg;
    }
  },
});

export const slack_remove_reaction = tool({
  description: "Remove one of the bot's emoji reactions from a Slack message.",
  inputSchema: z.object({
    channel: z.string().describe("Channel ID, #name, mention, or bare name"),
    ts: z.string().describe("Message ts"),
    emoji: z.string().describe("Shortcode (no colons) or unicode emoji to remove"),
  }),
  execute: async ({ channel, ts, emoji }) => {
    try {
      const client = slackWebClient();
      const id = await resolveChannelId(client, channel);
      if (!id) return `Could not find channel "${channel}".`;
      await client.reactions.remove({ channel: id, timestamp: ts, name: normalizeEmoji(emoji) });
      return JSON.stringify({ ok: true, removed: normalizeEmoji(emoji) });
    } catch (e) {
      return slackErrorMessage(e, "Failed to remove reaction");
    }
  },
});

export const slack_list_reactions = tool({
  description: "List the reactions on a Slack message (emoji name + count + who reacted).",
  inputSchema: z.object({
    channel: z.string().describe("Channel ID, #name, mention, or bare name"),
    ts: z.string().describe("Message ts"),
  }),
  execute: async ({ channel, ts }) => {
    try {
      const client = slackWebClient();
      const id = await resolveChannelId(client, channel);
      if (!id) return `Could not find channel "${channel}".`;
      const res = await client.reactions.get({ channel: id, timestamp: ts, full: true });
      const reactions = (
        (
          res.message as
            | { reactions?: Array<{ name?: string; count?: number; users?: string[] }> }
            | undefined
        )?.reactions ?? []
      ).map((r) => ({ name: r.name, count: r.count, users: r.users }));
      return JSON.stringify({ reactions });
    } catch (e) {
      return slackErrorMessage(e, "Failed to list reactions");
    }
  },
});
