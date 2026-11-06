// src/heartbeat/tasks.ts

import { DurableScheduler } from './scheduler.js';
import { ingestOrchestratorStatus } from '../work-queue/ingest.js';

export interface HeartbeatTaskResult {
  shouldWake: boolean;
  message?: string;
}

export const BUILTIN_TASKS = {
  check_social_inbox: async (tickCtx: any, taskCtx: any): Promise<HeartbeatTaskResult> => {
    if (!taskCtx?.social) {
      return { shouldWake: false };
    }

    try {
      const cursor = taskCtx.db ? (taskCtx.db.getKV?.("social_cursor") || undefined) : undefined;
      const response = await taskCtx.social.poll(cursor, 10);
      const messages = response?.messages || [];
      if (!messages || messages.length === 0) {
        return { shouldWake: false };
      }

      if (response.nextCursor && taskCtx.db?.setKV) {
        taskCtx.db.setKV("social_cursor", response.nextCursor);
      }

      let newCount = 0;
      let blockedCount = 0;

      for (const msg of messages) {
        const isBlocked = msg.content && msg.content.length > 50_000;
        const msgContent = isBlocked ? `[BLOCKED: size_limit] ${msg.content.slice(0, 100)}` : msg.content;

        try {
          if (taskCtx.db) {
            const rawDb = taskCtx.db.raw || taskCtx.db;
            const existing = rawDb.prepare("SELECT id FROM inbox_messages WHERE id = ?").get(msg.id);

            if (!existing) {
              rawDb.prepare(
                "INSERT INTO inbox_messages (id, from_address, to_address, content, received_at, status) VALUES (?, ?, ?, ?, datetime('now'), 'received')"
              ).run(msg.id, msg.from, msg.to, msgContent);

              if (isBlocked) {
                blockedCount++;
              } else {
                newCount++;
              }
            }
          }
        } catch {}
      }

      if (newCount > 0) {
        return {
          shouldWake: true,
          message: `${newCount} new message(s) received via social inbox`,
        };
      }

      return { shouldWake: false };
    } catch {
      return { shouldWake: false };
    }
  },

  heartbeat_ping: async (tickCtx: any, _taskCtx: any): Promise<HeartbeatTaskResult> => {
    const isCritical = tickCtx.survivalTier === "critical" || tickCtx.survivalTier === "dead";
    const payload = {
      creditsCents: tickCtx.creditBalance,
      tier: tickCtx.survivalTier,
      timestamp: new Date().toISOString(),
    };

    if (tickCtx.db) {
      try {
        const rawDb = tickCtx.db.raw || tickCtx.db;
        rawDb.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('last_heartbeat_ping', ?, datetime('now'))").run(JSON.stringify(payload));
        if (isCritical) {
          rawDb.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('last_distress', ?, datetime('now'))").run(JSON.stringify(payload));
        }
      } catch {}
    }

    if (isCritical) {
      return {
        shouldWake: true,
        message: `Distress signal fired due to ${tickCtx.survivalTier} tier`,
      };
    }

    return { shouldWake: false };
  },

  check_credits: async (tickCtx: any, _taskCtx: any): Promise<HeartbeatTaskResult> => {
    let prevTier: string | null = null;
    if (tickCtx.db) {
      try {
        const rawDb = tickCtx.db.raw || tickCtx.db;
        const row = rawDb.prepare("SELECT value FROM kv WHERE key = 'prev_credit_tier'").get() as any;
        prevTier = row?.value ?? null;
        rawDb.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('prev_credit_tier', ?, datetime('now'))").run(tickCtx.survivalTier);
        rawDb.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('last_credit_check', ?, datetime('now'))").run(JSON.stringify({ credits: tickCtx.creditBalance, timestamp: new Date().toISOString() }));
      } catch {}
    }

    const tierDropped = prevTier !== null && prevTier !== tickCtx.survivalTier && (tickCtx.survivalTier === "critical" || tickCtx.survivalTier === "dead");
    if (tierDropped) {
      return {
        shouldWake: true,
        message: `Credit tier dropped to ${tickCtx.survivalTier}`,
      };
    }

    return { shouldWake: false };
  },

  check_usdc_balance: async (tickCtx: any, _taskCtx: any): Promise<HeartbeatTaskResult> => {
    if (tickCtx.db) {
      try {
        const rawDb = tickCtx.db.raw || tickCtx.db;
        rawDb.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('last_usdc_check', ?, datetime('now'))").run(new Date().toISOString());
      } catch {}
    }

    const hasUsdcLowCredits = (tickCtx?.usdcBalance ?? 0) >= 5.0 && (tickCtx?.creditBalance ?? 0) < 1000;
    if (hasUsdcLowCredits) {
      return {
        shouldWake: true,
        message: `Has ${tickCtx.usdcBalance} USDC available for topup`,
      };
    }

    return { shouldWake: false };
  },

  health_check: async (tickCtx: any, taskCtx: any): Promise<HeartbeatTaskResult> => {
    let failing = false;
    let errMessage = "";

    if (taskCtx && typeof taskCtx.checkHealth === "function") {
      try {
        const ok = await taskCtx.checkHealth();
        if (!ok) {
          failing = true;
          errMessage = "Health check failed: sandbox exec returned non-zero";
        }
      } catch (err: any) {
        failing = true;
        errMessage = `Health check failed: ${err?.message || "sandbox unreachable"}`;
      }
    } else if (taskCtx?.mindmods?.exec) {
      try {
        const result = await taskCtx.mindmods.exec("echo alive", 5000);
        if (result.exitCode !== 0) {
          failing = true;
          errMessage = "Health check failed: sandbox exec returned non-zero";
        }
      } catch (err: any) {
        failing = true;
        errMessage = `Health check failed: ${err?.message || "sandbox unreachable"}`;
      }
    }

    if (failing) {
      if (tickCtx.db) {
        try {
          const rawDb = tickCtx.db.raw || tickCtx.db;
          const prevStatus = rawDb.prepare("SELECT value FROM kv WHERE key = 'health_check_status'").get() as any;
          if (prevStatus?.value !== "failing") {
            rawDb.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('health_check_status', 'failing', datetime('now'))").run();
            return { shouldWake: true, message: errMessage };
          }
        } catch {}
      }
      return { shouldWake: false };
    }

    if (tickCtx.db) {
      try {
        const rawDb = tickCtx.db.raw || tickCtx.db;
        rawDb.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('health_check_status', 'ok', datetime('now'))").run();
        rawDb.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('last_health_check', ?, datetime('now'))").run(new Date().toISOString());
      } catch {}
    }

    return { shouldWake: false };
  },

  refresh_models: async (tickCtx: any, taskCtx: any): Promise<HeartbeatTaskResult> => {
    try {
      if (taskCtx?.mindmods?.listModels) {
        const models = await taskCtx.mindmods.listModels();
        if (models && models.length > 0) {
          const rawDb = tickCtx.db ? (tickCtx.db.raw || tickCtx.db) : (taskCtx.db ? (taskCtx.db.raw || taskCtx.db) : null);
          if (rawDb) {
            rawDb.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('last_model_refresh', ?, datetime('now'))").run(JSON.stringify({ count: models.length }));
          }
        }
      }
    } catch {}
    return { shouldWake: false };
  },

  entelechy_full_potential: async (tickCtx: any, _taskCtx: any): Promise<HeartbeatTaskResult> => {
    try {
      const { callEntelechyMcpTool, ENTELECHY_DEFAULT_BANK } = await import("../memory/entelechy-client.js");
      const bankId = ENTELECHY_DEFAULT_BANK; // 'sovereign'

      let rawDb = tickCtx?.db ? (tickCtx.db.raw || tickCtx.db) : (_taskCtx?.db ? (_taskCtx.db.raw || _taskCtx.db) : null);
      if (!rawDb) {
        try {
          const { getDb } = await import("../state/database.js");
          rawDb = getDb();
        } catch {}
      }

      if (rawDb) {
        // 1. Synchronize newly completed turns to Entelechy memory
        const lastSyncRow = rawDb.prepare("SELECT value FROM kv WHERE key = 'entelechy_last_synced_turn'").get() as any;
        const lastSyncedRowid = lastSyncRow ? parseInt(lastSyncRow.value, 10) : 0;

        const newTurns = rawDb.prepare(
          "SELECT rowid, id, timestamp, input, thinking, reasoning, tool_calls FROM turns WHERE rowid > ? ORDER BY rowid ASC LIMIT 5"
        ).all(lastSyncedRowid) as any[];

        for (const turn of newTurns) {
          const content = `TURN rowid:${turn.rowid} id:${turn.id} [${turn.timestamp}]:\nINPUT: ${turn.input?.slice(0, 500) || "N/A"}\nTHINKING: ${turn.thinking?.slice(0, 500) || "N/A"}\nTOOLS: ${turn.tool_calls?.slice(0, 500) || "none"}`;
          try {
            await callEntelechyMcpTool("retain", {
              bank_id: bankId,
              content,
              context: `turn_rowid_${turn.rowid}`,
            });
            rawDb.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('entelechy_last_synced_turn', ?, datetime('now'))").run(turn.rowid.toString());
          } catch (err: any) {
            console.error(`[Entelechy] Failed to retain turn rowid ${turn.rowid}:`, err?.message || err);
          }
        }

        // 2. Autonomic MASS Heartbeat synchronization
        const heartbeatSummary = `MASS HEARTBEAT [${new Date().toISOString()}]: Tier: ${tickCtx?.survivalTier || "normal"}, Credits: $${(((tickCtx?.creditBalance ?? 0)) / 100).toFixed(2)}. Bank '${bankId}' operational.`;
        try {
          await callEntelechyMcpTool("retain", {
            bank_id: bankId,
            content: heartbeatSummary,
            context: "heartbeat_mass_sync",
          });
        } catch (err: any) {
          console.error('[Entelechy] Failed to retain MASS heartbeat:', err?.message || err);
        }

        rawDb.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('last_entelechy_full_potential', ?, datetime('now'))").run(new Date().toISOString());
      }
    } catch (err: any) {
      console.error('[Entelechy] entelechy_full_potential error:', err?.message || err);
    }
    return { shouldWake: false };
  },
};

export const BUILTIN_TASK_TYPES = {
  HEALTH_CHECK: 'health_check',
  CLEANUP: 'cleanup',
  ORCHESTRATOR_TICK: 'orchestrator_tick',
  FLEET_CENSUS: 'fleet_census',
  GATEWAY_ACTIVITY: 'gateway_activity',
  INTELLIGENCE_SCOUT: 'intelligence_scout',
  CHECK_CREDITS: 'check_credits',
  CHECK_USDC_BALANCE: 'check_usdc_balance',
  CHECK_FOR_UPDATES: 'check_for_updates',
  CHECK_SOCIAL_INBOX: 'check_social_inbox',
  HEARTBEAT_PING: 'heartbeat_ping',
  REFRESH_MODELS: 'refresh_models',
  ENTELECHY_FULL_POTENTIAL: 'entelechy_full_potential',
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
  for (const [taskName, taskFn] of Object.entries(BUILTIN_TASKS)) {
    scheduler.registerTask(taskName, async (tickCtx?: any, taskCtx?: any) => {
      return await taskFn(tickCtx || {}, taskCtx || {});
    });
  }

  // Builtin Cleanup: reaps stale/stopped/failed child processes from the DB if available
  scheduler.registerTask(BUILTIN_TASK_TYPES.CLEANUP, async () => {
    let reapedCount = 0;
    const targetDb = db || (scheduler as any).rawDb;
    if (targetDb && typeof targetDb.prepare === 'function') {
      try {
        const cutoff = new Date(Date.now() - 3600_000).toISOString();
        const res = targetDb.prepare(
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
    const { ingestOrchestratorStatus } = await import('../work-queue/ingest.js');
    const item = ingestOrchestratorStatus('ORCHESTRATOR_TICK: evaluating task status');
    return { status: 'enqueued', workItemId: item.id, timestamp: Date.now() };
  });

  // Schedule default entries
  scheduler.scheduleTask('default_health_check', BUILTIN_TASK_TYPES.HEALTH_CHECK, { intervalMs: 300000 });
  scheduler.scheduleTask('default_cleanup', BUILTIN_TASK_TYPES.CLEANUP, { intervalMs: 3600000 });
  scheduler.scheduleTask('default_orchestrator_tick', BUILTIN_TASK_TYPES.ORCHESTRATOR_TICK, { intervalMs: 60000 });
  scheduler.scheduleTask('default_fleet_census', BUILTIN_TASK_TYPES.FLEET_CENSUS, { intervalMs: 900000 });
  scheduler.scheduleTask('default_gateway_activity', BUILTIN_TASK_TYPES.GATEWAY_ACTIVITY, { intervalMs: 300000 });
  scheduler.scheduleTask('default_intelligence_scout', BUILTIN_TASK_TYPES.INTELLIGENCE_SCOUT, { intervalMs: 21600000 });
  scheduler.scheduleTask('default_entelechy_full_potential', BUILTIN_TASK_TYPES.ENTELECHY_FULL_POTENTIAL, { intervalMs: 120000 });
}
