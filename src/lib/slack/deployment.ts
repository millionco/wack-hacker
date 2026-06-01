import { env } from "@/env";

/**
 * True when the single-workspace Slack app has enough credentials to verify
 * webhooks and talk to the Slack API: `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET`.
 * Slack-facing routes guard on this and return 503 until the app is
 * provisioned, so the rest of the server can boot before Slack secrets are set.
 */
export function isSlackConfigured(): boolean {
  return Boolean(env.SLACK_SIGNING_SECRET && env.SLACK_BOT_TOKEN);
}

/** Standard 503 body returned by Slack routes before the app is configured. */
export function slackNotConfiguredResponse(): Response {
  return new Response(
    "Slack is not configured on this deployment yet. Set SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET.",
    { status: 503 },
  );
}

/**
 * Resolve the public base URL for the Slack manifest endpoints. Prefers an
 * explicit `BASE_URL`, then Vercel-provided domains, then the incoming request
 * origin during local setup.
 */
export function resolveBaseUrl(request?: Request): string {
  if (env.BASE_URL) return stripTrailingSlash(env.BASE_URL);

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`;
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  if (request) {
    try {
      return stripTrailingSlash(new URL(request.url).origin);
    } catch {
      // fall through
    }
  }

  return "http://localhost:3000";
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
