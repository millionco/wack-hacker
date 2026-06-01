import { tool } from "ai";
import { z } from "zod";

import { approval } from "../../approvals/index.ts";
import { toolError } from "../_shared/http.ts";
import { stripeRequest } from "./client.ts";

interface StripeList<T> {
  data: T[];
  has_more?: boolean;
}

const limit = z.number().int().min(1).max(50).optional().default(10);

export const stripe_search_customers = tool({
  description:
    'Search Stripe customers by email, name, or metadata. Returns id, email, name, created, and balance. Use email:"x@y.com" style clauses.',
  inputSchema: z.object({
    query: z.string().describe('Stripe search query, e.g. email:"a@b.com" or name:"Acme"'),
    limit,
  }),
  execute: async ({ query, limit: lim }) => {
    try {
      const res = await stripeRequest<StripeList<Record<string, unknown>>>("/customers/search", {
        query: { query, limit: lim },
      });
      const customers = res.data.map((c) => ({
        id: c.id,
        email: c.email,
        name: c.name,
        created: c.created,
        balance: c.balance,
      }));
      return JSON.stringify({ count: customers.length, customers });
    } catch (e) {
      return toolError(e, "Stripe customer search failed");
    }
  },
});

export const stripe_get_customer = tool({
  description: "Get a Stripe customer by ID, including subscriptions summary.",
  inputSchema: z.object({ customer_id: z.string().describe("Stripe customer id (cus_...)") }),
  execute: async ({ customer_id }) => {
    try {
      const c = await stripeRequest<Record<string, unknown>>(`/customers/${customer_id}`, {
        query: { "expand[]": "subscriptions" },
      });
      return JSON.stringify(c);
    } catch (e) {
      return toolError(e, "Stripe get customer failed");
    }
  },
});

export const stripe_list_subscriptions = tool({
  description: "List Stripe subscriptions, optionally filtered by customer and/or status.",
  inputSchema: z.object({
    customer_id: z.string().optional(),
    status: z
      .enum(["active", "past_due", "canceled", "trialing", "unpaid", "all"])
      .optional()
      .default("all"),
    limit,
  }),
  execute: async ({ customer_id, status, limit: lim }) => {
    try {
      const res = await stripeRequest<StripeList<Record<string, unknown>>>("/subscriptions", {
        query: { customer: customer_id, status, limit: lim },
      });
      const subs = res.data.map((s) => ({
        id: s.id,
        customer: s.customer,
        status: s.status,
        current_period_end: s.current_period_end,
        cancel_at_period_end: s.cancel_at_period_end,
      }));
      return JSON.stringify({ count: subs.length, subscriptions: subs });
    } catch (e) {
      return toolError(e, "Stripe list subscriptions failed");
    }
  },
});

export const stripe_list_invoices = tool({
  description: "List Stripe invoices, optionally filtered by customer and/or status.",
  inputSchema: z.object({
    customer_id: z.string().optional(),
    status: z.enum(["draft", "open", "paid", "uncollectible", "void"]).optional(),
    limit,
  }),
  execute: async ({ customer_id, status, limit: lim }) => {
    try {
      const res = await stripeRequest<StripeList<Record<string, unknown>>>("/invoices", {
        query: { customer: customer_id, status, limit: lim },
      });
      const invoices = res.data.map((i) => ({
        id: i.id,
        customer: i.customer,
        status: i.status,
        total: i.total,
        currency: i.currency,
        hosted_invoice_url: i.hosted_invoice_url,
        due_date: i.due_date,
      }));
      return JSON.stringify({ count: invoices.length, invoices });
    } catch (e) {
      return toolError(e, "Stripe list invoices failed");
    }
  },
});

export const stripe_get_balance = tool({
  description: "Get the current Stripe account balance (available and pending, per currency).",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const b = await stripeRequest<Record<string, unknown>>("/balance");
      return JSON.stringify({ available: b.available, pending: b.pending });
    } catch (e) {
      return toolError(e, "Stripe get balance failed");
    }
  },
});

export const stripe_list_recent_events = tool({
  description:
    "List recent Stripe events (webhooks/activity), optionally filtered by type (e.g. invoice.payment_failed).",
  inputSchema: z.object({
    type: z.string().optional().describe("Event type filter, e.g. charge.failed"),
    limit,
  }),
  execute: async ({ type, limit: lim }) => {
    try {
      const res = await stripeRequest<StripeList<Record<string, unknown>>>("/events", {
        query: { type, limit: lim },
      });
      const events = res.data.map((e) => ({ id: e.id, type: e.type, created: e.created }));
      return JSON.stringify({ count: events.length, events });
    } catch (e) {
      return toolError(e, "Stripe list events failed");
    }
  },
});

export const stripe_create_refund = approval(
  tool({
    description:
      "Refund a Stripe charge or payment intent. Money movement — requires approval. Optionally partial via amount (in cents).",
    inputSchema: z.object({
      charge_id: z.string().optional().describe("Charge id (ch_...)"),
      payment_intent_id: z.string().optional().describe("Payment intent id (pi_...)"),
      amount: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Partial amount in cents; omit for full refund"),
      reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).optional(),
    }),
    execute: async ({ charge_id, payment_intent_id, amount, reason }) => {
      if (!charge_id && !payment_intent_id)
        return "Provide a charge_id or payment_intent_id to refund.";
      try {
        const body: Record<string, string> = {};
        if (charge_id) body.charge = charge_id;
        if (payment_intent_id) body.payment_intent = payment_intent_id;
        if (amount) body.amount = String(amount);
        if (reason) body.reason = reason;
        const refund = await stripeRequest<Record<string, unknown>>("/refunds", {
          method: "POST",
          body,
        });
        return JSON.stringify({ id: refund.id, status: refund.status, amount: refund.amount });
      } catch (e) {
        return toolError(e, "Stripe refund failed");
      }
    },
  }),
);

export const stripe_cancel_subscription = approval(
  tool({
    description: "Cancel a Stripe subscription, immediately or at period end. Requires approval.",
    inputSchema: z.object({
      subscription_id: z.string().describe("Subscription id (sub_...)"),
      at_period_end: z
        .boolean()
        .default(true)
        .describe("Cancel at period end (true) vs immediately (false)"),
    }),
    execute: async ({ subscription_id, at_period_end }) => {
      try {
        const sub = at_period_end
          ? await stripeRequest<Record<string, unknown>>(`/subscriptions/${subscription_id}`, {
              method: "POST",
              body: { cancel_at_period_end: "true" },
            })
          : await stripeRequest<Record<string, unknown>>(`/subscriptions/${subscription_id}`, {
              method: "DELETE",
            });
        return JSON.stringify({
          id: sub.id,
          status: sub.status,
          cancel_at_period_end: sub.cancel_at_period_end,
        });
      } catch (e) {
        return toolError(e, "Stripe cancel subscription failed");
      }
    },
  }),
);
