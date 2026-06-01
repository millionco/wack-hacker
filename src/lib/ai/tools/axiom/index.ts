import { tool } from "ai";
import { z } from "zod";

import { toolError } from "../_shared/http.ts";
import { axiomRequest } from "./client.ts";

export const axiom_list_datasets = tool({
  description:
    "List Axiom datasets (name, description). Use to discover what log/event data is available before querying.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const res = await axiomRequest<Array<Record<string, unknown>>>("/datasets");
      const datasets = (res ?? []).map((d) => ({ name: d.name, description: d.description }));
      return JSON.stringify({ count: datasets.length, datasets });
    } catch (e) {
      return toolError(e, "Axiom list datasets failed");
    }
  },
});

export const axiom_query = tool({
  description:
    'Run an APL (Axiom Processing Language) query over a dataset. Use for logs, error rates, latency, and grouped counts. Include the dataset name in the APL (e.g. ["vercel"] | where status >= 500 | summarize count() by bin_auto(_time)).',
  inputSchema: z.object({
    apl: z
      .string()
      .describe("APL query. Must reference the dataset, e.g. ['my-dataset'] | where ..."),
    start_time: z.string().optional().describe("ISO start (default: 1h ago)"),
    end_time: z.string().optional().describe("ISO end (default: now)"),
  }),
  execute: async ({ apl, start_time, end_time }) => {
    try {
      const now = Date.now();
      const res = await axiomRequest<Record<string, unknown>>("/datasets/_apl", {
        method: "POST",
        query: { format: "tabular" },
        body: {
          apl,
          startTime: start_time ?? new Date(now - 60 * 60 * 1000).toISOString(),
          endTime: end_time ?? new Date(now).toISOString(),
        },
      });
      // Trim the response to the useful bits (tables/matches) to keep it small.
      const tables = (res as { tables?: unknown }).tables;
      const matches = (res as { matches?: unknown }).matches;
      return JSON.stringify({ tables, matches }).slice(0, 12_000);
    } catch (e) {
      return toolError(e, "Axiom query failed");
    }
  },
});
