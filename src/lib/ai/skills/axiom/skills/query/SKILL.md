---
name: query
description: Run APL queries against Axiom datasets.
criteria: Use for log search, error rates, latency percentiles, and grouped counts.
tools: [axiom_query]
minRole: member
mode: inline
---

- APL must reference the dataset, e.g. `['vercel'] | where status >= 500 | summarize count() by bin_auto(_time)`.
- Default window is the last hour; widen it explicitly when needed. Summarize the result.
