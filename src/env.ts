import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Core infrastructure — required for the bot to function at all.
    CRON_SECRET: z.string(),
    TURSO_DATABASE_URL: z.string(),
    TURSO_AUTH_TOKEN: z.string(),
    KV_REST_API_URL: z.string(),
    KV_REST_API_TOKEN: z.string(),

    // ── Domain integration credentials ──
    // Optional: a deploy only needs the keys for the domains it actually uses.
    // `.default("")` keeps the type `string` (no churn at the ~80 read sites)
    // while letting the app boot without them. The subagent for a domain
    // errors out *before launching* when its required keys are missing (see
    // `DOMAIN_REQUIRED_ENV` in delegates.ts), so a tool never runs with an
    // empty credential.
    LINEAR_API_KEY: z.string().default(""),
    NOTION_TOKEN: z.string().default(""),
    GITHUB_APP_ID: z.string().default(""),
    GITHUB_APP_PRIVATE_KEY: z.string().default(""),
    GITHUB_APP_INSTALLATION_ID: z.string().default(""),
    GITHUB_ORG: z.string().default(""),
    VERCEL_API_TOKEN: z.string().default(""),
    // Vercel team the `vercel` delegate operates on (scopes API calls + builds
    // dashboard URLs). Discover via `whoami` / `list_teams`, or the dashboard URL.
    VERCEL_TEAM_ID: z.string().default(""),
    VERCEL_TEAM_SLUG: z.string().default(""),
    SENTRY_AUTH_TOKEN: z.string().default(""),
    SENTRY_ORG: z.string().default(""),
    SENTRY_DSN: z.string().optional(),
    EXA_API_KEY: z.string().optional(),
    // Genuinely optional: when set, sandbox sessions boot from this prebuilt
    // snapshot (ripgrep + gh preinstalled) and skip ~20-30s of dnf install. The
    // app runs fine without it. Create one via scripts/create-sandbox-snapshot.ts.
    SANDBOX_BASE_SNAPSHOT_ID: z.string().optional(),

    // ── Slack transport (Chat SDK + @chat-adapter/slack) ──
    // Single-workspace install: bot token + signing secret. Optional so the app
    // can boot before the Slack app is provisioned; Slack-facing routes guard on
    // `isSlackConfigured()` and 503 until these are present.
    SLACK_BOT_TOKEN: z.string().optional(),
    SLACK_SIGNING_SECRET: z.string().optional(),
    SLACK_BOT_NAME: z.string().optional(),
    // User token used as a fallback search identity when a per-request
    // action_token isn't available — it carries the installer's private-channel
    // visibility.
    SLACK_USER_TOKEN: z.string().optional(),
    // Standard Redis (rediss://) URL backing the Chat SDK state adapter
    // (subscriptions, dedupe, per-thread state). Distinct from the Upstash
    // REST client (KV_REST_API_*) used by approvals + task dedup. Point both
    // at the same instance.
    REDIS_URL: z.string().optional(),
    // Public base URL for the Slack manifest endpoint. Falls back to
    // VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL at runtime.
    BASE_URL: z.string().optional(),

    // ── Vendored Million integrations (native tools, not MCP) ──
    // Optional so the bot boots with only the domains a deploy actually uses;
    // each domain client throws a clear error at call time when its key is
    // missing.
    STRIPE_API_KEY: z.string().optional(),
    POSTHOG_API_KEY: z.string().optional(),
    POSTHOG_PROJECT_ID: z.string().optional(),
    POSTHOG_HOST: z.string().optional(),
    MERCURY_API_TOKEN: z.string().optional(),
    AXIOM_API_TOKEN: z.string().optional(),
    AXIOM_ORG_ID: z.string().optional(),
    CLOUDFLARE_API_TOKEN: z.string().optional(),
    CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
    PLANETSCALE_SERVICE_TOKEN_ID: z.string().optional(),
    PLANETSCALE_SERVICE_TOKEN: z.string().optional(),
    PLANETSCALE_ORG: z.string().optional(),
    REPOGREP_API_KEY: z.string().optional(),
  },
  extends: [vercel()],
  runtimeEnv: process.env,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});
