// src/work-queue/executor.ts

import { WorkItem, WorkResult } from './types.js';
import { runAgentLoop } from '../agent/loop.js';
import { createDatabase, getCletusDatabase, getDb } from '../state/database.js';
import { loadConfig } from '../config.js';
import { getWallet } from '../identity/wallet.js';
import { createMindmodsClient } from '../mindmods/client.js';
import { createInferenceClient } from '../mindmods/inference.js';
import { completeTask, failTask } from '../orchestration/task-graph.js';
import { retainEntelechyTaskResult } from '../memory/entelechy-client.js';
import { createLogger } from '../observability/logger.js';

const logger = createLogger('work-queue.executor');

export interface ExecutorContext {
  agentId?: string;
  maxToolCallsPerInvocation?: number;
  db?: any;
  config?: any;
  identity?: any;
}

export async function executeWorkItem(item: WorkItem, context: ExecutorContext = {}): Promise<WorkResult> {
  try {
    const rawDb = context.db || getDb();
    const db = rawDb.getKV ? rawDb : createDatabase(rawDb);

    let config = context.config;
    if (!config) {
      try { config = loadConfig(); } catch { config = { model: 'gpt-4o', spendLimits: {} }; }
    }
    let identity = context.identity;
    if (!identity) {
      try {
        const w = await getWallet();
        identity = w.chainIdentity;
      } catch {
        identity = { address: '0x00', sandboxId: 'local-sandbox' };
      }
    }

    const mindmods = createMindmodsClient(config);
    const inference = createInferenceClient(config);

    const loopResult: any = await runAgentLoop({
      identity,
      config,
      db,
      mindmods,
      inference,
      maxTurns: context.maxToolCallsPerInvocation || 5,
      workPayload: item.payload,
      workItemId: item.id,
    } as any);

    const isTaskDone = Boolean((loopResult?.taskDone || loopResult?.completed) ?? true);
    const outputSummary = String(loopResult?.output || loopResult || 'Task completed');

    const taskCategory = typeof item.payload?.category === 'string'
      ? item.payload.category
      : typeof item.payload?.type === 'string'
      ? item.payload.type
      : item.source;

    logger.info(`Work item executed with capability/category: ${taskCategory}`, {
      id: item.id,
      category: taskCategory,
      isTaskDone,
    });

    if (isTaskDone) {
      // Optimization: Retain completed task result to Entelechy document store under 'cletus' bank asynchronously to avoid blocking execution output return.
      retainEntelechyTaskResult(item.id, outputSummary, 'cletus').catch((err) => {
        logger.warn('Asynchronous Entelechy task retention warning', { error: String(err) });
      });
    }

    // Sync task completion state back to task_graph if this item originated from a task
    if (item.payload && typeof item.payload.taskId === 'string') {
      const taskId = item.payload.taskId as string;
      try {
        if (isTaskDone) {
          completeTask(db.raw, taskId, {
            success: true,
            output: outputSummary,
            artifacts: [],
            costCents: loopResult?.costCents ?? 0,
            duration: loopResult?.duration ?? 0,
            revenueCents: loopResult?.revenueCents ?? loopResult?.data?.revenueCents ?? (item.payload?.revenueCents as number) ?? 0,
          } as any);
        } else {
          failTask(db.raw, taskId, 'Task execution incomplete', true);
        }
      } catch {
        // Best effort task graph sync
      }
    }

    return {
      success: true,
      task_done: isTaskDone,
      output: loopResult?.output || loopResult,
      data: loopResult?.data || {},
      timestamp: Date.now(),
    };
  } catch (err: any) {
    if (item.payload && typeof item.payload.taskId === 'string') {
      try {
        failTask(context.db?.raw || getDb(), item.payload.taskId as string, err?.message || String(err), true);
      } catch {}
    }

    return {
      success: false,
      task_done: false,
      error: err?.message || String(err),
      timestamp: Date.now(),
    };
  }
}
