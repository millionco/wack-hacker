import { env } from "@/env";

import { httpJson, type HttpJsonOptions } from "../_shared/http.ts";

export function posthogHost(): string {
  return (env.POSTHOG_HOST ?? "https://us.posthog.com").replace(/\/+$/, "");
}

export function posthogProjectId(): string {
  if (!env.POSTHOG_PROJECT_ID) {
    throw new Error("POSTHOG_PROJECT_ID is not configured. Use posthog_list_projects to find it.");
  }
  return env.POSTHOG_PROJECT_ID;
}

export function posthogRequest<T = unknown>(path: string, opts: HttpJsonOptions = {}): Promise<T> {
  if (!env.POSTHOG_API_KEY) throw new Error("POSTHOG_API_KEY is not configured.");
  return httpJson<T>(`${posthogHost()}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${env.POSTHOG_API_KEY}`, ...opts.headers },
  });
}
