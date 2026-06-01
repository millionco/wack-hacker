import { env } from "@/env";

import { httpJson, type HttpJsonOptions } from "../_shared/http.ts";

const BASE = "https://api.axiom.co/v1";

export function axiomRequest<T = unknown>(path: string, opts: HttpJsonOptions = {}): Promise<T> {
  if (!env.AXIOM_API_TOKEN) throw new Error("AXIOM_API_TOKEN is not configured.");
  return httpJson<T>(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${env.AXIOM_API_TOKEN}`,
      ...(env.AXIOM_ORG_ID ? { "X-Axiom-Org-Id": env.AXIOM_ORG_ID } : {}),
      ...opts.headers,
    },
  });
}
