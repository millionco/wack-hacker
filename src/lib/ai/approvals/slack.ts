import type { ApprovalState } from "./types.ts";

import { slackWebClient } from "../tools/slack/client.ts";
import { formatToolCall } from "./helpers.ts";

type DecidedStatus = Exclude<ApprovalState["status"], "pending">;

const STATUS_LABEL: Record<DecidedStatus, string> = {
  approved: ":white_check_mark: Approved",
  denied: ":x: Denied",
  timeout: ":hourglass: Timed out",
};

/** Decode a Chat SDK Slack thread id `slack:<channel>:<thread_ts>`. */
function decodeSlackThreadId(id: string | undefined): { channel?: string; threadTs?: string } {
  if (!id) return {};
  const parts = id.split(":");
  if (parts[0] !== "slack") return {};
  return { channel: parts[1], threadTs: parts[2] };
}

interface PostSlackApprovalArgs {
  approvalId: string;
  slackThreadId: string | undefined;
  channelId: string;
  requesterUserId: string;
  delegateName?: string;
  toolName: string;
  input: unknown;
  reason: string;
  timeoutMs: number;
}

/**
 * Post a Slack approval prompt with Approve/Deny buttons into the originating
 * thread. The button `action_id`s are `tool-approval:<approve|deny>:<id>`,
 * routed by the catch-all `onAction` handler in the Slack bot. Returns the
 * message ts so the wrapper can converge it after a decision.
 */
export async function postSlackApproval(args: PostSlackApprovalArgs): Promise<{ id: string }> {
  const client = slackWebClient();
  const { channel, threadTs } = decodeSlackThreadId(args.slackThreadId);
  const callStr = formatToolCall(args.delegateName, args.toolName, args.input);
  const minutes = Math.max(1, Math.round(args.timeoutMs / 60_000));

  const res = await client.chat.postMessage({
    channel: channel ?? args.channelId,
    ...(threadTs ? { thread_ts: threadTs } : {}),
    text: `Permission requested by <@${args.requesterUserId}>: ${args.toolName}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:passport_control: *Permission requested* — <@${args.requesterUserId}>\n\`\`\`${callStr}\`\`\`\n*Reason:* ${args.reason || "(not provided)"}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            style: "primary",
            text: { type: "plain_text", text: "Approve" },
            action_id: `tool-approval:approve:${args.approvalId}`,
            value: args.approvalId,
          },
          {
            type: "button",
            style: "danger",
            text: { type: "plain_text", text: "Deny" },
            action_id: `tool-approval:deny:${args.approvalId}`,
            value: args.approvalId,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Only the requester can approve · auto-denies in ${minutes}m`,
          },
        ],
      },
    ],
  });

  const ts = res.ts;
  if (!ts) throw new Error("Slack approval post returned no ts");
  return { id: ts };
}

/** Rewrite the approval message into its terminal decision state (no buttons). */
export async function convergeSlackApproval(state: ApprovalState): Promise<void> {
  if (!state.messageId || state.status === "pending") return;
  const client = slackWebClient();
  const callStr = formatToolCall(state.delegateName, state.toolName, state.input);
  const decidedBy =
    state.status !== "timeout" && state.decidedByUserId ? ` by <@${state.decidedByUserId}>` : "";

  await client.chat.update({
    channel: state.channelId,
    ts: state.messageId,
    text: `${STATUS_LABEL[state.status]}: ${state.toolName}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${STATUS_LABEL[state.status]}${decidedBy}\n\`\`\`${callStr}\`\`\``,
        },
      },
    ],
  });
}
