import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import {
  pruneSystemLogs,
  extractPrunedLogStats,
  formatLogDigest,
} from "../../observability/log-retention";

vi.mock("../../memory/entelechy-client.js", () => ({
  ENTELECHY_DEFAULT_BANK: "cletus",
  callEntelechyMcpTool: vi.fn().mockResolvedValue({ success: true }),
}));

import { callEntelechyMcpTool } from "../../memory/entelechy-client.js";

describe("Log Retention & Entelechy Archival Engine", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE system_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        module TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_system_logs_created ON system_logs(created_at DESC);
    `);
    vi.clearAllMocks();
  });

  afterEach(() => {
    db.close();
  });

  it("does not prune if row count is below maxEntries", async () => {
    // Insert 5 rows
    for (let i = 0; i < 5; i++) {
      db.prepare(`
        INSERT INTO system_logs (id, timestamp, level, module, message, created_at)
        VALUES (?, ?, 'INFO', 'test', 'msg', datetime('now'))
      `).run(`log-${i}`, new Date().toISOString());
    }

    const result = await pruneSystemLogs(db, { maxEntries: 10 });
    expect(result.prunedCount).toBe(0);
    expect(result.remainingCount).toBe(5);
    expect(result.summarized).toBe(false);
    expect(callEntelechyMcpTool).not.toHaveBeenCalled();
  });

  it("prunes excess rows and preserves exactly the latest maxEntries rows", async () => {
    // Insert 25 rows with increasing created_at
    const baseTime = Date.now();
    for (let i = 0; i < 25; i++) {
      const timeStr = new Date(baseTime + i * 1000).toISOString();
      const level = i % 5 === 0 ? "ERROR" : i % 2 === 0 ? "WARN" : "INFO";
      db.prepare(`
        INSERT INTO system_logs (id, timestamp, level, module, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `log-${i}`,
        timeStr,
        level,
        i % 3 === 0 ? "loop" : "orchestrator",
        `Sample message ${i}`,
        timeStr,
      );
    }

    // Keep only the latest 10 rows
    const result = await pruneSystemLogs(db, {
      maxEntries: 10,
      summarizeForEntelechy: true,
    });

    expect(result.prunedCount).toBe(15);
    expect(result.remainingCount).toBe(10);
    expect(result.summarized).toBe(true);

    // Verify exactly 10 latest remain in SQLite
    const remaining = db.prepare("SELECT COUNT(*) as cnt FROM system_logs").get() as any;
    expect(remaining.cnt).toBe(10);

    // Verify oldest remaining is log-15
    const oldestRemaining = db.prepare("SELECT id FROM system_logs ORDER BY created_at ASC LIMIT 1").get() as any;
    expect(oldestRemaining.id).toBe("log-15");

    // Verify Entelechy MCP was called with the digest
    expect(callEntelechyMcpTool).toHaveBeenCalledWith(
      "sync_retain",
      expect.objectContaining({
        bank_id: "cletus",
        context: "log_retention_sweep",
      }),
    );
  });

  it("extracts statistical summary of pruned logs correctly", () => {
    const baseTime = Date.now();
    for (let i = 0; i < 10; i++) {
      const timeStr = new Date(baseTime + i * 1000).toISOString();
      db.prepare(`
        INSERT INTO system_logs (id, timestamp, level, module, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `log-${i}`,
        timeStr,
        i < 3 ? "ERROR" : "INFO",
        i < 3 ? "telegram" : "main",
        i === 0 ? "Goal completed" : `Message ${i}`,
        timeStr,
      );
    }

    const cutoff = new Date(baseTime + 5000).toISOString();
    const stats = extractPrunedLogStats(db, cutoff);

    expect(stats.totalCount).toBe(6);
    expect(stats.errorCount).toBe(3);
    expect(stats.infoCount).toBe(3);
    expect(stats.topErrorModules).toEqual([{ module: "telegram", count: 3 }]);
    expect(stats.keyEvents.length).toBeGreaterThan(0);

    const digest = formatLogDigest(stats);
    expect(digest).toContain("# Cletus Operational Log Archive Digest");
    expect(digest).toContain("**Archived Entries:** 6");
    expect(digest).toContain("telegram");
  });

  it("handles Entelechy MCP failures gracefully without aborting pruning", async () => {
    (callEntelechyMcpTool as any).mockRejectedValue(new Error("Entelechy offline"));

    const baseTime = Date.now();
    for (let i = 0; i < 15; i++) {
      const timeStr = new Date(baseTime + i * 1000).toISOString();
      db.prepare(`
        INSERT INTO system_logs (id, timestamp, level, module, message, created_at)
        VALUES (?, ?, 'INFO', 'test', 'msg', ?)
      `).run(`log-${i}`, timeStr, timeStr);
    }

    const result = await pruneSystemLogs(db, { maxEntries: 5 });
    expect(result.prunedCount).toBe(10);
    expect(result.remainingCount).toBe(5);
    expect(result.summarized).toBe(false);

    // DB was still pruned!
    const remaining = db.prepare("SELECT COUNT(*) as cnt FROM system_logs").get() as any;
    expect(remaining.cnt).toBe(5);
  });
});
