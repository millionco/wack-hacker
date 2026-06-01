import { randomBytes, timingSafeEqual } from "node:crypto";

export { OAUTH_STATE_COOKIE } from "./constants";

/** Generate a random, URL-safe OAuth state nonce stored in a cookie + the URL. */
export function createOauthStateNonce(): string {
  return randomBytes(24).toString("base64url");
}

/** Constant-time compare of the cookie nonce against the `state` query param. */
export function isOauthStateMatch(
  cookieValue: string | undefined,
  stateParam: string | null,
): boolean {
  if (!cookieValue || !stateParam) return false;
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(stateParam);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
