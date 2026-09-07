// src/heartbeat/scheduler.ts

import { getDb } from '../state/database.js';
import { claim, complete, fail } from '../work-queue/queue.js';
import { WorkItem, WorkResult } from '../work-queue/types.js';
import { randomUUID } from 'crypto';

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

  constructor(workerId = 'durable-scheduler-1') {
    this.workerId = workerId;
  }

  registerTask(taskType: string, handler: TaskHandler): void {
    this.handlers.set(taskType, handler);
  }

  registerWorkHandler(handler: WorkHandler): void {
    this.workHandler = handler;
  }

  scheduleTask(id: string, taskType: string, options: ScheduleOptions): void {
    const db = getDb();
    const now = Date.now();
    let nextRunAt = now;

    if (options.intervalMs) {
      nextRunAt = now + options.intervalMs;
    }

    db.prepare(`
      INSERT INTO heartbeat_schedules (id, task_type, cron_expr, interval_ms, enabled, created_at, updated_at, next_run_at)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_type = excluded.task_type,
        cron_expr = excluded.cron_expr,
        interval_ms = excluded.interval_ms,
        updated_at = excluded.updated_at,
        next_run_at = excluded.next_run_at
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
      const db = getDb();
      const now = Date.now();

      // 1. Process scheduled heartbeat tasks
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

      // 2. Claim and process queued work items if work handler registered
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
