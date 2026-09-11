import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, initDb, closeDb } from '../state/database';
import { DurableScheduler } from '../heartbeat/scheduler';
import { enqueue } from '../work-queue/queue';
import { WorkItem, WorkResult } from '../work-queue/types';

describe('DurableScheduler Work Dispatch (Phase 1)', () => {
  beforeEach(() => {
    initDb(':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  it('dispatches claimed work items through registered work handler during tick()', async () => {
    const scheduler = new DurableScheduler('test-scheduler');
    const processedIds: string[] = [];

    scheduler.registerWorkHandler(async (item: WorkItem): Promise<WorkResult> => {
      processedIds.push(item.id);
      return {
        success: true,
        task_done: true,
        timestamp: Date.now(),
      };
    });

    const item1 = enqueue({
      source: 'creator',
      priority: 10,
      payload: { cmd: 'task1' },
      acceptance_predicate: 'result.task_done === true',
    });

    const item2 = enqueue({
      source: 'orchestrator',
      priority: 5,
      payload: { cmd: 'task2' },
      acceptance_predicate: 'result.task_done === true',
    });

    const stats = await scheduler.tick();

    expect(stats.executedWorkItems).toBe(2);
    expect(processedIds).toEqual([item1.id, item2.id]);

    const db = getDb();
    const row1 = db.prepare('SELECT status FROM work_queue WHERE id = ?').get(item1.id) as any;
    const row2 = db.prepare('SELECT status FROM work_queue WHERE id = ?').get(item2.id) as any;

    expect(row1.status).toBe('completed');
    expect(row2.status).toBe('completed');
  });
});
