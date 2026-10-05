// src/work-queue/executor.ts

import { WorkItem, WorkResult } from './types.js';
import { runAgentLoop } from '../agent/loop.js';
import { checkEntelechyTaskCache, retainEntelechyTaskResult } from '../memory/entelechy-client.js';

export interface ExecutorContext {
  agentId?: string;
  maxToolCallsPerInvocation?: number;
}

/**
 * Executes a work queue item.
 *
 * Optimization: Integrates Entelechy task recall caching and retention. Before running expensive LLM loops,
 * checks Entelechy's task cache. Upon successful completion, retains the task summary into Entelechy.
 * Expected Performance Impact: Bypasses redundant agent execution loops for identical or retried work items,
 * reducing latency to ~1ms and saving LLM token spend.
 */
export async function executeWorkItem(item: WorkItem, context: ExecutorContext = {}): Promise<WorkResult> {
  const taskKey = typeof item.payload?.taskKey === 'string' ? item.payload.taskKey : String(item.id);

  // Check Entelechy cache to avoid duplicate work
  try {
    const cachedCheck = await checkEntelechyTaskCache(taskKey);
    if (cachedCheck.cached && cachedCheck.data) {
      return {
        success: true,
        task_done: true,
        output: cachedCheck.data,
        data: { cachedFromEntelechy: true },
        timestamp: Date.now(),
      };
    }
  } catch {
    // Non-blocking: proceed to normal execution if Entelechy cache check fails
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

    if (isTaskDone) {
      // Retain successful task result into Entelechy memory
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
