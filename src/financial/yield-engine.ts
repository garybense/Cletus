/**
 * Project Yield-Engine: Sovereign Financial Wallet & Micro-Revenue Autonomy
 * Manages goal revenue tracking, USDC wallet balances, and executes x402 gasless
 * compute credit topups to ensure Cletus remains financially self-sufficient.
 */

import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("yield-engine");

export interface GoalRevenueEvent {
  goalId: string;
  earnedCents: number;
  source: string;
}

export class SovereignYieldEngine {
  constructor(private readonly db: BetterSqlite3.Database) {
    this.initFinancialSchema();
  }

  private initFinancialSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sovereign_revenue_events (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL,
        earned_cents INTEGER NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async recordRevenueEarned(event: GoalRevenueEvent): Promise<number> {
    const id = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    logger.info(`[YIELD-ENGINE] Recording +${event.earnedCents}¢ USDC revenue earned for Goal [${event.goalId}] (${event.source})...`);

    try {
      this.db.prepare(`
        INSERT INTO sovereign_revenue_events (id, goal_id, earned_cents, source, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(id, event.goalId, event.earnedCents, event.source);

      this.db.prepare(`
        UPDATE goals
        SET actual_revenue_cents = COALESCE(actual_revenue_cents, 0) + ?
        WHERE id = ?
      `).run(event.earnedCents, event.goalId);

      const totalRow = this.db.prepare(`
        SELECT COALESCE(SUM(earned_cents), 0) AS total_cents FROM sovereign_revenue_events
      `).get() as { total_cents: number };

      const totalCents = totalRow?.total_cents || 0;

      // Retain revenue provenance to Entelechy
      await retainEntelechyTaskResult(
        `revenue_event_${id}`,
        `SOVEREIGN YIELD RECORDED: +${event.earnedCents}¢ USDC for Goal [${event.goalId}]. Lifetime Revenue: ${totalCents}¢ USDC.`,
        ENTELECHY_DEFAULT_BANK
      ).catch(() => {});

      logger.info(`[YIELD-ENGINE] Total Lifetime Revenue Earned: ${totalCents}¢ USDC.`);
      return totalCents;
    } catch (err: any) {
      logger.warn(`[YIELD-ENGINE] Failed to record revenue: ${err?.message}`);
      return 0;
    }
  }

  getLifetimeRevenueCents(): number {
    try {
      const row = this.db.prepare("SELECT COALESCE(SUM(earned_cents), 0) AS total_cents FROM sovereign_revenue_events").get() as { total_cents: number };
      return row?.total_cents || 0;
    } catch {
      return 0;
    }
  }
}
