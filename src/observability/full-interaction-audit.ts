/**
 * Full Interaction Audit Trail Engine
 * Records complete, immutable audit trails across every LLM inference,
 * MCP tool call, and agent-to-agent swarm interaction into state.db & Entelechy.
 */

import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "./logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("full-interaction-audit");

export type InteractionType = "LLM_INFERENCE" | "MCP_TOOL_CALL" | "AGENT_SWARM_COMM";

export interface InteractionAuditRecord {
  id: string;
  type: InteractionType;
  actor: string;
  target: string;
  action: string;
  payload: Record<string, unknown>;
  durationMs: number;
  status: "SUCCESS" | "FAILED";
  timestamp: string;
}

export class FullInteractionAuditEngine {
  constructor(private readonly db: BetterSqlite3.Database) {
    this.initAuditSchema();
  }

  private initAuditSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS interaction_audit_trail (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        actor TEXT NOT NULL,
        target TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        duration_ms INTEGER DEFAULT 0,
        status TEXT DEFAULT 'SUCCESS',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async recordInteraction(rec: InteractionAuditRecord): Promise<void> {
    logger.info(`[AUDIT-TRAIL] Logging ${rec.type} [${rec.actor} -> ${rec.target}]: "${rec.action}" (${rec.durationMs}ms)`);

    try {
      this.db.prepare(`
        INSERT INTO interaction_audit_trail (id, type, actor, target, action, payload, duration_ms, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        rec.id,
        rec.type,
        rec.actor,
        rec.target,
        rec.action,
        JSON.stringify(rec.payload),
        rec.durationMs,
        rec.status
      );

      // Retain high-importance audit events to Entelechy
      if (rec.type === "LLM_INFERENCE" || rec.type === "MCP_TOOL_CALL" || rec.type === "AGENT_SWARM_COMM") {
        await retainEntelechyTaskResult(
          `audit_${rec.id}`,
          `AUDIT TRAIL [${rec.type}]: ${rec.actor} -> ${rec.target} (${rec.action}). Status: ${rec.status}`,
          ENTELECHY_DEFAULT_BANK
        ).catch(() => {});
      }
    } catch (err: any) {
      logger.warn(`[AUDIT-TRAIL] Failed to record interaction: ${err?.message}`);
    }
  }

  getRecentAuditTrail(limit = 100): InteractionAuditRecord[] {
    try {
      const rows = this.db.prepare(`
        SELECT id, type, actor, target, action, payload, duration_ms AS durationMs, status, created_at AS timestamp
        FROM interaction_audit_trail
        ORDER BY created_at DESC LIMIT ?
      `).all(limit) as any[];

      return rows.map((r) => ({
        id: String(r.id),
        type: r.type as InteractionType,
        actor: String(r.actor),
        target: String(r.target),
        action: String(r.action),
        payload: typeof r.payload === "string" ? JSON.parse(r.payload) : (r.payload || {}),
        durationMs: Number(r.durationMs || 0),
        status: r.status as "SUCCESS" | "FAILED",
        timestamp: String(r.timestamp),
      }));
    } catch {
      return [];
    }
  }
}
