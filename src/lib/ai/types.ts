import type { ToolSet, UIMessage } from "ai";
import type { z } from "zod";

import type { UserRole } from "./constants.ts";
import type { AgentContext } from "./context.ts";
import type { SkillBundle } from "./skills/types.ts";

export interface ChannelInfo {
  id: string;
  name: string;
}

export interface ThreadInfo {
  id: string;
  name: string;
  parentChannel: ChannelInfo;
}

export interface Attachment {
  url: string;
  filename: string;
  contentType?: string;
}

export interface RecentMessage {
  /** Discord message ID — used to dedupe against other context batches. Not rendered. */
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SerializedAgentContext {
  userId: string;
  username: string;
  nickname: string;
  channel: ChannelInfo;
  thread?: ThreadInfo;
  /**
   * Chat platform this turn runs on. Defaults to `discord` when absent so
   * legacy serialized contexts still deserialize. Controls platform-specific
   * formatting hints and role resolution.
   */
  platform?: "discord" | "slack";
  /**
   * Pre-resolved access tier. The Slack ingress resolves the tier (workspace
   * admin/owner → admin, team members → member) and stores it here. When set,
   * `AgentContext.role` returns it directly.
   */
  resolvedRole?: UserRole;
  /**
   * Chat SDK thread id for Slack turns (`slack:<channel>:<thread_ts>`). Carried
   * so platform-aware features (e.g. tool approval prompts) can post back into
   * the originating Slack thread without re-deriving it.
   */
  slackThreadId?: string;
  date: string;
  /**
   * Current instant as UTC ISO 8601 — the moment the orchestrator was invoked
   * (or for scheduled actions, the moment the handler fired). Injected into
   * the system prompt as `{{NOW_ISO}}` so the LLM never has to guess the time
   * when computing relative schedules like "in 10 minutes". Optional on the
   * serialized form so legacy contexts still deserialize.
   */
  nowISO?: string;
  /**
   * IANA timezone name (e.g. `America/New_York`). Injected as `{{USER_TZ}}`
   * and used as the default tz when interpreting clock times the user types
   * without an explicit zone. Optional on the wire; defaults to
   * `America/New_York` when absent.
   */
  timezone?: string;
  attachments?: Attachment[];
  memberRoles?: string[];
  recentMessages?: RecentMessage[];
  /**
   * True when `recentMessages` were fetched from the thread itself (i.e. the
   * mention that started this workflow was already in a thread). False when
   * they came from a parent channel (a fresh mention that created a new
   * thread). Controls the `<recent_thread_messages>` vs `<recent_channel_messages>`
   * tag in the system prompt so the model isn't told thread context when the
   * lead-in is actually channel chatter.
   */
  recentMessagesFromThread?: boolean;
  /**
   * Extra lead-in fetched when the triggering mention was a reply to another
   * message: the referenced message plus up to 14 messages immediately
   * preceding it, in chronological order. Only set when the reply target is
   * not already included in `recentMessages`.
   */
  referencedContext?: RecentMessage[];
}

/**
 * Usage accounting for a single orchestrator turn. Captured from the AI SDK's
 * `result.totalUsage` plus the subagent metrics accumulator. Stored in the
 * context snapshot so the /inspect-context command can report real, non-estimated
 * token numbers for the last completed turn.
 */
export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  /** Total including subagent tokens; matches the footer value. */
  totalTokens: number;
  subagentTokens: number;
  toolCallCount: number;
  stepCount: number;
  /**
   * Names of tools called during this turn, in call order. Includes both
   * orchestrator-level calls (delegation tools) and subagent-level calls
   * (tools run inside delegated subagents). Surfaced on spans and wide events
   * so operators can see *what* ran, not just *how many*.
   */
  toolNames: string[];
}

export interface ModelInfo {
  id: string;
  provider: string;
  limit: { context: number; output: number };
  cost: { input: number; output: number };
}

/**
 * Builder signature used to inject `experimental_context` into the nested
 * `ToolLoopAgent.stream()` call (e.g. the coding subagent passes
 * `{ sandbox, repoDir, branch, threadKey, repo }` so every code tool's
 * `execute` can resolve the target sandbox).
 */
export type BuildSubagentContext = (input: unknown, agentContext: AgentContext) => unknown;

/**
 * Post-finish hook for subagents that need to do work *after* the nested
 * agent's tool loop completes — e.g. the coding subagent auto-commits,
 * pushes, and opens a PR once the model has stopped editing. Yielded
 * `UIMessage`s are forwarded to the parent's stream so the final Discord
 * output includes the PR URL.
 */
export type SubagentPostFinish = (args: {
  input: unknown;
  agentContext: AgentContext;
  experimentalContext: unknown;
  lastAssistantText: string;
}) => AsyncGenerator<UIMessage, void, void>;

export interface SubagentSpec {
  /** Stable identifier used for telemetry/tracing. */
  name: string;
  /** Short description shown to the orchestrator as the delegation tool's description. */
  description: string;
  /** Full subagent system prompt. `{{SKILL_MENU}}` placeholder is replaced at runtime. */
  systemPrompt: string;
  /** All tools available to the subagent (includes base + skill-gated). */
  tools: ToolSet;
  /** Sub-skill manifest for progressive disclosure within the subagent. */
  subSkills: Record<string, SkillBundle>;
  /** Tool names always visible to the subagent (base tools). */
  baseToolNames: readonly string[];
  /**
   * Environment variables this domain needs to do anything. The delegation
   * tool checks these *before launching* the subagent and returns a clear
   * error when any are missing, so a tool never runs without its credentials.
   */
  requiredEnv?: readonly string[];
  /** Override the default `SUBAGENT_MODEL` (e.g. Claude for coding). */
  model?: string;
  /** Override the default `stepCountIs(15)` cap. */
  stopSteps?: number;
  /**
   * Override the default `{ task: z.string() }` input schema. Required when
   * the delegation tool needs extra structured input (e.g. the code subagent
   * takes `{ repo, task }`).
   */
  inputSchema?: z.ZodType;
  /**
   * Build the `experimental_context` passed to the subagent's
   * `ToolLoopAgent.stream()`. Invoked once per delegation call, before the
   * agent starts, with the tool's validated input + the orchestrator's
   * `AgentContext`. Tools receive the returned object via their
   * `experimental_context` parameter.
   */
  buildExperimentalContext?: BuildSubagentContext;
  /**
   * Runs after the nested `ToolLoopAgent`'s stream is fully drained. The
   * yielded `UIMessage`s are forwarded to the parent stream — used by the
   * coding subagent to commit/push/open a PR and relay the result.
   */
  postFinish?: SubagentPostFinish;
}

/**
 * Telemetry metadata passed through to every AI SDK `experimental_telemetry.metadata`
 * call in an orchestrator + its subagents. Flat key/value pairs; the AI SDK
 * flattens these into `ai.telemetry.metadata.<key>` span attributes so Axiom
 * can query by `chat.id` across the whole conversation. Undefined values are
 * tolerated so callers can build metadata from optional fields without first
 * filtering them out.
 */
export type TelemetryMetadata = Record<string, string | number | undefined>;
