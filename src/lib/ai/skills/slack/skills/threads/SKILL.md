---
name: threads
description: Read the full contents of a Slack thread.
criteria: Use after a search or channel-history hit when the answer depends on a thread's replies or full context.
tools: [slack_read_thread]
minRole: member
mode: inline
---

- Provide a permalink, or a channel plus the parent message `thread_ts`.
- Returns every message in the thread in order. Summarize faithfully and cite the thread permalink.
- To reply into the thread, use the messages skill's slack_post_message with `thread_ts`.
