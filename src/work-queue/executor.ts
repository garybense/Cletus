// src/work-queue/executor.ts

import { WorkItem, WorkResult } from './types.js';
import { runAgentLoop } from '../agent/loop.js';
import { checkEntelechyTaskCache, retainEntelechyTaskResult } from '../memory/entelechy-client.js';

export interface ExecutorContext {
  agentId?: string;
  maxToolCallsPerInvocation?: number;
}

export async function executeWorkItem(item: WorkItem, context: ExecutorContext = {}): Promise<WorkResult> {
  try {
    // Optimization / Memory Efficiency: Check Entelechy recall cache before executing work item.
    // Reuses cached task results for identical task payloads to eliminate duplicate LLM turns and API cost.
    // Expected Impact: Instant response latency (<1ms) and 0 token cost for duplicate/repeated work items.
    const taskKey = `work_item:${item.source}:${JSON.stringify(item.payload)}`;
    const cacheCheck = await checkEntelechyTaskCache(taskKey);
    if (cacheCheck.cached && cacheCheck.data !== undefined) {
      return {
        success: true,
        task_done: true,
        output: cacheCheck.data,
        data: { cached: true, source: 'entelechy_cache' },
        timestamp: Date.now(),
      };
    }

    // Single bounded invocation for the work item
    const loopResult: any = await runAgentLoop({
      maxTurns: context.maxToolCallsPerInvocation || 5,
      workPayload: item.payload,
      workItemId: item.id,
    } as any);

    const isTaskDone = Boolean(loopResult?.taskDone || loopResult?.completed);

    if (isTaskDone) {
      const outputSummary = typeof loopResult?.output === 'string'
        ? loopResult.output
        : JSON.stringify(loopResult?.output || {});
      await retainEntelechyTaskResult(taskKey, outputSummary);
    }

    return {
      success: true,
      task_done: isTaskDone,
      output: loopResult?.output || loopResult,
      data: loopResult?.data || {},
      timestamp: Date.now(),
    };
  } catch (err: any) {
    return {
      success: false,
      task_done: false,
      error: err?.message || String(err),
      timestamp: Date.now(),
    };
  }
}
