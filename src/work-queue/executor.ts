// src/work-queue/executor.ts

import { WorkItem, WorkResult } from './types.js';
import { runAgentLoop } from '../agent/loop.js';
import { checkEntelechyTaskCache, retainEntelechyTaskResult } from '../memory/entelechy-client.js';

export interface ExecutorContext {
  agentId?: string;
  maxToolCallsPerInvocation?: number;
}

/**
 * Execute a work item using a single bounded agent loop invocation.
 *
 * Optimization: Checks Entelechy memory recall cache before running agent turns.
 * If a previously completed task result is cached, returns it immediately without
 * consuming LLM tokens or API credits. Retains new results in Entelechy memory upon completion.
 * Expected Performance Impact: Saves 100% of LLM turn latency and API cost on repeated/cached tasks.
 */
export async function executeWorkItem(item: WorkItem, context: ExecutorContext = {}): Promise<WorkResult> {
  try {
    const taskKey = `work_item:${item.id}`;

    // Check Entelechy recall cache to avoid redundant LLM turns
    const cacheCheck = await checkEntelechyTaskCache(taskKey);
    if (cacheCheck.cached && cacheCheck.data) {
      return {
        success: true,
        task_done: true,
        output: cacheCheck.data,
        data: { cachedFromEntelechy: true },
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

    // Retain task result in Entelechy memory on successful completion
    if (isTaskDone) {
      const summary = typeof loopResult?.output === 'string'
        ? loopResult.output
        : JSON.stringify(loopResult?.output || loopResult);
      await retainEntelechyTaskResult(taskKey, summary);
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
