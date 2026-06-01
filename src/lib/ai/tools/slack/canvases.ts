import { tool } from "ai";
import { z } from "zod";

import { approval } from "../../approvals/index.ts";
import { resolveChannelId, slackErrorMessage, slackWebClient } from "./client.ts";

export const slack_create_canvas = approval(
  tool({
    description:
      "Create a Slack canvas (a persistent, shareable document) from markdown. Use for reports, summaries, analyses, or any structured write-up the user will revisit, instead of long chat messages. Optionally share it to a channel. Write the title and body in normal professional casing regardless of chat tone — a canvas is a document, not a chat message.",
    inputSchema: z.object({
      title: z.string().describe("Canvas title"),
      markdown: z
        .string()
        .describe("Canvas body as markdown (headings, lists, tables, code, links)"),
      share_to_channel: z
        .string()
        .optional()
        .describe("Optional channel ID, #name, or mention to share the canvas with"),
    }),
    execute: async ({ title, markdown, share_to_channel }) => {
      try {
        const client = slackWebClient();
        const body = `# ${title}\n\n${markdown}`;
        const res = await client.canvases.create({
          title,
          document_content: { type: "markdown", markdown: body },
        });
        const canvasId = res.canvas_id;

        let sharedWith: string | undefined;
        if (canvasId && share_to_channel) {
          const id = await resolveChannelId(client, share_to_channel);
          if (id) {
            await client.canvases.access
              .set({ canvas_id: canvasId, access_level: "write", channel_ids: [id] })
              .catch(() => {});
            sharedWith = id;
          }
        }

        return JSON.stringify({ ok: res.ok, canvasId, sharedWith });
      } catch (e) {
        return slackErrorMessage(e, "Failed to create canvas");
      }
    },
  }),
);
