import type { SlackAdapter } from "@chat-adapter/slack";

import { WebClient } from "@slack/web-api";

import { env } from "@/env";
import { slackBot } from "@/lib/slack/bot";

/**
 * Resolve the bot's Slack Web API client. Inside a webhook-triggered turn the
 * adapter exposes a request-scoped client (correct token in multi-workspace
 * mode); we fall back to a token-built client for cron/scheduled contexts.
 */
export function slackWebClient(): WebClient {
  const adapter = slackBot.getAdapter("slack") as SlackAdapter;
  try {
    return adapter.webClient;
  } catch {
    if (env.SLACK_BOT_TOKEN) return new WebClient(env.SLACK_BOT_TOKEN);
    throw new Error(
      "No Slack bot token available. Set SLACK_BOT_TOKEN or invoke within a Slack webhook context.",
    );
  }
}

/**
 * A user-scoped client for search. Slack's search APIs need a user token; on
 * single-workspace deploys this is `SLACK_USER_TOKEN`. Returns null when none
 * is configured so callers can fall back to bot-only behavior.
 */
export function slackUserClient(): WebClient | null {
  if (env.SLACK_USER_TOKEN) return new WebClient(env.SLACK_USER_TOKEN);
  return null;
}

const CHANNEL_ID_RE = /^[CGD][A-Z0-9]{6,}$/i;

/** Normalize `#name`, `<#C123|name>`, or a bare name to a usable form. */
export function normalizeChannelInput(input: string): string {
  const trimmed = input.trim();
  const mention = trimmed.match(/^<#([A-Z0-9]+)(?:\|[^>]+)?>$/i);
  if (mention?.[1]) return mention[1];
  return trimmed.replace(/^#/, "");
}

export function isChannelId(value: string): boolean {
  return CHANNEL_ID_RE.test(value);
}

/**
 * Resolve a channel reference (ID, #name, mention, or bare name) to a channel
 * ID by scanning visible conversations. Returns null when not found/accessible.
 */
export async function resolveChannelId(client: WebClient, input: string): Promise<string | null> {
  const normalized = normalizeChannelInput(input);
  if (isChannelId(normalized)) return normalized;

  const target = normalized.toLowerCase();
  let cursor: string | undefined;
  let pages = 0;
  do {
    const res = await client.conversations.list({
      cursor,
      exclude_archived: true,
      limit: 200,
      types: "public_channel,private_channel",
    });
    for (const ch of res.channels ?? []) {
      if (ch.name?.toLowerCase() === target && ch.id) return ch.id;
    }
    cursor = res.response_metadata?.next_cursor || undefined;
    pages += 1;
  } while (cursor && pages < 10);

  return null;
}

/** Convert a Slack `ts` (e.g. "1712345678.000100") to an ISO timestamp. */
export function tsToISO(ts: string | undefined): string | undefined {
  if (!ts) return undefined;
  const seconds = Number.parseFloat(ts);
  if (!Number.isFinite(seconds)) return undefined;
  return new Date(seconds * 1000).toISOString();
}

/** Normalize a thrown Slack Web API error into a short message string. */
export function slackErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { error?: string } }).data;
    if (data?.error) return `Slack API error: ${data.error}`;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
