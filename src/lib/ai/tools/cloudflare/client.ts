import { env } from "@/env";

import { httpJson, type HttpJsonOptions } from "../_shared/http.ts";

const BASE = "https://api.cloudflare.com/client/v4";

export function cloudflareAccountId(): string {
  if (!env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is not configured.");
  }
  return env.CLOUDFLARE_ACCOUNT_ID;
}

export function cloudflareRequest<T = unknown>(
  path: string,
  opts: HttpJsonOptions = {},
): Promise<T> {
  if (!env.CLOUDFLARE_API_TOKEN) throw new Error("CLOUDFLARE_API_TOKEN is not configured.");
  return httpJson<T>(`${BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, ...opts.headers },
  });
}
