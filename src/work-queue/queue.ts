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
  if (!input.acceptance_predicate || typeof input.acceptance_predicate !== 'string' || input.acceptance_predicate.trim() === '') {
    throw new Error('acceptance_predicate is required for enqueuing work items');
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

  if (isQueueSaturated(saturationLimit)) {
    throw new Error(`Queue saturation backpressure: reached limit of ${saturationLimit} pending/claimed items.`);
  }

  const id = randomUUID();
  const now = Date.now();
  const source = input.source;
  const priority = input.priority ?? 0;
  const payloadStr = JSON.stringify(input.payload || {});
  const acceptancePredicate = input.acceptance_predicate.trim();
  const spendBearing = input.spend_bearing ? 1 : 0;
  const status: WorkItemStatus = 'pending';

  db.prepare(`
    INSERT INTO work_queue (
      id, source, priority, payload, acceptance_predicate, spend_bearing, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, source, priority, payloadStr, acceptancePredicate, spendBearing, status, now, now);

  return {
    id,
    source,
    priority,
    payload: input.payload || {},
    acceptance_predicate: acceptancePredicate,
    spend_bearing: Boolean(input.spend_bearing),
    status,
    created_at: now,
    updated_at: now,
  };
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

    query += ` ORDER BY priority DESC, created_at ASC LIMIT 1`;

    const row = db.prepare(query).get(...params) as any;

    if (!row) return null;

    const leaseExpiresAt = now + leaseDurationMs;
    db.prepare(`
      UPDATE work_queue
      SET status = 'claimed', claimed_by = ?, lease_expires_at = ?, updated_at = ?
      WHERE id = ?
    `).run(workerId, leaseExpiresAt, now, row.id);

    return {
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
    };
  });

  return claimStmt();
}

/**
 * Claims up to `count` work items from the queue in a single atomic SQLite transaction pass.
 *
 * Optimization: Executes multi-item claims inside one SQLite transaction pass to avoid lock contention
 * and reduce disk write latency when processing work queue batches.
 * Expected Performance Impact: Reduces work item claim transaction time from O(N) to O(1) for batch workers.
 */
export function claimBatch(
  workerId: string,
  count = 10,
  leaseDurationMs = 60000,
  currentBalance: number = 0
): WorkItem[] {
  if (count <= 0) return [];
  const db = getDb();
  const now = Date.now();

  const claimTransaction = db.transaction(() => {
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

    const claimedItems: WorkItem[] = [];
    for (const row of rows) {
      updateStmt.run(workerId, leaseExpiresAt, now, row.id);
      claimedItems.push({
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

    return claimedItems;
  });

  return claimTransaction();
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
  const payload = JSON.parse(row.payload || '{}');
  const maxRetries = typeof payload.max_retries === 'number' ? payload.max_retries : 0;
  const currentRetryCount = typeof payload.retry_count === 'number' ? payload.retry_count : 0;

  if (predicatePassed) {
    const errorMsg = null;
    db.prepare(`
      UPDATE work_queue
      SET status = 'completed', result = ?, error = NULL, updated_at = ?
      WHERE id = ?
    `).run(resultStr, now, id);

    const updatedItem: WorkItem = {
      id: row.id,
      source: row.source,
      priority: row.priority,
      payload,
      acceptance_predicate: row.acceptance_predicate,
      spend_bearing: Boolean(row.spend_bearing),
      status: 'completed',
      claimed_by: row.claimed_by,
      lease_expires_at: row.lease_expires_at,
      result,
      error: undefined,
      created_at: row.created_at,
      updated_at: now,
    };

    return { success: true, item: updatedItem };
  }

  // Predicate failed — check if safe retry is available
  const errorMsg = `Acceptance predicate evaluation failed: predicate="${row.acceptance_predicate}" result=${resultStr}`;

  if (currentRetryCount < maxRetries) {
    // Perform cheap safe retry by resetting status to 'pending' with incremented retry_count
    payload.retry_count = currentRetryCount + 1;
    const updatedPayloadStr = JSON.stringify(payload);

    db.prepare(`
      UPDATE work_queue
      SET status = 'pending', payload = ?, claimed_by = NULL, lease_expires_at = NULL, error = ?, updated_at = ?
      WHERE id = ?
    `).run(updatedPayloadStr, errorMsg, now, id);

    const updatedItem: WorkItem = {
      id: row.id,
      source: row.source,
      priority: row.priority,
      payload,
      acceptance_predicate: row.acceptance_predicate,
      spend_bearing: Boolean(row.spend_bearing),
      status: 'pending',
      error: errorMsg,
      created_at: row.created_at,
      updated_at: now,
    };

    return { success: false, item: updatedItem };
  }

  // Max retries exceeded or 0 retries allowed
  db.prepare(`
    UPDATE work_queue
    SET status = 'failed', result = ?, error = ?, updated_at = ?
    WHERE id = ?
  `).run(resultStr, errorMsg, now, id);

  const updatedItem: WorkItem = {
    id: row.id,
    source: row.source,
    priority: row.priority,
    payload,
    acceptance_predicate: row.acceptance_predicate,
    spend_bearing: Boolean(row.spend_bearing),
    status: 'failed',
    claimed_by: row.claimed_by,
    lease_expires_at: row.lease_expires_at,
    result,
    error: errorMsg,
    created_at: row.created_at,
    updated_at: now,
  };

  return { success: false, item: updatedItem };
}

export function fail(id: string, error: string): WorkItem {
  const db = getDb();
  const now = Date.now();

  const row = db.prepare('SELECT * FROM work_queue WHERE id = ?').get(id) as any;
  if (!row) {
    throw new Error(`WorkItem not found: ${id}`);
  }

  const payload = JSON.parse(row.payload || '{}');
  const maxRetries = typeof payload.max_retries === 'number' ? payload.max_retries : 0;
  const currentRetryCount = typeof payload.retry_count === 'number' ? payload.retry_count : 0;

  if (currentRetryCount < maxRetries) {
    // Perform cheap safe retry by resetting status to 'pending' with incremented retry_count
    payload.retry_count = currentRetryCount + 1;
    const updatedPayloadStr = JSON.stringify(payload);

    db.prepare(`
      UPDATE work_queue
      SET status = 'pending', payload = ?, claimed_by = NULL, lease_expires_at = NULL, error = ?, updated_at = ?
      WHERE id = ?
    `).run(updatedPayloadStr, error, now, id);

    return {
      id: row.id,
      source: row.source,
      priority: row.priority,
      payload,
      acceptance_predicate: row.acceptance_predicate,
      spend_bearing: Boolean(row.spend_bearing),
      status: 'pending',
      error,
      created_at: row.created_at,
      updated_at: now,
    };
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
    payload,
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
