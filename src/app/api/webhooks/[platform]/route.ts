import { after } from "next/server";

// Importing from the handlers barrel (not the raw bot) ensures all Slack event
// handlers are registered on the singleton before the first webhook fires.
import { slackBot } from "@/bot/slack";
import { isSlackConfigured, slackNotConfiguredResponse } from "@/lib/slack/deployment";

type Platform = keyof typeof slackBot.webhooks;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
): Promise<Response> {
  if (!isSlackConfigured()) return slackNotConfiguredResponse();

  const { platform } = await params;
  const handler = slackBot.webhooks[platform as Platform];
  if (!handler) {
    return new Response(`Unknown platform: ${platform}`, { status: 404 });
  }

  return handler(request, {
    waitUntil: (task: Promise<unknown>) => after(() => task),
  });
}
