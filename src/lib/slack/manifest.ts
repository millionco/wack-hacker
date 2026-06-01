/**
 * Slack app manifest generator. Produces the JSON you paste into
 * api.slack.com/apps (or POST to apps.manifest.create) to provision the bot
 * with the scopes, events, and slash commands the agent needs.
 *
 * Scopes are a superset of Pookie's: in addition to read/search, we request
 * the write scopes the expanded Slack tool domain uses (channel management,
 * pins, bookmarks, usergroups), all gated behind the agent's role checks.
 */

const WEBHOOK_PATH = "/api/webhooks/slack";

const BOT_SCOPES = [
  "app_mentions:read",
  "assistant:write",
  "bookmarks:read",
  "bookmarks:write",
  "canvases:read",
  "canvases:write",
  "channels:history",
  "channels:manage",
  "channels:read",
  "chat:write",
  "chat:write.public",
  "commands",
  "emoji:read",
  "files:read",
  "files:write",
  "groups:history",
  "groups:read",
  "groups:write",
  "im:history",
  "im:read",
  "im:write",
  "links:read",
  "mpim:history",
  "mpim:read",
  "mpim:write",
  "pins:read",
  "pins:write",
  "reactions:read",
  "reactions:write",
  "search:read.files",
  "search:read.public",
  "search:read.users",
  "usergroups:read",
  "users:read",
  "users:read.email",
] as const;

const USER_SCOPES = [
  "channels:history",
  "groups:history",
  "im:history",
  "mpim:history",
  "search:read.files",
  "search:read.im",
  "search:read.mpim",
  "search:read.private",
  "search:read.public",
  "search:read.users",
  "users:read",
  "users:read.email",
] as const;

const BOT_EVENTS = [
  "app_mention",
  "assistant_thread_started",
  "assistant_thread_context_changed",
  "member_joined_channel",
  "message.channels",
  "message.groups",
  "message.im",
  "message.mpim",
  "reaction_added",
  "reaction_removed",
] as const;

interface SlackManifest {
  display_information: { name: string; description: string; background_color?: string };
  features: {
    app_home?: {
      home_tab_enabled: boolean;
      messages_tab_enabled: boolean;
      messages_tab_read_only_enabled: boolean;
    };
    assistant_view?: {
      assistant_description: string;
      suggested_prompts?: Array<{ title: string; message: string }>;
    };
    bot_user: { display_name: string; always_online: boolean };
    slash_commands?: Array<{
      command: string;
      description: string;
      usage_hint?: string;
      should_escape?: boolean;
      url?: string;
    }>;
  };
  oauth_config: {
    scopes: { bot: string[]; user?: string[] };
  };
  settings: {
    event_subscriptions?: { request_url?: string; bot_events: string[] };
    interactivity?: { is_enabled: boolean; request_url?: string };
    org_deploy_enabled: boolean;
    socket_mode_enabled: boolean;
    token_rotation_enabled: boolean;
  };
}

export function createSlackManifest(deployUrl?: string, appName = "pookie"): SlackManifest {
  const endpoint = (path: string): string | undefined => {
    if (!deployUrl) return undefined;
    return `${deployUrl.replace(/\/+$/, "")}${path}`;
  };
  const webhookUrl = endpoint(WEBHOOK_PATH);

  return {
    display_information: {
      name: appName,
      description: "Million's AI teammate in Slack",
      background_color: "#101010",
    },
    features: {
      app_home: {
        home_tab_enabled: false,
        messages_tab_enabled: true,
        messages_tab_read_only_enabled: false,
      },
      assistant_view: {
        assistant_description:
          "Million's AI teammate — search Slack, ship code, and run your stack.",
        suggested_prompts: [
          { title: "Search the workspace", message: "Find the thread where we discussed ..." },
          {
            title: "Summarize this channel",
            message: "Summarize the recent activity in this channel",
          },
        ],
      },
      bot_user: { display_name: appName, always_online: true },
      slash_commands: [
        {
          command: "/help",
          description: "See what I can do",
          should_escape: false,
          ...(webhookUrl ? { url: webhookUrl } : {}),
        },
      ],
    },
    oauth_config: {
      scopes: { bot: [...BOT_SCOPES], user: [...USER_SCOPES] },
    },
    settings: {
      event_subscriptions: {
        ...(webhookUrl ? { request_url: webhookUrl } : {}),
        bot_events: [...BOT_EVENTS],
      },
      interactivity: {
        is_enabled: true,
        ...(webhookUrl ? { request_url: webhookUrl } : {}),
      },
      org_deploy_enabled: false,
      socket_mode_enabled: false,
      token_rotation_enabled: false,
    },
  };
}

export function buildSlackAppCreateUrl(manifest: SlackManifest): string {
  const url = new URL("https://api.slack.com/apps");
  url.search = new URLSearchParams({
    new_app: "1",
    manifest_json: JSON.stringify(manifest),
  }).toString();
  return url.toString();
}
