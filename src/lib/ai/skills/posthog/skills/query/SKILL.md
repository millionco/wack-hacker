---
name: query
description: Run custom HogQL queries against PostHog.
criteria: Use when no saved insight answers the question and you need a custom analytics query.
tools: [posthog_query]
minRole: member
mode: inline
---

- HogQL is SQL-like over PostHog tables (events, persons). Filter on `event`, `timestamp`, and `properties`.
- Keep queries bounded by a time window. Summarize the result; don't dump raw rows unless asked.
