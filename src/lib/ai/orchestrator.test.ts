import type { MockLanguageModelV3 } from "ai/test";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  contextForRole,
  installMockProvider,
  linearClientClass,
  notionClientClass,
  octokitClass,
  streamingTextModel,
  uninstallMockProvider,
} from "@/lib/test/fixtures";

import { UserRole } from "./constants.ts";
import { AgentContext } from "./context.ts";
import { TurnUsageTracker } from "./turn-usage.ts";

// Third-party SDK mocks — neutralize clients that our tool modules
// instantiate at import time so the real tool definitions load safely.
vi.mock("@linear/sdk", () => ({ LinearClient: linearClientClass() }));
vi.mock("octokit", () => ({ Octokit: octokitClass() }));
vi.mock("@octokit/auth-app", () => ({ createAppAuth: vi.fn(() => ({})) }));
vi.mock("@notionhq/client", () => ({ Client: notionClientClass() }));
vi.mock("workflow/api", () => ({
  start: vi.fn().mockResolvedValue({ runId: "run-test" }),
  getRun: vi.fn(() => ({ cancel: vi.fn().mockResolvedValue(undefined) })),
}));
vi.mock("@vercel/sandbox", () => ({
  Sandbox: class MockSandbox {},
}));

const { createOrchestrator } = await import("./orchestrator.ts");

const BASE_TOOLS = ["cancel_task", "list_scheduled_tasks", "schedule_task"];

describe("createOrchestrator", () => {
  let model: MockLanguageModelV3;

  beforeEach(() => {
    model = streamingTextModel("hi");
    installMockProvider(model);
  });

  afterEach(() => {
    uninstallMockProvider();
  });

  async function drain(ctx: AgentContext) {
    const agent = createOrchestrator(ctx, new TurnUsageTracker());
    const result = await agent.stream({ prompt: "say hi" });
    const reader = result.toUIMessageStream().getReader();
    while (!(await reader.read()).done);
  }

  function getToolNames(): string[] {
    const call = model.doStreamCalls[0]!;
    return (call.tools ?? [])
      .map((t) => (t as { name?: string }).name)
      .filter((n): n is string => typeof n === "string")
      .sort();
  }

  it("gives public users only base tools (all delegate skills require member+)", async () => {
    const ctx = contextForRole(UserRole.Public);
    await drain(ctx);

    expect(getToolNames()).toEqual(BASE_TOOLS.sort());
  });

  it("includes delegation tools for users with the member role", async () => {
    const ctx = contextForRole(UserRole.Member);
    await drain(ctx);

    const tools = getToolNames();
    expect(tools).toEqual(
      expect.arrayContaining([
        ...BASE_TOOLS,
        "delegate_slack",
        "delegate_github",
        "delegate_linear",
        "delegate_notion",
        "delegate_sentry",
        "delegate_vercel",
        "delegate_stripe",
        "delegate_exa",
      ]),
    );
  });

  it("injects execution context into system prompt via buildInstructions", async () => {
    const ctx = AgentContext.fromSlack({
      userId: "U1",
      username: "alice",
      channel: { id: "C1", name: "general" },
      role: UserRole.Member,
    });
    await drain(ctx);

    const call = model.doStreamCalls[0]!;
    const system = call.prompt.find((m) => m.role === "system");
    const systemContent =
      typeof system?.content === "string" ? system.content : JSON.stringify(system?.content);
    expect(systemContent).toContain("<execution_context>");
    expect(systemContent).toContain('username: "alice"');
    expect(systemContent).not.toContain("{{DATE}}");
  });
});
