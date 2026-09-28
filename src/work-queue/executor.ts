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
    // Optimization: Entelechy Task Cache Integration
    // Check Entelechy memory task cache before executing expensive agent turns.
    // Expected Impact: Bypasses redundant LLM turns and API calls when work item result is cached.
    const cacheKey = item.id || JSON.stringify(item.payload);
    const recall = await checkEntelechyTaskCache(cacheKey);
    if (recall.cached && recall.data) {
      return {
        success: true,
        task_done: true,
        output: recall.data,
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
    const output = loopResult?.output || loopResult;

    if (isTaskDone && output) {
      const summary = typeof output === 'string' ? output : JSON.stringify(output);
      await retainEntelechyTaskResult(cacheKey, summary);
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
