// src/work-queue/executor.ts

import { WorkItem, WorkResult } from './types.js';
import { runAgentLoop } from '../agent/loop.js';
import { checkEntelechyTaskCache, retainEntelechyTaskResult } from '../memory/entelechy-client.js';

export interface ExecutorContext {
  agentId?: string;
  maxToolCallsPerInvocation?: number;
  bypassCache?: boolean;
}

export async function executeWorkItem(item: WorkItem, context: ExecutorContext = {}): Promise<WorkResult> {
  try {
    // Optimization / Entelechy Recall Caching: Check Entelechy task recall cache
    // to determine if an identical task result was recently computed, avoiding
    // redundant LLM turns and API calls.
    // Expected Performance Impact: Saves 1-5 LLM turns (~100% token cost reduction) for repeated/re-enqueued work items.
    if (!context.bypassCache && item.payload?.bypassEntelechyCache !== true) {
      const cacheCheck = await checkEntelechyTaskCache(item.id);
      if (cacheCheck.cached && cacheCheck.data) {
        let cachedOutput: any = cacheCheck.data;
        try {
          cachedOutput = JSON.parse(cacheCheck.data);
        } catch {}

        return {
          success: true,
          task_done: true,
          output: cachedOutput,
          data: { fromEntelechyCache: true },
          timestamp: Date.now(),
        };
      }
    }

    // Single bounded invocation for the work item
    const loopResult: any = await runAgentLoop({
      maxTurns: context.maxToolCallsPerInvocation || 5,
      workPayload: item.payload,
      workItemId: item.id,
    } as any);

    const isTaskDone = Boolean(loopResult?.taskDone || loopResult?.completed);
    const output = loopResult?.output || loopResult;

    // Retain completed task result into Entelechy memory for future turn efficiency
    if (isTaskDone) {
      const outputSummary = typeof output === 'string' ? output : JSON.stringify(output);
      await retainEntelechyTaskResult(item.id, outputSummary);
    }

    return {
      success: true,
      task_done: isTaskDone,
      output,
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
