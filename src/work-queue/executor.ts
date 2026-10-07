// src/work-queue/executor.ts

import { WorkItem, WorkResult } from './types.js';
import { runAgentLoop } from '../agent/loop.js';
import { createDatabase, getCletusDatabase, getDb } from '../state/database.js';
import { loadConfig } from '../config.js';
import { getWallet } from '../identity/wallet.js';
import { createMindmodsClient } from '../mindmods/client.js';
import { createInferenceClient } from '../mindmods/inference.js';
import { completeTask, failTask } from '../orchestration/task-graph.js';
import { checkEntelechyTaskCache, retainEntelechyTaskResult } from '../memory/entelechy-client.js';

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

    // Optimization: Check Entelechy recall cache before running agent loop to bypass duplicate LLM turn calls on retried/cached tasks.
    // Expected Performance Impact: Eliminates 5+ LLM API turns and ~1000-3000ms latency per cached work item.
    const cacheCheck = await checkEntelechyTaskCache(item.id);
    if (cacheCheck.cached && cacheCheck.data) {
      return {
        success: true,
        task_done: true,
        output: cacheCheck.data,
        data: { cachedFromEntelechy: true },
        timestamp: Date.now(),
      };
    }

    let config = context.config;
    if (!config) {
      try {
        config = loadConfig() || { model: 'gpt-4o', spendLimits: {}, mindmodsApiUrl: 'https://api.mindmods.tech' };
      } catch {
        config = { model: 'gpt-4o', spendLimits: {}, mindmodsApiUrl: 'https://api.mindmods.tech' };
      }
    }
    if (!config || typeof config !== 'object') {
      config = { model: 'gpt-4o', spendLimits: {}, mindmodsApiUrl: 'https://api.mindmods.tech' };
    }
    if (!config.mindmodsApiUrl) {
      config.mindmodsApiUrl = config.apiUrl || 'https://api.mindmods.tech';
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

    const clientOptions = {
      apiUrl: config.mindmodsApiUrl || config.apiUrl || 'https://api.mindmods.tech',
      apiKey: config.apiKey || config.mindmodsApiKey || 'mock-api-key',
      sandboxId: identity?.sandboxId || 'local-sandbox',
    };
    const mindmods = createMindmodsClient(clientOptions);
    const inferenceOptions = {
      apiUrl: config.inferenceApiUrl || config.apiUrl || config.mindmodsApiUrl || 'https://api.mindmods.tech',
      apiKey: config.apiKey || config.mindmodsApiKey || 'mock-api-key',
      defaultModel: config.inferenceModel || config.model || 'gpt-4o',
      maxTokens: config.maxTokens || 4096,
    };
    const inference = createInferenceClient(inferenceOptions as any);

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

    if (isTaskDone) {
      // Retain completed task result to Entelechy document store under 'cletus' bank
      retainEntelechyTaskResult(item.id, outputSummary, 'cletus').catch(() => {});
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
