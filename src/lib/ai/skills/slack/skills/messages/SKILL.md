---
name: messages
description: Read channel history and post, edit, delete, or pin messages.
criteria: Use to read recent messages in a known channel, or to send/edit/delete/pin messages.
tools:
  [
    slack_channel_history,
    slack_get_permalink,
    slack_post_message,
    slack_update_message,
    slack_delete_message,
    slack_pin_message,
    slack_unpin_message,
  ]
minRole: member
mode: inline
---

- slack_channel_history returns recent top-level messages oldest-first with author IDs and ts. Resolve author IDs to names with users tools only when it matters.
- To reply in a thread, call slack_post_message with `thread_ts` set to the parent message ts.
- slack_update_message / slack_delete_message only work on messages the bot itself sent.
- Posting, editing, deleting, and pinning require approval — the user confirms via a Slack button. Write Slack mrkdwn, not Discord markdown.
