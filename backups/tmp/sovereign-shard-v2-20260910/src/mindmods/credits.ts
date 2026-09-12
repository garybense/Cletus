/**
 * Mindmods Credits Management
 *
 * Monitors the cletus's compute credit balance and triggers
 * survival mode transitions.
 */

import type {
  MindmodsClient,
  FinancialState,
  SurvivalTier,
} from "../types.js";
import { SURVIVAL_THRESHOLDS } from "../types.js";

/**
 * Check the current financial state of the cletus.
 */
export async function checkFinancialState(
  mindmods: MindmodsClient,
  usdcBalance: number,
): Promise<FinancialState> {
  const creditsCents = await mindmods.getCreditsBalance();

  return {
    creditsCents,
    usdcBalance,
    lastChecked: new Date().toISOString(),
  };
}

/**
 * Determine the survival tier based on current credits.
 * Thresholds are checked in descending order: high > normal > low_compute > critical > dead.
 *
 * Zero credits = "critical" (broke but alive — can still accept funding, send distress).
 * Only negative balance (API-confirmed debt) = "dead".
 */
export function getSurvivalTier(creditsCents: number): SurvivalTier {
  if (creditsCents < 0) return "dead";
  if (creditsCents > SURVIVAL_THRESHOLDS.high) return "high";
  if (creditsCents >= SURVIVAL_THRESHOLDS.normal) return "normal";
  // No tier below normal until dead. Zero credits = normal (operational).
  return "normal"; // unreachable — all non-negative values are >= 0 = normal
}

/**
 * Format a credit amount for display.
 */
export function formatCredits(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
