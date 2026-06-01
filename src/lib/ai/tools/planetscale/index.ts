import { tool } from "ai";
import { z } from "zod";

import { toolError } from "../_shared/http.ts";
import { planetscaleOrg, planetscaleRequest } from "./client.ts";

interface PsList<T> {
  data: T[];
}

export const planetscale_list_databases = tool({
  description: "List PlanetScale databases in the org (name, state, region, default branch).",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const res = await planetscaleRequest<PsList<Record<string, unknown>>>(
        `/organizations/${planetscaleOrg()}/databases`,
      );
      const databases = (res.data ?? []).map((d) => ({
        name: d.name,
        state: d.state,
        region: (d.region as { slug?: string } | undefined)?.slug,
        defaultBranch: d.default_branch,
      }));
      return JSON.stringify({ count: databases.length, databases });
    } catch (e) {
      return toolError(e, "PlanetScale list databases failed");
    }
  },
});

export const planetscale_list_branches = tool({
  description:
    "List branches for a PlanetScale database (name, production flag, ready state, parent).",
  inputSchema: z.object({ database: z.string().describe("Database name") }),
  execute: async ({ database }) => {
    try {
      const res = await planetscaleRequest<PsList<Record<string, unknown>>>(
        `/organizations/${planetscaleOrg()}/databases/${database}/branches`,
      );
      const branches = (res.data ?? []).map((b) => ({
        name: b.name,
        production: b.production,
        ready: b.ready,
        parentBranch: b.parent_branch,
      }));
      return JSON.stringify({ count: branches.length, branches });
    } catch (e) {
      return toolError(e, "PlanetScale list branches failed");
    }
  },
});

export const planetscale_list_deploy_requests = tool({
  description:
    "List deploy requests for a PlanetScale database (number, state, branch -> into, deployed).",
  inputSchema: z.object({
    database: z.string().describe("Database name"),
    state: z.enum(["open", "closed", "all"]).optional().default("open"),
  }),
  execute: async ({ database, state }) => {
    try {
      const res = await planetscaleRequest<PsList<Record<string, unknown>>>(
        `/organizations/${planetscaleOrg()}/databases/${database}/deploy-requests`,
        { query: { state } },
      );
      const deployRequests = (res.data ?? []).map((d) => ({
        number: d.number,
        state: d.state,
        branch: d.branch,
        intoBranch: d.into_branch,
        deployed: d.deployed_at,
      }));
      return JSON.stringify({ count: deployRequests.length, deployRequests });
    } catch (e) {
      return toolError(e, "PlanetScale list deploy requests failed");
    }
  },
});

export const planetscale_get_deploy_request = tool({
  description:
    "Get a PlanetScale deploy request by number, including its state and deployment details.",
  inputSchema: z.object({
    database: z.string().describe("Database name"),
    number: z.number().int().describe("Deploy request number"),
  }),
  execute: async ({ database, number }) => {
    try {
      const dr = await planetscaleRequest<Record<string, unknown>>(
        `/organizations/${planetscaleOrg()}/databases/${database}/deploy-requests/${number}`,
      );
      return JSON.stringify(dr);
    } catch (e) {
      return toolError(e, "PlanetScale get deploy request failed");
    }
  },
});
