# Pookie

AI-powered **Slack** bot for [Million](https://million.dev). Pookie coordinates specialized subagents to operate the services Million runs on, directly from Slack threads. Built on an orchestrator + skill-gated delegate subagent architecture with [Chat SDK](https://www.npmjs.com/package/chat) for Slack transport.

- **Talk to your tools.** @mention Pookie in any channel it's in, or DM it. Pull it into a thread and it keeps up with the conversation.
- **Native Slack streaming.** Replies stream token-by-token via Slack's streaming API; conversation history persists per thread in the Chat SDK state store.
- **Personality.** Pookie ships with three registers (`balanced` default, plus `cute`/`professional`) and a pet mode (`uwu`/`owo`/`meow`).
- **Scheduling.** Ask Pookie to remind you or post on a schedule; recurring jobs survive redeploys (Turso + Vercel Queue).
- **Role-aware + approvals.** Workspace members get read + safe tools; risky writes (posting, money movement, infra) require a Slack approval button. Slack admins/owners unlock admin operations.

### Domains

Each domain is a delegate subagent with progressive `SKILL.md` disclosure. `repogrep` is a flat orchestrator tool (like `documentation`).

**Slack & knowledge**

- **Slack** — workspace search, channel history, threads, files, canvases, reactions, channel management, users/usergroups/emoji.
- **Notion** — read/write pages, query/update databases, comments.

**Engineering**

- **GitHub** — repos, issues, PRs, file contents, workflows, deployments, packages, projects.
- **Linear** — issues, views, projects, initiatives, updates, documents, users.
- **Sentry** — error monitoring, events, stack traces, releases, alerts.
- **Vercel** — projects, deployments, runtime logs, env vars, domains, edge config, feature flags, rollouts, sandboxes, firewall.
- **Code** (admin-only) — autonomous coding agent in a Vercel Sandbox that opens a PR.

**Vendored Million integrations** (native tools, not MCP)

- **Stripe** — customers, subscriptions, invoices, balance, events; refunds/cancellations behind approval.
- **Mercury** — accounts, balances, transactions (read-only).
- **PostHog** — insights, feature flags, HogQL queries.
- **Axiom** — datasets + APL log/trace queries.
- **Cloudflare** — zones, DNS, Workers, cache purge.
- **PlanetScale** — databases, branches, deploy requests.
- **Exa** — web + docs research with citations.
- **Repogrep** — search public GitHub repos/code (via Repogrep's MCP endpoint).

Built on [Next.js](https://nextjs.org) App Router + [Hono](https://hono.dev), [Chat SDK](https://www.npmjs.com/package/chat) + [`@chat-adapter/slack`](https://www.npmjs.com/package/@chat-adapter/slack), [AI SDK](https://ai-sdk.dev) v6, and [Workflow DevKit](https://useworkflow.dev). Deployed on Vercel with Fluid Compute.

> Every integration's credentials are optional: a domain's subagent refuses to launch (with a clear message) when its required env vars are missing, so a deploy only needs the keys for the domains it actually uses.

## Setup

### Prerequisites

- [Bun](https://bun.com) >= 1.3.10
- A Slack app (create one from the generated manifest, below)
- Redis (`REDIS_URL`) for Chat SDK state + an Upstash REST KV (`KV_REST_API_*`) for the conversation/approval stores

### Create the Slack app

Generate the app manifest and open the prefilled "create app" URL:

```bash
BASE_URL=https://your-deployment.example.com bun scripts/slack-manifest.ts
```

Paste the manifest at [api.slack.com/apps](https://api.slack.com/apps), install it to your workspace, then set the env vars below. The manifest points Slack's **Event Subscriptions** and **Interactivity** request URLs at `{BASE_URL}/api/webhooks/slack`.

### Environment

Key Slack vars (validated by [`src/env.ts`](src/env.ts)):

- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` — workspace install (required).
- `SLACK_USER_TOKEN` — enables workspace search (`slack_search`).
- `REDIS_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `TURSO_*` — state, stores, scheduling.
- Vendored integrations: `STRIPE_API_KEY`, `MERCURY_API_TOKEN`, `POSTHOG_API_KEY`/`POSTHOG_PROJECT_ID`, `AXIOM_API_TOKEN`, `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`, `PLANETSCALE_SERVICE_TOKEN_ID`/`PLANETSCALE_SERVICE_TOKEN`/`PLANETSCALE_ORG`, `EXA_API_KEY`. Each is optional — its tools error clearly at call time when unset.

### Development

```bash
bun install
bun dev
```

The dev server runs at `http://localhost:3000`. Point Slack's request URL at `{tunnel}/api/webhooks/slack` (e.g. via a tunnel) to receive events locally.

### Scripts

| Command                    | Description                                       |
| -------------------------- | ------------------------------------------------- |
| `bun dev`                  | Start Next.js dev server                          |
| `bun run build`            | Compile skills → `next build`                     |
| `bun run typecheck`        | `tsgo --noEmit`                                   |
| `bun run lint`             | `oxlint --type-aware`                             |
| `bun run format`           | `oxfmt`                                           |
| `bun run test`             | Unit tests (vitest)                               |
| `bun run validate`         | `typecheck && lint && test`                       |
| `bun scripts/slack-manifest.ts` | Print the Slack app manifest + create URL    |
