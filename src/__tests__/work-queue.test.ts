import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, initDb, closeDb } from '../state/database';
import { enqueue, enqueueBatch, claim, claimBatch, complete, fail, expire } from '../work-queue/queue';
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

  it('enqueues and claims items in batches atomically', () => {
    const items = enqueueBatch([
      { source: 'creator', priority: 10, payload: { num: 1 }, acceptance_predicate: 'result.success === true' },
      { source: 'creator', priority: 20, payload: { num: 2 }, acceptance_predicate: 'result.success === true' },
      { source: 'creator', priority: 30, payload: { num: 3 }, acceptance_predicate: 'result.success === true' },
    ]);

    expect(items.length).toBe(3);

    const claimed = claimBatch('worker-batch', 2);
    expect(claimed.length).toBe(2);
    expect(claimed[0].payload.num).toBe(3); // Priority 30
    expect(claimed[1].payload.num).toBe(2); // Priority 20

    const claimedRemaining = claimBatch('worker-batch', 2);
    expect(claimedRemaining.length).toBe(1);
    expect(claimedRemaining[0].payload.num).toBe(1); // Priority 10
  });

  it('retries items when retries remain and fails when max retries exceeded', () => {
    const item = enqueue({
      source: 'orchestrator',
      payload: { task: 'retry-test' },
      acceptance_predicate: 'result.success === true',
      max_retries: 2,
    });

    const claimed1 = claim('worker-1');
    expect(claimed1).not.toBeNull();

    // First attempt fails predicate -> retried to pending (retry_count = 1)
    const result1 = complete(claimed1!.id, { success: false, timestamp: Date.now() });
    expect(result1.success).toBe(false);
    expect(result1.item.status).toBe('pending');
    expect(result1.item.retry_count).toBe(1);

    const claimed2 = claim('worker-2');
    expect(claimed2).not.toBeNull();
    expect(claimed2!.id).toBe(item.id);

    // Second attempt fails predicate -> retried to pending (retry_count = 2)
    const result2 = complete(claimed2!.id, { success: false, timestamp: Date.now() });
    expect(result2.success).toBe(false);
    expect(result2.item.status).toBe('pending');
    expect(result2.item.retry_count).toBe(2);

    const claimed3 = claim('worker-3');
    expect(claimed3).not.toBeNull();

    // Third attempt fails predicate -> exceeds max_retries (2) -> failed
    const result3 = complete(claimed3!.id, { success: false, timestamp: Date.now() });
    expect(result3.success).toBe(false);
    expect(result3.item.status).toBe('failed');
    expect(result3.item.retry_count).toBe(2);
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
