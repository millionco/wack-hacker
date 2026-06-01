import { tool } from "ai";
import { z } from "zod";

import { resolveChannelId, slackErrorMessage, slackWebClient } from "./client.ts";

export const slack_get_user_profile = tool({
  description:
    "Get a Slack user's profile by user ID (display name, real name, title, email, timezone, status).",
  inputSchema: z.object({
    user: z.string().describe("Slack user ID (U...)"),
  }),
  execute: async ({ user }) => {
    try {
      const client = slackWebClient();
      const res = await client.users.info({ user });
      const u = res.user;
      return JSON.stringify({
        id: u?.id,
        name: u?.name,
        displayName: u?.profile?.display_name || u?.real_name,
        title: u?.profile?.title,
        email: u?.profile?.email,
        timezone: u?.tz,
        statusText: u?.profile?.status_text,
        isAdmin: u?.is_admin,
        isBot: u?.is_bot,
      });
    } catch (e) {
      return slackErrorMessage(e, "Failed to get user profile");
    }
  },
});

export const slack_list_channel_members = tool({
  description:
    "List the user IDs of members in a Slack channel. Use with slack_get_user_profile to resolve names.",
  inputSchema: z.object({
    channel: z.string().describe("Channel ID, #name, mention, or bare name"),
    limit: z.number().int().min(1).max(200).default(100),
  }),
  execute: async ({ channel, limit }) => {
    try {
      const client = slackWebClient();
      const id = await resolveChannelId(client, channel);
      if (!id) return `Could not find channel "${channel}".`;
      const res = await client.conversations.members({ channel: id, limit });
      return JSON.stringify({ channelId: id, members: res.members ?? [] });
    } catch (e) {
      return slackErrorMessage(e, "Failed to list channel members");
    }
  },
});

export const slack_list_usergroups = tool({
  description:
    "List Slack user groups (handles, names, member counts). Useful for resolving @group handles.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const client = slackWebClient();
      const res = await client.usergroups.list({ include_count: true });
      const groups = (res.usergroups ?? []).map((g) => ({
        id: g.id,
        handle: g.handle,
        name: g.name,
        userCount: g.user_count,
      }));
      return JSON.stringify({ count: groups.length, groups });
    } catch (e) {
      return slackErrorMessage(e, "Failed to list user groups");
    }
  },
});

export const slack_list_emoji = tool({
  description:
    "List the workspace's custom emoji names. Useful before reacting with a workspace-custom emoji.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const client = slackWebClient();
      const res = await client.emoji.list();
      const names = Object.keys(res.emoji ?? {});
      return JSON.stringify({ count: names.length, emoji: names.slice(0, 500) });
    } catch (e) {
      return slackErrorMessage(e, "Failed to list emoji");
    }
  },
});
