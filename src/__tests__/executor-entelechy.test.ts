import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeWorkItem } from '../work-queue/executor.js';
import { WorkItem } from '../work-queue/types.js';
import { pruneEntelechyCache } from '../memory/entelechy-client.js';
import { ColonyMessaging, LocalDBTransport } from '../orchestration/messaging.js';
import { createTestDb } from './mocks.js';
import type { CletusDatabase } from '../types.js';

// Mock runAgentLoop to simulate task execution
vi.mock('../agent/loop.js', () => ({
  runAgentLoop: vi.fn(async (opts: any) => {
    return {
      taskDone: true,
      completed: true,
      output: `Executed payload: ${JSON.stringify(opts.workPayload)}`,
    };
  }),
}));

describe('Entelechy Task Cache & Batched Messaging', () => {
  let db: CletusDatabase;

  beforeEach(() => {
    db = createTestDb();
    pruneEntelechyCache(0); // clear cache before each test

    // Stub global fetch so Entelechy MCP calls return empty content during initial uncached recall check
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () => JSON.stringify({ content: [] }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    db.close();
  });

  it('bypasses agent loop execution on cached Entelechy work item results', async () => {
    const item: WorkItem = {
      id: 'item-1',
      source: 'creator',
      priority: 10,
      payload: { query: 'price_check', target: 'SOL/USDC' },
      acceptance_predicate: 'result.task_done === true',
      spend_bearing: false,
      status: 'claimed',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    // First execution: uncached
    const firstResult = await executeWorkItem(item);
    expect(firstResult.success).toBe(true);
    expect(firstResult.task_done).toBe(true);
    expect(firstResult.output).toContain('Executed payload');

    // Second execution with identical payload: should hit Entelechy cache
    const secondResult = await executeWorkItem(item);
    expect(secondResult.success).toBe(true);
    expect(secondResult.task_done).toBe(true);
    expect(secondResult.data?.cached).toBe(true);
    expect(secondResult.data?.source).toBe('entelechy_cache');
    expect(secondResult.output).toBe(firstResult.output);
  });

  it('delivers batch messages in single transaction pass via ColonyMessaging.sendBatch', async () => {
    const transport = new LocalDBTransport(db);
    const messaging = new ColonyMessaging(transport, db);

    const msg1 = messaging.createMessage({
      type: 'task_assignment',
      to: '0xchild1',
      content: 'Task 1 data collection',
    });

    const msg2 = messaging.createMessage({
      type: 'task_assignment',
      to: '0xchild2',
      content: 'Task 2 content aggregation',
    });

    const res = await messaging.sendBatch([msg1, msg2]);
    expect(res.sent).toBe(2);
    expect(res.failed).toBe(0);

    const countRow = db.raw.prepare("SELECT COUNT(*) as count FROM inbox_messages").get() as { count: number };
    expect(countRow.count).toBe(2);
  });
});
