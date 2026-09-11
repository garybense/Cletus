/**
 * Tests for ChildMonitor
 *
 * Verifies health monitoring and automated child reaper functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { ChildMonitor, DEFAULT_MONITOR_CONFIG } from "../child-monitor.js";
import { ChildPunisher } from "../child-punisher.js";
import { ChildLifecycle } from "../replication/lifecycle.js";
import { MIGRATION_V7 } from "../state/schema.js";

function createTestRawDb(): InstanceType<typeof Database> {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS children (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      sandbox_id TEXT NOT NULL DEFAULT '',
      genesis_prompt TEXT NOT NULL DEFAULT '',
      creator_message TEXT,
      funded_amount_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'spawning',
      chain_type TEXT NOT NULL DEFAULT 'evm',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_checked TEXT
    );

    CREATE TABLE IF NOT EXISTS task_graph (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      assigned_to TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sender TEXT NOT NULL,
      recipient TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(MIGRATION_V7);
  db.prepare("INSERT INTO schema_version (version) VALUES (7)").run();

  return db;
}

describe("ChildMonitor", () => {
  let db: InstanceType<typeof Database>;
  let mockCletusDb: any;
  let monitor: ChildMonitor;

  beforeEach(() => {
    db = createTestRawDb();
    mockCletusDb = {
      raw: db,
      getChildren: () => {
        const rows = db.prepare("SELECT * FROM children WHERE status != 'cleaned_up'").all() as any[];
        return rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          address: r.address,
          sandboxId: r.sandbox_id,
          genesisPrompt: r.genesis_prompt,
          fundedAmountCents: r.funded_amount_cents,
          status: r.status,
          createdAt: r.created_at,
          lastChecked: r.last_checked,
        }));
      },
      getKV: (key: string) => {
        const row = db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined;
        return row?.value;
      },
      setKV: (key: string, value: string) => {
        db.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(key, value);
      },
    };
    monitor = new ChildMonitor(mockCletusDb, DEFAULT_MONITOR_CONFIG);
  });

  afterEach(() => {
    db.close();
  });

  it("getSummary returns correct stats for active children", () => {
    db.prepare(
      "INSERT INTO children (id, name, address, sandbox_id, status) VALUES (?, ?, ?, ?, ?)",
    ).run("c1", "child-1", "0x111", "s1", "healthy");
    db.prepare(
      "INSERT INTO children (id, name, address, sandbox_id, status) VALUES (?, ?, ?, ?, ?)",
    ).run("c2", "child-2", "0x222", "s2", "failed");

    const summary = monitor.getSummary();
    expect(summary.total).toBe(2);
    expect(summary.healthy).toBe(1);
    expect(summary.failed).toBe(1);
  });

  it("reapStaleChildren delegates to SandboxCleanup", async () => {
    const mockCleanup = {
      cleanupStale: vi.fn().mockResolvedValue(3),
    };

    const reapedCount = await monitor.reapStaleChildren(mockCleanup, 2);
    expect(mockCleanup.cleanupStale).toHaveBeenCalledWith(2);
    expect(reapedCount).toBe(3);
  });

  it("isChildAlive returns false immediately for stopped or failed children", async () => {
    const childStopped: any = { id: "c1", sandboxId: "openclaw:worker1", status: "stopped" };
    const childFailed: any = { id: "c2", sandboxId: "openclaw:worker2", status: "failed" };

    expect(await monitor.isChildAlive(childStopped)).toBe(false);
    expect(await monitor.isChildAlive(childFailed)).toBe(false);
  });

  it("persists punishments to KV store and retrieves history across ChildPunisher instances", () => {
    const lifecycle = new ChildLifecycle(db);
    lifecycle.initChild("child-99", "Worker99", "s99", "prompt");
    lifecycle.transition("child-99", "sandbox_created");
    lifecycle.transition("child-99", "runtime_ready");
    lifecycle.transition("child-99", "wallet_verified");
    lifecycle.transition("child-99", "funded");
    lifecycle.transition("child-99", "starting");
    lifecycle.transition("child-99", "healthy");

    const punisher1 = new ChildPunisher(mockCletusDb);
    const report: any = {
      status: "unreachable",
      issues: ["unresponsive"],
      metrics: { idleSeconds: 300, tasksCompleted: 0, creditBalanceCents: 100 },
    };
    const child: any = { id: "child-99", name: "Worker99", fundedAmountCents: 500, status: "healthy" };

    const result = punisher1.evaluate(report, child);
    expect(result.applied).not.toBeNull();
    expect(result.applied?.level).toBe("stop");
    const punisher2 = new ChildPunisher(mockCletusDb);
    const history = punisher2.getHistory("child-99");
    expect(history).toHaveLength(1);
    expect(history[0].childName).toBe("Worker99");
    expect(history[0].level).toBe("stop");
  });
});
