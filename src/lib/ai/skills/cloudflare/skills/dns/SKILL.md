---
name: dns
description: List and create Cloudflare DNS records.
criteria: Use to inspect or add DNS records for a zone.
tools: [cloudflare_list_dns_records, cloudflare_create_dns_record]
minRole: member
mode: inline
---

- List first to see existing records and avoid duplicates. Creating a record requires approval.
- Report type, name, content, and proxied state.
