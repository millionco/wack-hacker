---
name: channels
description: Create channels and manage topic, purpose, membership, and archival.
criteria: Use to create a channel, set its topic/purpose, invite users, or archive it.
tools:
  [
    slack_create_channel,
    slack_set_channel_topic,
    slack_set_channel_purpose,
    slack_invite_to_channel,
    slack_archive_channel,
  ]
minRole: member
mode: inline
---

- Channel names are lowercase with hyphens, no spaces or periods.
- All channel mutations require approval. Archiving is admin-only and destructive — confirm first.
- Invites take Slack user IDs; resolve names/emails with the users skill first.
