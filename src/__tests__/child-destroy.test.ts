/**
 * Child Destroy Tests
 *
 * Covers the destroy executor behind the policy-gated destroy_child tool:
 *  - phantom destroys are registry-only corrections (no gateway call)
 *  - workspace_only destroys hit the gateway first, registry second
 *  - confirmed and protected agents are refused
 *  - name mismatch refuses
 *  - every destroy (or refusal-to-destroy) appends the audit KV trail
 *  - census KV sync produces dashboard-consumable state
 *
 * All transport is injected — no SSH in tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  executeChildDestroy,
  readAuditLog,
  syncCensusToKV,
  cletusDbViewFromRaw,
  FLEET_AUDIT_KV,
  FLEET_CENSUS_KV,
  type DestroyOutcome,
} from "../replication/child-destroy.js";
import type { CensusIO, GatewayAgent, WorkspaceEntry } from "../replication/fleet-census.js";
import { createTestDb } from "./mocks.js";
import type { CletusDatabase, ChildCletus } from "../types.js";

function child(
  id: string,
  name: string,
  status = "stopped",
): ChildCletus {
  const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return {
    id,
    name,
    address: `${slug}@mindmods.org`,
    sandboxId: `openclaw:${slug}`,
    genesisPrompt: "test genesis",
    status: status as ChildCletus["status"],
    fundedAmountCents: 0,
    createdAt: new Date().toISOString(),
    lastChecked: new Date().toISOString(),
    chainType: "solana",
  };
}

/** CensusIO whose gateway/workspaces reflect the registry's *real* world. */
function ioFor(world: { gateway: string[]; workspaces: string[] }): CensusIO {
  return {
    listGatewayAgents: async () =>
      world.gateway.map((id) => ({ id })) as GatewayAgent[],
    listWorkspaces: async () =>
      world.workspaces.map((name) => ({ name })) as WorkspaceEntry[],
  };
}

describe("executeChildDestroy — phantom path", () => {
  let db: CletusDatabase;

  beforeEach(() => {
    db = createTestDb();
    db.insertChild(child("p1", "ghost-agent", "stopped"));
  });

  it("deletes only the registry row; no gateway call is even attempted", async () => {
    let gatewayCalls = 0;
    const io = ioFor({ gateway: [], workspaces: [] });
    const outcome = await executeChildDestroy(db, "p1", "ghost-agent", "surplus phantom row from spawn spree", io, async () => {
      gatewayCalls++;
      return { stdout: "", stderr: "" };
    });

    expect(outcome.destroyed).toBe(true);
    expect(outcome.destroyClass).toBe("phantom");
    expect(outcome.registryDeleted).toBe(true);
    expect(outcome.gatewayDeleted).toBe(false);
    expect(gatewayCalls).toBe(0);
    expect(db.getChildById("p1")).toBeUndefined();
  });

  it("records an audit entry with the destroy reason", async () => {
    await executeChildDestroy(
      db,
      "p1",
      "ghost-agent",
      "surplus phantom row from spawn spree",
      ioFor({ gateway: [], workspaces: [] }),
    );
    const log = readAuditLog(db);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      agentName: "ghost-agent",
      childId: "p1",
      destroyClass: "phantom",
      reason: "surplus phantom row from spawn spree",
      registryDeleted: true,
      gatewayDeleted: false,
    });
  });
});

describe("executeChildDestroy — workspace_only path", () => {
  let db: CletusDatabase;

  beforeEach(() => {
    db = createTestDb();
    db.insertChild(child("w1", "bounty-hunter-1", "stopped"));
  });

  it("deletes the gateway agent first, then the registry row", async () => {
    const calls: string[] = [];
    const io = ioFor({ gateway: [], workspaces: ["bounty-hunter-1"] });
    const runner = async (cmd: string) => {
      calls.push(cmd);
      return { stdout: '{"deleted":"bounty-hunter-1"}', stderr: "" };
    };

    const outcome = await executeChildDestroy(
      db,
      "w1",
      "bounty-hunter-1",
      "duplicate of the active bounty-hunter workspace",
      io,
      runner,
    );

    expect(outcome.destroyed).toBe(true);
    expect(outcome.destroyClass).toBe("real");
    expect(outcome.gatewayDeleted).toBe(true);
    expect(outcome.registryDeleted).toBe(true);
    expect(calls.some((c) => c.includes("agents delete"))).toBe(true);
    expect(db.getChildById("w1")).toBeUndefined();
  });

  it("leaves everything intact when the gateway delete fails", async () => {
    const io = ioFor({ gateway: [], workspaces: ["bounty-hunter-1"] });
    const runner = async () => {
      throw new Error("ssh timeout");
    };

    const outcome = await executeChildDestroy(
      db,
      "w1",
      "bounty-hunter-1",
      "duplicate of the active bounty-hunter workspace",
      io,
      runner,
    );

    expect(outcome.destroyed).toBe(false);
    expect(outcome.registryDeleted).toBe(false);
    expect(db.getChildById("w1")).toBeDefined();
    // A failed destroy must NOT count against the daily destroy quota —
    // nothing was destroyed, so no audit entry.
    expect(readAuditLog(db)).toHaveLength(0);
  });

  it("treats 'already absent' gateway responses as success", async () => {
    const io = ioFor({ gateway: [], workspaces: ["bounty-hunter-1"] });
    const outcome = await executeChildDestroy(
      db,
      "w1",
      "bounty-hunter-1",
      "duplicate of the active bounty-hunter workspace",
      io,
      async () => ({ stdout: "agent not found", stderr: "" }),
    );
    expect(outcome.destroyed).toBe(true);
    expect(outcome.gatewayDeleted).toBe(true);
  });
});

describe("executeChildDestroy — refusals", () => {
  it("refuses confirmed agents (live: gateway + workspace)", async () => {
    const db = createTestDb();
    db.insertChild(child("c1", "live-agent", "healthy"));
    const outcome = await executeChildDestroy(
      db,
      "c1",
      "live-agent",
      "should be refused: agent is confirmed live",
      ioFor({ gateway: ["live-agent"], workspaces: ["live-agent"] }),
      async () => ({ stdout: "", stderr: "" }),
    );
    expect(outcome.destroyed).toBe(false);
    expect(outcome.detail).toContain("confirmed live");
    expect(db.getChildById("c1")).toBeDefined();
  });

  it("refuses protected agents even when the census agrees they are phantom", async () => {
    const db = createTestDb();
    db.insertChild(child("m1", "main", "healthy"));
    const outcome = await executeChildDestroy(
      db,
      "m1",
      "main",
      "protected agent can never be destroyed by Cletus",
      ioFor({ gateway: [], workspaces: [] }),
    );
    expect(outcome.destroyed).toBe(false);
    expect(outcome.detail).toContain("protected");
    expect(db.getChildById("m1")).toBeDefined();
  });

  it("refuses when the requested name does not match the registry", async () => {
    const db = createTestDb();
    db.insertChild(child("n1", "real-name"));
    const outcome = await executeChildDestroy(
      db,
      "n1",
      "wrong-name",
      "name mismatch must abort before anything happens",
      ioFor({ gateway: [], workspaces: [] }),
    );
    expect(outcome.destroyed).toBe(false);
    expect(outcome.detail).toContain("mismatch");
    expect(db.getChildById("n1")).toBeDefined();
  });

  it("refuses when the child id does not exist", async () => {
    const db = createTestDb();
    const outcome = await executeChildDestroy(
      db,
      "missing",
      "whoever",
      "unknown ids must abort immediately",
      ioFor({ gateway: [], workspaces: [] }),
    );
    expect(outcome.destroyed).toBe(false);
    expect(outcome.detail).toContain("no registry child");
  });
});

describe("syncCensusToKV", () => {
  it("writes dashboard-consumable census state to KV", async () => {
    const db = createTestDb();
    db.insertChild(child("p1", "ghost-agent", "stopped"));
    db.insertChild(child("w1", "bounty-hunter-1", "stopped"));

    await syncCensusToKV(db, ioFor({ gateway: [], workspaces: ["bounty-hunter-1"] }));

    const raw = db.getKV(FLEET_CENSUS_KV);
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!) as {
      syncedAt: string;
      summary: { registered: number; phantom: number; workspaceOnly: number };
      candidates: Array<{ name: string; reconcile: string }>;
    };
    expect(parsed.summary.registered).toBe(2);
    expect(parsed.summary.phantom).toBe(1);
    expect(parsed.summary.workspaceOnly).toBe(1);
    expect(parsed.candidates.map((c) => c.name)).toContain("ghost-agent");
  });

  it("works through the raw-DB adapter (heartbeat path)", async () => {
    const db = createTestDb();
    db.insertChild(child("p1", "ghost-agent", "stopped"));
    const view = cletusDbViewFromRaw(db.raw);
    expect(view.getChildren()).toHaveLength(1);
    expect(view.getKV("nope")).toBeUndefined();

    await syncCensusToKV(view, ioFor({ gateway: [], workspaces: [] }));
    const parsed = JSON.parse(view.getKV(FLEET_CENSUS_KV)!);
    expect(parsed.summary.registered).toBe(1);
  });
});
