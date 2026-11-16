/**
 * Autonomous Goal Seeder
 *
 * Automatically seeds initial default active goals into state.db
 * if no active goals exist when Cletus boots up or ticks.
 */

import type { Database } from "better-sqlite3";
import { getActiveGoals, insertGoal } from "../state/database.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("orchestration.goal-seeder");

export interface DefaultGoalDefinition {
  title: string;
  description: string;
  expectedRevenueCents?: number;
}

export const DEFAULT_MISSION_GOALS: DefaultGoalDefinition[] = [
  {
    title: "Scout & Execute High-Utility Bounties",
    description: "Scan digital frontier for short-cycle technical bounties, generate code solutions, and verify completed work.",
    expectedRevenueCents: 5000, // $50.00
  },
  {
    title: "Maintain System Health & File Integrity",
    description: "Run diagnostic sweeps, audit SQLite state.db integrity, monitor work queue items, and clean up stale tasks.",
    expectedRevenueCents: 0,
  },
  {
    title: "Monitor Wallet Balance & Compute Floor",
    description: "Ensure compute credits remain above safety thresholds, track actual revenue earned, and enforce spend policies.",
    expectedRevenueCents: 0,
  },
];

/**
 * Seed default mission goals into SQLite if no active goals currently exist.
 * Returns the IDs of seeded goals, or empty array if active goals were already present.
 */
export function seedDefaultGoals(db: Database): string[] {
  try {
    const active = getActiveGoals(db);
    if (active.length > 0) {
      return [];
    }

    logger.info("No active goals found. Seeding default mission pipeline goals into state.db...");
    const seededIds: string[] = [];

    for (const def of DEFAULT_MISSION_GOALS) {
      const goalId = insertGoal(db, {
        title: def.title,
        description: def.description,
        status: "active",
        expectedRevenueCents: def.expectedRevenueCents ?? 0,
        actualRevenueCents: 0,
      });
      seededIds.push(goalId);
      logger.info(`Seeded active goal [${goalId}]: "${def.title}"`);
    }

    return seededIds;
  } catch (err: any) {
    logger.error("Failed to seed default goals", err);
    return [];
  }
}
