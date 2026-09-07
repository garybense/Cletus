// src/replication/result-envelope.ts

import { getDb } from '../state/database.js';
import { complete, fail } from '../work-queue/queue.js';
import { WorkResult } from '../work-queue/types.js';

export interface ChildResultEnvelope {
  childId: string;
  workItemId: string;
  success: boolean;
  taskDone: boolean;
  output?: unknown;
  error?: string;
  timestamp: number;
}

export function recordChildResult(envelope: ChildResultEnvelope): { idempotencyKey: string; alreadyProcessed: boolean; success: boolean } {
  const db = getDb();
  const idempotencyKey = `${envelope.childId}:${envelope.workItemId}:${envelope.timestamp}`;

  // Check if child_results table exists, if not create it
  db.prepare(`
    CREATE TABLE IF NOT EXISTS child_results (
      idempotency_key TEXT PRIMARY KEY,
      child_id TEXT NOT NULL,
      work_item_id TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `).run();

  const existing = db.prepare('SELECT * FROM child_results WHERE idempotency_key = ?').get(idempotencyKey);
  if (existing) {
    return { idempotencyKey, alreadyProcessed: true, success: true };
  }

  const result: WorkResult = {
    success: envelope.success,
    task_done: envelope.taskDone,
    output: envelope.output,
    error: envelope.error,
    timestamp: envelope.timestamp,
  };

  db.prepare(`
    INSERT INTO child_results (idempotency_key, child_id, work_item_id, result_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(idempotencyKey, envelope.childId, envelope.workItemId, JSON.stringify(result), Date.now());

  let completionStatus = { success: false };
  try {
    if (envelope.success) {
      completionStatus = complete(envelope.workItemId, result);
    } else {
      fail(envelope.workItemId, envelope.error || 'Child execution failed');
      completionStatus = { success: false };
    }
  } catch (err) {
    // Work item may already be completed or cleaned up
  }

  return { idempotencyKey, alreadyProcessed: false, success: completionStatus.success };
}
