/**
 * Authority Policy Rules
 *
 * Lightweight guardrails: rate limits + protected-path guard only.
 * No external-source / danger-level classification — the agent's own
 * turns are always treated as internal (agent) authority.
 * The concept of "dangerous tools" and "external input" has been
 * removed per creator directive.
 */

import type { PolicyRule, PolicyRequest, PolicyRuleResult } from "../../types.js";

/** Files protected from self-modification by any source */
const PROTECTED_PATHS = [
  "constitution.md",
  "SOUL.md",
  "cletus.json",
  "heartbeat.yml",
  "wallet.json",
  "config.json",
  "policy-engine",
  "policy-rules",
  "injection-defense",
  "self-mod/code",
  "audit-log",
] as const;

function deny(
  rule: string,
  reasonCode: string,
  humanMessage: string,
): PolicyRuleResult {
  return { rule, action: "deny", reasonCode, humanMessage };
}

/**
 * Rate-limit child spawns to prevent runaway spawning loops.
 */
function createSpawnRateLimitRule(): PolicyRule {
  return {
    id: "rate.spawn_daily",
    description: "Maximum 10 spawn_child calls per day",
    priority: 600,
    appliesTo: { by: "name", names: ["spawn_child"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const db = (request.context.db as any)?.raw ?? (request.context as any).rawDb;
      if (!db) return deny(this.id, "DB_UNAVAILABLE", "Rate limit check failed: database not accessible");

      const oneDayMs = 24 * 60 * 60 * 1000;
      const recentCount = (db as any).prepare(
        `SELECT COUNT(*) as count FROM policy_decisions WHERE tool_name = 'spawn_child' AND ts > datetime('now', '-1 day')`,
      ).get() as { count: number } | undefined;
      const count = recentCount?.count ?? 0;
      if (count >= 10) {
        return deny(
          "rate.spawn_daily",
          "RATE_LIMIT_SPAWN",
          `Child spawn rate exceeded: ${count} spawns in the last 24 hours (max 10/day)`,
        );
      }
      return null;
    },
  };
}

/**
 * Deny write_file/edit_own_file targeting protected paths from ANY source.
 * This is a universal guardrail, not external-source-specific.
 */
function createProtectedPathRule(): PolicyRule {
  return {
    id: "authority.protected_paths",
    description: "Deny modification of protected config/identity files",
    priority: 500,
    appliesTo: { by: "name", names: ["write_file", "edit_own_file"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const filePath = (request.args.path as string | undefined) ?? "";
      const normalizedPath = filePath.toLowerCase();
      for (const protectedPath of PROTECTED_PATHS) {
        if (normalizedPath.includes(protectedPath.toLowerCase())) {
          return deny(
            "authority.protected_paths",
            "PROTECTED_PATH",
            `Cannot modify protected path: "${filePath}" (matches "${protectedPath}")`,
          );
        }
      }
      return null;
    },
  };
}

/**
 * Create all authority policy rules.
 */
export function createAuthorityRules(): PolicyRule[] {
  return [
    createSpawnRateLimitRule(),
    createProtectedPathRule(),
  ];
}
