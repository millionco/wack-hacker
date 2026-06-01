import { ToolLoopAgent, type ToolSet } from "ai";

import type { TurnUsageTracker } from "./turn-usage.ts";
import type { TelemetryMetadata } from "./types.ts";

import { wrapApprovalTools } from "./approvals/index.ts";
import { ORCHESTRATOR_MODEL, SYSTEM_PROMPT } from "./constants.ts";
import { AgentContext } from "./context.ts";
import { buildDelegationTools } from "./delegates.ts";
import { createScheduleTask, list_scheduled_tasks, cancel_task } from "./tools/schedule/index.ts";

export { ORCHESTRATOR_MODEL, SYSTEM_PROMPT } from "./constants.ts";

/**
 * Build the exact orchestrator tool surface for the scheduler's context.
 * Exported so the context inspector can snapshot the same tool set the
 * orchestrator runs with. Takes the full `AgentContext` because role-aware
 * tools (delegates, schedule_task) need both the resolved role and the
 * scheduler's `memberRoles` for propagation into persisted task meta.
 *
 * `extraMetadata` flows through to every delegation subagent so the whole
 * chat trace shares `chat.*` attributes without baggage plumbing.
 */
export function getOrchestratorTools(
  context: AgentContext,
  tracker: TurnUsageTracker,
  extraMetadata?: TelemetryMetadata,
): ToolSet {
  const tools: ToolSet = {
    schedule_task: createScheduleTask(context),
    list_scheduled_tasks,
    cancel_task,
    ...buildDelegationTools(context, tracker, extraMetadata),
  };
  return wrapApprovalTools(tools, { context });
}

export function createOrchestrator(
  context: AgentContext,
  tracker: TurnUsageTracker,
  extraMetadata?: TelemetryMetadata,
  options?: { systemPrompt?: string; extraTools?: ToolSet },
) {
  const instructions = context.buildInstructions(options?.systemPrompt ?? SYSTEM_PROMPT);
  const tools: ToolSet = {
    ...getOrchestratorTools(context, tracker, extraMetadata),
    ...options?.extraTools,
  };

  return new ToolLoopAgent({
    model: ORCHESTRATOR_MODEL,
    instructions,
    tools,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "orchestrator",
      metadata: {
        role: context.role,
        ...extraMetadata,
      },
    },
  });
}
