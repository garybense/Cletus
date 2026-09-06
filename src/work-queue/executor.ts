// src/work-queue/executor.ts

import { WorkItem, WorkResult } from './types.js';
import { runAgentLoop } from '../agent/loop.js';

export interface ExecutorContext {
  agentId?: string;
  maxToolCallsPerInvocation?: number;
}

export async function executeWorkItem(item: WorkItem, context: ExecutorContext = {}): Promise<WorkResult> {
  const startTime = Date.now();

  try {
    // Single bounded invocation for the work item
    const loopResult = await runAgentLoop({
      maxTurns: context.maxToolCallsPerInvocation || 5,
      workPayload: item.payload,
      workItemId: item.id,
    });

    const isTaskDone = Boolean(loopResult?.taskDone || loopResult?.completed);

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
