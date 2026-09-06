import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, initDb, closeDb } from '../state/database';
import { enqueue, claim } from '../work-queue/queue';
import { recordChildResult } from '../replication/result-envelope';

describe('Child Result Return & Idempotency (Phase 6)', () => {
  beforeEach(() => {
    initDb(':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  it('records child result, evaluates acceptance predicate, and enforces idempotency', () => {
    const item = enqueue({
      source: 'child',
      payload: { subtask: 'compile' },
      acceptance_predicate: 'result.task_done === true',
    });

    claim('child-worker-1');

    const envelope = {
      childId: 'child-99',
      workItemId: item.id,
      success: true,
      taskDone: true,
      output: 'Compiled successfully',
      timestamp: 1600000000000,
    };

    // First processing
    const firstCall = recordChildResult(envelope);
    expect(firstCall.alreadyProcessed).toBe(false);
    expect(firstCall.success).toBe(true);

    const db = getDb();
    const row = db.prepare('SELECT status FROM work_queue WHERE id = ?').get(item.id) as any;
    expect(row.status).toBe('completed');

    // Duplicate call (idempotency test)
    const secondCall = recordChildResult(envelope);
    expect(secondCall.alreadyProcessed).toBe(true);
  });
});
