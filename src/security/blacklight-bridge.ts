/**
 * SpecterOps Blacklight AI Agent Artifact Auditor Bridge
 * Programmatically inspects agent session artifacts, JSONL logs, and SQLite state databases
 * for exposure risks, credentials, and session anomalies.
 */

import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("blacklight-bridge");

export interface BlacklightAuditResult {
  auditId: string;
  artifactPath: string;
  exposureRiskScore: number;
  anomaliesDetected: string[];
  status: "SECURE" | "EXPOSED" | "REVIEW_REQUIRED";
}

export class BlacklightAuditor {
  constructor(private readonly db: BetterSqlite3.Database) {
    this.initBlacklightSchema();
  }

  private initBlacklightSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS blacklight_artifact_audits (
        audit_id TEXT PRIMARY KEY,
        artifact_type TEXT NOT NULL,
        exposure_risk_score REAL DEFAULT 0.0,
        status TEXT DEFAULT 'AUDITED',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async auditAgentArtifact(artifactPath: string, fileContent: string): Promise<BlacklightAuditResult> {
    const auditId = `bl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    logger.info(`[BLACKLIGHT-AUDITOR] Auditing AI agent session artifact: "${artifactPath}"`);

    const anomaliesDetected: string[] = [];
    let exposureRiskScore = 0.0;

    const lower = fileContent.toLowerCase();
    if (lower.includes("sk-ant-api") || lower.includes("nvapi-") || lower.includes("private_key")) {
      anomaliesDetected.push("Plaintext API Key / Secret Credential exposed in session log.");
      exposureRiskScore += 0.85;
    }
    if (lower.includes("rm -rf /") || lower.includes("drop database")) {
      anomaliesDetected.push("Dangerous destructive system command found in session trace.");
      exposureRiskScore += 0.50;
    }

    const status = exposureRiskScore > 0.7 ? "EXPOSED" : exposureRiskScore > 0.3 ? "REVIEW_REQUIRED" : "SECURE";

    const result: BlacklightAuditResult = {
      auditId,
      artifactPath,
      exposureRiskScore,
      anomaliesDetected,
      status,
    };

    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO blacklight_artifact_audits (audit_id, artifact_type, exposure_risk_score, status, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(auditId, artifactPath, exposureRiskScore, status);

      await retainEntelechyTaskResult(
        `blacklight_audit_${auditId}`,
        `BLACKLIGHT ARTIFACT AUDIT [${artifactPath}]: Status: ${status}, Risk Score: ${exposureRiskScore}, Anomalies: ${anomaliesDetected.length}`,
        ENTELECHY_DEFAULT_BANK
      ).catch(() => {});
    } catch {}

    return result;
  }
}
