import { tool } from "ai";
import { z } from "zod";

import { toolError } from "../_shared/http.ts";
import { posthogProjectId, posthogRequest } from "./client.ts";

interface Paged<T> {
  results: T[];
  count?: number;
}

export const posthog_list_projects = tool({
  description:
    "List PostHog projects available to the API key (id, name, organization). Use to find the project id.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const res = await posthogRequest<Paged<Record<string, unknown>>>("/api/projects/");
      const projects = res.results.map((p) => ({
        id: p.id,
        name: p.name,
        organization: p.organization,
      }));
      return JSON.stringify({ count: projects.length, projects });
    } catch (e) {
      return toolError(e, "PostHog list projects failed");
    }
  },
});

export const posthog_list_insights = tool({
  description:
    "List saved PostHog insights (id, name, description). Use to discover existing analyses before querying.",
  inputSchema: z.object({
    search: z.string().optional().describe("Filter insights by name"),
    limit: z.number().int().min(1).max(50).optional().default(20),
  }),
  execute: async ({ search, limit }) => {
    try {
      const res = await posthogRequest<Paged<Record<string, unknown>>>(
        `/api/projects/${posthogProjectId()}/insights/`,
        { query: { search, limit } },
      );
      const insights = res.results.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
      }));
      return JSON.stringify({ count: insights.length, insights });
    } catch (e) {
      return toolError(e, "PostHog list insights failed");
    }
  },
});

export const posthog_get_insight = tool({
  description: "Get a PostHog insight by short id, including its current result data.",
  inputSchema: z.object({ insight_id: z.string().describe("Insight short id") }),
  execute: async ({ insight_id }) => {
    try {
      const res = await posthogRequest<Record<string, unknown>>(
        `/api/projects/${posthogProjectId()}/insights/`,
        { query: { short_id: insight_id } },
      );
      return JSON.stringify(res);
    } catch (e) {
      return toolError(e, "PostHog get insight failed");
    }
  },
});

export const posthog_list_feature_flags = tool({
  description:
    "List PostHog feature flags (key, name, active, rollout). Use to check what's enabled.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(100).optional().default(50),
  }),
  execute: async ({ limit }) => {
    try {
      const res = await posthogRequest<Paged<Record<string, unknown>>>(
        `/api/projects/${posthogProjectId()}/feature_flags/`,
        { query: { limit } },
      );
      const flags = res.results.map((f) => ({ key: f.key, name: f.name, active: f.active }));
      return JSON.stringify({ count: flags.length, flags });
    } catch (e) {
      return toolError(e, "PostHog list feature flags failed");
    }
  },
});

export const posthog_query = tool({
  description:
    "Run a HogQL query against PostHog (SQL-like). Use for custom analytics: event counts, funnels-as-SQL, property breakdowns. Returns columns + rows.",
  inputSchema: z.object({
    hogql: z
      .string()
      .describe("A HogQL SELECT query, e.g. SELECT count() FROM events WHERE event = '$pageview'"),
  }),
  execute: async ({ hogql }) => {
    try {
      const res = await posthogRequest<Record<string, unknown>>(
        `/api/projects/${posthogProjectId()}/query/`,
        { method: "POST", body: { query: { kind: "HogQLQuery", query: hogql } } },
      );
      return JSON.stringify({ columns: res.columns, results: res.results });
    } catch (e) {
      return toolError(e, "PostHog query failed");
    }
  },
});
