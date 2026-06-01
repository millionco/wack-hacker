/**
 * Print the Slack app manifest + a prefilled "create app" URL.
 *
 *   bun scripts/slack-manifest.ts            # uses BASE_URL from env
 *   BASE_URL=https://pookie.million.dev bun scripts/slack-manifest.ts
 */
import { buildSlackAppCreateUrl, createSlackManifest } from "../src/lib/slack/manifest.ts";

const baseUrl =
  process.env.BASE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined);
const appName = process.env.SLACK_BOT_NAME ?? "pookie";

const manifest = createSlackManifest(baseUrl, appName);

console.log(JSON.stringify(manifest, null, 2));
console.log("\n--- Create app URL ---\n");
console.log(buildSlackAppCreateUrl(manifest));
if (!baseUrl) {
  console.log("\n(no BASE_URL set — request URLs omitted; set BASE_URL to include them)");
}
