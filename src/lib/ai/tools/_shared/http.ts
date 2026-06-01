import { stringifyQueryValue } from "@/lib/http/query";

import type { HttpJsonOptions } from "./types.ts";

import { HttpError } from "./errors.ts";

/**
 * Minimal JSON HTTP helper shared by the vendored integration clients. Keeps
 * each domain client tiny: auth headers + base URL + this fetch wrapper.
 */

export type { HttpJsonOptions } from "./types.ts";
export { HttpError } from "./errors.ts";

function buildUrl(url: string, query?: Record<string, unknown>): string {
  if (!query) return url;
  const u = new URL(url);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) u.searchParams.append(key, stringifyQueryValue(v));
    } else {
      u.searchParams.set(key, stringifyQueryValue(value));
    }
  }
  return u.toString();
}

export async function httpJson<T = unknown>(url: string, opts: HttpJsonOptions = {}): Promise<T> {
  const { method = "GET", headers = {}, query, body, form, timeoutMs = 20_000 } = opts;

  const finalHeaders: Record<string, string> = { Accept: "application/json", ...headers };
  let payload: string | undefined;
  if (body !== undefined) {
    if (form) {
      finalHeaders["Content-Type"] = "application/x-www-form-urlencoded";
      payload = new URLSearchParams(body as Record<string, string>).toString();
    } else {
      finalHeaders["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }

  const response = await fetch(buildUrl(url, query), {
    method,
    headers: finalHeaders,
    body: payload,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new HttpError(response.status, text, `HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/** Turn any thrown error into a short string for a tool result. */
export function toolError(error: unknown, fallback: string): string {
  if (error instanceof HttpError) {
    if (error.status === 401 || error.status === 403) {
      return `${fallback}: not authorized (check the integration's API token).`;
    }
    if (error.status === 429) return `${fallback}: rate limited, try again shortly.`;
    return `${fallback}: ${error.message}`;
  }
  if (error instanceof Error) return `${fallback}: ${error.message}`;
  return fallback;
}
