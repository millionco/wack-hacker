import type { SlackInstallation } from "@chat-adapter/slack";

import { WebClient } from "@slack/web-api";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { slackBot } from "@/bot/slack";
import { env } from "@/env";
import {
  isOAuthConfigured,
  resolveBaseUrl,
  slackNotConfiguredResponse,
} from "@/lib/slack/deployment";
import { isOauthStateMatch, OAUTH_STATE_COOKIE } from "@/lib/slack/oauth-state";

function errorRedirect(baseUrl: string, reason: string): NextResponse {
  const target = new URL("/", baseUrl);
  target.searchParams.set("slack_error", reason);
  const response = NextResponse.redirect(target);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

export async function GET(request: Request): Promise<Response> {
  if (!isOAuthConfigured()) return slackNotConfiguredResponse();

  const baseUrl = resolveBaseUrl(request);
  const url = new URL(request.url);

  const errorReason = url.searchParams.get("error");
  if (errorReason) return errorRedirect(baseUrl, errorReason);

  const stateCookie = (await cookies()).get(OAUTH_STATE_COOKIE)?.value;
  const stateParam = url.searchParams.get("state");
  if (!isOauthStateMatch(stateCookie, stateParam)) {
    return errorRedirect(baseUrl, "invalid_state");
  }

  try {
    await slackBot.initialize();
    const slack = slackBot.getAdapter("slack");
    const code = url.searchParams.get("code");
    if (!code) throw new Error("missing slack oauth code");

    const result = await new WebClient().oauth.v2.access({
      client_id: env.SLACK_CLIENT_ID!,
      client_secret: env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: `${baseUrl}/api/slack/oauth`,
    });

    if (!(result.ok && result.access_token && result.team?.id)) {
      throw new Error(result.error || "slack oauth did not return an installation");
    }

    const installation: SlackInstallation = {
      botToken: result.access_token,
      botUserId: result.bot_user_id,
      teamName: result.team.name,
    };
    await slack.setInstallation(result.team.id, installation);

    const target = new URL("/", baseUrl);
    target.searchParams.set("slack_installed", result.team.id);
    const response = NextResponse.redirect(target);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    return errorRedirect(
      baseUrl,
      err instanceof Error && err.message ? err.message : "install_failed",
    );
  }
}
