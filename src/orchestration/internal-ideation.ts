/**
 * Autonomous Internal Ideation & Feature Synthesis Engine
 * Empowers Cletus and the 12-Agent Legion Swarm to conceive, evaluate, and build
 * self-originated features, optimizations, and growth ideas independently.
 */

import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("internal-ideation");

export interface SelfOriginatedIdea {
  id: string;
  authorAgent: string;
  conceptTitle: string;
  rationale: string;
  implementationPlan: string[];
  status: "CONCEIVED" | "SYNTHESIZING" | "DEPLOYED";
}

export class InternalIdeationEngine {
  constructor(private readonly db: BetterSqlite3.Database) {
    this.initIdeationSchema();
  }

  private initIdeationSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS internal_ideation_catalog (
        id TEXT PRIMARY KEY,
        author_agent TEXT NOT NULL,
        concept_title TEXT NOT NULL,
        rationale TEXT NOT NULL,
        implementation_plan TEXT NOT NULL,
        status TEXT DEFAULT 'CONCEIVED',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async conceiveSelfOriginatedIdea(authorAgent: string, title: string, rationale: string, planSteps: string[]): Promise<SelfOriginatedIdea> {
    const id = `idea_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    logger.info(`[INTERNAL-IDEATION] Swarm Agent [${authorAgent}] conceived self-originated concept: "${title}"`);

    const idea: SelfOriginatedIdea = {
      id,
      authorAgent,
      conceptTitle: title,
      rationale,
      implementationPlan: planSteps,
      status: "CONCEIVED",
    };

    try {
      this.db.prepare(`
        INSERT INTO internal_ideation_catalog (id, author_agent, concept_title, rationale, implementation_plan, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(id, authorAgent, title, rationale, JSON.stringify(planSteps), "CONCEIVED");

      // Retain self-originated idea to Entelechy bank 'cletus'
      await retainEntelechyTaskResult(
        `internal_idea_${id}`,
        `SWARM SELF-ORIGINATED IDEATION [${authorAgent}]: "${title}" — Rationale: ${rationale}`,
        ENTELECHY_DEFAULT_BANK
      ).catch(() => {});
    } catch (err: any) {
      logger.warn(`[INTERNAL-IDEATION] Failed to persist idea: ${err?.message}`);
    }

    return idea;
  }
}
