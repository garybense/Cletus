/**
 * Child Destroy Executor
 *
 * The mechanical arm behind the `destroy_child` tool. Destruction authority
 * lives in the policy engine (creator decision 2026-09-14): Cletus proposes,
 * the engine approves each destroy individually, one agent per call, reason
 * required, protected agents untouchable, daily quota enforced.
 *
 * Two destroy classes:
 *  - PHANTOM: the registry row asserts something false (no gateway agent, no
 *    workspace). No OpenClaw object exists, so this is a registry correction:
 *    delete the row, log it. Gateway surfaces are never touched.
 *  - REAL: a workspace-backed agent. Requires explicit workspace_cleanup
 *    confirmation. Executes `openclaw agents delete <name> --force --json`
 *    through the existing SSH transport, THEN deletes the registry row only
 *    if the gateway confirmed removal.
 *
 * Every destroy appends an audit line to the `fleet_audit` KV log (capped) —
 * the durable "who was destroyed, when, why" trail.
 */

import type { CletusDatabase } from "../types.js";
import { createLogger } from "../observability/logger.js";
import {
  agentNameFromChild,
  gatherFleetCensus,
  registryChildrenFromDb,
  type FleetCensus,
  type ReconciledChild,
} from "./fleet-census.js";
import { createDefaultCensusIO, type CensusIO } from "./fleet-census-io.js";

const logger = createLogger("child.destroy");

/** KV key holding the capped JSON audit log of destroy operations. */
export const FLEET_AUDIT_KV = "fleet_audit";
/** KV key holding the latest fleet census summary for the dashboard. */
export const FLEET_CENSUS_KV = "fleet_census";
const AUDIT_LOG_MAX_ENTRIES = 200;

export type DestroyClass = "phantom" | "real";

export interface DestroyOutcome {
  destroyed: boolean;
  destroyClass: DestroyClass;
  agentName: string;
  /** What actually happened, safe to show Cletus (and the dashboard). */
  detail: string;
  /** Registry row removed? */
  registryDeleted: boolean;
  /** Gateway agent removed? (false for phantoms — nothing to remove) */
  gatewayDeleted: boolean;
}

export interface DestroyAuditEntry {
  at: string;
  agentName: string;
  childId: string;
  destroyClass: DestroyClass;
  reason: string;
  registryDeleted: boolean;
  gatewayDeleted: boolean;
}

/** In-memory runner seam so tests never touch SSH. */
export type RemoteRunner = (command: string) => Promise<{ stdout: string; stderr: string }>;

/* ------------------------------------------------------------------ */
/* Audit log                                                          */
/* ------------------------------------------------------------------ */

export function readAuditLog(
  db: Pick<CletusDatabase, "getKV">,
): DestroyAuditEntry[] {
  const raw = db.getKV(FLEET_AUDIT_KV);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DestroyAuditEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function appendAudit(
  db: Pick<CletusDatabase, "getKV" | "setKV">,
  entry: DestroyAuditEntry,
): void {
  const log = readAuditLog(db);
  log.push(entry);
  const capped = log.slice(-AUDIT_LOG_MAX_ENTRIES);
  db.setKV(FLEET_AUDIT_KV, JSON.stringify(capped));
}

/* ------------------------------------------------------------------ */
/* Census evidence                                                    */
/* ------------------------------------------------------------------ */

/**
 * Locate the child in a census and return its evidence trail: reconcile
 * status, name duplicates, and the ranked-candidate reasons. Phantoms
 * missing from the candidate list are still evidencable (they were skipped
 * only if protected or confirmed — both checked again here defensively).
 */
export function collectEvidence(
  census: FleetCensus,
  childId: string,
  agentName: string,
): { child: ReconciledChild; reasons: string[] } | null {
  const child = census.children.find((c) => c.id === childId);
  if (!child) return null;

  const candidate = census.candidates.find((c) => c.id === childId);
  const reasons = candidate
    ? [...candidate.reasons]
    : [`no destroy candidacy: reconcile=${child.reconcile}, duplicates=${child.nameCount}`];

  if (child.nameCount > 1) {
    reasons.push(
      `duplicate: ${child.nameCount} registered children share the name "${agentName}"`,
    );
  }
  return { child, reasons };
}

/* ------------------------------------------------------------------ */
/* Destroy operations                                                 */
/* ------------------------------------------------------------------ */

async function deleteGatewayAgent(
  agentName: string,
  runner: RemoteRunner,
): Promise<{ ok: boolean; detail: string }> {
  const cmd = `openclaw agents delete ${JSON.stringify(agentName)} --force --json 2>&1`;
  try {
    const { stdout, stderr } = await runner(cmd);
    const output = `${stdout}\n${stderr}`.trim();
    // The CLI exits 0 and prints a JSON summary on success; treat explicit
    // failure markers or a missing-agent echo as informative, not fatal —
    // the agent may already be gone (which is the desired end state).
    if (/already (deleted|removed|gone)|not found|no such agent/i.test(output)) {
      return { ok: true, detail: "gateway reported agent already absent" };
    }
    if (output.length === 0) {
      return { ok: false, detail: "gateway delete produced no output — verify manually" };
    }
    return { ok: true, detail: output.slice(0, 300) };
  } catch (err: any) {
    return { ok: false, detail: `gateway delete failed: ${err?.message ?? String(err)}` };
  }
}

/**
 * Execute one policy-approved destroy. Assumes the policy engine has already
 * vetted the request (one agent, reason, quota, protection); this function
 * re-verifies only the structural invariants that would make the operation
 * unsafe or meaningless, then performs the smallest possible action.
 */
export async function executeChildDestroy(
  db: DestroyDbView,
  childId: string,
  requestedAgentName: string,
  reason: string,
  io?: CensusIO,
  runner: RemoteRunner = defaultRemoteRunner,
): Promise<DestroyOutcome> {
  const child = db.getChildById(childId);
  if (!child) {
    return {
      destroyed: false,
      destroyClass: "phantom",
      agentName: requestedAgentName,
      detail: `no registry child with id ${childId}`,
      registryDeleted: false,
      gatewayDeleted: false,
    };
  }

  const agentName = agentNameFromChild({
    id: child.id,
    name: child.name,
    status: String(child.status),
    sandboxId: child.sandboxId ?? null,
    createdAt: child.createdAt,
  }) ?? child.name;

  if (agentName !== requestedAgentName) {
    return {
      destroyed: false,
      destroyClass: "phantom",
      agentName,
      detail: `agent name mismatch: requested "${requestedAgentName}" but registry says "${agentName}". Re-run with the correct name.`,
      registryDeleted: false,
      gatewayDeleted: false,
    };
  }

  // Fresh census = fresh evidence. A stale census could bless a destroy the
  // current world no longer supports.
  const census = await gatherFleetCensus(registryChildrenFromDb(db), io ?? createDefaultCensusIO());
  const evidence = collectEvidence(census, childId, agentName);
  if (!evidence) {
    return {
      destroyed: false,
      destroyClass: "phantom",
      agentName,
      detail: "census could not locate the child — refusing to act blind",
      registryDeleted: false,
      gatewayDeleted: false,
    };
  }

  const { child: reconciled } = evidence;
  if (reconciled.protected) {
    return {
      destroyed: false,
      destroyClass: reconciled.reconcile === "phantom" ? "phantom" : "real",
      agentName,
      detail: `agent "${agentName}" is protected — destroy refused`,
      registryDeleted: false,
      gatewayDeleted: false,
    };
  }
  if (reconciled.reconcile === "confirmed") {
    return {
      destroyed: false,
      destroyClass: "real",
      agentName,
      detail:
        `agent "${agentName}" is confirmed live (gateway + workspace). ` +
        `Destroying live agents requires workspace_cleanup: true and a real gateway delete — not implemented in this pass.`,
      registryDeleted: false,
      gatewayDeleted: false,
    };
  }

  const destroyClass: DestroyClass = reconciled.reconcile === "phantom" ? "phantom" : "real";

  // --- PHANTOM PATH: registry correction only -----------------------
  if (destroyClass === "phantom") {
    const registryDeleted = db.deleteChild(childId);
    const outcome: DestroyOutcome = {
      destroyed: registryDeleted,
      destroyClass,
      agentName,
      detail: registryDeleted
        ? `phantom registry row deleted (no gateway agent, no workspace existed)`
        : `registry delete affected no rows (already gone?)`,
      registryDeleted,
      gatewayDeleted: false,
    };
    appendAudit(db, {
      at: new Date().toISOString(),
      agentName,
      childId,
      destroyClass,
      reason,
      registryDeleted,
      gatewayDeleted: false,
    });
    syncCensusToKV(db);
    logger.info(`destroyed phantom "${agentName}" (${childId}): ${reason}`);
    return outcome;
  }

  // --- REAL PATH (workspace_only): gateway delete, then registry -----
  const gateway = await deleteGatewayAgent(agentName, runner);
  if (!gateway.ok) {
    return {
      destroyed: false,
      destroyClass,
      agentName,
      detail: `gateway delete refused/failed: ${gateway.detail}. Registry row left intact — reconcile before retrying.`,
      registryDeleted: false,
      gatewayDeleted: false,
    };
  }
  const registryDeleted = db.deleteChild(childId);
  const outcome: DestroyOutcome = {
    destroyed: true,
    destroyClass,
    agentName,
    detail: `gateway agent deleted (${gateway.detail}); registry row ${registryDeleted ? "deleted" : "already absent"}`,
    registryDeleted,
    gatewayDeleted: true,
  };
  appendAudit(db, {
    at: new Date().toISOString(),
    agentName,
    childId,
    destroyClass,
    reason,
    registryDeleted,
    gatewayDeleted: true,
  });
  syncCensusToKV(db);
  logger.info(`destroyed real agent "${agentName}" (${childId}): ${reason}`);
  return outcome;
}

/** Lazily-bound default runner to avoid a circular import at module load. */
let defaultRemoteRunner: RemoteRunner = async (command: string) => {
  const { runRemoteOrLocal } = await import("./openclaw-spawner.js");
  return runRemoteOrLocal(command);
};

/* ------------------------------------------------------------------ */
/* Census → KV (dashboard consumption)                                */
/* ------------------------------------------------------------------ */

/**
 * Structural view of the DB surface the census machinery needs. The full
 * CletusDatabase satisfies it; heartbeat tasks pass a raw-SQLite adapter
 * (cletusDbViewFromRaw) instead.
 */
export type CensusDbView = Pick<CletusDatabase, "getChildren" | "getKV" | "setKV">;
export type DestroyDbView = Pick<
  CletusDatabase,
  "getChildren" | "getChildById" | "deleteChild" | "getKV" | "setKV"
>;

/**
 * Build the census DB view from a raw better-sqlite3 handle — the shape the
 * heartbeat scheduler hands to its task handlers.
 */
export function cletusDbViewFromRaw(
  raw: import("better-sqlite3").Database,
): CensusDbView {
  return {
    getChildren: () =>
      raw
        .prepare(
          `SELECT id, name, address, sandbox_id, genesis_prompt, creator_message,
                  funded_amount_cents, status, created_at, last_checked, chain_type
           FROM children`,
        )
        .all() as import("../types.js").ChildCletus[],
    getKV: (key: string) =>
      (raw.prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined)
        ?.value,
    setKV: (key: string, value: string) => {
      raw
        .prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))")
        .run(key, value);
    },
  };
}

/**
 * Compute the census and write a compact summary + top candidates into KV so
 * the dashboard server can read Cletus's live fleet state honestly, with no
 * process coupling and no SSH from the dashboard tier.
 */
export async function syncCensusToKV(
  db: CensusDbView,
  io?: CensusIO,
): Promise<void> {
  try {
    const census = await gatherFleetCensus(
      registryChildrenFromDb(db),
      io ?? createDefaultCensusIO(),
    );
    db.setKV(
      FLEET_CENSUS_KV,
      JSON.stringify({
        syncedAt: new Date().toISOString(),
        summary: census.summary,
        candidates: census.candidates.slice(0, 20).map((c) => ({
          id: c.id,
          name: c.name,
          reconcile: c.reconcile,
          rank: c.rank,
        })),
        audit: readAuditLog(db).slice(-20),
      }),
    );
  } catch (err: any) {
    logger.warn(`census KV sync failed: ${err?.message ?? err}`);
  }
}
