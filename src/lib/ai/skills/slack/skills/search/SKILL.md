---
name: search
description: Search the whole Slack workspace for messages, threads, and files.
criteria: Use for "find/where did X come up/who said/that link/old thread" questions when the channel is unknown.
tools: [slack_search]
minRole: member
mode: inline
---

- Use short, discriminative queries — names, project terms, quoted phrases, error strings — not full questions.
- Slack operators work inside the query: `in:#channel`, `from:@user`, `after:YYYY-MM-DD`, `before:YYYY-MM-DD`, `has:link`, `has:file`.
- Workspace search needs a user token; if it's unavailable the tool says so — fall back to slack_channel_history for a known channel.
- Always pass through the returned permalinks in your answer. If results come back empty, reformulate once with different keywords before giving up.
