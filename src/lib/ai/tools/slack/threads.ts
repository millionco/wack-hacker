import { tool } from "ai";
import { z } from "zod";

import { resolveChannelId, slackErrorMessage, slackWebClient, tsToISO } from "./client.ts";

const SNIPPET_MAX = 800;
function truncate(text: string | undefined): string {
  const t = text ?? "";
  return t.length > SNIPPET_MAX ? `${t.slice(0, SNIPPET_MAX - 1)}…` : t;
}

/** Parse a Slack archives permalink into channel + thread ts when possible. */
function parsePermalink(url: string): { channel: string; ts: string } | null {
  const m = url.match(/\/archives\/([A-Z0-9]+)\/p(\d+)/i);
  if (!m?.[1] || !m[2]) return null;
  const digits = m[2];
  const ts = `${digits.slice(0, -6)}.${digits.slice(-6)}`;
  return { channel: m[1], ts };
}

export const slack_read_thread = tool({
  description:
    "Fetch all messages in a Slack thread. Use after a search or slack_channel_history result when the answer depends on replies or full thread context. Provide a permalink, or a channel plus thread_ts.",
  inputSchema: z.object({
    permalink: z.string().optional().describe("A Slack message permalink (archives URL)"),
    channel: z.string().optional().describe("Channel ID, #name, mention, or bare name"),
    thread_ts: z.string().optional().describe("Parent message ts of the thread"),
  }),
  execute: async ({ permalink, channel, thread_ts }) => {
    try {
      const client = slackWebClient();
      let channelRef = channel;
      let ts = thread_ts;
      if (permalink) {
        const parsed = parsePermalink(permalink);
        if (parsed) {
          channelRef ??= parsed.channel;
          ts ??= parsed.ts;
        }
      }
      if (!channelRef || !ts) {
        return "Provide a permalink, or both a channel and thread_ts.";
      }
      const id = await resolveChannelId(client, channelRef);
      if (!id) return `Could not find or access channel "${channelRef}".`;
      const res = await client.conversations.replies({ channel: id, ts, limit: 100 });
      const messages = (res.messages ?? []).map((m) => ({
        ts: m.ts,
        author: m.user ?? m.bot_id ?? "unknown",
        text: truncate(m.text),
        timestamp: tsToISO(m.ts),
      }));
      return JSON.stringify({ channelId: id, threadTs: ts, count: messages.length, messages });
    } catch (e) {
      return slackErrorMessage(e, "Failed to read thread");
    }
  },
});
