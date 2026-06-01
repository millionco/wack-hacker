import { env } from "@/env";

import { httpJson, type HttpJsonOptions } from "../_shared/http.ts";

const BASE = "https://api.mercury.com/api/v1";

export function mercuryRequest<T = unknown>(path: string, opts: HttpJsonOptions = {}): Promise<T> {
  if (!env.MERCURY_API_TOKEN) throw new Error("MERCURY_API_TOKEN is not configured.");
  return httpJson<T>(`${BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${env.MERCURY_API_TOKEN}`, ...opts.headers },
  });
}
