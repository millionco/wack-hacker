import type { SlackAdapter } from "@chat-adapter/slack";

import { UserRole } from "@/lib/ai/constants";

interface ResolvedSlackIdentity {
  role: UserRole;
  /** IANA timezone from the user's Slack profile, when available. */
  timezone?: string;
}

/**
 * Resolve a Slack user's access tier for the agent.
 *
 * Million's workspace is an internal team space, so any resolvable member is
 * treated as a member (unlocks the vendored integration delegates), while
 * Slack workspace admins/owners get the admin tier (unlocks destructive and
 * `delegate_code` operations). Unknown users fall back to public.
 *
 * Best-effort: a Slack API hiccup degrades to member rather than blocking
 * the turn, since the lookup is advisory and the underlying tools still
 * enforce their own approval gates.
 */
export async function resolveSlackIdentity(
  adapter: SlackAdapter,
  userId: string | undefined,
): Promise<ResolvedSlackIdentity> {
  if (!userId) return { role: UserRole.Public };

  try {
    const result = await adapter.webClient.users.info({ user: userId });
    const user = result.user as { is_admin?: boolean; is_owner?: boolean; tz?: string } | undefined;
    if (!user) return { role: UserRole.Member };
    const role = user.is_admin || user.is_owner ? UserRole.Admin : UserRole.Member;
    return { role, timezone: user.tz };
  } catch {
    return { role: UserRole.Member };
  }
}
