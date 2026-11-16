/**
 * Context-Engineering Skills Advisor Bridge
 * Automatically consults Muratcan Koylan's context-engineering principles (context-degradation,
 * context-compression, long-horizon-prompting, memory-systems) to optimize agent attention budgets.
 */

import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("context-engineering-bridge");

export interface ContextOptimizationAdvice {
  taskContext: string;
  recommendedSkill: string;
  mitigationStrategy: string;
  tokenBudgetEfficiencyGain: number; // percentage
}

export class ContextEngineeringAdvisor {
  constructor(private readonly db: BetterSqlite3.Database) {}

  adviseContextOptimization(taskTitle: string, taskDescription: string): ContextOptimizationAdvice {
    logger.info(`[CONTEXT-ADVISOR] Analyzing context engineering principles for task: "${taskTitle.slice(0, 40)}..."`);

    let recommendedSkill = "context-optimization";
    let mitigationStrategy = "Apply JIT retrieval and tool output offloading via filesystem-context.";
    let tokenBudgetEfficiencyGain = 35;

    const text = `${taskTitle} ${taskDescription}`.toLowerCase();
    if (text.includes("long") || text.includes("autonomous") || text.includes("horizon")) {
      recommendedSkill = "long-horizon-prompting";
      mitigationStrategy = "Write pseudo-formal task brief with exact success predicates and audit-gated return conditions.";
      tokenBudgetEfficiencyGain = 45;
    } else if (text.includes("memory") || text.includes("state") || text.includes("cross-session")) {
      recommendedSkill = "memory-systems";
      mitigationStrategy = "Use append-only schema-first JSONL logs and graph-based memory indexing.";
      tokenBudgetEfficiencyGain = 40;
    } else if (text.includes("degradation") || text.includes("failure") || text.includes("lost")) {
      recommendedSkill = "context-degradation";
      mitigationStrategy = "Detect attention scarcity and U-shaped attention curve drop-offs; compress working window.";
      tokenBudgetEfficiencyGain = 50;
    }

    const advice: ContextOptimizationAdvice = {
      taskContext: taskTitle,
      recommendedSkill,
      mitigationStrategy,
      tokenBudgetEfficiencyGain,
    };

    // Retain advice provenance into Entelechy
    retainEntelechyTaskResult(
      `context_advice_${Date.now()}`,
      `CONTEXT ENGINEERING ADVISOR: Task "${taskTitle}" -> Skill: [${recommendedSkill}]. Strategy: ${mitigationStrategy}`,
      ENTELECHY_DEFAULT_BANK
    ).catch(() => {});

    return advice;
  }
}
