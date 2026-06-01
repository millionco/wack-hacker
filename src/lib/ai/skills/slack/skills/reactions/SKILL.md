---
name: reactions
description: Add, remove, and list emoji reactions on Slack messages.
criteria: Use for lightweight acknowledgements/status signals, or to read who reacted to a message.
tools: [slack_react_to_message, slack_remove_reaction, slack_list_reactions]
minRole: member
mode: inline
---

- Pass emoji as a Slack shortcode without colons (e.g. white_check_mark, eyes, tada) or a unicode emoji.
- Reacting is a great alternative to a redundant text reply for a simple "got it" / "on it" / "done".
- For workspace-custom emoji, confirm the name exists via the users skill's slack_list_emoji.
