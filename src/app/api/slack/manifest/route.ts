import { env } from "@/env";
import { resolveBaseUrl } from "@/lib/slack/deployment";
import { createSlackManifest } from "@/lib/slack/manifest";

/** Serves the Slack app manifest JSON for provisioning the app. */
export function GET(request: Request): Response {
  const manifest = createSlackManifest(resolveBaseUrl(request), env.SLACK_BOT_NAME ?? "pookie");
  return Response.json(manifest);
}
