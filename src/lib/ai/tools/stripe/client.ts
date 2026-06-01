import { env } from "@/env";

import { httpJson, type HttpJsonOptions } from "../_shared/http.ts";

const BASE = "https://api.stripe.com/v1";

export function stripeKey(): string {
  if (!env.STRIPE_API_KEY) throw new Error("STRIPE_API_KEY is not configured.");
  return env.STRIPE_API_KEY;
}

export function stripeRequest<T = unknown>(path: string, opts: HttpJsonOptions = {}): Promise<T> {
  return httpJson<T>(`${BASE}${path}`, {
    ...opts,
    form: opts.body !== undefined ? true : opts.form,
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      "Stripe-Version": "2024-06-20",
      ...opts.headers,
    },
  });
}
