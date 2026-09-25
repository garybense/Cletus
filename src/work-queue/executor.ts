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
    // Derive task cache key from payload or work item ID
    const taskKey = (item.payload as any)?.taskKey || (item.payload as any)?.command || item.id;

    // Optimization: Check Entelechy recall cache to avoid redundant LLM turns and network requests
    // Expected Impact: Reduces latency from multi-turn LLM inference (~5-15s) to <5ms on cache hits.
    const cacheResult = await checkEntelechyTaskCache(taskKey);
    if (cacheResult.cached && cacheResult.data) {
      return {
        success: true,
        task_done: true,
        output: cacheResult.data,
        data: { cached: true },
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
    const output = loopResult?.output || loopResult;

    // Retain completed work item output into Entelechy memory for subsequent tasks
    if (isTaskDone && output) {
      const summaryStr = typeof output === 'string' ? output : JSON.stringify(output);
      await retainEntelechyTaskResult(taskKey, summaryStr);
    }

    return {
      success: true,
      task_done: isTaskDone,
      output: output,
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
