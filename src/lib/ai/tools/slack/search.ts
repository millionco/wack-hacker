import { tool } from "ai";
import { z } from "zod";

import { slackErrorMessage, slackUserClient, tsToISO } from "./client.ts";

const SNIPPET_MAX = 280;

function truncate(text: string | undefined): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > SNIPPET_MAX ? `${t.slice(0, SNIPPET_MAX - 1)}…` : t;
}

/** Strip Slack mrkdwn entities from a query so search matches plain terms. */
function cleanQuery(query: string): string {
  return query
    .replace(/<@([A-Z0-9]+)>/gi, "@$1")
    .replace(/<#([A-Z0-9]+)\|([^>]+)>/g, "#$2")
    .replace(/<([^>|]+)\|([^>]+)>/g, "$2")
    .replace(/<([^>]+)>/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export const slack_search = tool({
  description:
    "Search Slack across the whole workspace using Slack's Search API. Best for discovery: finding where a topic came up, who mentioned it, old threads, or files across channels. For recent context in a known channel, prefer slack_channel_history. Supports Slack operators in the query (in:#channel, from:@user, after:YYYY-MM-DD, before:YYYY-MM-DD, has:link, has:file). Results include permalinks — always include them in your reply.",
  inputSchema: z.object({
    query: z
      .string()
      .min(2)
      .describe(
        "Short, discriminative query. Prefer names, project terms, quoted phrases, or unique keywords over a full question.",
      ),
    limit: z.number().int().min(1).max(50).default(15),
  }),
  execute: async ({ query, limit }) => {
    const cleaned = cleanQuery(query);
    if (!cleaned) return "Search query was empty after cleaning Slack formatting.";

    // Slack search.* requires a user token. Bot tokens can't call it.
    const client = slackUserClient();
    if (!client) {
      return "Workspace search needs a Slack user token (SLACK_USER_TOKEN) which isn't configured on this deployment. Use slack_channel_history for a known channel instead.";
    }

    try {
      const messagesRes = await client.search.messages({
        query: cleaned,
        count: limit,
        sort: "timestamp",
        sort_dir: "desc",
      });
      const messages = (messagesRes.messages?.matches ?? []).map((m) => ({
        type: "message" as const,
        author: m.username ?? "unknown",
        channel: m.channel?.name ? `#${m.channel.name}` : (m.channel?.id ?? "unknown"),
        channelId: m.channel?.id,
        text: truncate(m.text),
        permalink: m.permalink,
        timestamp: tsToISO(m.ts),
      }));

      let files: Array<Record<string, unknown>> = [];
      if (messages.length === 0) {
        const filesRes = await client.search.files({
          query: cleaned,
          count: limit,
          sort: "timestamp",
          sort_dir: "desc",
        });
        files = (filesRes.files?.matches ?? []).map((f) => ({
          type: "file",
          title: f.title || f.name || "untitled",
          filetype: f.filetype,
          permalink: f.permalink,
          timestamp: f.created ? new Date(f.created * 1000).toISOString() : undefined,
        }));
      }

      const total = messages.length + files.length;
      if (total === 0) {
        return `No Slack results for "${cleaned}". Try alternate keywords, Slack operators (after:, before:, in:#channel, from:@user), or slack_channel_history for a known channel.`;
      }
      return JSON.stringify({ query: cleaned, results: { messages, files } });
    } catch (e) {
      return slackErrorMessage(e, "Slack search failed");
    }
  },
});
