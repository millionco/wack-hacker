---
name: deploy-requests
description: List and inspect PlanetScale deploy requests.
criteria: Use for schema change/deploy-request status.
tools: [planetscale_list_deploy_requests, planetscale_get_deploy_request]
minRole: member
mode: inline
---

- List by state (open/closed/all), then get a specific deploy request by number for details.
- Report source branch, target branch, and whether it's deployed.
