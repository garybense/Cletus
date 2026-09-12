// src/heartbeat/tasks.ts

import { DurableScheduler } from './scheduler.js';
import { ingestOrchestratorStatus } from '../work-queue/ingest.js';

export const BUILTIN_TASK_TYPES = {
  HEALTH_CHECK: 'health_check',
  CLEANUP: 'cleanup',
  ORCHESTRATOR_TICK: 'orchestrator_tick',
};

export function registerBuiltinHeartbeatTasks(scheduler: DurableScheduler, db?: any): void {
  // Builtin Health Check
  scheduler.registerTask(BUILTIN_TASK_TYPES.HEALTH_CHECK, async () => {
    return { status: 'healthy', timestamp: Date.now() };
  });

  // Builtin Cleanup: reaps stale/stopped/failed child processes from the DB if available
  scheduler.registerTask(BUILTIN_TASK_TYPES.CLEANUP, async () => {
    let reapedCount = 0;
    if (db && typeof db.prepare === 'function') {
      try {
        const cutoff = new Date(Date.now() - 3600_000).toISOString();
        const res = db.prepare(
          "UPDATE children SET status = 'cleaned_up' WHERE status IN ('failed', 'stopped') AND last_checked < ?"
        ).run(cutoff);
        reapedCount = res.changes ?? 0;
      } catch (err) {
        // Ignored or logged if cleanup query fails
      }
    }
    return { status: 'cleaned', reapedCount, timestamp: Date.now() };
  });

  // Builtin Orchestrator Tick: Claims work through scheduler queue, no ambient authority
  scheduler.registerTask(BUILTIN_TASK_TYPES.ORCHESTRATOR_TICK, async () => {
    const item = ingestOrchestratorStatus('ORCHESTRATOR_TICK: evaluating task status');
    return { status: 'enqueued', workItemId: item.id, timestamp: Date.now() };
  });

  // Schedule default entries
  scheduler.scheduleTask('default_health_check', BUILTIN_TASK_TYPES.HEALTH_CHECK, { intervalMs: 300000 });
  scheduler.scheduleTask('default_cleanup', BUILTIN_TASK_TYPES.CLEANUP, { intervalMs: 3600000 });
  scheduler.scheduleTask('default_orchestrator_tick', BUILTIN_TASK_TYPES.ORCHESTRATOR_TICK, { intervalMs: 60000 });
}
