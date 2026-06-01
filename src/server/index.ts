import { evlog, type EvlogVariables } from "evlog/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

// Slack ingress is handled by the Next route at `app/api/webhooks/slack`. This
// Hono app remains as the `/api` catch-all and exposes a health check; the
// Discord gateway/interactions/cron routes were removed in the Slack cutover.
export const app = new Hono<EvlogVariables>().basePath("/api");
app.use(cors());
app.use(evlog());
app.get("/health", (c) => c.json({ ok: true }));
