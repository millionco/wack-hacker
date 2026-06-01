import { z } from "zod";

/**
 * Pull the team / user / channel ids out of a raw Slack event payload. The
 * Chat SDK normalizes most things, but tools that call the Slack Web API
 * directly (search, channel history) need the raw ids, and per-request
 * `action_token`s only live on the raw event.
 */

const envelopeSchema = z
  .object({
    user: z.string().min(1).optional(),
    channel: z.string().min(1).optional(),
    channel_id: z.string().min(1).optional(),
    team: z.string().min(1).optional(),
    team_id: z.string().min(1).optional(),
    event: z.unknown().optional(),
  })
  .partial();

interface SlackEventContext {
  userId?: string;
  channelId?: string;
  teamId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function field(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const v = value[key];
  return typeof v === "string" ? v : undefined;
}

export function extractSlackEventContext(raw: unknown): SlackEventContext {
  const parsed = envelopeSchema.safeParse(raw);
  const data = parsed.success ? parsed.data : undefined;

  const teamId = data?.team_id ?? data?.team ?? field(data?.event, "team");
  const userId = data?.user ?? field(data?.event, "user");
  const channelId =
    data?.channel ??
    data?.channel_id ??
    field(data?.event, "channel") ??
    field(data?.event, "channel_id");

  return { teamId, userId, channelId };
}

export function extractSlackChannelId(raw: unknown): string | undefined {
  return extractSlackEventContext(raw).channelId;
}

interface ActionTokenRaw {
  action_token?: string;
  assistant_thread?: { action_token?: string };
}

/**
 * The initial `app_mention` carries `assistant_thread.action_token`, which
 * scopes `assistant.search.context` results to the requesting user. Follow-up
 * messages don't, so callers cache it in thread state.
 */
export function extractActionToken(raw: unknown): string | undefined {
  if (!isRecord(raw)) return undefined;
  const event = raw as ActionTokenRaw;
  return event.assistant_thread?.action_token ?? event.action_token;
}
