/**
 * Slack delivers both `app_mention` and a generic `message` event for the same
 * @-mention, sharing one `ts`. The Chat SDK dedupes by `ts`, so whichever event
 * wins the race is the one surfaced — and when `message` wins, `isMention` is
 * false. Detect addressing by scanning the raw text too, not just `isMention`.
 */

interface SlackMessageRaw {
  text?: string;
  thread_ts?: string;
  ts?: string;
}

interface AddressableMessage {
  isMention?: boolean;
  raw?: unknown;
}

export function hasSlackBotMention(
  text: string | undefined,
  botUserId: string | undefined,
): boolean {
  return Boolean(botUserId && text?.includes(`<@${botUserId}>`));
}

export function isSlackBotAddressed(
  message: AddressableMessage | undefined,
  botUserId: string | undefined,
): boolean {
  if (message?.isMention) return true;
  const raw = message?.raw as SlackMessageRaw | undefined;
  return hasSlackBotMention(raw?.text, botUserId);
}
