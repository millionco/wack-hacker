---
name: files
description: List, read, and upload Slack files.
criteria: Use to find files in a channel, read a text/code/csv file's content, or upload a snippet/report.
tools: [slack_list_files, slack_read_file, slack_upload_file]
minRole: member
mode: inline
---

- slack_read_file returns text content for text-like files (markdown, code, json, csv, logs). For binary/private/large files it returns metadata and a note — share the permalink instead of guessing contents.
- slack_upload_file posts a text file to a channel and requires approval.
