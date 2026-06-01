import type { ToolSet } from "ai";

import { createMCPClient } from "@ai-sdk/mcp";

import { env } from "@/env";

// Repogrep is a public MCP server (search across public GitHub repos). Pookie
// integrates it the same way — see millionco/pookie mcp/presets.ts. We connect
// to this single, hardcoded vendor endpoint directly (no MCP management UX).
const REPOGREP_MCP_URL = "https://repogrep.com/api/mcp/mcp";

interface RepogrepHandle {
  tools: ToolSet;
  close: () => Promise<void>;
}

const EMPTY: RepogrepHandle = { tools: {}, close: async () => {} };

/**
 * Open a connection to the Repogrep MCP server and return its tools. Resilient
 * by design: a connection failure yields an empty toolset + no-op close so a
 * turn never breaks just because Repogrep is unreachable.
 *
 * The HTTP transport occasionally 405s; fall back to SSE like Pookie does.
 */
export async function openRepogrepTools(): Promise<RepogrepHandle> {
  const headers = env.REPOGREP_API_KEY
    ? { Authorization: `Bearer ${env.REPOGREP_API_KEY}` }
    : undefined;

  const connect = async (type: "http" | "sse") => {
    const client = await createMCPClient({
      transport: { type, url: REPOGREP_MCP_URL, ...(headers ? { headers } : {}) },
    });
    const tools = (await client.tools()) as unknown as ToolSet;
    return { tools, close: () => client.close() } satisfies RepogrepHandle;
  };

  try {
    return await connect("http");
  } catch (httpError) {
    const methodNotAllowed = httpError instanceof Error && httpError.message.includes("405");
    if (!methodNotAllowed) {
      console.warn("[repogrep] connect failed:", httpError);
      return EMPTY;
    }
    try {
      return await connect("sse");
    } catch (sseError) {
      console.warn("[repogrep] sse connect failed:", sseError);
      return EMPTY;
    }
  }
}
