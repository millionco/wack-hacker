import type { SlackAdapterConfig } from "@chat-adapter/slack";
import type { StateAdapter } from "chat";

import { createSlackAdapter } from "@chat-adapter/slack";
import { createRedisState } from "@chat-adapter/state-redis";
import { Chat } from "chat";

import { env } from "@/env";

import type { SlackThreadState } from "./types";

import { isOAuthConfigured, isSlackConfigured } from "./deployment";

export type { SlackThreadState } from "./types";

/**
 * `createRedisState` connects to Redis lazily, but it constructs the client at
 * call time and reads `REDIS_URL` then. During Next.js build the module graph
 * is evaluated before runtime env exists, so we defer construction behind a
 * Proxy — the first method call builds the real adapter.
 */
function lazyRedisState(): StateAdapter {
  let instance: StateAdapter | undefined;
  return new Proxy({} as StateAdapter, {
    get(_target, prop, receiver) {
      instance ??= createRedisState({
        url: env.REDIS_URL ?? process.env.KV_URL,
      });
      const value = Reflect.get(instance, prop, receiver);
      return typeof value === "function" ? value.bind(instance) : value;
    },
  });
}

/**
 * The Slack adapter throws at construction if no signing secret / credentials
 * are present. Pass placeholders when env isn't populated yet so module load
 * doesn't crash the whole server — Slack-facing routes guard on
 * `isSlackConfigured()` and 503 until real secrets are set.
 */
function buildAdapterConfig(): SlackAdapterConfig {
  if (!isSlackConfigured()) {
    return {
      signingSecret: "wack-hacker-not-configured",
      clientId: "wack-hacker-not-configured",
      clientSecret: "wack-hacker-not-configured",
    };
  }

  if (isOAuthConfigured()) {
    return {
      signingSecret: env.SLACK_SIGNING_SECRET,
      clientId: env.SLACK_CLIENT_ID,
      clientSecret: env.SLACK_CLIENT_SECRET,
    };
  }

  // Single-workspace: bot token + signing secret (both auto-detected from env
  // by the adapter, but we pass them explicitly for clarity).
  return {
    signingSecret: env.SLACK_SIGNING_SECRET,
    botToken: env.SLACK_BOT_TOKEN,
  };
}

export const slackBot = new Chat<
  { slack: ReturnType<typeof createSlackAdapter> },
  SlackThreadState
>({
  userName: env.SLACK_BOT_NAME ?? "pookie",
  adapters: {
    slack: createSlackAdapter(buildAdapterConfig()),
  },
  state: lazyRedisState(),
  // Process follow-up messages concurrently per thread; the orchestrator turn
  // is idempotent enough and Slack delivers fast successive messages.
  concurrency: "concurrent",
}).registerSingleton();
