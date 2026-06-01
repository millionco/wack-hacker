---
name: payments
description: Stripe account balance and refunds.
criteria: Use to check the account balance or issue a refund.
tools: [stripe_get_balance, stripe_create_refund]
minRole: member
mode: inline
---

- Balance returns available and pending amounts per currency (in cents).
- Refunds are money movement: they require approval and you should confirm the charge/PI and amount first. Omit amount for a full refund.
