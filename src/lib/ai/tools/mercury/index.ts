import { tool } from "ai";
import { z } from "zod";

import { toolError } from "../_shared/http.ts";
import { mercuryRequest } from "./client.ts";

export const mercury_list_accounts = tool({
  description:
    "List Mercury bank accounts with balances (id, name, type, available/current balance).",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const res = await mercuryRequest<{ accounts: Array<Record<string, unknown>> }>("/accounts");
      const accounts = (res.accounts ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        status: a.status,
        availableBalance: a.availableBalance,
        currentBalance: a.currentBalance,
      }));
      return JSON.stringify({ count: accounts.length, accounts });
    } catch (e) {
      return toolError(e, "Mercury list accounts failed");
    }
  },
});

export const mercury_get_account = tool({
  description:
    "Get a single Mercury account by id, including balances and routing/account number metadata.",
  inputSchema: z.object({ account_id: z.string().describe("Mercury account id") }),
  execute: async ({ account_id }) => {
    try {
      const a = await mercuryRequest<Record<string, unknown>>(`/account/${account_id}`);
      return JSON.stringify(a);
    } catch (e) {
      return toolError(e, "Mercury get account failed");
    }
  },
});

export const mercury_list_transactions = tool({
  description:
    "List transactions for a Mercury account, newest first. Optionally filter by date range and search text. Returns amount, counterparty, status, and date.",
  inputSchema: z.object({
    account_id: z.string().describe("Mercury account id"),
    limit: z.number().int().min(1).max(100).optional().default(25),
    start: z.string().optional().describe("ISO start date"),
    end: z.string().optional().describe("ISO end date"),
    search: z.string().optional().describe("Search counterparty / description"),
  }),
  execute: async ({ account_id, limit, start, end, search }) => {
    try {
      const res = await mercuryRequest<{ transactions: Array<Record<string, unknown>> }>(
        `/account/${account_id}/transactions`,
        { query: { limit, start, end, search } },
      );
      const transactions = (res.transactions ?? []).map((t) => ({
        id: t.id,
        amount: t.amount,
        status: t.status,
        counterparty: t.counterpartyName,
        kind: t.kind,
        date: t.createdAt ?? t.postedAt,
        note: t.note,
      }));
      return JSON.stringify({ count: transactions.length, transactions });
    } catch (e) {
      return toolError(e, "Mercury list transactions failed");
    }
  },
});
