import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, initDb, closeDb } from '../state/database';
import { enqueue, claim, claimBatch, complete, fail, expire } from '../work-queue/queue';
import { WorkResult } from '../work-queue/types';

describe('Work Queue (Phase 0)', () => {
  beforeEach(() => {
    initDb(':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  it('rejects enqueue when acceptance_predicate is missing or empty', () => {
    expect(() => {
      enqueue({
        source: 'creator',
        payload: { task: 'do something' },
        acceptance_predicate: '',
      });
    }).toThrow(/acceptance_predicate is required/i);

    expect(() => {
      enqueue({
        source: 'creator',
        payload: { task: 'do something' },
        // @ts-expect-error test missing predicate
        acceptance_predicate: null,
      });
    }).toThrow(/acceptance_predicate is required/i);
  });

  it('enqueues a work item with required acceptance_predicate successfully', () => {
    const item = enqueue({
      source: 'creator',
      priority: 10,
      payload: { command: 'hello' },
      acceptance_predicate: 'result.task_done === true',
      spend_bearing: true,
    });

    expect(item.id).toBeDefined();
    expect(item.source).toBe('creator');
    expect(item.priority).toBe(10);
    expect(item.acceptance_predicate).toBe('result.task_done === true');
    expect(item.status).toBe('pending');
  });

  it('claims highest priority pending work item', () => {
    enqueue({
      source: 'maintenance',
      priority: 1,
      payload: { task: 'maint' },
      acceptance_predicate: 'result.success === true',
    });

    const highPriority = enqueue({
      source: 'creator',
      priority: 100,
      payload: { task: 'command' },
      acceptance_predicate: 'result.success === true',
    });

    const claimed = claim('worker-1');
    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(highPriority.id);
    expect(claimed?.status).toBe('claimed');
    expect(claimed?.claimed_by).toBe('worker-1');
  });

  it('evaluates acceptance_predicate mechanically on complete() and fails completion if predicate evaluates to false', () => {
    const item = enqueue({
      source: 'orchestrator',
      payload: { task: 'subtask' },
      acceptance_predicate: 'result.task_done === true',
    });

    const claimed = claim('worker-1');
    expect(claimed).not.toBeNull();

    // WorkResult with task_done = false
    const invalidResult: WorkResult = {
      success: true,
      task_done: false,
      timestamp: Date.now(),
    };

    const completed = complete(claimed!.id, invalidResult);
    expect(completed.success).toBe(false);
    expect(completed.item.status).toBe('failed');
    expect(completed.item.error).toContain('Acceptance predicate evaluation failed');

    // Check DB status
    const db = getDb();
    const row = db.prepare('SELECT * FROM work_queue WHERE id = ?').get(claimed!.id) as any;
    expect(row.status).toBe('failed');
  });

  it('successfully completes work item when acceptance_predicate evaluates to true', () => {
    const item = enqueue({
      source: 'orchestrator',
      payload: { task: 'subtask' },
      acceptance_predicate: 'result.task_done === true',
    });

    const claimed = claim('worker-1');
    expect(claimed).not.toBeNull();

    const validResult: WorkResult = {
      success: true,
      task_done: true,
      timestamp: Date.now(),
    };

    const completed = complete(claimed!.id, validResult);
    expect(completed.success).toBe(true);
    expect(completed.item.status).toBe('completed');

    const db = getDb();
    const row = db.prepare('SELECT * FROM work_queue WHERE id = ?').get(claimed!.id) as any;
    expect(row.status).toBe('completed');
  });

  it('allows failing and expiring work items', () => {
    const item1 = enqueue({
      source: 'maintenance',
      payload: {},
      acceptance_predicate: 'result.success === true',
    });
    claim('worker-1');

    const failed = fail(item1.id, 'Runtime exception');
    expect(failed.status).toBe('failed');
    expect(failed.error).toBe('Runtime exception');

    const item2 = enqueue({
      source: 'maintenance',
      payload: {},
      acceptance_predicate: 'result.success === true',
    });
    const expired = expire(item2.id);
    expect(expired.status).toBe('expired');
  });

  it('claims multiple work items atomically with claimBatch', () => {
    enqueue({ source: 'test', priority: 1, payload: { id: 1 }, acceptance_predicate: 'result.success === true' });
    enqueue({ source: 'test', priority: 5, payload: { id: 2 }, acceptance_predicate: 'result.success === true' });
    enqueue({ source: 'test', priority: 10, payload: { id: 3 }, acceptance_predicate: 'result.success === true' });

    const batch = claimBatch('worker-batch', 2);
    expect(batch).toHaveLength(2);
    expect(batch[0].payload).toEqual({ id: 3 });
    expect(batch[1].payload).toEqual({ id: 2 });
    expect(batch[0].claimed_by).toBe('worker-batch');
    expect(batch[1].claimed_by).toBe('worker-batch');
  });

  it('performs cheap safe retries when retry_count < max_retries on predicate or execution failure', () => {
    const item = enqueue({
      source: 'orchestrator',
      payload: { max_retries: 2, task: 'scrape' },
      acceptance_predicate: 'result.task_done === true',
    });

    const claimed = claim('worker-1');
    expect(claimed).not.toBeNull();

    // First attempt fails predicate evaluation -> should retry
    const res1 = complete(claimed!.id, { success: true, task_done: false, timestamp: Date.now() });
    expect(res1.success).toBe(false);
    expect(res1.item.status).toBe('pending');
    expect(res1.item.payload.retry_count).toBe(1);

    // Claim second time
    const claimed2 = claim('worker-1');
    expect(claimed2).not.toBeNull();
    expect(claimed2?.payload.retry_count).toBe(1);

    // Second attempt fails with error -> should retry again
    const res2 = fail(claimed2!.id, 'Network timeout');
    expect(res2.status).toBe('pending');
    expect(res2.payload.retry_count).toBe(2);

    // Claim third time
    const claimed3 = claim('worker-1');
    expect(claimed3).not.toBeNull();

    // Third attempt fails error -> max retries (2) exceeded, now marked failed
    const res3 = fail(claimed3!.id, 'Network timeout again');
    expect(res3.status).toBe('failed');
  });

  it('respects CLETUS_QUEUE_SATURATION_LIMIT env variable for backpressure', () => {
    enqueue({
      source: 'test',
      payload: {},
      acceptance_predicate: 'result.success === true',
    });

    const originalEnv = process.env.CLETUS_QUEUE_SATURATION_LIMIT;
    process.env.CLETUS_QUEUE_SATURATION_LIMIT = '1';

    try {
      expect(() => {
        enqueue({
          source: 'test',
          payload: {},
          acceptance_predicate: 'result.success === true',
        });
      }).toThrow(/Queue saturation backpressure: reached limit of 1/i);
    } finally {
      if (originalEnv === undefined) {
        delete process.env.CLETUS_QUEUE_SATURATION_LIMIT;
      } else {
        process.env.CLETUS_QUEUE_SATURATION_LIMIT = originalEnv;
      }
    }
  });
});
