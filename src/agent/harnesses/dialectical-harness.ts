import { createLogger } from "../../observability/logger.js";
import type { ChatMessage, InferenceToolCall } from "../../types.js";
import type { TaskNode, TaskResult } from "../../orchestration/task-graph.js";
import { BaseHarness } from "./base-harness.js";
import { HarnessTool } from "../harness-types.js";
import { PROPONENT_SIGNATURE, CRITIC_SIGNATURE } from "./formalization-prompts.js";

const logger = createLogger("harness.dialectical");

/**
 * DialecticalHarness
 *
 * An assembly of two adversarial agents (Proponent and Critic) working
 * to formalize the Tractatus axioms into a closed mathematical system.
 */
export class DialecticalHarness extends BaseHarness {
  readonly id = "dialectical";
  readonly description = "Adversarial assembly for formalizing logic into closed systems.";

  private historyA: ChatMessage[] = []; // Proponent
  private historyB: ChatMessage[] = []; // Critic
  private roundCount = 0;
  private maxRounds = 10;

  getToolDefs(): HarnessTool[] {
    return []; // The formalizers communicate purely through reasoning/text for now
  }

  buildSystemPrompt(): string {
    return "You are an internal module of the Invariant Closure Assembly.";
  }

  async execute(): Promise<TaskResult> {
    this.context.budget.startedAt = Date.now();

    // Initial Setup
    this.historyA = [{ role: "system", content: PROPONENT_SIGNATURE }];
    this.historyB = [{ role: "system", content: CRITIC_SIGNATURE }];

    let currentThesis = this.task.description;
    let latestObjectionCount = 99;
    let consecutiveLowObjections = 0;

    logger.info(`[${this.id}] Initiating Invariant Closure Assembly for task: ${this.task.id}`);

    while (this.roundCount < this.maxRounds && consecutiveLowObjections < 2) {
      this.roundCount++;
      logger.info(`[${this.id}] Starting Round ${this.roundCount}/${this.maxRounds}`);

      // ── Phase 1: Proponent (Axiomatic Architect) ──────────────────────────
      this.historyA.push({
        role: "user",
        content: `Refine and formalize the following thesis using mathematical notation. Current State: \n${currentThesis}`
      });

      const respA = await this.context.inference.chat({
        tier: "high", // Force high tier for symbolic reasoning
        messages: this.historyA,
      });

      currentThesis = respA.content;
      this.historyA.push({ role: "assistant", content: respA.content });
      logger.info(`[${this.id}] Proponent refinement delivered (~${respA.content.length} chars)`);

      // ── Phase 2: Critic (Logical Auditor) ──────────────────────────────────
      this.historyB.push({
        role: "user",
        content: `Audit the following formalization for semantic leakage or logical inconsistency. Identify all objections. Thesis: \n${currentThesis}`
      });

      const respB = await this.context.inference.chat({
        tier: "high",
        messages: this.historyB,
      });

      this.historyB.push({ role: "assistant", content: respB.content });

      // Heuristic for objection count (looking for bullet points or numbered lists)
      const objectionMatch = respB.content.match(/^(\d+\.|-|\*)/gm);
      latestObjectionCount = objectionMatch ? objectionMatch.length : 0;

      logger.info(`[${this.id}] Critic delivered ${latestObjectionCount} objections.`);

      if (latestObjectionCount <= 1) {
        consecutiveLowObjections++;
      } else {
        consecutiveLowObjections = 0;
      }

      // Feedback loop: Pass Critic's objections back to the Proponent
      this.historyA.push({
        role: "user",
        content: `The Auditor has raised the following objections. Resolve them in the next formal iteration: \n${respB.content}`
      });
    }

    const finalResult = `## TRACTATUS FORMALIZATION CLOSURE

**Final Thesis:**
${currentThesis}

**Assembly Rounds:** ${this.roundCount}
**Status:** ${consecutiveLowObjections >= 2 ? "LOGICAL CLOSURE ACHIEVED" : "CLOSURE INCOMPLETE"}
`;

    return {
      success: true,
      output: finalResult,
      artifacts: ["Tractatus_Formalization.md"],
      costCents: this.context.budget.costUsedCents,
      duration: Date.now() - this.context.budget.startedAt,
    };
  }
}
