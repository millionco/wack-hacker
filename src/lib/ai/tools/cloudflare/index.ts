import { tool } from "ai";
import { z } from "zod";

import { approval } from "../../approvals/index.ts";
import { toolError } from "../_shared/http.ts";
import { cloudflareAccountId, cloudflareRequest } from "./client.ts";

interface CfEnvelope<T> {
  success: boolean;
  result: T;
  errors?: Array<{ message?: string }>;
}

async function resolveZoneId(zone: string): Promise<string> {
  if (/^[a-f0-9]{32}$/i.test(zone)) return zone;
  const res = await cloudflareRequest<CfEnvelope<Array<{ id: string; name: string }>>>("/zones", {
    query: { name: zone },
  });
  const id = res.result?.[0]?.id;
  if (!id) throw new Error(`No Cloudflare zone found for "${zone}"`);
  return id;
}

export const cloudflare_list_zones = tool({
  description:
    "List Cloudflare zones (domains) with id, name, and status. Use to find a zone id for DNS/cache operations.",
  inputSchema: z.object({
    filter: z.string().optional().describe("Substring filter on zone name"),
  }),
  execute: async ({ filter }) => {
    try {
      const res = await cloudflareRequest<CfEnvelope<Array<Record<string, unknown>>>>("/zones", {
        query: { per_page: 50, ...(filter ? { name: filter } : {}) },
      });
      const zones = res.result.map((z) => ({ id: z.id, name: z.name, status: z.status }));
      return JSON.stringify({ count: zones.length, zones });
    } catch (e) {
      return toolError(e, "Cloudflare list zones failed");
    }
  },
});

export const cloudflare_list_dns_records = tool({
  description:
    "List DNS records for a Cloudflare zone (type, name, content, proxied). Zone may be a name or id.",
  inputSchema: z.object({
    zone: z.string().describe("Zone name (example.com) or zone id"),
    type: z.string().optional().describe("Filter by record type (A, CNAME, TXT, ...)"),
  }),
  execute: async ({ zone, type }) => {
    try {
      const zoneId = await resolveZoneId(zone);
      const res = await cloudflareRequest<CfEnvelope<Array<Record<string, unknown>>>>(
        `/zones/${zoneId}/dns_records`,
        { query: { per_page: 100, type } },
      );
      const records = res.result.map((r) => ({
        id: r.id,
        type: r.type,
        name: r.name,
        content: r.content,
        proxied: r.proxied,
        ttl: r.ttl,
      }));
      return JSON.stringify({ count: records.length, records });
    } catch (e) {
      return toolError(e, "Cloudflare list DNS records failed");
    }
  },
});

export const cloudflare_create_dns_record = approval(
  tool({
    description: "Create a DNS record in a Cloudflare zone. Requires approval.",
    inputSchema: z.object({
      zone: z.string().describe("Zone name or id"),
      type: z.string().describe("Record type (A, AAAA, CNAME, TXT, ...)"),
      name: z.string().describe("Record name (e.g. www or www.example.com)"),
      content: z.string().describe("Record content (IP, target, or text)"),
      proxied: z.boolean().optional().default(false),
      ttl: z.number().int().optional().default(1),
    }),
    execute: async ({ zone, type, name, content, proxied, ttl }) => {
      try {
        const zoneId = await resolveZoneId(zone);
        const res = await cloudflareRequest<CfEnvelope<Record<string, unknown>>>(
          `/zones/${zoneId}/dns_records`,
          { method: "POST", body: { type, name, content, proxied, ttl } },
        );
        return JSON.stringify({ ok: res.success, id: res.result?.id });
      } catch (e) {
        return toolError(e, "Cloudflare create DNS record failed");
      }
    },
  }),
);

export const cloudflare_list_workers = tool({
  description: "List Cloudflare Workers scripts in the account (name, created/modified).",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const res = await cloudflareRequest<CfEnvelope<Array<Record<string, unknown>>>>(
        `/accounts/${cloudflareAccountId()}/workers/scripts`,
      );
      const workers = res.result.map((w) => ({
        id: w.id,
        createdOn: w.created_on,
        modifiedOn: w.modified_on,
      }));
      return JSON.stringify({ count: workers.length, workers });
    } catch (e) {
      return toolError(e, "Cloudflare list workers failed");
    }
  },
});

export const cloudflare_purge_cache = approval(
  tool({
    description:
      "Purge Cloudflare cache for a zone — everything, or specific URLs. Requires approval.",
    inputSchema: z.object({
      zone: z.string().describe("Zone name or id"),
      urls: z
        .array(z.string())
        .optional()
        .describe("Specific URLs to purge; omit to purge everything"),
    }),
    execute: async ({ zone, urls }) => {
      try {
        const zoneId = await resolveZoneId(zone);
        const body = urls?.length ? { files: urls } : { purge_everything: true };
        const res = await cloudflareRequest<CfEnvelope<Record<string, unknown>>>(
          `/zones/${zoneId}/purge_cache`,
          { method: "POST", body },
        );
        return JSON.stringify({
          ok: res.success,
          purged: urls?.length ? urls.length : "everything",
        });
      } catch (e) {
        return toolError(e, "Cloudflare purge cache failed");
      }
    },
  }),
);
