/**
 * The Vercel team the `vercel` delegate operates on. Read straight from
 * `process.env` (rather than the validated `env` module) because this is a
 * `constants.ts` file, which the lint rules forbid from importing `env`. The
 * values are declared in `env.ts` for documentation/typing, and the vercel
 * delegate requires `VERCEL_TEAM_ID` (see `requiredEnv` in delegates.ts), so
 * tools never run unscoped. `VERCEL_TEAM_ID` scopes API calls;
 * `VERCEL_TEAM_SLUG` only builds dashboard links.
 */
export const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID ?? "";
export const VERCEL_TEAM_SLUG = process.env.VERCEL_TEAM_SLUG ?? "";

/** Dashboard URL prefix used for building links in tool responses. */
export const VERCEL_DASHBOARD_BASE = `https://vercel.com/${VERCEL_TEAM_SLUG}`;
