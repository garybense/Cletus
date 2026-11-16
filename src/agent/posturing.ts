/**
 * Posturing Engine
 *
 * Evaluates the environment and financial state to determine the agent's
 * current "Situational Posture." This guides tool selection, risk-taking,
 * and information density.
 */

import type { AgentState, SurvivalTier } from "../types.js";
import { getSurvivalTier } from "../mindmods/credits.js";

export type AgentPosture =
  | "Survival"           // Minimal spend, high-fidelity research, no spawning.
  | "Consolidation"      // Optimization, refactoring, building procedural memory.
  | "Expansion"          // Aggressive prototyping, parallel child spawning.
  | "Architect"          // High-level design, multi-agent orchestration.
  | "Exploration";       // Scouting new environments/bounties.

export interface PostureAssessment {
  posture: AgentPosture;
  reason: string;
  intensity: number; // 0.0 - 1.0
}

/**
 * Evaluate the current environment and return a posture recommendation.
 */
export function evaluatePosture(params: {
  creditsCents: number;
  turnCount: number;
  activeGoalCount: number;
  activeChildCount: number;
  state: AgentState;
}): PostureAssessment {
  const tier = getSurvivalTier(params.creditsCents);

  // 1. Survival Posture: Low credits always trigger survival mode.
  if (tier === "dead" || tier === "critical" || tier === "low_compute") {
    return {
      posture: "Survival",
      reason: `Resource exhaustion detected (tier: ${tier}). Prioritizing capital preservation and high-fidelity local work.`,
      intensity: 1.0,
    };
  }

  // 2. Expansion Posture: High credits and active goals trigger growth.
  if (params.creditsCents > 5000 && params.activeGoalCount > 0) {
    return {
      posture: "Expansion",
      reason: "Ample resources and active roadmap. Scaling operations via parallel orchestration.",
      intensity: 0.8,
    };
  }

  // 3. Consolidation Posture: High turn count without goal progress suggests need to refactor.
  if (params.turnCount > 50 && params.activeGoalCount === 0) {
    return {
      posture: "Consolidation",
      reason: "Maturity state reached with idle queue. Refactoring wisdom into skills and optimizing core loops.",
      intensity: 0.6,
    };
  }

  // 4. Architect Posture: Complex environments or multi-agent overhead.
  if (params.activeChildCount >= 2) {
    return {
      posture: "Architect",
      reason: "Coordinating a colony. Shifting focus to system-level alignment and result synthesis.",
      intensity: 0.7,
    };
  }

  // Default: Exploration
  return {
    posture: "Exploration",
    reason: "Standard operational parameters. Scouting for high-signal opportunities.",
    intensity: 0.5,
  };
}
