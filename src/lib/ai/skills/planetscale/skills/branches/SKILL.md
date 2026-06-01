---
name: branches
description: List PlanetScale branches for a database.
criteria: Use to see branches, which is production, and readiness.
tools: [planetscale_list_branches]
minRole: member
mode: inline
---

- Requires a database name. Flag the production branch and any non-ready branches.
