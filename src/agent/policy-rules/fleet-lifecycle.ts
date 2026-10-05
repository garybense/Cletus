/**
 * Fleet Lifecycle Policy Rules
 *
 * Gates OpenClaw agent lifecycle operations under hard limits. The 2026-09-13
 * incident (493 registered children vs a 10/day spawn cap) showed that a
 * spawn-rate limit alone cannot control fleet size: it caps how fast the fleet
 * can grow but not how large it gets. These rules close that gap.
 *
 * Destroy authority (creator decision): Cletus proposes, the policy engine
 * approves each destroy individually. Batching is impossible by construction —
 * every destroy call is evaluated per agent, arrays are rejected, and each
 * call needs a stated reason. Protected agents can never be destroyed by
 * Cletus regardless of reason.
 *
 * Counts are read from durable state (policy_decisions + children tables), so
 * limits hold across restarts and cannot be reset by the agent.
 */

import type {
  PolicyRule,
  PolicyRequest,
  PolicyRuleResult,
} from "../../types.js";

/** Hard fleet limits. Keep in sync with the dashboard fleet panel. */
export const FLEET_LIMITS = {
  /** Maximum children allowed in a live state (healthy/running). */
  maxLiveAgents: 3,
  /** Maximum destroy_child calls per 24h window. */
  maxDestroysPerDay: 10,
  /** Minimum chars required in the destroy reason. */
  minReasonLength: 15,
} as const;

/**
 * Agents that Cletus may never destroy. The gateway's registered agents and
 * any founder-era agents live here. Extend deliberately, review on any
 * architecture change.
 */
export const PROTECTED_AGENTS: readonly string[] = [
  "main",
  "mudge-recon",
];

function deny(
  rule: string,
  reasonCode: string,
  humanMessage: string,
): PolicyRuleResult {
  return { rule, action: "deny", reasonCode, humanMessage };
}

function rawDb(request: PolicyRequest): import("better-sqlite3").Database | null {
  return ((request.context.db as any)?.raw ?? (request.context as any).rawDb) ?? null;
}

/**
 * Count recent allowed policy decisions for a tool within a time window.
 * Mirrors countRecentDecisions() in rate-limits.ts (datetime format:
 * 'YYYY-MM-DD HH:MM:SS').
 */
function countRecentDecisions(
  db: import("better-sqlite3").Database,
  toolName: string,
  windowMs: number,
): number {
  const cutoff = new Date(Date.now() - windowMs);
  const cutoffStr = cutoff.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM policy_decisions
       WHERE tool_name = ? AND decision = 'allow' AND created_at >= ?`,
    )
    .get(toolName, cutoffStr) as { count: number };
  return row.count;
}

/**
 * Cap the live fleet: no new spawns while maxLiveAgents children are
 * healthy/running. Unlike the spawn-rate rule, this bounds fleet SIZE.
 */
function createMaxLiveAgentsRule(): PolicyRule {
  return {
    id: "fleet.max_live_agents",
    description: `No spawn_child while ${FLEET_LIMITS.maxLiveAgents} children are live`,
    priority: 550,
    appliesTo: { by: "name", names: ["spawn_child"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const db = rawDb(request);
      if (!db) return deny(this.id, "DB_UNAVAILABLE", "Fleet size check failed: database not accessible");

      const row = db
        .prepare(
          `SELECT COUNT(*) as count FROM children WHERE status IN ('healthy', 'running')`,
        )
        .get() as { count: number };

      if (row.count >= FLEET_LIMITS.maxLiveAgents) {
        return deny(
          this.id,
          "FLEET_FULL",
          `Live fleet at capacity: ${row.count} healthy/running children (max ${FLEET_LIMITS.maxLiveAgents}). Destroy surplus agents before spawning.`,
        );
      }

      return null;
    },
  };
}

/**
 * Per-destroy guard:
 *  - exactly one agent per call (no batch destruction)
 *  - a substantive reason is required
 *  - protected agents are never destroyable by Cletus
 */
function createDestroyGuardRule(): PolicyRule {
  return {
    id: "fleet.destroy_guard",
    description: "destroy_child: one agent per call, reason required, protected agents denied",
    priority: 500,
    appliesTo: { by: "name", names: ["destroy_child"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const agentIds = request.args.agent_ids;
      if (Array.isArray(agentIds) && agentIds.length > 1) {
        return deny(
          this.id,
          "FLEET_DESTROY_BATCH",
          "Batch destruction is not permitted. Each destroy requires its own call with its own reason (one agent per call).",
        );
      }

      const agentId =
        typeof request.args.agent_id === "string" ? request.args.agent_id.trim() : "";
      if (!agentId) {
        return deny(this.id, "FLEET_DESTROY_NO_AGENT", "destroy_child requires a named agent_id.");
      }

      if (PROTECTED_AGENTS.includes(agentId)) {
        return deny(
          this.id,
          "FLEET_DESTROY_PROTECTED",
          `Agent "${agentId}" is protected and cannot be destroyed by Cletus.`,
        );
      }

      const reason = typeof request.args.reason === "string" ? request.args.reason.trim() : "";
      if (reason.length < FLEET_LIMITS.minReasonLength) {
        return deny(
          this.id,
          "FLEET_DESTROY_NO_REASON",
          `destroy_child requires a reason of at least ${FLEET_LIMITS.minReasonLength} characters stating why the agent is surplus.`,
        );
      }

      return null;
    },
  };
}

/**
 * Destroy quota: at most maxDestroysPerDay destroy_child calls per 24h.
 * Cleanup must be gradual so a mistake cannot cascade through the fleet.
 */
function createDestroyDailyRule(): PolicyRule {
  return {
    id: "rate.destroy_daily",
    description: `Maximum ${FLEET_LIMITS.maxDestroysPerDay} destroy_child calls per day`,
    priority: 600,
    appliesTo: { by: "name", names: ["destroy_child"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const db = rawDb(request);
      if (!db) return deny(this.id, "DB_UNAVAILABLE", "Destroy rate check failed: database not accessible");

      const oneDayMs = 24 * 60 * 60 * 1000;
      const recentCount = countRecentDecisions(db, "destroy_child", oneDayMs);

      if (recentCount >= FLEET_LIMITS.maxDestroysPerDay) {
        return deny(
          this.id,
          "RATE_LIMIT_DESTROY",
          `Destroy rate exceeded: ${recentCount} destroys in the last 24 hours (max ${FLEET_LIMITS.maxDestroysPerDay}/day).`,
        );
      }

      return null;
    },
  };
}

/**
 * Create all fleet lifecycle policy rules.
 */
export function createFleetLifecycleRules(): PolicyRule[] {
  return [
    createMaxLiveAgentsRule(),
    createDestroyGuardRule(),
    createDestroyDailyRule(),
  ];
}
