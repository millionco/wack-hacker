import { tool } from "ai";
import { z } from "zod";

import { exaClient, formatExaResults } from "./client.ts";

const numResults = z.number().int().min(1).max(15).optional().default(6);

export const exa_search = tool({
  description:
    "Search the web with Exa. Use for current events, external docs, company/product info, or anything not in internal tools. Returns titles, URLs, and snippets.",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
    num_results: numResults,
    type: z.enum(["auto", "neural", "keyword"]).optional().default("auto"),
    start_published_date: z.string().optional().describe("ISO date — only results published after"),
    include_domains: z.array(z.string()).optional().describe("Restrict to these domains"),
  }),
  execute: async ({ query, num_results, type, start_published_date, include_domains }) => {
    try {
      const res = await exaClient().searchAndContents(query, {
        numResults: num_results,
        type,
        ...(start_published_date ? { startPublishedDate: start_published_date } : {}),
        ...(include_domains?.length ? { includeDomains: include_domains } : {}),
        text: { maxCharacters: 1500 },
        highlights: { numSentences: 3, highlightsPerUrl: 2 },
      });
      return formatExaResults(res.results);
    } catch (e) {
      return `Exa search failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
});

export const exa_get_contents = tool({
  description:
    "Fetch and summarize the contents of one or more URLs via Exa. Use to read an article, doc, or page the user referenced.",
  inputSchema: z.object({
    urls: z.array(z.string()).min(1).max(10).describe("URLs to fetch"),
  }),
  execute: async ({ urls }) => {
    try {
      const res = await exaClient().getContents(urls, {
        text: { maxCharacters: 3000 },
        highlights: { numSentences: 5, highlightsPerUrl: 3 },
      });
      return formatExaResults(res.results);
    } catch (e) {
      return `Exa get-contents failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
});

export const exa_find_similar = tool({
  description:
    "Find pages similar to a given URL via Exa. Use for alternatives, competitors, or related docs.",
  inputSchema: z.object({
    url: z.string().describe("Reference URL"),
    num_results: numResults,
  }),
  execute: async ({ url, num_results }) => {
    try {
      const res = await exaClient().findSimilarAndContents(url, {
        numResults: num_results,
        text: { maxCharacters: 1000 },
        highlights: { numSentences: 2, highlightsPerUrl: 2 },
      });
      return formatExaResults(res.results);
    } catch (e) {
      return `Exa find-similar failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
});
