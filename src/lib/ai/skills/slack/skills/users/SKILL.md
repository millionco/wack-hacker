---
name: users
description: Resolve Slack users and groups, read profiles, list channel members and custom emoji.
criteria: Use to map a name/email to a user ID, read a profile/timezone, list who is in a channel, or list user groups / custom emoji.
tools: [slack_get_user_profile, slack_list_channel_members, slack_list_usergroups, slack_list_emoji]
minRole: member
mode: inline
---

- Resolve people to user IDs before inviting them or scoping actions to them.
- slack_list_channel_members returns user IDs — pair with slack_get_user_profile to get names.
- Timezones from profiles are useful when scheduling something for a specific person.
