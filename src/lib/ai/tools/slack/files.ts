import { tool } from "ai";
import { z } from "zod";

import { env } from "@/env";

import { approval } from "../../approvals/index.ts";
import { resolveChannelId, slackErrorMessage, slackWebClient } from "./client.ts";

const FILE_CONTENT_MAX = 12_000;
const TEXT_FILETYPES = new Set([
  "text",
  "markdown",
  "md",
  "post",
  "json",
  "csv",
  "yaml",
  "yml",
  "javascript",
  "typescript",
  "python",
  "html",
  "xml",
  "log",
  "diff",
  "patch",
]);

export const slack_list_files = tool({
  description:
    "List recent files in a Slack channel (id, title, filetype, permalink). Useful before reading a specific file.",
  inputSchema: z.object({
    channel: z.string().describe("Channel ID, #name, mention, or bare name"),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  execute: async ({ channel, limit }) => {
    try {
      const client = slackWebClient();
      const id = await resolveChannelId(client, channel);
      if (!id) return `Could not find channel "${channel}".`;
      const res = await client.files.list({ channel: id, count: limit });
      const files = (res.files ?? []).map((f) => ({
        id: f.id,
        title: f.title || f.name,
        filetype: f.filetype,
        permalink: f.permalink,
        size: f.size,
      }));
      return JSON.stringify({ count: files.length, files });
    } catch (e) {
      return slackErrorMessage(e, "Failed to list files");
    }
  },
});

export const slack_read_file = tool({
  description:
    "Read a Slack file's metadata and text content by file ID. Works for text-like files (markdown, code, json, csv, logs). For binary/large files, returns metadata and a note that content isn't available.",
  inputSchema: z.object({
    file_id: z.string().describe("Slack file ID (F...)"),
  }),
  execute: async ({ file_id }) => {
    try {
      const client = slackWebClient();
      const res = await client.files.info({ file: file_id });
      const f = res.file;
      if (!f) return `File ${file_id} not found.`;

      const meta = {
        id: f.id,
        title: f.title || f.name,
        filetype: f.filetype,
        permalink: f.permalink,
        size: f.size,
      };

      let content: string | undefined =
        (f.preview as string | undefined) ?? (f.plain_text as string | undefined);

      const isText = TEXT_FILETYPES.has((f.filetype ?? "").toLowerCase());
      if (!content && isText && f.url_private_download && env.SLACK_BOT_TOKEN) {
        const r = await fetch(f.url_private_download, {
          headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` },
          signal: AbortSignal.timeout(15_000),
        });
        if (r.ok) content = (await r.text()).slice(0, FILE_CONTENT_MAX);
      }

      return JSON.stringify({
        ...meta,
        completeness: content ? "ok" : "unavailable",
        content: content?.slice(0, FILE_CONTENT_MAX),
        ...(content
          ? {}
          : {
              note: "Content not readable (binary, private, or too large). Share the permalink with the user.",
            }),
      });
    } catch (e) {
      return slackErrorMessage(e, "Failed to read file");
    }
  },
});

export const slack_upload_file = approval(
  tool({
    description:
      "Upload a text file (snippet, report, export) to a Slack channel. Provide the text content, a filename, and an optional title/comment.",
    inputSchema: z.object({
      channel: z.string().describe("Channel ID, #name, mention, or bare name"),
      content: z.string().describe("Text content of the file"),
      filename: z.string().describe("Filename, e.g. report.md"),
      title: z.string().optional().describe("Optional display title"),
      initial_comment: z.string().optional().describe("Optional message posted with the file"),
    }),
    execute: async ({ channel, content, filename, title, initial_comment }) => {
      try {
        const client = slackWebClient();
        const id = await resolveChannelId(client, channel);
        if (!id) return `Could not find channel "${channel}".`;
        const res = await client.files.uploadV2({
          channel_id: id,
          content,
          filename,
          ...(title ? { title } : {}),
          ...(initial_comment ? { initial_comment } : {}),
        });
        return JSON.stringify({ ok: res.ok });
      } catch (e) {
        return slackErrorMessage(e, "Failed to upload file");
      }
    },
  }),
);
