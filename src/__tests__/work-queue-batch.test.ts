import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { enqueueBatch, enqueue, getQueueMetrics } from '../work-queue/queue.js';
import { initDb, closeDb, getDb } from '../state/database.js';
import type { EnqueueWorkItemInput } from '../work-queue/types.js';

describe('Work Queue Batch Enqueue Optimization', () => {
  beforeEach(() => {
    initDb(':memory:');
    delete process.env.CLETUS_QUEUE_SATURATION_LIMIT;
  });

  afterEach(() => {
    closeDb();
    delete process.env.CLETUS_QUEUE_SATURATION_LIMIT;
  });

  it('should return empty array when batch inputs are empty', () => {
    const result = enqueueBatch([]);
    expect(result).toEqual([]);
  });

  it('should successfully enqueue a batch of items inside a single transaction', () => {
    const inputs: EnqueueWorkItemInput[] = [
      {
        source: 'orchestrator',
        priority: 10,
        payload: { taskId: 'task-1', category: 'data_collection' },
        acceptance_predicate: 'result.success === true',
      },
      {
        source: 'social',
        priority: 5,
        payload: { taskId: 'task-2', category: 'social_engagement' },
        acceptance_predicate: 'result.success === true',
      },
      {
        source: 'maintenance',
        priority: 1,
        payload: { taskId: 'task-3', category: 'health_check' },
        acceptance_predicate: 'result.success === true',
      },
    ];

    const items = enqueueBatch(inputs);

    expect(items.length).toBe(3);
    expect(items[0].source).toBe('orchestrator');
    expect(items[0].priority).toBe(10);
    expect(items[1].source).toBe('social');
    expect(items[2].source).toBe('maintenance');

    const metrics = getQueueMetrics();
    expect(metrics.pending).toBe(3);
    expect(metrics.claimed).toBe(0);
    expect(metrics.totalActive).toBe(3);
  });

  it('should reject batch if any item is missing an acceptance predicate', () => {
    const inputs: EnqueueWorkItemInput[] = [
      {
        source: 'orchestrator',
        priority: 1,
        payload: { taskId: 'valid-1' },
        acceptance_predicate: 'result.success === true',
      },
      {
        source: 'orchestrator',
        priority: 1,
        payload: { taskId: 'invalid-2' },
        acceptance_predicate: '',
      },
    ];

    expect(() => enqueueBatch(inputs)).toThrow(/acceptance_predicate is required/);

    const metrics = getQueueMetrics();
    expect(metrics.totalActive).toBe(0);
  });

  it('should enforce backpressure when batch exceeds saturation limit', () => {
    process.env.CLETUS_QUEUE_SATURATION_LIMIT = '2';

    const inputs: EnqueueWorkItemInput[] = [
      {
        source: 'orchestrator',
        priority: 1,
        payload: { taskId: '1' },
        acceptance_predicate: 'result.success === true',
      },
      {
        source: 'orchestrator',
        priority: 1,
        payload: { taskId: '2' },
        acceptance_predicate: 'result.success === true',
      },
      {
        source: 'orchestrator',
        priority: 1,
        payload: { taskId: '3' },
        acceptance_predicate: 'result.success === true',
      },
    ];

    expect(() => enqueueBatch(inputs)).toThrow(/Queue saturation backpressure/);

    const metrics = getQueueMetrics();
    expect(metrics.totalActive).toBe(0);
  });

  it('should measure batch enqueue performance versus individual enqueues', () => {
    const count = 50;
    const inputs: EnqueueWorkItemInput[] = Array.from({ length: count }, (_, i) => ({
      source: 'orchestrator',
      priority: i,
      payload: { index: i },
      acceptance_predicate: 'result.success === true',
    }));

    const startSingle = performance.now();
    for (const input of inputs) {
      enqueue(input);
    }
    const endSingle = performance.now();
    const durationSingle = endSingle - startSingle;

    closeDb();
    initDb(':memory:');

    const startBatch = performance.now();
    enqueueBatch(inputs);
    const endBatch = performance.now();
    const durationBatch = endBatch - startBatch;

    expect(getQueueMetrics().pending).toBe(count);
    expect(durationBatch).toBeLessThanOrEqual(durationSingle + 500); // Verify batch executes cleanly within threshold
  });
});
