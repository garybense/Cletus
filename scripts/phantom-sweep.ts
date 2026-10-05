/**
 * Phantom Sweep (creator-directed, 2026-09-14)
 *
 * One-time cleanup of the 2026-09-13 spawn spree: ~479 registry rows that
 * assert OpenClaw children which never materialized (no gateway agent, no
 * workspace — pure phantom rows).
 *
 * This is NOT a bulk DELETE. Every row goes through the exact production
 * chain a live Cletus turn would use:
 *
 *   PolicyEngine.evaluate → logDecision → executeChildDestroy
 *
 * so policy_decisions, the fleet_audit KV trail, and the fleet_census KV all
 * receive the same durable records they would have gotten from 479 real
 * destroy_child calls. maxDestroysPerDay is temporarily raised (creator
 * decision) and restored to 5 immediately after this sweep.
 *
 * Safety properties:
 *  - DRY-RUN by default. Pass --apply to actually destroy.
 *  - Health gate: refuses to run if the census looks degraded (0 gateway
 *    agents AND 0 workspaces) — that reading would misclassify real
 *    workspace-backed agents as phantoms.
 *  - Guard runner: any attempt to touch the gateway during a phantom destroy
 *    throws — phantoms are registry corrections, full stop. The real-destroy
 *    path calls the gateway BEFORE any registry write, so a misclassification
 *    fails closed (refusal), never destroys something real.
 *  - Sequential only (audit KV is read-modify-write; no parallel corruption).
 *  - Consistent SQLite backup before the first write.
 *  - Quota-aware: counts recent allowed destroys and aborts before exceeding
 *    the policy limit (the policy engine is the backstop either way).
 *
 * Usage:
 *   npx tsx scripts/phantom-sweep.ts           # dry run: census + plan only
 *   npx tsx scripts/phantom-sweep.ts --apply   # real destroy, sequential
 */

import path from "node:path";
import { homedir } from "node:os";
import { createDatabase } from "../src/state/database.js";
import { PolicyEngine } from "../src/agent/policy-engine.js";
import { createFleetLifecycleRules, FLEET_LIMITS } from "../src/agent/policy-rules/fleet-lifecycle.js";
import {
  executeChildDestroy,
  syncCensusToKV,
  type RemoteRunner,
} from "../src/replication/child-destroy.js";
import {
  agentNameFromChild,
  gatherFleetCensus,
  registryChildrenFromDb,
  type GatewayAgent,
  type ReconciledChild,
  type WorkspaceEntry,
} from "../src/replication/fleet-census.js";
import { createDefaultCensusIO, type CensusIO } from "../src/replication/fleet-census-io.js";
import type { PolicyRequest, SpendTrackerInterface } from "../src/types.js";

const APPLY = process.argv.includes("--apply");
const CENSUS_TTL_MS = 10 * 60 * 1000;
const REFUSAL_ABORT_STREAK = 5;
const DESTROY_REASON =
  "Creator-approved phantom sweep 2026-09-14: registry row has no OpenClaw " +
  "gateway agent and no host workspace — registry correction only.";

const dbPath =
  process.env.CLETUS_DB_PATH ?? path.join(homedir(), ".cletus", "state.db");

/* ------------------------------------------------------------------ */
/* Policy plumbing (mirrors the live executeTool path)                 */
/* ------------------------------------------------------------------ */

const DESTROY_TOOL_STUB = { name: "destroy_child", riskLevel: "dangerous" } as any;

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
  args: Record<string, unknown>,
  ctxDb: unknown,
): PolicyRequest {
  return {
    tool: DESTROY_TOOL_STUB,
    args,
    context: { db: ctxDb } as any,
    turnContext: {
      inputSource: "creator",
      turnToolCallCount: 0,
      sessionSpend: createMockSpendTracker(),
    },
  };
}

/* ------------------------------------------------------------------ */
/* TTL-cached census IO (executeChildDestroy re-censuses per call)     */
/* ------------------------------------------------------------------ */

function createCachedCensusIO(ttlMs = CENSUS_TTL_MS): CensusIO {
  const inner = createDefaultCensusIO();
  let gateway: GatewayAgent[] | null = null;
  let workspaces: WorkspaceEntry[] | null = null;
  let fetchedAt = 0;

  const refresh = async (): Promise<void> => {
    if (gateway !== null && workspaces !== null && Date.now() - fetchedAt <= ttlMs) return;
    const [g, w] = await Promise.all([inner.listGatewayAgents(), inner.listWorkspaces()]);
    gateway = g;
    workspaces = w;
    fetchedAt = Date.now();
    console.log(
      `[census] refreshed: ${gateway.length} gateway agents, ${workspaces.length} workspaces`,
    );
  };

  return {
    async listGatewayAgents() {
      await refresh();
      return gateway!;
    },
    async listWorkspaces() {
      await refresh();
      return workspaces!;
    },
  };
}

/** Loud failure if a "phantom" destroy ever tries to reach the gateway. */
const guardRunner: RemoteRunner = async (command) => {
  throw new Error(
    `SWEEP INVARIANT VIOLATION: gateway command attempted during phantom destroy: ${command}`,
  );
};

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

const db = createDatabase(dbPath);
const engine = new PolicyEngine(db.raw, createFleetLifecycleRules());
const io = createCachedCensusIO();

const backupPath = `${dbPath}.backup-phantom-sweep`;

// Consistent backup before any possible write (no-op cost in dry-run).
await db.raw.backup(backupPath);
console.log(`[backup] ${backupPath}`);

// --- Health gate: a degraded census must never drive destroys -------
console.log("[census] pre-flight (bypasses TTL cache)…");
const preflight = await gatherFleetCensus(
  registryChildrenFromDb(db),
  createDefaultCensusIO(),
);
const degraded =
  preflight.summary.gatewayAgents === 0 && preflight.summary.workspaces === 0;
if (degraded) {
  console.error(
    "ABORT: census looks degraded (0 gateway agents, 0 workspaces). " +
      "Workspace-backed agents would read as phantoms. Fix transport and re-run.",
  );
  process.exit(1);
}

// --- Identify phantom candidates from the pre-flight census ---------
const phantoms: ReconciledChild[] = preflight.children.filter(
  (c) => c.reconcile === "phantom" && !c.protected,
);

console.log(
  `[census] registered=${preflight.summary.registered} confirmed=${preflight.summary.confirmed} workspace_only=${preflight.summary.workspaceOnly} phantom=${preflight.summary.phantom}`,
);
console.log(
  `[plan] ${phantoms.length} phantom rows queued for destroy (${APPLY ? "APPLY" : "DRY RUN"})`,
);

// --- Quota headroom check (policy engine is the hard backstop) ------
const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  .toISOString()
  .replace("T", " ")
  .replace(/\.\d{3}Z$/, "");
const { count: recentDestroys } = db.raw
  .prepare(
    `SELECT COUNT(*) as count FROM policy_decisions
     WHERE tool_name = 'destroy_child' AND decision = 'allow' AND created_at >= ?`,
  )
  .get(cutoff) as { count: number };
const headroom = FLEET_LIMITS.maxDestroysPerDay - recentDestroys;
if (phantoms.length > headroom) {
  console.error(
    `ABORT: ${phantoms.length} phantoms but only ${headroom} destroy headroom in the last 24h (limit ${FLEET_LIMITS.maxDestroysPerDay}). ` +
      `Re-run tomorrow or raise the temporary limit deliberately.`,
  );
  process.exit(1);
}

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Sample of what would be destroyed:");
  for (const c of phantoms.slice(0, 10)) {
    const agent = agentNameFromChild(c) ?? c.name;
    console.log(`  - ${c.id}  ${agent}  (status=${c.status}, duplicates=${c.nameCount})`);
  }
  if (phantoms.length > 10) console.log(`  … and ${phantoms.length - 10} more`);
  db.close();
  process.exit(0);
}

// --- APPLY: sequential, one policy-gated destroy per row ------------
let destroyed = 0;
let refusals = 0;
let refusalStreak = 0;
const refusalSamples: string[] = [];

for (let i = 0; i < phantoms.length; i++) {
  const child = phantoms[i];
  const agentName = agentNameFromChild(child) ?? child.name;

  // Skip rows that vanished since the pre-flight census (already destroyed).
  if (!db.getChildById(child.id)) {
    console.log(`[${i + 1}/${phantoms.length}] ${agentName}: already gone, skipping`);
    continue;
  }

  const decision = engine.evaluate(
    makeRequest({ agent_id: child.id, agent_name: agentName, reason: DESTROY_REASON }, db),
  );
  engine.logDecision(decision); // always log — mirrors production behavior

  if (decision.action !== "allow") {
    console.error(
      `[${i + 1}/${phantoms.length}] POLICY DENIED ${agentName}: ${decision.reasonCode} — stopping sweep.`,
    );
    break;
  }

  const outcome = await executeChildDestroy(
    db,
    child.id,
    agentName,
    DESTROY_REASON,
    io,
    guardRunner,
  );

  if (outcome.destroyed) {
    destroyed++;
    refusalStreak = 0;
  } else {
    refusals++;
    refusalStreak++;
    if (refusalSamples.length < 5) {
      refusalSamples.push(`${agentName}: ${outcome.detail}`);
    }
  }

  if (refusalStreak >= REFUSAL_ABORT_STREAK) {
    console.error(
      `ABORT: ${REFUSAL_ABORT_STREAK} consecutive refusals — something systematic changed.`,
    );
    break;
  }
  if ((i + 1) % 25 === 0) {
    console.log(
      `[progress] ${i + 1}/${phantoms.length} processed, ${destroyed} destroyed, ${refusals} refused`,
    );
  }
}

// --- Post-sweep census → KV so the dashboard reflects reality -------
await syncCensusToKV(db, io);

console.log("\n=== Sweep complete ===");
console.log(`destroyed: ${destroyed}`);
console.log(`refused:   ${refusals}`);
for (const s of refusalSamples) console.log(`  refusal sample: ${s}`);

const post = await gatherFleetCensus(registryChildrenFromDb(db), io);
console.log(
  `[post-census] registered=${post.summary.registered} confirmed=${post.summary.confirmed} workspace_only=${post.summary.workspaceOnly} phantom=${post.summary.phantom}`,
);

db.close();
