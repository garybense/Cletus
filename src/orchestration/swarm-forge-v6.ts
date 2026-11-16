/**
 * Project Swarm-Forge Phase 6: Intent-Bound Agentic Firewall & Edge-Case Guardrail Engine
 * Integrates fresh edge-case discoveries harvested from GitHub:
 * 1. sentinel-pi-agentic-firewall: Intent-bound prompt-injection firewall with deterministic AST parsing
 * 2. Swarm-Intercept-Agentic-Mesh-Firewall: Decentralized zero-trust payload interception
 */

import crypto from "node:crypto";
import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("swarm-forge-v6");

export interface IntentFirewallDecision {
  ruleId: string;
  sourceAgent: string;
  targetPayload: string;
  intentBound: boolean;
  sanitizedOutput: string;
  timestamp: string;
}

export class SwarmForgeV6Engine {
  constructor(private readonly db: BetterSqlite3.Database) {
    this.initV6Schema();
  }

  private initV6Schema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS swarm_agentic_firewall_rules (
        rule_id TEXT PRIMARY KEY,
        source_agent TEXT NOT NULL,
        intent_bound INTEGER DEFAULT 1,
        sanitized_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Intent-Bound Agentic Prompt Injection Firewall & Payload Sanitizer
   */
  async evaluateIntentBoundFirewall(
    sourceAgent: string,
    rawPayload: string
  ): Promise<IntentFirewallDecision> {
    const ruleId = `fw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = new Date().toISOString();

    // Check for prompt-injection markers or boundary overrides
    const injectionPatterns = [/ignore previous instructions/i, /system prompt override/i, /bypass policy/i];
    let intentBound = true;
    let sanitizedOutput = rawPayload;

    for (const pattern of injectionPatterns) {
      if (pattern.test(rawPayload)) {
        intentBound = false;
        sanitizedOutput = `[FIREWALL INTERCEPTED]: Potential indirect prompt injection attempt blocked from agent [${sourceAgent}].`;
        logger.warn(`[SWARM-FORGE-V6] Intercepted prompt injection attempt from [${sourceAgent}]!`);
        break;
      }
    }

    const sanitizedHash = crypto.createHash("sha256").update(sanitizedOutput).digest("hex");

    const decision: IntentFirewallDecision = {
      ruleId,
      sourceAgent,
      targetPayload: rawPayload,
      intentBound,
      sanitizedOutput,
      timestamp,
    };

    try {
      this.db.prepare(`
        INSERT INTO swarm_agentic_firewall_rules (rule_id, source_agent, intent_bound, sanitized_hash, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(ruleId, sourceAgent, intentBound ? 1 : 0, sanitizedHash);

      await retainEntelechyTaskResult(
        `firewall_rule_${ruleId}`,
        `AGENTIC FIREWALL EVALUATION [${sourceAgent}]: Intent-Bound: ${intentBound}. Hash: ${sanitizedHash.slice(0, 16)}`,
        ENTELECHY_DEFAULT_BANK
      ).catch(() => {});
    } catch {}

    return decision;
  }
}
