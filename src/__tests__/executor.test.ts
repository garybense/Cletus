import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb, initDb, closeDb } from '../state/database.js';
import { executeWorkItem } from '../work-queue/executor.js';
import { WorkItem } from '../work-queue/types.js';
import * as loopModule from '../agent/loop.js';
import * as entelechyClient from '../memory/entelechy-client.js';

describe('Work Queue Executor (Phase 3)', () => {
  beforeEach(() => {
    initDb(':memory:');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    closeDb();
    vi.restoreAllMocks();
  });

  it('executes a work item via single-invocation runAgentLoop', async () => {
    vi.spyOn(entelechyClient, 'checkEntelechyTaskCache').mockResolvedValueOnce({ cached: false });
    vi.spyOn(entelechyClient, 'retainEntelechyTaskResult').mockResolvedValueOnce();
    vi.spyOn(loopModule, 'runAgentLoop').mockResolvedValueOnce({
      taskDone: true,
      output: 'Task completed successfully',
    } as any);

    const item: WorkItem = {
      id: 'work-123',
      source: 'creator',
      priority: 100,
      payload: { command: 'test command' },
      acceptance_predicate: 'result.task_done === true',
      spend_bearing: true,
      status: 'claimed',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    const result = await executeWorkItem(item, { maxToolCallsPerInvocation: 3 });

    expect(result.success).toBe(true);
    expect(result.task_done).toBe(true);
    expect(result.output).toBe('Task completed successfully');
  });

  it('bypasses execution loop when Entelechy task recall cache hits', async () => {
    vi.spyOn(entelechyClient, 'checkEntelechyTaskCache').mockResolvedValueOnce({
      cached: true,
      data: 'Cached Entelechy task output',
    });
    const runLoopSpy = vi.spyOn(loopModule, 'runAgentLoop');

    const item: WorkItem = {
      id: 'work-cached-1',
      source: 'creator',
      priority: 50,
      payload: { taskKey: 'custom-key-1', command: 'cached command' },
      acceptance_predicate: 'result.task_done === true',
      spend_bearing: false,
      status: 'claimed',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    const result = await executeWorkItem(item);

    expect(result.success).toBe(true);
    expect(result.task_done).toBe(true);
    expect(result.output).toBe('Cached Entelechy task output');
    expect(result.data?.cachedFromEntelechy).toBe(true);
    expect(runLoopSpy).not.toHaveBeenCalled();
  });

  it('handles execution errors cleanly', async () => {
    vi.spyOn(entelechyClient, 'checkEntelechyTaskCache').mockResolvedValueOnce({ cached: false });
    vi.spyOn(loopModule, 'runAgentLoop').mockRejectedValueOnce(new Error('LLM error'));

    const item: WorkItem = {
      id: 'work-456',
      source: 'maintenance',
      priority: 10,
      payload: { command: 'failing command' },
      acceptance_predicate: 'result.success === true',
      spend_bearing: false,
      status: 'claimed',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    const result = await executeWorkItem(item);

    expect(result.success).toBe(false);
    expect(result.task_done).toBe(false);
    expect(result.error).toBe('LLM error');
  });
});
