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
    vi.restoreAllMocks();
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

  it('bypasses execution via Entelechy task recall cache when taskKey is provided', async () => {
    const entelechyModule = await import('../memory/entelechy-client');
    vi.spyOn(entelechyModule, 'checkEntelechyTaskCache').mockResolvedValueOnce({
      cached: true,
      data: 'Cached Entelechy task output',
    });

    const loopSpy = vi.spyOn(loopModule, 'runAgentLoop');

    const item: WorkItem = {
      id: 'work-cached-1',
      source: 'orchestrator',
      priority: 50,
      payload: { taskKey: 'price_check_eth' },
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
    expect(result.data).toEqual({ cached: true, source: 'entelechy_task_cache' });
    expect(loopSpy).not.toHaveBeenCalled();
  });

  it('retains task output in Entelechy memory when taskKey is provided and task completes', async () => {
    const entelechyModule = await import('../memory/entelechy-client');
    vi.spyOn(entelechyModule, 'checkEntelechyTaskCache').mockResolvedValueOnce({
      cached: false,
    });
    const retainSpy = vi.spyOn(entelechyModule, 'retainEntelechyTaskResult').mockResolvedValueOnce();

    vi.spyOn(loopModule, 'runAgentLoop').mockResolvedValueOnce({
      taskDone: true,
      output: 'Freshly computed price $3200',
    } as any);

    const item: WorkItem = {
      id: 'work-retain-1',
      source: 'orchestrator',
      priority: 50,
      payload: { taskKey: 'fresh_price_check' },
      acceptance_predicate: 'result.task_done === true',
      spend_bearing: false,
      status: 'claimed',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    const result = await executeWorkItem(item);

    expect(result.success).toBe(true);
    expect(result.task_done).toBe(true);
    expect(result.output).toBe('Freshly computed price $3200');
    expect(retainSpy).toHaveBeenCalledWith('fresh_price_check', 'Freshly computed price $3200');
  });
});
