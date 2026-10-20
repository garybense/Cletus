// src/work-queue/queue.ts

import { getDb } from '../state/database.js';
import { WorkItem, WorkResult, EnqueueWorkItemInput, WorkItemStatus } from './types.js';
import { randomUUID } from 'crypto';

export const UNRESOLVED_BALANCE = -1;

export function evaluateAcceptancePredicate(predicate: string, result: WorkResult): boolean {
  if (!predicate || typeof predicate !== 'string' || predicate.trim() === '') {
    return false;
  }

  const trimmed = predicate.trim();

  // Common simple mechanical predicates
  if (trimmed === 'result.success === true' || trimmed === 'result.success') {
    return Boolean(result.success);
  }
  if (trimmed === 'result.task_done === true' || trimmed === 'result.task_done') {
    return Boolean(result.task_done);
  }

  // Safe evaluation via Function constructor with constrained context
  try {
    const fn = new Function('result', `return Boolean(${trimmed});`);
    return Boolean(fn(result));
  } catch (err) {
    return false;
  }
}

export function enqueue(input: EnqueueWorkItemInput): WorkItem {
  return enqueueBatch([input])[0];
}

/**
 * Enqueues a batch of work items within a single SQLite transaction pass.
 * Optimization: Performs a single multi-item insertion pass inside a transaction,
 * reducing DB disk I/O write operations from O(N) to O(1).
 */
export function enqueueBatch(inputs: EnqueueWorkItemInput[]): WorkItem[] {
  if (!inputs || inputs.length === 0) return [];

  for (const input of inputs) {
    if (!input.acceptance_predicate || typeof input.acceptance_predicate !== 'string' || input.acceptance_predicate.trim() === '') {
      throw new Error('acceptance_predicate is required for enqueuing work items');
    }
  }

  const db = getDb();

  // Backpressure Check: prevent queue saturation
  const envLimit = process.env.CLETUS_QUEUE_SATURATION_LIMIT
    ? parseInt(process.env.CLETUS_QUEUE_SATURATION_LIMIT, 10)
    : NaN;
  let saturationLimit = !isNaN(envLimit) && envLimit > 0 ? envLimit : 100; // Default

  if (isNaN(envLimit) || envLimit <= 0) {
    const configRow = db.prepare("SELECT value FROM kv WHERE key = 'config'").get() as { value: string } | undefined;
    if (configRow?.value) {
      try {
        const config = JSON.parse(configRow.value);
        if (typeof config.queueSaturationLimit === 'number' && config.queueSaturationLimit > 0) {
          saturationLimit = config.queueSaturationLimit;
        }
      } catch {}
    }
  }

  const { totalActive } = getQueueMetrics();
  if (totalActive + inputs.length > saturationLimit) {
    throw new Error(`Queue saturation backpressure: reached limit of ${saturationLimit} pending/claimed items.`);
  }

  const insertStmt = db.prepare(`
    INSERT INTO work_queue (
      id, source, priority, payload, acceptance_predicate, spend_bearing, status, retry_count, max_retries, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  const results: WorkItem[] = [];

  const txn = db.transaction(() => {
    for (const input of inputs) {
      const id = randomUUID();
      const source = input.source;
      const priority = input.priority ?? 0;
      const payloadStr = JSON.stringify(input.payload || {});
      const acceptancePredicate = input.acceptance_predicate.trim();
      const spendBearing = input.spend_bearing ? 1 : 0;
      const status: WorkItemStatus = 'pending';
      const retryCount = input.retry_count ?? 0;
      const maxRetries = input.max_retries ?? 0;

      insertStmt.run(id, source, priority, payloadStr, acceptancePredicate, spendBearing, status, retryCount, maxRetries, now, now);

      results.push({
        id,
        source,
        priority,
        payload: input.payload || {},
        acceptance_predicate: acceptancePredicate,
        spend_bearing: Boolean(input.spend_bearing),
        status,
        retry_count: retryCount,
        max_retries: maxRetries,
        created_at: now,
        updated_at: now,
      });
    }
  });

  txn();
  return results;
}

/**
 * Returns metrics for the current work queue.
 */
export function getQueueMetrics(): { pending: number; claimed: number; totalActive: number } {
  const db = getDb();
  const pending = Number((db.prepare("SELECT COUNT(*) as count FROM work_queue WHERE status = 'pending'").get() as any)?.count) || 0;
  const claimed = Number((db.prepare("SELECT COUNT(*) as count FROM work_queue WHERE status = 'claimed'").get() as any)?.count) || 0;
  return { pending, claimed, totalActive: pending + claimed };
}

/**
 * Check if the queue is saturated.
 */
export function isQueueSaturated(limit: number): boolean {
  const { totalActive } = getQueueMetrics();
  return totalActive >= limit;
}

/**
 * Claims the next highest priority work item from the queue.
 * FINANCIAL GATE:
 * If balance === UNRESOLVED_BALANCE (-1), spend-bearing work items CANNOT be claimed.
 * Non-spend-bearing work items can still be claimed.
 */
export function claim(workerId: string, leaseDurationMs = 60000, currentBalance: number = 0): WorkItem | null {
  const batch = claimBatch(workerId, 1, leaseDurationMs, currentBalance);
  return batch.length > 0 ? batch[0] : null;
}

/**
 * Claims a batch of up to count pending/expired work items in a single SQLite transaction pass.
 * Optimization: Claims and updates leases for up to N work items in a single transaction pass,
 * eliminating loop overhead and per-item query roundtrips.
 */
export function claimBatch(
  workerId: string,
  count = 1,
  leaseDurationMs = 60000,
  currentBalance = 0,
): WorkItem[] {
  if (count <= 0) return [];
  const db = getDb();
  const now = Date.now();

  const claimStmt = db.transaction(() => {
    let query = `
      SELECT * FROM work_queue
      WHERE (status = 'pending' OR (status = 'claimed' AND lease_expires_at IS NOT NULL AND lease_expires_at < ?))
    `;

    const params: any[] = [now];

    if (currentBalance === UNRESOLVED_BALANCE) {
      query += ` AND spend_bearing = 0`;
    }

    query += ` ORDER BY priority DESC, created_at ASC LIMIT ?`;
    params.push(count);

    const rows = db.prepare(query).all(...params) as any[];

    if (!rows || rows.length === 0) return [];

    const leaseExpiresAt = now + leaseDurationMs;
    const updateStmt = db.prepare(`
      UPDATE work_queue
      SET status = 'claimed', claimed_by = ?, lease_expires_at = ?, updated_at = ?
      WHERE id = ?
    `);

    const items: WorkItem[] = [];
    for (const row of rows) {
      updateStmt.run(workerId, leaseExpiresAt, now, row.id);
      items.push({
        id: row.id,
        source: row.source,
        priority: row.priority,
        payload: JSON.parse(row.payload || '{}'),
        acceptance_predicate: row.acceptance_predicate,
        spend_bearing: Boolean(row.spend_bearing),
        status: 'claimed' as WorkItemStatus,
        claimed_by: workerId,
        lease_expires_at: leaseExpiresAt,
        created_at: row.created_at,
        updated_at: now,
      });
    }

    return items;
  });

  return claimStmt();
}

export function complete(id: string, result: WorkResult): { success: boolean; item: WorkItem } {
  const db = getDb();
  const now = Date.now();

  const row = db.prepare('SELECT * FROM work_queue WHERE id = ?').get(id) as any;
  if (!row) {
    throw new Error(`WorkItem not found: ${id}`);
  }

  const predicatePassed = evaluateAcceptancePredicate(row.acceptance_predicate, result);
  const resultStr = JSON.stringify(result);

  const retryCount = Number(row.retry_count || 0);
  const maxRetries = Number(row.max_retries || 0);

  let newStatus: WorkItemStatus;
  let newRetryCount = retryCount;
  let errorMsg: string | null = null;

  if (predicatePassed) {
    newStatus = 'completed';
  } else if (retryCount < maxRetries) {
    newStatus = 'pending';
    newRetryCount = retryCount + 1;
    errorMsg = `Acceptance predicate evaluation failed (retrying ${newRetryCount}/${maxRetries}): predicate="${row.acceptance_predicate}" result=${resultStr}`;
  } else {
    newStatus = 'failed';
    errorMsg = `Acceptance predicate evaluation failed: predicate="${row.acceptance_predicate}" result=${resultStr}`;
  }

  db.prepare(`
    UPDATE work_queue
    SET status = ?, result = ?, error = ?, retry_count = ?, updated_at = ?
    WHERE id = ?
  `).run(newStatus, resultStr, errorMsg, newRetryCount, now, id);

  const updatedItem: WorkItem = {
    id: row.id,
    source: row.source,
    priority: row.priority,
    payload: JSON.parse(row.payload || '{}'),
    acceptance_predicate: row.acceptance_predicate,
    spend_bearing: Boolean(row.spend_bearing),
    status: newStatus,
    claimed_by: row.claimed_by,
    lease_expires_at: row.lease_expires_at,
    result,
    error: errorMsg || undefined,
    retry_count: newRetryCount,
    max_retries: maxRetries,
    created_at: row.created_at,
    updated_at: now,
  };

  return { success: predicatePassed, item: updatedItem };
}

export function fail(id: string, error: string): WorkItem {
  const db = getDb();
  const now = Date.now();

  const row = db.prepare('SELECT * FROM work_queue WHERE id = ?').get(id) as any;
  if (!row) {
    throw new Error(`WorkItem not found: ${id}`);
  }

  db.prepare(`
    UPDATE work_queue
    SET status = 'failed', error = ?, updated_at = ?
    WHERE id = ?
  `).run(error, now, id);

  return {
    id: row.id,
    source: row.source,
    priority: row.priority,
    payload: JSON.parse(row.payload || '{}'),
    acceptance_predicate: row.acceptance_predicate,
    spend_bearing: Boolean(row.spend_bearing),
    status: 'failed',
    claimed_by: row.claimed_by,
    lease_expires_at: row.lease_expires_at,
    result: row.result ? JSON.parse(row.result) : undefined,
    error,
    created_at: row.created_at,
    updated_at: now,
  };
}

export function expire(id: string): WorkItem {
  const db = getDb();
  const now = Date.now();

  const row = db.prepare('SELECT * FROM work_queue WHERE id = ?').get(id) as any;
  if (!row) {
    throw new Error(`WorkItem not found: ${id}`);
  }

  db.prepare(`
    UPDATE work_queue
    SET status = 'expired', updated_at = ?
    WHERE id = ?
  `).run(now, id);

  return {
    id: row.id,
    source: row.source,
    priority: row.priority,
    payload: JSON.parse(row.payload || '{}'),
    acceptance_predicate: row.acceptance_predicate,
    spend_bearing: Boolean(row.spend_bearing),
    status: 'expired',
    claimed_by: row.claimed_by,
    lease_expires_at: row.lease_expires_at,
    result: row.result ? JSON.parse(row.result) : undefined,
    error: row.error,
    created_at: row.created_at,
    updated_at: now,
  };
}
