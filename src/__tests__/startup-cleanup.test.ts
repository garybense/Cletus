import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { performProcessStartupCleanup } from "../state/startup-cleanup.js";

describe("performProcessStartupCleanup", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_graph (
        id TEXT PRIMARY KEY,
        status TEXT,
        assigned_to TEXT,
        started_at TEXT
      );

      CREATE TABLE IF NOT EXISTS children (
        id TEXT PRIMARY KEY,
        sandbox_id TEXT,
        address TEXT,
        status TEXT,
        last_checked TEXT
      );

      CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        level TEXT,
        module TEXT,
        message TEXT,
        created_at TEXT
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it("resets tasks assigned to local workers back to pending", async () => {
    db.prepare(
      "INSERT INTO task_graph (id, status, assigned_to, started_at) VALUES (?, ?, ?, ?)"
    ).run("task-1", "assigned", "local://worker-1", new Date().toISOString());

    db.prepare(
      "INSERT INTO task_graph (id, status, assigned_to, started_at) VALUES (?, ?, ?, ?)"
    ).run("task-2", "assigned", "remote://worker-2", new Date().toISOString());

    const result = await performProcessStartupCleanup(db);
    expect(result.resetTasksCount).toBe(1);

    const task1 = db.prepare("SELECT * FROM task_graph WHERE id = 'task-1'").get() as any;
    expect(task1.status).toBe("pending");
    expect(task1.assigned_to).toBeNull();
    expect(task1.started_at).toBeNull();

    const task2 = db.prepare("SELECT * FROM task_graph WHERE id = 'task-2'").get() as any;
    expect(task2.status).toBe("assigned");
  });

  it("marks live local-worker children as stopped", async () => {
    db.prepare(
      "INSERT INTO children (id, sandbox_id, address, status) VALUES (?, ?, ?, ?)"
    ).run("c1", "local://worker-1", "local://worker-1", "running");

    db.prepare(
      "INSERT INTO children (id, sandbox_id, address, status) VALUES (?, ?, ?, ?)"
    ).run("c2", "remote-sandbox", "0x123", "running");

    const result = await performProcessStartupCleanup(db);
    expect(result.stoppedChildrenCount).toBe(1);

    const c1 = db.prepare("SELECT * FROM children WHERE id = 'c1'").get() as any;
    expect(c1.status).toBe("stopped");

    const c2 = db.prepare("SELECT * FROM children WHERE id = 'c2'").get() as any;
    expect(c2.status).toBe("running");
  });

  it("executes log pruning during startup", async () => {
    const insertLog = db.prepare(
      "INSERT INTO system_logs (timestamp, level, module, message, created_at) VALUES (?, ?, ?, ?, ?)"
    );

    for (let i = 0; i < 20; i++) {
      const ts = new Date(Date.now() - (20 - i) * 1000).toISOString();
      insertLog.run(ts, "INFO", "test", `Log message ${i}`, ts);
    }

    const result = await performProcessStartupCleanup(db, { maxLogEntries: 10, summarizeForEntelechy: false });
    expect(result.prunedLogsCount).toBe(10);

    const count = (db.prepare("SELECT COUNT(*) as count FROM system_logs").get() as any).count;
    expect(count).toBe(10);
  });
});
