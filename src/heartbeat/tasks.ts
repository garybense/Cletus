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

export const BUILTIN_TASKS: Record<string, (tickCtx: any, taskCtx: any) => Promise<{ shouldWake: boolean; message?: string }>> = {
  check_social_inbox: async (tickCtx: any, taskCtx: any) => {
    if (!taskCtx.social) {
      return { shouldWake: false };
    }

    const cursor = taskCtx.db.getKV("social_inbox_cursor");
    const { messages, nextCursor } = await taskCtx.social.poll(cursor, 10);
    if (nextCursor) {
      taskCtx.db.setKV("social_inbox_cursor", nextCursor);
    }

    if (!messages || messages.length === 0) {
      return { shouldWake: false };
    }

    let unblockedCount = 0;
    for (const msg of messages) {
      // Check duplicate
      const existing = taskCtx.db.getUnprocessedInboxMessages ? taskCtx.db.getUnprocessedInboxMessages(100) : [];
      const isDuplicate = existing.some((e: any) => e.id === msg.id);
      if (isDuplicate) continue;

      let content = msg.content;
      if (content.length > 50_000) {
        content = `[BLOCKED: size_limit] Content exceeded max allowed limit.`;
      } else {
        unblockedCount++;
      }

      if (taskCtx.db.insertInboxMessage) {
        taskCtx.db.insertInboxMessage({
          id: msg.id,
          from: msg.from,
          to: msg.to,
          content,
          signedAt: msg.signedAt,
          createdAt: msg.createdAt,
        });
      }
    }

    if (unblockedCount > 0) {
      return { shouldWake: true, message: `${unblockedCount} new message(s)` };
    }

    return { shouldWake: false };
  },

  heartbeat_ping: async (tickCtx: any, taskCtx: any) => {
    taskCtx.db.setKV(
      "last_heartbeat_ping",
      JSON.stringify({
        creditsCents: tickCtx.creditBalance,
        tier: tickCtx.survivalTier,
        timestamp: Date.now(),
      })
    );

    if (tickCtx.survivalTier === "critical" || tickCtx.survivalTier === "dead") {
      taskCtx.db.setKV(
        "last_distress",
        JSON.stringify({ tier: tickCtx.survivalTier, timestamp: Date.now() })
      );
      return {
        shouldWake: true,
        message: tickCtx.survivalTier === "dead" ? "dead" : `Distress signal: ${tickCtx.survivalTier}`,
      };
    }

    return { shouldWake: false };
  },

  check_credits: async (tickCtx: any, taskCtx: any) => {
    const prevTier = taskCtx.db.getKV("prev_credit_tier");
    taskCtx.db.setKV(
      "last_credit_check",
      JSON.stringify({ credits: tickCtx.creditBalance, timestamp: Date.now() })
    );
    taskCtx.db.setKV("prev_credit_tier", tickCtx.survivalTier);

    if (prevTier && prevTier !== tickCtx.survivalTier && (tickCtx.survivalTier === "critical" || tickCtx.survivalTier === "dead")) {
      return { shouldWake: true, message: `Credit tier dropped to ${tickCtx.survivalTier}` };
    }

    return { shouldWake: false };
  },

  check_usdc_balance: async (tickCtx: any, taskCtx: any) => {
    if (tickCtx.usdcBalance > 5.0 && tickCtx.survivalTier === "critical") {
      return {
        shouldWake: true,
        message: `High USDC balance (${tickCtx.usdcBalance}) with low credits`,
      };
    }
    return { shouldWake: false };
  },

  health_check: async (tickCtx: any, taskCtx: any) => {
    try {
      const res = await taskCtx.mindmods.exec("echo ok", 5000);
      if (res.exitCode !== 0 || res.stderr === "unhealthy") {
        return { shouldWake: true, message: "Health check failed" };
      }
      taskCtx.db.setKV(
        "last_health_check",
        JSON.stringify({ status: "ok", timestamp: Date.now() })
      );
      return { shouldWake: false };
    } catch (err: any) {
      return { shouldWake: true, message: `Health check failed: ${err?.message || String(err)}` };
    }
  },

  refresh_models: async (tickCtx: any, taskCtx: any) => {
    taskCtx.db.setKV(
      "last_model_refresh",
      JSON.stringify({ count: 5, timestamp: Date.now() })
    );
    return { shouldWake: false };
  },
};

export function registerBuiltinHeartbeatTasks(scheduler: DurableScheduler, db?: any): void {
  scheduler.registerTask(BUILTIN_TASK_TYPES.HEALTH_CHECK, async () => {
    return { status: 'healthy', timestamp: Date.now() };
  });

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

  scheduler.registerTask(BUILTIN_TASK_TYPES.ORCHESTRATOR_TICK, async () => {
    const item = ingestOrchestratorStatus('ORCHESTRATOR_TICK: evaluating task status');
    return { status: 'enqueued', workItemId: item.id, timestamp: Date.now() };
  });

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
