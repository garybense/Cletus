/**
 * Unified Activity Log Ingestor Loop Daemon
 * Continuously tails cletus.log and dashboard.log, ingesting every single log line
 * into SQLite system_logs table in real time for 100% complete Unified Activity Log display.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "./logger.js";

const logger = createLogger("unified-log-ingestor");

export class UnifiedLogIngestorDaemon {
  private isRunning = false;
  private cletusOffset = 0;
  private dashOffset = 0;

  constructor(private readonly db: BetterSqlite3.Database) {
    this.initTable();
  }

  private initTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  startLoop(intervalMs = 2000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info("[UNIFIED-LOG] Starting Continuous Unified Activity Log Ingestion Loop...");

    setInterval(() => {
      this.ingestLogs().catch((err) => {
        logger.warn(`[UNIFIED-LOG] Ingestion error: ${err?.message || String(err)}`);
      });
    }, intervalMs);
  }

  async ingestLogs(): Promise<void> {
    const home = os.homedir();
    const cletusLogPath = path.join(home, ".cletus", "cletus.log");
    const dashLogPath = path.join(process.cwd(), "dashboard.log");

    await this.tailAndInsert(cletusLogPath, "cletus", "cletusOffset");
    await this.tailAndInsert(dashLogPath, "dashboard", "dashOffset");
  }

  private async tailAndInsert(filePath: string, sourceName: string, offsetKey: "cletusOffset" | "dashOffset"): Promise<void> {
    if (!fs.existsSync(filePath)) return;

    try {
      const stats = fs.statSync(filePath);
      const currentOffset = this[offsetKey];
      if (stats.size <= currentOffset) {
        if (stats.size < currentOffset) this[offsetKey] = 0;
        return;
      }

      const stream = fs.createReadStream(filePath, {
        start: currentOffset,
        end: stats.size,
        encoding: "utf-8",
      });

      let chunk = "";
      for await (const c of stream) {
        chunk += c;
      }
      this[offsetKey] = stats.size;

      const lines = chunk.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length === 0) return;

      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO system_logs (id, timestamp, level, source, message)
        VALUES (?, ?, ?, ?, ?)
      `);

      this.db.transaction(() => {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!.trim();
          const id = `syslog_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
          const timestamp = new Date().toISOString();
          let level = "info";
          const lower = line.toLowerCase();
          if (lower.includes("error") || lower.includes("fail") || lower.includes("fatal")) level = "error";
          else if (lower.includes("warn")) level = "warn";
          else if (lower.includes("thought") || lower.includes("think")) level = "thought";
          else if (lower.includes("tool") || lower.includes("exec")) level = "tool";

          stmt.run(id, timestamp, level, sourceName, line);
        }
      })();
    } catch {}
  }
}
