/**
 * Per-thread state persisted by the Chat SDK state adapter. We keep the chat
 * transcript here (Slack-native conversation memory) instead of standing up a
 * separate durable workflow per conversation — the Chat SDK already persists
 * subscriptions, locks, dedupe, and thread state in Redis.
 */
export interface SlackThreadState {
  /** Rolling AI message history for the orchestrator, capped per turn. */
  messages?: unknown[];
  /** Cached Slack search context (action_token, teamId, contextChannelId). */
  searchContext?: {
    actionToken?: string;
    teamId?: string;
    contextChannelId?: string;
  };
  [key: string]: unknown;
}
