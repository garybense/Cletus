// src/work-queue/executor.ts

import { WorkItem, WorkResult } from './types.js';
import { runAgentLoop } from '../agent/loop.js';
import { checkEntelechyTaskCache, retainEntelechyTaskResult } from '../memory/entelechy-client.js';

export interface ExecutorContext {
  agentId?: string;
  maxToolCallsPerInvocation?: number;
}

export async function executeWorkItem(item: WorkItem, context: ExecutorContext = {}): Promise<WorkResult> {
  const taskKey = (item.payload?.task_key || item.payload?.cache_key) as string | undefined;

  // Optimization: Check Entelechy recall memory cache to bypass redundant LLM turns or duplicate network work.
  if (taskKey) {
    try {
      const cached = await checkEntelechyTaskCache(taskKey);
      if (cached.cached && cached.data) {
        return {
          success: true,
          task_done: true,
          output: cached.data,
          data: { cachedFromEntelechy: true },
          timestamp: Date.now(),
        };
      }
    } catch {
      // Non-critical cache check fallback
    }
  }

  try {
    // Single bounded invocation for the work item
    const loopResult: any = await runAgentLoop({
      maxTurns: context.maxToolCallsPerInvocation || 5,
      workPayload: item.payload,
      workItemId: item.id,
    } as any);

    const isTaskDone = Boolean(loopResult?.taskDone || loopResult?.completed);
    const outputData = loopResult?.output || loopResult;

    // Optimization: Retain task result into Entelechy memory for future turn reuse
    if (taskKey && isTaskDone) {
      const summary = typeof outputData === 'string' ? outputData : JSON.stringify(outputData);
      await retainEntelechyTaskResult(taskKey, summary).catch(() => {});
    }

    return {
      success: true,
      task_done: isTaskDone,
      output: outputData,
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
