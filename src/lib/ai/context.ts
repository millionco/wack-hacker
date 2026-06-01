import type {
  ChannelInfo,
  ThreadInfo,
  Attachment,
  RecentMessage,
  SerializedAgentContext,
} from "./types.ts";

import { UserRole } from "./constants.ts";

export type {
  ChannelInfo,
  ThreadInfo,
  Attachment,
  RecentMessage,
  SerializedAgentContext,
} from "./types.ts";

import { DEFAULT_TIMEZONE } from "../tasks/constants.ts";

export class AgentContext {
  readonly userId: string;
  readonly username: string;
  readonly nickname: string;
  readonly channel: ChannelInfo;
  readonly thread?: ThreadInfo;
  readonly date: string;
  readonly nowISO: string;
  readonly timezone: string;
  readonly attachments?: Attachment[];
  readonly memberRoles?: string[];
  readonly recentMessages?: RecentMessage[];
  readonly recentMessagesFromThread?: boolean;
  readonly referencedContext?: RecentMessage[];
  readonly platform: "discord" | "slack";
  readonly resolvedRole?: UserRole;
  readonly slackThreadId?: string;

  private constructor(data: SerializedAgentContext) {
    this.userId = data.userId;
    this.username = data.username;
    this.nickname = data.nickname;
    this.channel = data.channel;
    this.thread = data.thread;
    this.date = data.date;
    // Default nowISO/timezone on deserialize so legacy serialized contexts
    // (written before these fields existed) still round-trip cleanly.
    this.nowISO = data.nowISO ?? new Date().toISOString();
    this.timezone = data.timezone ?? DEFAULT_TIMEZONE;
    this.attachments = data.attachments;
    this.memberRoles = data.memberRoles;
    this.recentMessages = data.recentMessages;
    this.recentMessagesFromThread = data.recentMessagesFromThread;
    this.referencedContext = data.referencedContext;
    this.platform = data.platform ?? "discord";
    this.resolvedRole = data.resolvedRole;
    this.slackThreadId = data.slackThreadId;
  }

  /**
   * Application-level access tier. The Slack ingress resolves the tier up front
   * (workspace admins/owners → admin, members → member) and stores it in
   * `resolvedRole`.
   */
  get role(): UserRole {
    return this.resolvedRole ?? UserRole.Public;
  }

  /**
   * Build context for a Slack turn. The Slack ingress has already resolved the
   * user's role and gathered recent thread/channel messages via the Chat SDK.
   */
  static fromSlack(data: {
    userId: string;
    username: string;
    channel: ChannelInfo;
    thread?: ThreadInfo;
    role: UserRole;
    timezone?: string;
    attachments?: Attachment[];
    recentMessages?: RecentMessage[];
    slackThreadId?: string;
  }): AgentContext {
    const now = new Date();
    return new AgentContext({
      userId: data.userId,
      username: data.username,
      nickname: data.username,
      channel: data.channel,
      thread: data.thread,
      platform: "slack",
      resolvedRole: data.role,
      slackThreadId: data.slackThreadId,
      date: now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      nowISO: now.toISOString(),
      timezone: data.timezone ?? DEFAULT_TIMEZONE,
      attachments: data.attachments,
      recentMessages: data.recentMessages,
      recentMessagesFromThread: Boolean(data.thread),
    });
  }

  static fromJSON(data: SerializedAgentContext): AgentContext {
    return new AgentContext(data);
  }

  toJSON(): SerializedAgentContext {
    return {
      userId: this.userId,
      username: this.username,
      nickname: this.nickname,
      channel: this.channel,
      thread: this.thread,
      date: this.date,
      nowISO: this.nowISO,
      timezone: this.timezone,
      attachments: this.attachments,
      memberRoles: this.memberRoles,
      recentMessages: this.recentMessages,
      recentMessagesFromThread: this.recentMessagesFromThread,
      referencedContext: this.referencedContext,
      platform: this.platform,
      resolvedRole: this.resolvedRole,
      slackThreadId: this.slackThreadId,
    };
  }

  buildInstructions(baseInstructions: string): string {
    const replaced = baseInstructions
      .replace("{{DATE}}", this.date)
      .replace("{{NOW_ISO}}", this.nowISO)
      .replace("{{USER_TZ}}", this.timezone);
    return `${replaced}\n\n${this.contextBlock()}`;
  }

  /**
   * Render the YAML execution-context block appended to the system prompt.
   * Public so the context inspector can snapshot the exact block the orchestrator
   * saw without duplicating the YAML layout.
   */
  contextBlock(): string {
    const thread = this.thread
      ? `\nthread:\n  name: ${JSON.stringify(this.thread.name)}\n  id: "${this.thread.id}"\n  parent_channel: "#${this.thread.parentChannel.name}"`
      : "";

    // Tag the lead-in block based on where its messages actually came from,
    // not on whether the conversation is happening in a thread. A fresh
    // mention creates a thread but the lead-in is from the parent channel.
    // Legacy serialized contexts without the flag fall back to `thread`.
    const fromThread = this.recentMessagesFromThread ?? Boolean(this.thread);
    const msgTag = fromThread ? "recent_thread_messages" : "recent_channel_messages";
    const recentMsgs = this.recentMessages?.length
      ? `\n\n<${msgTag}>\n${this.recentMessages
          .map((m) => `[${m.timestamp}] ${m.author}: ${m.content}`)
          .join("\n")}\n</${msgTag}>`
      : "";

    const refMsgs = this.referencedContext?.length
      ? `\n\n<referenced_message_context>\nThe user's mention was a reply to a message in this channel. Below is that message (last) plus the messages that immediately preceded it, in chronological order.\n${this.referencedContext
          .map((m) => `[${m.timestamp}] ${m.author}: ${m.content}`)
          .join("\n")}\n</referenced_message_context>`
      : "";

    return `<execution_context>
\`\`\`yaml
user:
  username: "${this.username}"
  nickname: ${JSON.stringify(this.nickname)}
  id: "${this.userId}"
channel:
  name: "#${this.channel.name}"
  id: "${this.channel.id}"${thread}
date: "${this.date}"
\`\`\`
</execution_context>${recentMsgs}${refMsgs}`;
  }
}
