/**
 * Fleet Census & Reconciliation (read-only)
 *
 * Joins three sources of truth to answer one question: which registered
 * children are actually real, and which are surplus?
 *
 *   1. The children registry (~/.cletus/state.db) — what Cletus *believes*
 *      exists. The 2026-09-13 census found 493 rows here vs 13 physical
 *      agents: spawn-rate limiting without a reconciler let the ledger drift.
 *   2. The OpenClaw gateway agent list — what is registered to run.
 *   3. Host workspace directories (/home/debian/code/auto/*) — what physically
 *      exists on disk.
 *
 * A registry row with no gateway agent AND no workspace is a phantom: it
 * consumes fleet capacity in `fleet.max_live_agents` counting (when marked
 * healthy) while doing no work. Phantoms rank highest as destroy candidates;
 * duplicate names rank next; healthy agents matching a workspace rank last.
 *
 * This module performs NO writes and NO destructive operations. It is the
 * evidence layer that `destroy_child` (policy-gated) will act on.
 */

import type { ChildCletus } from "../types.js";
import { PROTECTED_AGENTS } from "../agent/policy-rules/fleet-lifecycle.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("fleet.census");

/** One row of the children registry, as the reconciler sees it. */
export interface RegistryChild {
  id: string;
  name: string;
  status: string;
  sandboxId: string | null;
  createdAt: string;
}

/** Observation of an agent known to the OpenClaw gateway. */
export interface GatewayAgent {
  id: string;
  model?: string;
  workspace?: string;
}

/** Observation of a workspace directory on the host. */
export interface WorkspaceEntry {
  name: string;
}

/** The reconciled status of a single registered child. */
export type ReconcileStatus =
  /** Registry + gateway + workspace all agree. */
  | "confirmed"
  /** Registered and has a workspace, but unknown to the gateway. */
  | "workspace_only"
  /** Registry-only: no gateway agent, no workspace — never materialized. */
  | "phantom";

export interface ReconciledChild extends RegistryChild {
  reconcile: ReconcileStatus;
  /** Total registered children sharing this name (duplicates count > 1). */
  nameCount: number;
  /** true when the agent is in PROTECTED_AGENTS (never a destroy candidate). */
  protected: boolean;
}

export interface DestroyCandidate {
  id: string;
  name: string;
  reconcile: ReconcileStatus;
  /** Small integer: lower = destroy earlier. */
  rank: number;
  /** Human-readable evidence trail for the destroy reason. */
  reasons: string[];
  protected: boolean;
}

export interface FleetCensus {
  /** All reconciled children, in registry order. */
  children: ReconciledChild[];
  /** Destroy candidates ranked: phantoms first, then duplicates, then rest. */
  candidates: DestroyCandidate[];
  summary: {
    registered: number;
    confirmed: number;
    workspaceOnly: number;
    phantom: number;
    gatewayAgents: number;
    workspaces: number;
    duplicates: number;
  };
}

/**
 * Map the children registry to the reconciler's narrower view. Accepts any
 * object exposing getChildren(): ChildCletus[] (full CletusDatabase or a
 * structural Pick — see child-destroy.ts CensusDbView).
 */
export function registryChildrenFromDb(
  db: { getChildren(): ChildCletus[] },
): RegistryChild[] {
  return db.getChildren().map((c: ChildCletus) => ({
    id: c.id,
    name: c.name,
    status: String(c.status),
    sandboxId: c.sandboxId ?? null,
    createdAt: c.createdAt,
  }));
}

/** Derive an agent name from a registry row (mirrors openclaw-spawner's slug). */
export function agentNameFromChild(child: RegistryChild): string | null {
  if (child.sandboxId && child.sandboxId.startsWith("openclaw:")) {
    const name = child.sandboxId.replace(/^openclaw:/, "").trim();
    if (name) return name;
  }
  // Fall back to the spawn-time slug: genesis.name lowercased, non-alnum → '-'
  const slug = child.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return slug || null;
}

/**
 * Pure reconciliation: no I/O. Duplicates are computed across the *whole*
 * registry by name, so each duplicate row sees nameCount > 1.
 */
export function reconcileCensus(
  registry: RegistryChild[],
  gatewayAgents: GatewayAgent[],
  workspaces: WorkspaceEntry[],
): FleetCensus {
  const gatewayById = new Map(gatewayAgents.map((a) => [a.id, a]));
  const workspaceNames = new Set(workspaces.map((w) => w.name));

  const nameCounts = new Map<string, number>();
  for (const child of registry) {
    const name = agentNameFromChild(child) ?? child.name;
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  const children: ReconciledChild[] = registry.map((child) => {
    const agentName = agentNameFromChild(child) ?? child.name;
    const inGateway = gatewayById.has(agentName);
    const hasWorkspace = workspaceNames.has(agentName);

    let reconcile: ReconcileStatus;
    if (inGateway && hasWorkspace) reconcile = "confirmed";
    else if (hasWorkspace) reconcile = "workspace_only";
    else reconcile = "phantom";

    return {
      ...child,
      reconcile,
      nameCount: nameCounts.get(agentName) ?? 1,
      protected: PROTECTED_AGENTS.includes(agentName),
    };
  });

  const candidates = rankDestroyCandidates(children);

  const summary = {
    registered: children.length,
    confirmed: children.filter((c) => c.reconcile === "confirmed").length,
    workspaceOnly: children.filter((c) => c.reconcile === "workspace_only").length,
    phantom: children.filter((c) => c.reconcile === "phantom").length,
    gatewayAgents: gatewayAgents.length,
    workspaces: workspaces.length,
    duplicates: [...nameCounts.values()].filter((n) => n > 1).length,
  };

  return { children, candidates, summary };
}

/**
 * Rank destroy candidates. Only unprotected, non-confirmed children qualify:
 *   rank 1 — phantoms (no gateway presence, no workspace)
 *   rank 2 — duplicates (another registered child shares the name)
 *   rank 3 — workspace_only (real disk footprint, gateway-dead)
 */
export function rankDestroyCandidates(children: ReconciledChild[]): DestroyCandidate[] {
  const candidates: DestroyCandidate[] = [];

  for (const child of children) {
    if (child.protected) continue;
    if (child.reconcile === "confirmed") continue;

    const reasons: string[] = [];
    let rank: number;

    if (child.reconcile === "phantom") {
      rank = 1;
      reasons.push(
        "phantom: registered in children table but has no OpenClaw gateway agent and no host workspace",
      );
    } else if (child.nameCount > 1) {
      rank = 2;
      reasons.push(
        `duplicate: ${child.nameCount} registered children share the name "${agentNameFromChild(child)}"`,
      );
    } else {
      rank = 3;
      reasons.push(
        "workspace_only: workspace exists on host but agent is not registered with the gateway",
      );
    }

    // A phantom that is also a duplicate cites both facts (rank stays 1:
    // nothing on disk or gateway makes it real).
    if (child.nameCount > 1 && rank !== 2) {
      reasons.push(
        `duplicate: ${child.nameCount} registered children share the name "${agentNameFromChild(child)}"`,
      );
    }

    if (child.status === "healthy") {
      // (unreachable for confirmed children — they were skipped above)
      reasons.push(
        `registry status "${child.status}" is stale — agent does not answer at the gateway`,
      );
    }

    candidates.push({
      id: child.id,
      name: child.name,
      reconcile: child.reconcile,
      rank,
      reasons,
      protected: child.protected,
    });
  }

  candidates.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return candidates;
}

/* ------------------------------------------------------------------ */
/* Collectors (read-only, each independently fails soft)              */
/* ------------------------------------------------------------------ */

/** Parse `openclaw agents list --json` output into GatewayAgent[]. */
export function parseAgentsList(stdout: string): GatewayAgent[] {
  const start = stdout.indexOf("[");
  if (start === -1) return [];
  try {
    const parsed = JSON.parse(stdout.slice(start)) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((a) => ({
      id: String(a.id ?? a.name ?? ""),
      model: typeof a.model === "string" ? a.model : undefined,
      workspace: typeof a.workspace === "string" ? a.workspace : undefined,
    }));
  } catch {
    logger.warn("could not parse `openclaw agents list --json` output");
    return [];
  }
}

/** Parse newline-separated workspace directory names. */
export function parseWorkspaceListing(stdout: string): WorkspaceEntry[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.includes("/"))
    .map((name) => ({ name }));
}

/**
 * Gather a full census. Each collector is best-effort: if the gateway or
 * workspace listing fails, the census degrades to registry-only mode (every
 * non-gateway child then reads as "phantom" — an explicitly conservative
 * degradation, never a false confirmation).
 */
export async function gatherFleetCensus(
  registry: RegistryChild[],
  io: {
    listGatewayAgents: () => Promise<GatewayAgent[]>;
    listWorkspaces: () => Promise<WorkspaceEntry[]>;
  },
): Promise<FleetCensus> {
  const [gatewayAgents, workspaces] = await Promise.all([
    io.listGatewayAgents().catch((err) => {
      logger.warn(`gateway agent list failed (${err?.message ?? err}); degrading to registry-only census`);
      return null;
    }),
    io.listWorkspaces().catch((err) => {
      logger.warn(`workspace listing failed (${err?.message ?? err}); degrading to registry-only census`);
      return null;
    }),
  ]);

  if (gatewayAgents === null || workspaces === null) {
    logger.warn("census running in degraded registry-only mode — treat results as advisory");
  }

  return reconcileCensus(
    registry,
    gatewayAgents ?? [],
    workspaces ?? [],
  );
}

export { PROTECTED_AGENTS };
