/**
 * Swarm Triage & Autonomous Delegation Engine
 * Binds directly to Cletus's decision-making loop to evaluate task complexity,
 * scope, and multi-domain requirements, automatically deciding whether Cletus should
 * execute the task solo or delegate to the 12-Agent Legion Swarm.
 */

import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("swarm-triage");

export type TaskExecutionPath = "SOLO_EXECUTION" | "LEGION_SWARM_DELEGATION";

export interface TriageDecision {
  path: TaskExecutionPath;
  reason: string;
  complexityScore: number; // 0-100
  recommendedSwarmRoster?: string[];
}

export class SwarmTriageEngine {
  constructor(private readonly db?: BetterSqlite3.Database) {}

  discernTaskExecutionPath(taskTitle: string, taskDescription: string): TriageDecision {
    const text = `${taskTitle} ${taskDescription}`.toLowerCase();
    let complexityScore = 20; // Default base complexity

    // Complexity Indicators
    const multiStepKeywords = ["multi-step", "pipeline", "all", "sweep", "audit", "harvest", "extract", "every", "research", "comprehensive", "full", "systemic"];
    const swarmKeywords = ["swarm", "multi-agent", "legion", "consensus", "12-model", "refactor codebase", "multi-county", "web-scale", "security audit"];
    const simpleKeywords = ["ping", "status", "read file", "check credit", "small", "single"];

    for (const kw of multiStepKeywords) {
      if (text.includes(kw)) complexityScore += 15;
    }

    for (const kw of swarmKeywords) {
      if (text.includes(kw)) complexityScore += 25;
    }

    for (const kw of simpleKeywords) {
      if (text.includes(kw)) complexityScore -= 10;
    }

    // Clamp score 0-100
    complexityScore = Math.max(0, Math.min(100, complexityScore));

    const path: TaskExecutionPath = complexityScore >= 45 ? "LEGION_SWARM_DELEGATION" : "SOLO_EXECUTION";
    const reason = path === "LEGION_SWARM_DELEGATION"
      ? `Task complexity score ${complexityScore}/100 exceeds threshold (45). High-scope/multi-agent task requires 12-Model Legion Swarm delegation.`
      : `Task complexity score ${complexityScore}/100 is within single-agent capacity. Executing solo via Cletus.`;

    const decision: TriageDecision = {
      path,
      reason,
      complexityScore,
      recommendedSwarmRoster: path === "LEGION_SWARM_DELEGATION" ? [
        "Commander (550B)", "Auditor 1 (120B)", "Lead Coder (30B)", "Security (22B)",
        "Scout (72B)", "Reasoning (32B)", "Evaluator (27B)", "Synth Architect"
      ] : undefined,
    };

    logger.info(`[SWARM-TRIAGE] Decision for "${taskTitle.slice(0, 40)}...": ${path} (Score: ${complexityScore}/100)`);
    return decision;
  }

  async recordTriageDecision(taskId: string, decision: TriageDecision): Promise<void> {
    if (this.db) {
      try {
        this.db.prepare(`
          INSERT OR REPLACE INTO kv (key, value, updated_at)
          VALUES (?, ?, datetime('now'))
        `).run(`triage_decision_${taskId}`, JSON.stringify(decision));
      } catch {}
    }

    // Retain triage provenance to Entelechy
    await retainEntelechyTaskResult(
      `triage_decision_${taskId}`,
      `SWARM TRIAGE DECISION [${decision.path}]: Score ${decision.complexityScore}/100. ${decision.reason}`,
      ENTELECHY_DEFAULT_BANK
    ).catch(() => {});
  }
}
