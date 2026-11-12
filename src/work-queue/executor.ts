// src/work-queue/executor.ts

import { WorkItem, WorkResult } from './types.js';
import { runAgentLoop } from '../agent/loop.js';
import { createDatabase, getCletusDatabase, getDb } from '../state/database.js';
import { loadConfig } from '../config.js';
import { getWallet } from '../identity/wallet.js';
import { createMindmodsClient } from '../mindmods/client.js';
import { createInferenceClient } from '../mindmods/inference.js';
import { completeTask, failTask, TERMINAL_TASK_STATUSES } from '../orchestration/task-graph.js';
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from '../memory/entelechy-client.js';
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

    const activeOllamaUrl = (config.ollamaBaseUrl && !config.ollamaBaseUrl.includes("mindmods.org"))
      ? config.ollamaBaseUrl
      : (config.apiUrl?.includes(":11434") ? config.apiUrl : undefined);

    const mindmods = createMindmodsClient(config);
    const inference = createInferenceClient({
      apiUrl: config.apiUrl || config.mindmodsApiUrl || activeOllamaUrl,
      apiKey: config.offlineMode ? "" : (config.apiKey || ""),
      defaultModel: config.inferenceModel,
      maxTokens: config.maxTokensPerTurn,
      lowComputeModel: config.modelStrategy?.lowComputeModel,
      ollamaBaseUrl: activeOllamaUrl,
      allowInsecureRemoteHttp: config.allowInsecureRemoteHttp ?? true,
    });

    // Deduplication check: if this item mirrors a task_graph task, verify it isn't
    // already terminal or actively executing under LocalWorkerPool.
    if (item.payload && typeof item.payload.taskId === 'string') {
      const targetTaskId = item.payload.taskId;
      try {
        const existingTask = (rawDb.prepare
          ? rawDb.prepare("SELECT status, assigned_to FROM task_graph WHERE id = ?").get(targetTaskId)
          : null) as any;

        if (existingTask) {
          if (TERMINAL_TASK_STATUSES.has(existingTask.status)) {
            logger.info(`Work item [${item.id}] referenced already terminal task [${targetTaskId}] (${existingTask.status}), skipping dual-execution.`);
            return {
              success: true,
              task_done: true,
              output: `Task ${targetTaskId} is already in terminal status '${existingTask.status}'`,
              data: {},
              timestamp: Date.now(),
            };
          }
          if (existingTask.assigned_to?.startsWith("local://")) {
            logger.info(`Work item [${item.id}] referenced task [${targetTaskId}] actively managed by LocalWorkerPool, delegating execution.`);
            return {
              success: true,
              task_done: true,
              output: `Task ${targetTaskId} is actively executing in LocalWorkerPool (${existingTask.assigned_to})`,
              data: {},
              timestamp: Date.now(),
            };
          }
        }
      } catch {
        // Fall through to regular execution if table check fails
      }
    }

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

    const outputSummary = String(loopResult?.output || loopResult || 'Task completed');
    const isCanned = outputSummary.includes("Hello! I'm doing well") ||
                     outputSummary.includes("Both work. The second is simpler") ||
                     outputSummary.includes("Autonomous reasoning completed") ||
                     outputSummary.includes("Not certain from what is here") ||
                     outputSummary.includes("Which version is this");

    if (isCanned) {
      throw new Error(`Task worker produced canned/honeypot output: "${outputSummary.slice(0, 100)}"`);
    }

    const isTaskDone = Boolean((loopResult?.taskDone || loopResult?.completed) ?? true);

    if (isTaskDone) {
      // Retain completed task result to Entelechy document store under sovereign bank
      retainEntelechyTaskResult(item.id, outputSummary, ENTELECHY_DEFAULT_BANK).catch(() => {});
    }

    // Sync task completion state back to task_graph if this item originated from a task
    if (item.payload && typeof item.payload.taskId === 'string') {
      const taskId = item.payload.taskId as string;
      try {
        const existingTask = (db.raw.prepare
          ? db.raw.prepare("SELECT status FROM task_graph WHERE id = ?").get(taskId)
          : null) as any;

        if (!existingTask || !TERMINAL_TASK_STATUSES.has(existingTask.status)) {
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
        }
      } catch (syncErr) {
        // Best effort task graph sync
        logger.debug(`Task graph sync skipped: ${syncErr instanceof Error ? syncErr.message : String(syncErr)}`);
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
