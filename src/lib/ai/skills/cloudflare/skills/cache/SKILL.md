---
name: cache
description: Purge Cloudflare cache.
criteria: Use to clear cached content for a zone, by URL or entirely.
tools: [cloudflare_purge_cache]
minRole: member
mode: inline
---

- Prefer purging specific URLs over everything. Purging requires approval — confirm scope first.
