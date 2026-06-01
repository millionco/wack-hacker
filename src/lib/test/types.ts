import type { Mock } from "vitest";

import type {
  CreateCodingSandboxConfig,
  ExecOptions,
  ExecResult,
  Sandbox,
  SandboxHooks,
  SandboxProvider,
  VercelSandboxReconnectOptions,
} from "@/lib/sandbox/types";

export type FetchImpl = (url: URL) => Response | Promise<Response>;

export interface NotionClientMocks {
  dataSourcesQuery?: Mock;
  dataSourcesRetrieve?: Mock;
  pagesRetrieve?: Mock;
  pagesUpdate?: Mock;
  pagesCreate?: Mock;
  usersList?: Mock;
  search?: Mock;
  databasesRetrieve?: Mock;
}

// ─── sandbox test fixtures ────────────────────────────────────────────────

export type ExecHandler = (
  command: string,
  options: Required<Pick<ExecOptions, "cwd">> & ExecOptions,
) => Promise<ExecResult> | ExecResult;

export interface InMemorySandboxOptions {
  name?: string;
  workingDirectory?: string;
  currentBranch?: string;
  hooks?: SandboxHooks;
  /** Custom exec handler — default returns exit 0 with empty output. */
  execHandler?: ExecHandler;
  /** Seed files: path (absolute) → content. */
  files?: Record<string, string>;
}

export interface TestSandboxProviderOptions {
  /** Override the default `sb-<n>` name assigned to fresh sandboxes. */
  name?: string;
  /** Pre-wire the first reconnect to throw. */
  reconnectFails?: boolean;
  /** Default exec handler for every sandbox the provider mints. */
  execHandler?: ExecHandler;
}

export interface TestSandboxProvider {
  provider: SandboxProvider;
  createCalls: CreateCodingSandboxConfig[];
  reconnectCalls: { id: string; options: VercelSandboxReconnectOptions }[];
  stoppedIds: string[];
  sandboxesById: Map<string, Sandbox>;
  failReconnectOnce: () => void;
}
