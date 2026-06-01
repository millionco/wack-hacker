---
name: subscriptions
description: List and cancel Stripe subscriptions.
criteria: Use for subscription status, renewal dates, or cancelling a subscription.
tools: [stripe_list_subscriptions, stripe_cancel_subscription]
minRole: member
mode: inline
---

- Filter by customer and/or status. Report `current_period_end` and `cancel_at_period_end` clearly.
- Cancelling requires approval; default to cancel-at-period-end unless the user explicitly wants immediate.
