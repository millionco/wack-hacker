import { tool } from "ai";
import { z } from "zod";

import { approval } from "../../approvals/index.ts";
import { admin } from "../../skills/admin.ts";
import { resolveChannelId, slackErrorMessage, slackWebClient } from "./client.ts";

export const slack_create_channel = approval(
  tool({
    description:
      "Create a new Slack channel. Names must be lowercase, no spaces or periods, max 80 chars. Optionally private.",
    inputSchema: z.object({
      name: z.string().describe("Channel name (lowercase, hyphens, no spaces)"),
      is_private: z.boolean().default(false),
    }),
    execute: async ({ name, is_private }) => {
      try {
        const client = slackWebClient();
        const res = await client.conversations.create({ name, is_private });
        return JSON.stringify({ ok: res.ok, id: res.channel?.id, name: res.channel?.name });
      } catch (e) {
        return slackErrorMessage(e, "Failed to create channel");
      }
    },
  }),
);

export const slack_set_channel_topic = approval(
  tool({
    description: "Set a Slack channel's topic.",
    inputSchema: z.object({
      channel: z.string().describe("Channel ID, #name, mention, or bare name"),
      topic: z.string().describe("New topic text"),
    }),
    execute: async ({ channel, topic }) => {
      try {
        const client = slackWebClient();
        const id = await resolveChannelId(client, channel);
        if (!id) return `Could not find channel "${channel}".`;
        await client.conversations.setTopic({ channel: id, topic });
        return JSON.stringify({ ok: true, channelId: id, topic });
      } catch (e) {
        return slackErrorMessage(e, "Failed to set topic");
      }
    },
  }),
);

export const slack_set_channel_purpose = approval(
  tool({
    description: "Set a Slack channel's purpose/description.",
    inputSchema: z.object({
      channel: z.string().describe("Channel ID, #name, mention, or bare name"),
      purpose: z.string().describe("New purpose text"),
    }),
    execute: async ({ channel, purpose }) => {
      try {
        const client = slackWebClient();
        const id = await resolveChannelId(client, channel);
        if (!id) return `Could not find channel "${channel}".`;
        await client.conversations.setPurpose({ channel: id, purpose });
        return JSON.stringify({ ok: true, channelId: id, purpose });
      } catch (e) {
        return slackErrorMessage(e, "Failed to set purpose");
      }
    },
  }),
);

export const slack_invite_to_channel = approval(
  tool({
    description: "Invite one or more users to a Slack channel by user ID.",
    inputSchema: z.object({
      channel: z.string().describe("Channel ID, #name, mention, or bare name"),
      user_ids: z.array(z.string()).min(1).max(30).describe("Slack user IDs to invite"),
    }),
    execute: async ({ channel, user_ids }) => {
      try {
        const client = slackWebClient();
        const id = await resolveChannelId(client, channel);
        if (!id) return `Could not find channel "${channel}".`;
        await client.conversations.invite({ channel: id, users: user_ids.join(",") });
        return JSON.stringify({ ok: true, channelId: id, invited: user_ids });
      } catch (e) {
        return slackErrorMessage(e, "Failed to invite users");
      }
    },
  }),
);

export const slack_archive_channel = admin(
  approval(
    tool({
      description: "Archive a Slack channel. Destructive and admin-only. Confirm before use.",
      inputSchema: z.object({
        channel: z.string().describe("Channel ID, #name, mention, or bare name"),
      }),
      execute: async ({ channel }) => {
        try {
          const client = slackWebClient();
          const id = await resolveChannelId(client, channel);
          if (!id) return `Could not find channel "${channel}".`;
          await client.conversations.archive({ channel: id });
          return JSON.stringify({ ok: true, archived: id });
        } catch (e) {
          return slackErrorMessage(e, "Failed to archive channel");
        }
      },
    }),
  ),
);
