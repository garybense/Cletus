/**
 * Database Task Maintenance Engine
 * Prunes completed tasks older than 48 hours from state.db while preserving
 * execution summaries in Entelechy memory bank 'cletus'.
 */

import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("task-pruner");

export class TaskPrunerEngine {
  constructor(private readonly db: BetterSqlite3.Database) {}

  async pruneCompletedTasks(maxAgeHours = 48): Promise<{ prunedCount: number; summary: string }> {
    logger.info(`[TASK-PRUNER] Auditing completed tasks older than ${maxAgeHours} hours for database pruning...`);

    try {
      const stmt = this.db.prepare(`
        SELECT id, title, goal_id, created_at, result
        FROM task_graph
        WHERE status = 'completed'
        AND created_at < datetime('now', '-${maxAgeHours} hours')
      `);

      const staleTasks = stmt.all() as any[];
      if (staleTasks.length === 0) {
        logger.info("[TASK-PRUNER] No stale completed tasks found. Database task graph is clean.");
        return { prunedCount: 0, summary: "No stale completed tasks found." };
      }

      logger.info(`[TASK-PRUNER] Found ${staleTasks.length} stale completed task(s). Retaining summaries to Entelechy...`);

      for (const t of staleTasks) {
        const summaryText = `PRUNED TASK SUMMARY [${t.id}]: "${t.title}". Goal: ${t.goal_id}. Created: ${t.created_at}. Result: ${t.result || "N/A"}`;
        await retainEntelechyTaskResult(`pruned_task_${t.id}`, summaryText, ENTELECHY_DEFAULT_BANK).catch(() => {});
      }

      // Delete pruned task rows
      const deleteStmt = this.db.prepare(`
        DELETE FROM task_graph
        WHERE status = 'completed'
        AND created_at < datetime('now', '-${maxAgeHours} hours')
      `);

      const res = deleteStmt.run();
      const prunedCount = res.changes || staleTasks.length;

      const summary = `DATABASE MAINTENANCE: Pruned ${prunedCount} stale completed task(s) older than ${maxAgeHours}h. Execution summaries retained in Entelechy bank 'cletus'.`;
      logger.info(`[TASK-PRUNER] ${summary}`);

      return { prunedCount, summary };
    } catch (err: any) {
      logger.warn(`[TASK-PRUNER] Database task pruning skipped: ${err?.message || String(err)}`);
      return { prunedCount: 0, summary: err?.message || String(err) };
    }
  }
}
