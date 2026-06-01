---
name: customers
description: Search and inspect Stripe customers.
criteria: Use to find a customer by email/name or read a customer's details and subscriptions.
tools: [stripe_search_customers, stripe_get_customer]
minRole: member
mode: inline
---

- Search uses Stripe query syntax: `email:"a@b.com"`, `name:"Acme"`, `metadata["key"]:"value"`.
- stripe_get_customer expands subscriptions so you can answer plan questions in one call.
