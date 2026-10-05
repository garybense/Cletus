// src/heartbeat/tasks.ts

import { DurableScheduler } from './scheduler.js';
import { ingestOrchestratorStatus } from '../work-queue/ingest.js';

export const BUILTIN_TASK_TYPES = {
  HEALTH_CHECK: 'health_check',
  CLEANUP: 'cleanup',
  ORCHESTRATOR_TICK: 'orchestrator_tick',
  FLEET_CENSUS: 'fleet_census',
  GATEWAY_ACTIVITY: 'gateway_activity',
  INTELLIGENCE_SCOUT: 'intelligence_scout',
};

export function registerBuiltinHeartbeatTasks(scheduler: DurableScheduler, db?: any): void {
  // ... (previous registrations)

  // Builtin Intelligence Scout: periodic check of research sources (arXiv, etc.)
  scheduler.registerTask(BUILTIN_TASK_TYPES.INTELLIGENCE_SCOUT, async () => {
    const { runIntelligenceScout } = await import('./intelligence-scout.js');
    return await runIntelligenceScout(db);
  });

  // Schedule default entries
  scheduler.scheduleTask('default_health_check', BUILTIN_TASK_TYPES.HEALTH_CHECK, { intervalMs: 300000 });
  scheduler.scheduleTask('default_cleanup', BUILTIN_TASK_TYPES.CLEANUP, { intervalMs: 3600000 });
  scheduler.scheduleTask('default_orchestrator_tick', BUILTIN_TASK_TYPES.ORCHESTRATOR_TICK, { intervalMs: 60000 });
  scheduler.scheduleTask('default_fleet_census', BUILTIN_TASK_TYPES.FLEET_CENSUS, { intervalMs: 900000 });
  scheduler.scheduleTask('default_gateway_activity', BUILTIN_TASK_TYPES.GATEWAY_ACTIVITY, { intervalMs: 300000 });
  scheduler.scheduleTask('default_intelligence_scout', BUILTIN_TASK_TYPES.INTELLIGENCE_SCOUT, { intervalMs: 21600000 }); // 6 hours
}
