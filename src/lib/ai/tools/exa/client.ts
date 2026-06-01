import Exa from "exa-js";

import { env } from "@/env";

let cached: Exa | undefined;

export function exaClient(): Exa {
  if (!env.EXA_API_KEY) {
    throw new Error("EXA_API_KEY is not configured.");
  }
  return (cached ??= new Exa(env.EXA_API_KEY));
}

interface ExaResultLike {
  title?: string | null;
  url: string;
  publishedDate?: string;
  author?: string;
  text?: string;
  highlights?: string[];
}

export function formatExaResults(results: ExaResultLike[]): string {
  if (results.length === 0) return "No results found.";
  return results
    .map((r, i) => {
      const date = r.publishedDate ? ` (${r.publishedDate.slice(0, 10)})` : "";
      const snippet =
        r.highlights && r.highlights.length > 0
          ? r.highlights.join(" … ")
          : r.text
            ? r.text.slice(0, 500)
            : "(no preview)";
      return `${i + 1}. ${r.title ?? "Untitled"}${date}\n${r.url}\n${snippet}`;
    })
    .join("\n\n");
}
