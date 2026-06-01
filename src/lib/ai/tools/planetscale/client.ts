import { env } from "@/env";

import { httpJson, type HttpJsonOptions } from "../_shared/http.ts";

const BASE = "https://api.planetscale.com/v1";

export function planetscaleOrg(): string {
  if (!env.PLANETSCALE_ORG) throw new Error("PLANETSCALE_ORG is not configured.");
  return env.PLANETSCALE_ORG;
}

export function planetscaleRequest<T = unknown>(
  path: string,
  opts: HttpJsonOptions = {},
): Promise<T> {
  if (!env.PLANETSCALE_SERVICE_TOKEN_ID || !env.PLANETSCALE_SERVICE_TOKEN) {
    throw new Error(
      "PLANETSCALE_SERVICE_TOKEN_ID and PLANETSCALE_SERVICE_TOKEN must be configured.",
    );
  }
  return httpJson<T>(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `${env.PLANETSCALE_SERVICE_TOKEN_ID}:${env.PLANETSCALE_SERVICE_TOKEN}`,
      ...opts.headers,
    },
  });
}
