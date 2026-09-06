// src/heartbeat/tasks.ts

import { DurableScheduler } from './scheduler';
import { ingestOrchestratorStatus } from '../work-queue/ingest';

export const BUILTIN_TASK_TYPES = {
  HEALTH_CHECK: 'health_check',
  CLEANUP: 'cleanup',
  ORCHESTRATOR_TICK: 'orchestrator_tick',
};

export function registerBuiltinHeartbeatTasks(scheduler: DurableScheduler): void {
  // Builtin Health Check
  scheduler.registerTask(BUILTIN_TASK_TYPES.HEALTH_CHECK, async () => {
    return { status: 'healthy', timestamp: Date.now() };
  });

  // Builtin Cleanup
  scheduler.registerTask(BUILTIN_TASK_TYPES.CLEANUP, async () => {
    return { status: 'cleaned', timestamp: Date.now() };
  });

  // Builtin Orchestrator Tick: Claims work through scheduler queue, no ambient authority
  scheduler.registerTask(BUILTIN_TASK_TYPES.ORCHESTRATOR_TICK, async () => {
    const item = ingestOrchestratorStatus('ORCHESTRATOR_TICK: evaluating task status');
    return { status: 'enqueued', workItemId: item.id, timestamp: Date.now() };
  });

  // Schedule default entries
  scheduler.scheduleTask('default_health_check', BUILTIN_TASK_TYPES.HEALTH_CHECK, { intervalMs: 300000 });
  scheduler.scheduleTask('default_orchestrator_tick', BUILTIN_TASK_TYPES.ORCHESTRATOR_TICK, { intervalMs: 60000 });
}
