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
  check_social_inbox: async (tickCtx, taskCtx) => {
    if (!taskCtx?.social) return { shouldWake: false };
    const pollRes = typeof taskCtx.social.poll === "function"
      ? await taskCtx.social.poll()
      : await taskCtx.social.pollResponses?.();
    if (!pollRes || !pollRes.messages || pollRes.messages.length === 0) return { shouldWake: false };

    let added = 0;
    for (const msg of pollRes.messages) {
      if (msg.content && msg.content.length > 50000) {
        msg.content = `[BLOCKED: size_limit] ${msg.content.slice(0, 100)}`;
        taskCtx.db.insertInboxMessage(msg);
      } else {
        const stmt = taskCtx.db.raw.prepare(
          `INSERT OR IGNORE INTO inbox_messages (id, from_address, content, received_at, reply_to)
           VALUES (?, ?, ?, ?, ?)`
        );
        const res = stmt.run(
          msg.id,
          msg.from,
          msg.content,
          msg.createdAt || new Date().toISOString(),
          msg.replyTo ?? null,
        );
        if (res.changes > 0) added++;
      }
    }

    if (added === 0) return { shouldWake: false };
    return { shouldWake: true, message: `Poll returned ${added} new message(s)` };
  },

  heartbeat_ping: async (tickCtx, taskCtx) => {
    const creditsCents = tickCtx.creditBalance ?? 0;
    const tier = tickCtx.survivalTier || "normal";
    taskCtx.db.setKV?.("last_heartbeat_ping", JSON.stringify({ creditsCents, tier, timestamp: new Date().toISOString() }));

    if (tier === "critical" || tier === "dead") {
      taskCtx.db.setKV?.("last_distress", JSON.stringify({ tier, timestamp: new Date().toISOString() }));
      return { shouldWake: true, message: `Distress signal triggered (${tier} tier)` };
    }
    return { shouldWake: false };
  },

  check_credits: async (tickCtx, taskCtx) => {
    const credits = tickCtx.creditBalance ?? 0;
    const currentTier = tickCtx.survivalTier || "normal";
    const prevTier = taskCtx.db.getKV?.("prev_credit_tier");

    taskCtx.db.setKV?.("last_credit_check", JSON.stringify({ credits, tier: currentTier, timestamp: new Date().toISOString() }));
    taskCtx.db.setKV?.("prev_credit_tier", currentTier);

    if (prevTier && prevTier !== currentTier && (currentTier === "critical" || currentTier === "dead")) {
      return { shouldWake: true, message: `Credit tier dropped to ${currentTier}` };
    }
    return { shouldWake: false };
  },

  check_usdc_balance: async (tickCtx, taskCtx) => {
    const usdc = tickCtx.usdcBalance ?? 0;
    const tier = tickCtx.survivalTier || "normal";

    if (usdc >= 5.0 && (tier === "critical" || tier === "dead")) {
      return { shouldWake: true, message: `Has USDC balance (${usdc}) while in ${tier} credit tier` };
    }
    return { shouldWake: false };
  },

  health_check: async (tickCtx, taskCtx) => {
    try {
      if (taskCtx.mindmods?.exec) {
        const res = await taskCtx.mindmods.exec("echo ok");
        if (res?.exitCode !== 0 || res?.stderr?.includes("unhealthy")) {
          return { shouldWake: true, message: "Health check failed: execution error" };
        }
      }
      taskCtx.db.setKV?.("last_health_check", JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
      return { shouldWake: false };
    } catch (err: any) {
      return { shouldWake: true, message: `Health check error: ${err?.message || String(err)}` };
    }
  },

  refresh_models: async (tickCtx, taskCtx) => {
    taskCtx.db.setKV?.("last_model_refresh", JSON.stringify({ count: 5, timestamp: new Date().toISOString() }));
    return { shouldWake: false };
  },
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
