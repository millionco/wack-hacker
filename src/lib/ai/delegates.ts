import type { ToolSet } from "ai";

import type { AgentContext } from "./context.ts";
import type { TurnUsageTracker } from "./turn-usage.ts";
import type { SubagentSpec, TelemetryMetadata } from "./types.ts";

import { SKILL_MANIFEST as AXIOM_SUBSKILLS } from "./skills/generated/domains/axiom.ts";
import { SKILL_MANIFEST as CLOUDFLARE_SUBSKILLS } from "./skills/generated/domains/cloudflare.ts";
import { SKILL_MANIFEST as CODE_SUBSKILLS } from "./skills/generated/domains/code.ts";
import { SKILL_MANIFEST as EXA_SUBSKILLS } from "./skills/generated/domains/exa.ts";
import { SKILL_MANIFEST as GITHUB_SUBSKILLS } from "./skills/generated/domains/github.ts";
import { SKILL_MANIFEST as LINEAR_SUBSKILLS } from "./skills/generated/domains/linear.ts";
import { SKILL_MANIFEST as MERCURY_SUBSKILLS } from "./skills/generated/domains/mercury.ts";
import { SKILL_MANIFEST as NOTION_SUBSKILLS } from "./skills/generated/domains/notion.ts";
import { SKILL_MANIFEST as PLANETSCALE_SUBSKILLS } from "./skills/generated/domains/planetscale.ts";
import { SKILL_MANIFEST as POSTHOG_SUBSKILLS } from "./skills/generated/domains/posthog.ts";
import { SKILL_MANIFEST as SENTRY_SUBSKILLS } from "./skills/generated/domains/sentry.ts";
import { SKILL_MANIFEST as SLACK_SUBSKILLS } from "./skills/generated/domains/slack.ts";
import { SKILL_MANIFEST as STRIPE_SUBSKILLS } from "./skills/generated/domains/stripe.ts";
import { SKILL_MANIFEST as VERCEL_SUBSKILLS } from "./skills/generated/domains/vercel.ts";
import { SKILL_MANIFEST } from "./skills/generated/manifest.ts";
import { SkillRegistry } from "./skills/registry.ts";
import { createDelegationTool } from "./subagent.ts";
import * as axiomTools from "./tools/axiom/index.ts";
import * as cloudflareTools from "./tools/cloudflare/index.ts";
import {
  buildCodeExperimentalContext,
  codeDelegationInputSchema,
  codePostFinish,
} from "./tools/code/delegation.ts";
import * as codeTools from "./tools/code/index.ts";
import * as exaTools from "./tools/exa/index.ts";
import * as githubTools from "./tools/github/index.ts";
import * as linearTools from "./tools/linear/index.ts";
import * as mercuryTools from "./tools/mercury/index.ts";
import * as notionTools from "./tools/notion/index.ts";
import * as planetscaleTools from "./tools/planetscale/index.ts";
import * as posthogTools from "./tools/posthog/index.ts";
import * as sentryTools from "./tools/sentry/index.ts";
import * as slackTools from "./tools/slack/index.ts";
import * as stripeTools from "./tools/stripe/index.ts";
import * as vercelTools from "./tools/vercel/index.ts";

const DELEGATE_PREFIX = "delegate_";

/**
 * Per-domain configuration for delegation subagents.
 *
 * `tools` is the full domain tool set. `baseToolNames` are the tools always
 * visible to the subagent without loading a sub-skill — typically search and
 * retrieval tools that serve as the agent's initial discovery toolkit.
 */
const DOMAINS = {
  linear: {
    tools: linearTools as unknown as ToolSet,
    subSkills: LINEAR_SUBSKILLS,
    baseToolNames: [
      "search_entities",
      "retrieve_entities",
      "suggest_property_values",
      "aggregate_issues",
    ],
    requiredEnv: ["LINEAR_API_KEY"],
  },
  github: {
    tools: githubTools as unknown as ToolSet,
    subSkills: GITHUB_SUBSKILLS,
    baseToolNames: ["list_repositories", "get_repository", "search_code", "search_issues"],
    requiredEnv: [
      "GITHUB_APP_ID",
      "GITHUB_APP_PRIVATE_KEY",
      "GITHUB_APP_INSTALLATION_ID",
      "GITHUB_ORG",
    ],
  },
  slack: {
    tools: slackTools as unknown as ToolSet,
    subSkills: SLACK_SUBSKILLS,
    baseToolNames: [
      "slack_get_workspace",
      "slack_list_channels",
      "slack_check_channel_access",
      "slack_get_channel",
      "slack_resolve_user",
    ],
    requiredEnv: [],
  },
  notion: {
    tools: notionTools as unknown as ToolSet,
    subSkills: NOTION_SUBSKILLS,
    baseToolNames: ["search_notion", "retrieve_page", "retrieve_database", "list_users"],
    requiredEnv: ["NOTION_TOKEN"],
  },
  sentry: {
    tools: sentryTools as unknown as ToolSet,
    subSkills: SENTRY_SUBSKILLS,
    baseToolNames: ["list_projects", "get_project", "search_issues", "get_issue"],
    requiredEnv: ["SENTRY_AUTH_TOKEN", "SENTRY_ORG"],
  },
  vercel: {
    tools: vercelTools as unknown as ToolSet,
    subSkills: VERCEL_SUBSKILLS,
    baseToolNames: [
      "list_projects",
      "get_project",
      "list_deployments",
      "get_deployment",
      "list_aliases",
      "list_domains",
      "whoami",
      "list_teams",
    ],
    requiredEnv: ["VERCEL_API_TOKEN", "VERCEL_TEAM_ID"],
  },
  code: {
    tools: codeTools as unknown as ToolSet,
    subSkills: CODE_SUBSKILLS,
    baseToolNames: ["read", "grep", "glob", "list_dir", "todo_write"],
    requiredEnv: [
      "GITHUB_APP_ID",
      "GITHUB_APP_PRIVATE_KEY",
      "GITHUB_APP_INSTALLATION_ID",
      "GITHUB_ORG",
    ],
  },
  stripe: {
    tools: stripeTools as unknown as ToolSet,
    subSkills: STRIPE_SUBSKILLS,
    baseToolNames: [
      "stripe_search_customers",
      "stripe_get_customer",
      "stripe_get_balance",
      "stripe_list_recent_events",
    ],
    requiredEnv: ["STRIPE_API_KEY"],
  },
  posthog: {
    tools: posthogTools as unknown as ToolSet,
    subSkills: POSTHOG_SUBSKILLS,
    baseToolNames: ["posthog_list_projects", "posthog_list_insights", "posthog_list_feature_flags"],
    requiredEnv: ["POSTHOG_API_KEY"],
  },
  mercury: {
    tools: mercuryTools as unknown as ToolSet,
    subSkills: MERCURY_SUBSKILLS,
    baseToolNames: ["mercury_list_accounts", "mercury_get_account", "mercury_list_transactions"],
    requiredEnv: ["MERCURY_API_TOKEN"],
  },
  axiom: {
    tools: axiomTools as unknown as ToolSet,
    subSkills: AXIOM_SUBSKILLS,
    baseToolNames: ["axiom_list_datasets", "axiom_query"],
    requiredEnv: ["AXIOM_API_TOKEN"],
  },
  cloudflare: {
    tools: cloudflareTools as unknown as ToolSet,
    subSkills: CLOUDFLARE_SUBSKILLS,
    baseToolNames: ["cloudflare_list_zones", "cloudflare_list_dns_records"],
    requiredEnv: ["CLOUDFLARE_API_TOKEN"],
  },
  planetscale: {
    tools: planetscaleTools as unknown as ToolSet,
    subSkills: PLANETSCALE_SUBSKILLS,
    baseToolNames: ["planetscale_list_databases", "planetscale_list_branches"],
    requiredEnv: ["PLANETSCALE_SERVICE_TOKEN_ID", "PLANETSCALE_SERVICE_TOKEN"],
  },
  exa: {
    tools: exaTools as unknown as ToolSet,
    subSkills: EXA_SUBSKILLS,
    baseToolNames: ["exa_search", "exa_get_contents"],
    requiredEnv: ["EXA_API_KEY"],
  },
} as const satisfies Record<
  string,
  {
    tools: ToolSet;
    subSkills: unknown;
    baseToolNames: readonly string[];
    requiredEnv: readonly string[];
  }
>;

/**
 * Per-domain overrides layered into the `SubagentSpec` before creating the
 * delegation tool. Today only `code` needs non-default values — stronger
 * model, more steps, custom input schema, sandbox context builder, and the
 * post-finish commit/push/PR step. Other domains use the defaults.
 */
const DOMAIN_SPEC_OVERRIDES: Partial<Record<keyof typeof DOMAINS, Partial<SubagentSpec>>> = {
  code: {
    model: "anthropic/claude-opus-4.7",
    stopSteps: 60,
    inputSchema: codeDelegationInputSchema,
    buildExperimentalContext: buildCodeExperimentalContext,
    postFinish: codePostFinish,
  },
};

const registry = new SkillRegistry(SKILL_MANIFEST);

/** Build delegation tools for every delegate-mode skill the role can access. */
export function buildDelegationTools(
  context: AgentContext,
  tracker: TurnUsageTracker,
  extraMetadata?: TelemetryMetadata,
): ToolSet {
  const tools: ToolSet = {};
  for (const [name, config] of Object.entries(DOMAINS)) {
    const skill = registry.loadSkill(name, context.role);
    if (!skill || skill.mode !== "delegate") continue;
    const overrides = DOMAIN_SPEC_OVERRIDES[name as keyof typeof DOMAINS] ?? {};
    tools[DELEGATE_PREFIX + name] = createDelegationTool(
      {
        name,
        description: skill.description,
        systemPrompt: skill.instructions,
        ...config,
        ...overrides,
      },
      context,
      tracker,
      extraMetadata,
    );
  }
  return tools;
}
