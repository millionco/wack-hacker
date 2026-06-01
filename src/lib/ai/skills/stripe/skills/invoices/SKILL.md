---
name: invoices
description: List Stripe invoices and their status and links.
criteria: Use for invoice status, amounts due, or hosted invoice links.
tools: [stripe_list_invoices]
minRole: member
mode: inline
---

- Filter by customer and/or status (draft, open, paid, uncollectible, void).
- Share `hosted_invoice_url` so the user can open the invoice directly.
