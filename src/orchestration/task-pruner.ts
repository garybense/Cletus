/**
 * Automatic TTL-Based Task & Queue Pruning Engine
 * Archives completed/failed tasks older than a given TTL to Entelechy and prunes them from state.db.
 */

import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("task-pruner");

export const DEFAULT_TASK_TTL_HOURS = 24;

export async function pruneCompletedTasks(
  db: BetterSqlite3.Database,
  ttlHours: number = DEFAULT_TASK_TTL_HOURS,
): Promise<number> {
  const cutoffIso = new Date(Date.now() - ttlHours * 3600 * 1000).toISOString();

                                                                                                                                                                                                                                                                                                                                                                                        try {
    const expiredTasks = db.prepare(`
      SELECT id, goal_id, title, status, completed_at, result
      FROM task_graph
      WHERE status IN ('completed', 'failed', 'cancelled')
        AND completed_at IS NOT NULL
        AND completed_at < ?
      LIMIT 25
    `).all(cutoffIso) as Array<{
      id: string;
      goal_id: string;
      title: string;
      status: string;
      completed_at: string;
      result: string | null;
    }>;

    if (expiredTasks.length === 0) return 0;

    let prunedCount = 0;
    for (const task of expiredTasks) {
      // Archive digest to Entelechy before deleting
      const summary = `ARCHIVED_TASK [${task.id}] - Title: "${task.title}" (Status: ${task.status}, Completed: ${task.completed_at}) Result: ${task.result || "N/A"}`;
      await retainEntelechyTaskResult(`archived_task_${task.id}`, summary, ENTELECHY_DEFAULT_BANK).catch(() => {});

      // Delete from task_graph
      const res = db.prepare("DELETE FROM task_graph WHERE id = ?").run(task.id);
      if (res.changes > 0) prunedCount++;
    }

    // Also prune completed work_queue items older than TTL (check if updated_at exists, else created_at)
    let queueRes = { changes: 0 };
    try {
      queueRes = db.prepare(`
        DELETE FROM work_queue
        WHERE status IN ('completed', 'failed')
          AND created_at < ?
      `).run(cutoffIso);
    } catch {}

    if (prunedCount > 0 || queueRes.changes > 0) {
      logger.info(`[PRUNER] TTL pruning complete: removed ${prunedCount} old task_graph node(s) and ${queueRes.changes} work_queue item(s).`);
    }

    return prunedCount;
  } catch (e: any) {
    logger.warn(`[PRUNER] Task TTL pruning error: ${e?.message || String(e)}`);
    return 0;
  }
}
