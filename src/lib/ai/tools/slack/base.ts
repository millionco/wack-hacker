import { tool } from "ai";
import { z } from "zod";

import { resolveChannelId, slackErrorMessage, slackWebClient } from "./client.ts";

export const slack_get_workspace = tool({
  description:
    "Get basic info about the current Slack workspace (team name, id, url) and the bot's own identity. Use to confirm which workspace you're operating in.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const client = slackWebClient();
      const [auth, team] = await Promise.all([client.auth.test(), client.team.info()]);
      return JSON.stringify({
        teamId: team.team?.id ?? auth.team_id,
        teamName: team.team?.name ?? auth.team,
        url: auth.url,
        botUserId: auth.user_id,
        botName: auth.user,
      });
    } catch (e) {
      return slackErrorMessage(e, "Failed to fetch workspace info");
    }
  },
});

export const slack_list_channels = tool({
  description:
    "List Slack channels the bot can see. Use to find channel IDs, confirm visible channels, or explain that a missing private channel needs the bot invited. Supports a name filter substring.",
  inputSchema: z.object({
    filter: z.string().optional().describe("Case-insensitive substring to filter channel names by"),
    include_private: z.boolean().default(true).describe("Include private channels the bot is in"),
    limit: z.number().int().min(1).max(200).default(100),
  }),
  execute: async ({ filter, include_private, limit }) => {
    try {
      const client = slackWebClient();
      const out: Array<{ id?: string; name?: string; isPrivate?: boolean; isMember?: boolean }> =
        [];
      const needle = filter?.toLowerCase();
      let cursor: string | undefined;
      let pages = 0;
      do {
        const res = await client.conversations.list({
          cursor,
          exclude_archived: true,
          limit: 200,
          types: include_private ? "public_channel,private_channel" : "public_channel",
        });
        for (const ch of res.channels ?? []) {
          if (needle && !ch.name?.toLowerCase().includes(needle)) continue;
          out.push({ id: ch.id, name: ch.name, isPrivate: ch.is_private, isMember: ch.is_member });
          if (out.length >= limit) break;
        }
        cursor = res.response_metadata?.next_cursor || undefined;
        pages += 1;
      } while (cursor && out.length < limit && pages < 10);

      return JSON.stringify({ count: out.length, channels: out });
    } catch (e) {
      return slackErrorMessage(e, "Failed to list channels");
    }
  },
});

export const slack_get_channel = tool({
  description:
    "Get metadata for a single Slack channel (name, topic, purpose, member count, privacy). Accepts a channel ID, #name, mention, or bare name.",
  inputSchema: z.object({
    channel: z.string().describe("Channel ID, #name, <#C..> mention, or bare name"),
  }),
  execute: async ({ channel }) => {
    try {
      const client = slackWebClient();
      const id = await resolveChannelId(client, channel);
      if (!id) return `Could not find or access a channel matching "${channel}".`;
      const res = await client.conversations.info({ channel: id, include_num_members: true });
      const c = res.channel;
      return JSON.stringify({
        id: c?.id,
        name: c?.name,
        topic: c?.topic?.value,
        purpose: c?.purpose?.value,
        isPrivate: c?.is_private,
        isArchived: c?.is_archived,
        memberCount: (c as { num_members?: number } | undefined)?.num_members,
      });
    } catch (e) {
      return slackErrorMessage(e, "Failed to fetch channel info");
    }
  },
});

export const slack_check_channel_access = tool({
  description:
    "Check whether the bot can see and read a Slack channel. Accepts a channel ID, #name, or mention. If the bot lacks access, returns user-facing invite instructions.",
  inputSchema: z.object({
    channel: z.string().describe("Channel ID, #name, <#C..> mention, or bare name"),
  }),
  execute: async ({ channel }) => {
    try {
      const client = slackWebClient();
      const id = await resolveChannelId(client, channel);
      if (!id) {
        return JSON.stringify({
          accessible: false,
          message: `I can't see "${channel}". Invite me with \`/invite @pookie\` in that channel (a member must do this for private channels).`,
        });
      }
      const res = await client.conversations.info({ channel: id });
      return JSON.stringify({
        accessible: Boolean(res.channel?.is_member ?? true),
        channelId: id,
        name: res.channel?.name,
      });
    } catch (e) {
      return JSON.stringify({
        accessible: false,
        message: `I can't access "${channel}". Invite me with \`/invite @pookie\`. (${slackErrorMessage(e, "access check failed")})`,
      });
    }
  },
});

export const slack_resolve_user = tool({
  description:
    "Resolve a Slack user by ID or email to their profile (id, name, display name, email, timezone). Use to map a person mentioned by name/email to a user ID before other actions.",
  inputSchema: z.object({
    user: z.string().optional().describe("Slack user ID (U...)"),
    email: z.string().optional().describe("Email address to look up"),
  }),
  execute: async ({ user, email }) => {
    try {
      const client = slackWebClient();
      const res = email
        ? await client.users.lookupByEmail({ email })
        : user
          ? await client.users.info({ user })
          : null;
      if (!res) return "Provide either a user ID or an email to resolve.";
      const u = res.user;
      return JSON.stringify({
        id: u?.id,
        name: u?.name,
        displayName: u?.profile?.display_name || u?.real_name,
        email: u?.profile?.email,
        timezone: u?.tz,
        isAdmin: u?.is_admin,
        isBot: u?.is_bot,
      });
    } catch (e) {
      return slackErrorMessage(e, "Failed to resolve user");
    }
  },
});
