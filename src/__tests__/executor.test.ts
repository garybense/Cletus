import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb, initDb, closeDb } from '../state/database';
import { executeWorkItem } from '../work-queue/executor';
import { WorkItem } from '../work-queue/types';
import * as loopModule from '../agent/loop';

describe('Work Queue Executor (Phase 3)', () => {
  beforeEach(() => {
    initDb(':memory:');
  });

  afterEach(() => {
    closeDb();
    vi.restoreAllMocks();
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

  it('uses cached Entelechy task memory result when available', async () => {
    const entelechy = await import('../memory/entelechy-client.js');
    vi.spyOn(entelechy, 'checkEntelechyTaskCache').mockResolvedValueOnce({
      cached: true,
      data: 'Cached task result from Entelechy',
    });

    const runSpy = vi.spyOn(loopModule, 'runAgentLoop');

    const item: WorkItem = {
      id: 'cached-work-999',
      source: 'creator',
      priority: 50,
      payload: { command: 'cached query' },
      acceptance_predicate: 'result.task_done === true',
      spend_bearing: false,
      status: 'claimed',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    const result = await executeWorkItem(item);

    expect(result.success).toBe(true);
    expect(result.task_done).toBe(true);
    expect(result.output).toBe('Cached task result from Entelechy');
    expect(result.data?.cachedFromEntelechy).toBe(true);
    expect(runSpy).not.toHaveBeenCalled();
  });

  it('retains task output in Entelechy memory on successful completion', async () => {
    const entelechy = await import('../memory/entelechy-client.js');
    vi.spyOn(entelechy, 'checkEntelechyTaskCache').mockResolvedValueOnce({ cached: false });
    const retainSpy = vi.spyOn(entelechy, 'retainEntelechyTaskResult').mockResolvedValueOnce();

    vi.spyOn(loopModule, 'runAgentLoop').mockResolvedValueOnce({
      completed: true,
      output: 'Task result retained in Entelechy',
    } as any);

    const item: WorkItem = {
      id: 'retain-work-888',
      source: 'maintenance',
      priority: 80,
      payload: { command: 'retain command' },
      acceptance_predicate: 'result.task_done === true',
      spend_bearing: false,
      status: 'claimed',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    const result = await executeWorkItem(item);

    expect(result.success).toBe(true);
    expect(result.task_done).toBe(true);
    expect(retainSpy).toHaveBeenCalledWith('work_item:retain-work-888', 'Task result retained in Entelechy');
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
});
