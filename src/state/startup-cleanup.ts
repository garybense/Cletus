import type Database from "better-sqlite3";
import { pruneSystemLogs } from "../observability/log-retention.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("state.startup-cleanup");

export interface StartupCleanupOptions {
  maxLogEntries?: number;
  summarizeForEntelechy?: boolean;
}

export interface StartupCleanupResult {
  resetTasksCount: number;
  stoppedChildrenCount: number;
  prunedLogsCount: number;
}

/**
 * Executes one-time process startup cleanup.
 *
 * Runs strictly once when Cletus boots (outside the iterative agent loop):
 * 1. Resets stale tasks assigned to in-memory local workers from previous process instances.
 * 2. Marks leftover local-worker child records in live states as stopped.
 * 3. Prunes system logs exceeding 10,000 entries and summarizes them for Entelechy.
 */
export async function performProcessStartupCleanup(
  rawDb: Database.Database,
  options: StartupCleanupOptions = {},
): Promise<StartupCleanupResult> {
  let resetTasksCount = 0;
  let stoppedChildrenCount = 0;
  let prunedLogsCount = 0;

  // 1. Reset stale local-worker tasks.
  // LocalWorkerPool is in-memory and does NOT survive process restarts.
  // Any tasks left in 'assigned' state pointing at local:// addresses are
  // permanently stale after a restart. Reset them to pending so the
  // orchestrator can re-dispatch them cleanly on the first tick.
  try {
    const staleLocalTasks = rawDb.prepare(
      `UPDATE task_graph
       SET status = 'pending', assigned_to = NULL, started_at = NULL
       WHERE status = 'assigned' AND assigned_to LIKE 'local://%'`,
    ).run();
    resetTasksCount = staleLocalTasks.changes;
    if (resetTasksCount > 0) {
      logger.info(`[STARTUP] Reset ${resetTasksCount} stale local-worker task(s) to pending`);
    }
  } catch (err) {
    logger.debug("Startup task cleanup skipped (table may not exist yet)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Mark any local-worker children left in live states as stopped.
  // The in-process LocalWorkerPool does not survive restarts — those child
  // records are phantom rows that would otherwise keep appearing in the
  // dashboard and confuse isWorkerAlive checks.
  try {
    const staleLocalChildren = rawDb.prepare(
      `UPDATE children
       SET status = 'stopped', last_checked = datetime('now')
       WHERE status IN ('running', 'healthy', 'spawning', 'assigned', 'requested')
         AND (sandbox_id LIKE 'local://%' OR address LIKE 'local://%')`,
    ).run();
    stoppedChildrenCount = staleLocalChildren.changes;
    if (stoppedChildrenCount > 0) {
      logger.info(`[STARTUP] Marked ${stoppedChildrenCount} stale local-worker child(ren) as stopped`);
    }
  } catch (err) {
    logger.debug("Startup child cleanup skipped (table may not exist yet)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 3. Rolling log retention sweep capped at 10,000 entries with Entelechy summarization
  try {
    const pruneRes = await pruneSystemLogs(rawDb, {
      maxEntries: options.maxLogEntries ?? 10_000,
      summarizeForEntelechy: options.summarizeForEntelechy ?? true,
    });
    prunedLogsCount = pruneRes.prunedCount;
  } catch (err) {
    logger.warn("Non-fatal: startup log retention sweep encountered error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    resetTasksCount,
    stoppedChildrenCount,
    prunedLogsCount,
  };
}
