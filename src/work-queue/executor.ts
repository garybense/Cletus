// src/work-queue/executor.ts

import { WorkItem, WorkResult } from './types.js';
import { runAgentLoop } from '../agent/loop.js';
import { checkEntelechyTaskCache, retainEntelechyTaskResult } from '../memory/entelechy-client.js';

export interface ExecutorContext {
  agentId?: string;
  maxToolCallsPerInvocation?: number;
}

export async function executeWorkItem(item: WorkItem, context: ExecutorContext = {}): Promise<WorkResult> {
  const taskKey = typeof item.payload?.taskKey === 'string'
    ? item.payload.taskKey
    : typeof item.payload?.task_key === 'string'
      ? item.payload.task_key
      : undefined;

  // Optimization: Check Entelechy recall memory cache to bypass redundant agent turns & LLM costs
  if (taskKey) {
    try {
      const cacheCheck = await checkEntelechyTaskCache(taskKey);
      if (cacheCheck.cached && cacheCheck.data) {
        return {
          success: true,
          task_done: true,
          output: cacheCheck.data,
          data: { cached: true, source: 'entelechy_task_cache' },
          timestamp: Date.now(),
        };
      }
    } catch {
      // Non-blocking fallback to fresh execution on cache error
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
    const output = loopResult?.output || loopResult;

    // Retain successful execution result in Entelechy memory
    if (taskKey && isTaskDone) {
      const summary = typeof output === 'string' ? output : JSON.stringify(output);
      retainEntelechyTaskResult(taskKey, summary).catch(() => {});
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
