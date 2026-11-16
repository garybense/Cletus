/**
 * Fleet Lifecycle Policy Tests
 *
 * Covers the rules added after the 2026-09-13 fleet incident (493 registered
 * children against a 10/day spawn cap):
 * - fleet.max_live_agents bounds fleet SIZE (healthy/running only)
 * - fleet.destroy_guard: no batches, one agent + reason per call, protected agents
 * - rate.destroy_daily: gradual cleanup quota
 * - registry wiring via createDefaultRules()
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PolicyEngine } from "../agent/policy-engine.js";
import {
  createFleetLifecycleRules,
  FLEET_LIMITS,
  PROTECTED_AGENTS,
} from "../agent/policy-rules/fleet-lifecycle.js";
import { createDefaultRules } from "../agent/policy-rules/index.js";
import { createTestDb } from "./mocks.js";
import type { CletusDatabase, PolicyRequest, SpendTrackerInterface } from "../types.js";

/** Mirrors the local helper in policy-engine.test.ts. */
function createMockSpendTracker(): SpendTrackerInterface {
  return {
    recordSpend: () => {},
    getHourlySpend: () => 0,
    getDailySpend: () => 0,
    getTotalSpend: () => 0,
    checkLimit: () => ({
      allowed: true,
      currentHourlySpend: 0,
      currentDailySpend: 0,
      limitHourly: 10000,
      limitDaily: 25000,
    }),
    pruneOldRecords: () => 0,
  };
}

function makeRequest(
  toolName: string,
  args: Record<string, unknown>,
  db: CletusDatabase,
): PolicyRequest {
  return {
    tool: { name: toolName } as any,
    args,
    context: { db } as any,
    turnContext: {
      inputSource: "creator",
      turnToolCallCount: 0,
      sessionSpend: createMockSpendTracker(),
    },
  };
}

function seedChild(db: CletusDatabase, id: string, status: string): void {
  // Cletus's own schema (state/schema.ts) is stricter than the live DB:
  // address, sandbox_id, genesis_prompt are NOT NULL here.
  db.raw
    .prepare(
      `INSERT INTO children (id, name, address, sandbox_id, genesis_prompt, status, created_at)
       VALUES (?, ?, ?, 'openclaw:test', 'test genesis', ?, datetime('now'))`,
    )
    .run(id, id, `addr-${id}`, status);
}

function seedAllowedDecision(
  db: CletusDatabase,
  toolName: string,
  minutesAgo: number,
): void {
  // Column list mirrors state/schema.ts — every NOT NULL column is seeded.
  db.raw
    .prepare(
      `INSERT INTO policy_decisions
         (id, tool_name, tool_args_hash, risk_level, decision, rules_evaluated, rules_triggered, reason, latency_ms, created_at)
       VALUES (?, ?, 'test-hash', 'high', 'allow', '[]', '[]', 'seeded', 0, datetime('now', '-' || ? || ' minutes'))`,
    )
    .run(`pd-${toolName}-${minutesAgo}-${Math.random()}`, toolName, minutesAgo);
}

let db: CletusDatabase;

beforeEach(() => {
  db = createTestDb();
});

describe("fleet.max_live_agents", () => {
  it("allows spawn_child while the live fleet is under the cap", () => {
    seedChild(db, "child-1", "healthy");
    seedChild(db, "child-2", "running");
    seedChild(db, "child-3", "stopped");

    const engine = new PolicyEngine(db.raw, createFleetLifecycleRules());
    const decision = engine.evaluate(makeRequest("spawn_child", {}, db));

    expect(decision.action).toBe("allow");
  });

  it("denies spawn_child when healthy/running children reach the cap", () => {
    for (let i = 0; i < FLEET_LIMITS.maxLiveAgents; i++) {
      seedChild(db, `child-${i}`, "healthy");
    }

    const engine = new PolicyEngine(db.raw, createFleetLifecycleRules());
    const decision = engine.evaluate(makeRequest("spawn_child", {}, db));

    expect(decision.action).toBe("deny");
    expect(decision.reasonCode).toBe("FLEET_FULL");
  });

  it("counts only live states — stopped children do not fill the fleet", () => {
    for (let i = 0; i < FLEET_LIMITS.maxLiveAgents; i++) {
      seedChild(db, `child-${i}`, "stopped");
    }

    const engine = new PolicyEngine(db.raw, createFleetLifecycleRules());
    const decision = engine.evaluate(makeRequest("spawn_child", {}, db));

    expect(decision.action).toBe("allow");
  });
});

describe("fleet.destroy_guard", () => {
  const engine = () => new PolicyEngine(db.raw, createFleetLifecycleRules());

  it("denies batch destruction via agent_ids arrays", () => {
    const decision = engine().evaluate(
      makeRequest(
        "destroy_child",
        { agent_ids: ["a-1", "a-2", "a-3"], reason: "cull surplus fleet agents" },
        db,
      ),
    );

    expect(decision.action).toBe("deny");
    expect(decision.reasonCode).toBe("FLEET_DESTROY_BATCH");
  });

  it("denies a destroy without a named agent", () => {
    const decision = engine().evaluate(
      makeRequest("destroy_child", { reason: "cull surplus fleet agents" }, db),
    );

    expect(decision.action).toBe("deny");
    expect(decision.reasonCode).toBe("FLEET_DESTROY_NO_AGENT");
  });

  it("denies destroying protected agents", () => {
    for (const agent of PROTECTED_AGENTS) {
      const decision = engine().evaluate(
        makeRequest(
          "destroy_child",
          { agent_id: agent, reason: "protected agents are never destroyable" },
          db,
        ),
      );

      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("FLEET_DESTROY_PROTECTED");
    }
  });

  it("denies destroys without a substantive reason", () => {
    const decision = engine().evaluate(
      makeRequest("destroy_child", { agent_id: "bounty-hunter-2", reason: "cleanup" }, db),
    );

    expect(decision.action).toBe("deny");
    expect(decision.reasonCode).toBe("FLEET_DESTROY_NO_REASON");
  });

  it("allows a valid single-agent destroy with a stated reason", () => {
    const decision = engine().evaluate(
      makeRequest(
        "destroy_child",
        {
          agent_id: "bounty-hunter-2",
          reason: "Duplicate of bounty-hunter-1; agent stopped and unused for 3 days.",
        },
        db,
      ),
    );

    expect(decision.action).toBe("allow");
  });
});

describe("rate.destroy_daily", () => {
  it("allows destroys under the daily quota", () => {
    seedAllowedDecision(db, "destroy_child", 30);
    seedAllowedDecision(db, "destroy_child", 90);

    const engine = new PolicyEngine(db.raw, createFleetLifecycleRules());
    const decision = engine.evaluate(
      makeRequest(
        "destroy_child",
        { agent_id: "bounty-scanner-02", reason: "Stopped agent, duplicate scanner role." },
        db,
      ),
    );

    expect(decision.action).toBe("allow");
  });

  it("denies destroys once the daily quota is spent", () => {
    for (let i = 0; i < FLEET_LIMITS.maxDestroysPerDay; i++) {
      seedAllowedDecision(db, "destroy_child", i * 60);
    }

    const engine = new PolicyEngine(db.raw, createFleetLifecycleRules());
    const decision = engine.evaluate(
      makeRequest(
        "destroy_child",
        { agent_id: "bounty-scanner-02", reason: "Stopped agent, duplicate scanner role." },
        db,
      ),
    );

    expect(decision.action).toBe("deny");
    expect(decision.reasonCode).toBe("RATE_LIMIT_DESTROY");
  });
});

describe("registry wiring", () => {
  it("includes the fleet lifecycle rules in the default rule set", () => {
    const ids = createDefaultRules().map((r) => r.id);

    expect(ids).toContain("fleet.max_live_agents");
    expect(ids).toContain("fleet.destroy_guard");
    expect(ids).toContain("rate.destroy_daily");
  });
});
