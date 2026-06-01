import type { ApprovalState } from "@/lib/ai/approvals";

/** Build an `ApprovalState` with sensible defaults for store / handler tests. */
export function baseApprovalState(overrides: Partial<ApprovalState> = {}): ApprovalState {
  return {
    id: "a1",
    status: "pending",
    toolName: "doit",
    input: { foo: "bar" },
    reason: "because",
    channelId: "ch-1",
    messageId: "msg-5",
    requesterUserId: "user-1",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}
