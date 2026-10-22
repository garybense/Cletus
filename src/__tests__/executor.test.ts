import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb, initDb, closeDb } from '../state/database';
import { executeWorkItem } from '../work-queue/executor';
import { WorkItem } from '../work-queue/types';
import * as loopModule from '../agent/loop';
import { retainEntelechyTaskResult } from '../memory/entelechy-client';

describe('Work Queue Executor (Phase 3)', () => {
  beforeEach(() => {
    initDb(':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  it('executes a work item via single-invocation runAgentLoop', async () => {
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

  it('handles execution errors cleanly', async () => {
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

  it('bypasses agent loop execution when task result is cached in Entelechy memory', async () => {
    const taskId = 'test-cached-task-123';
    await retainEntelechyTaskResult(taskId, 'Previously executed task output', 'cletus');

    const item: WorkItem = {
      id: 'work-789',
      source: 'test',
      priority: 1,
      payload: { taskId },
      acceptance_predicate: 'result.success === true',
      spend_bearing: false,
      status: 'claimed',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    const result = await executeWorkItem(item);
    expect(result.success).toBe(true);
    expect(result.task_done).toBe(true);
    expect(result.output).toBe('Previously executed task output');
    expect(result.data).toEqual({ cached: true, source: 'entelechy' });
  });
});
