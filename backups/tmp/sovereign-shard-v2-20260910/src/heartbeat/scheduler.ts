// src/heartbeat/scheduler.ts

import {
  getDb,
  getHeartbeatSchedule,
  acquireTaskLease,
  releaseTaskLease,
  insertHeartbeatHistory,
  updateHeartbeatSchedule,
} from '../state/database.js';
import { claim, complete, fail } from '../work-queue/queue.js';
import { WorkItem, WorkResult } from '../work-queue/types.js';
import { randomUUID } from 'crypto';
import type {
  HeartbeatConfig,
  HeartbeatTaskFn,
  HeartbeatLegacyContext,
} from '../types.js';
import type BetterSqlite3 from 'better-sqlite3';

export type TaskHandler = (payload?: Record<string, unknown>) => Promise<unknown>;
export type WorkHandler = (item: WorkItem) => Promise<WorkResult>;

export interface ScheduleOptions {
  cronExpr?: string;
  intervalMs?: number;
}

export class DurableScheduler {
  private handlers = new Map<string, TaskHandler>();
  private workHandler?: WorkHandler;
  private tickInProgress = false;
  private workerId: string;

  private rawDb?: BetterSqlite3.Database;
  private hbConfig?: HeartbeatConfig;
  private taskFns = new Map<string, HeartbeatTaskFn>();
  private legacyContext?: HeartbeatLegacyContext;

  constructor(
    workerIdOrDb: string | BetterSqlite3.Database = 'durable-scheduler-1',
    config?: HeartbeatConfig,
    tasks?: Map<string, HeartbeatTaskFn>,
    legacyContext?: HeartbeatLegacyContext,
  ) {
    if (typeof workerIdOrDb === 'string') {
      this.workerId = workerIdOrDb;
    } else {
      this.rawDb = workerIdOrDb;
      this.workerId = 'durable-scheduler-1';
      this.hbConfig = config;
      if (tasks) {
        this.taskFns = tasks;
        for (const [name, fn] of tasks.entries()) {
          this.handlers.set(name, async () => fn({} as any, this.legacyContext as any));
        }
      }
      this.legacyContext = legacyContext;
    }
  }

  registerTask(taskType: string, handler: TaskHandler): void {
    this.handlers.set(taskType, handler);
  }

  registerWorkHandler(handler: WorkHandler): void {
    this.workHandler = handler;
  }

  scheduleTask(id: string, taskType: string, options: ScheduleOptions): void {
    const db = this.rawDb || getDb();
    const now = Date.now();
    const nextRunAt = now;

    db.prepare(`
      INSERT INTO heartbeat_schedules (id, task_type, cron_expr, interval_ms, enabled, created_at, updated_at, next_run_at)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_type = excluded.task_type,
        cron_expr = excluded.cron_expr,
        interval_ms = excluded.interval_ms,
        updated_at = excluded.updated_at
    `).run(id, taskType, options.cronExpr || null, options.intervalMs || null, now, now, nextRunAt);
  }

  async tick(): Promise<{ executedTasks: number; executedWorkItems: number }> {
    if (this.tickInProgress) {
      return { executedTasks: 0, executedWorkItems: 0 };
    }

    this.tickInProgress = true;
    let executedTasks = 0;
    let executedWorkItems = 0;

    try {
      const db = this.rawDb || getDb();
      const now = Date.now();

      // 1. Process Phase 1.1 heartbeat_schedule table tasks if present
      try {
        const legacySchedules = getHeartbeatSchedule(db);
        for (const schedule of legacySchedules) {
          if (!schedule.enabled) continue;
          const taskFn = this.taskFns.get(schedule.taskName) || (this.handlers.has(schedule.taskName) ? async () => this.handlers.get(schedule.taskName)!() : null);
          if (!taskFn) continue;

          const acquired = acquireTaskLease(db, schedule.taskName, this.workerId, schedule.timeoutMs || 30_000);
          if (!acquired) continue;

          const startTimeIso = new Date().toISOString();
          const startMs = Date.now();

          try {
            let timeoutTimer: NodeJS.Timeout | undefined;
            const timeoutPromise = new Promise((_, reject) => {
              timeoutTimer = setTimeout(() => reject(new Error(`Task ${schedule.taskName} timed out`)), schedule.timeoutMs || 30_000);
            });

            await Promise.race([
              taskFn({} as any, this.legacyContext as any),
              timeoutPromise,
            ]);

            if (timeoutTimer) clearTimeout(timeoutTimer);

            const endMs = Date.now();
            const durationMs = endMs - startMs;
            const completedIso = new Date(endMs).toISOString();

            insertHeartbeatHistory(db, {
              id: randomUUID(),
              taskName: schedule.taskName,
              startedAt: startTimeIso,
              completedAt: completedIso,
              result: "success",
              durationMs,
              error: null,
              idempotencyKey: null,
            });

            updateHeartbeatSchedule(db, schedule.taskName, {
              lastRunAt: completedIso,
              lastResult: "success",
              runCount: (schedule.runCount || 0) + 1,
            });

            executedTasks++;
          } catch (err: any) {
            const endMs = Date.now();
            const durationMs = endMs - startMs;
            const completedIso = new Date(endMs).toISOString();
            const isTimeout = err?.message?.includes("timed out");
            const resultStatus = isTimeout ? "timeout" : "failure";

            insertHeartbeatHistory(db, {
              id: randomUUID(),
              taskName: schedule.taskName,
              startedAt: startTimeIso,
              completedAt: completedIso,
              result: resultStatus,
              durationMs,
              error: err?.message || String(err),
              idempotencyKey: null,
            });

            updateHeartbeatSchedule(db, schedule.taskName, {
              lastRunAt: completedIso,
              lastResult: resultStatus,
              lastError: err?.message || String(err),
              failCount: (schedule.failCount || 0) + 1,
            });

            executedTasks++;
          } finally {
            releaseTaskLease(db, schedule.taskName, this.workerId);
          }
        }
      } catch {
        // Table or schedules query failed (e.g. table not initialized in an isolated test)
      }

      // 2. Process Phase 1 scheduled heartbeat tasks (heartbeat_schedules table)
      try {
        const dueSchedules = db.prepare(`
          SELECT * FROM heartbeat_schedules
          WHERE enabled = 1 AND (next_run_at IS NULL OR next_run_at <= ?)
        `).all(now) as any[];

        for (const schedule of dueSchedules) {
          const handler = this.handlers.get(schedule.task_type);
          if (!handler) continue;

          const runId = randomUUID();
          db.prepare(`
            INSERT INTO heartbeat_runs (id, schedule_id, status, started_at)
            VALUES (?, ?, 'running', ?)
          `).run(runId, schedule.id, now);

          try {
            const result = await handler();
            const finishedAt = Date.now();
            const nextRun = schedule.interval_ms ? finishedAt + schedule.interval_ms : null;

            db.prepare(`
              UPDATE heartbeat_runs
              SET status = 'completed', completed_at = ?, result_json = ?
              WHERE id = ?
            `).run(finishedAt, JSON.stringify(result || {}), runId);

            db.prepare(`
              UPDATE heartbeat_schedules
              SET last_run_at = ?, next_run_at = ?, updated_at = ?
              WHERE id = ?
            `).run(finishedAt, nextRun, finishedAt, schedule.id);

            executedTasks++;
          } catch (err: any) {
            const finishedAt = Date.now();
            db.prepare(`
              UPDATE heartbeat_runs
              SET status = 'failed', completed_at = ?, error = ?
              WHERE id = ?
            `).run(finishedAt, err?.message || String(err), runId);
          }
        }
      } catch {
        // Table or schedules query failed
      }

      // 3. Claim and process queued work items if work handler registered
      if (this.workHandler) {
        let workItem = claim(this.workerId);
        while (workItem) {
          try {
            const result = await this.workHandler(workItem);
            complete(workItem.id, result);
            executedWorkItems++;
          } catch (err: any) {
            fail(workItem.id, err?.message || String(err));
          }
          workItem = claim(this.workerId);
        }
      }
    } finally {
      this.tickInProgress = false;
    }

    return { executedTasks, executedWorkItems };
  }
}
