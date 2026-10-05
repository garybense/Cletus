import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { ChildMonitor, DEFAULT_MONITOR_CONFIG } from "../child-monitor";
import { MIGRATION_V7 } from "../state/schema";

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

    CREATE TABLE IF NOT EXISTS inbox_messages (
      id TEXT PRIMARY KEY,
      from_address TEXT NOT NULL,
      to_address TEXT,
      content TEXT NOT NULL DEFAULT '',
      received_at TEXT NOT NULL DEFAULT (datetime('now'))
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

  it("killAllChildren transitions all active children to stopped", async () => {
    db.prepare(
      "INSERT INTO children (id, name, address, sandbox_id, status) VALUES (?, ?, ?, ?, ?)",
    ).run("c1", "child-1", "0x111", "s1", "healthy");
    db.prepare(
      "INSERT INTO children (id, name, address, sandbox_id, status) VALUES (?, ?, ?, ?, ?)",
    ).run("c2", "child-2", "0x222", "s2", "spawning");
    db.prepare(
      "INSERT INTO children (id, name, address, sandbox_id, status) VALUES (?, ?, ?, ?, ?)",
    ).run("c3", "child-3", "0x333", "s3", "stopped");

    const result = await monitor.killAllChildren("Runaway spawn test");
    expect(result.killed).toBe(2);

    const children = db.prepare("SELECT * FROM children").all() as any[];
    expect(children.filter((c) => c.status === "failed" || c.status === "stopped").length).toBe(3);
  });

  it("flags error_loop and marks status unhealthy when consecutive errors exceed threshold", async () => {
    db.prepare(
      "INSERT INTO children (id, name, address, sandbox_id, status) VALUES (?, ?, ?, ?, ?)",
    ).run("c3", "child-error", "0x333", "s3", "healthy");

    const child = mockCletusDb.getChildren()[0];

    // Record 3 consecutive errors
    monitor.recordError("c3");
    monitor.recordError("c3");
    monitor.recordError("c3");

    const report = await monitor.checkChild(child);
    expect(report.status).toBe("error_loop");
    expect(report.issues.some((i) => i.includes("consecutive errors"))).toBe(true);

    // Record recovery
    monitor.recordRecovery("c3");
    const recoveryReport = await monitor.checkChild(child);
    expect(recoveryReport.status).toBe("healthy");
  });

  it("performs liveness check for local sandbox child", async () => {
    db.prepare(
      "INSERT INTO children (id, name, address, sandbox_id, status) VALUES (?, ?, ?, ?, ?)",
    ).run("c4", "local-child", "0x444", "local-sandbox", "healthy");

    const child = mockCletusDb.getChildren()[0];
    const isAlive = await monitor.isChildAlive(child);
    expect(isAlive).toBe(true);
  });
});
