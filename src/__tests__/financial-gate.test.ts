import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, initDb, closeDb } from '../state/database';
import { enqueue, claim, UNRESOLVED_BALANCE } from '../work-queue/queue';

describe('Financial Gate (Phase 5)', () => {
  beforeEach(() => {
    initDb(':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  it('blocks spend-bearing items when balance is unresolved (-1)', () => {
    // Enqueue a spend-bearing item
    const spendItem = enqueue({
      source: 'creator',
      priority: 100,
      payload: { cmd: 'paid action' },
      acceptance_predicate: 'result.success === true',
      spend_bearing: true,
    });

    // Attempt to claim with unresolved balance (-1)
    const claimedUnresolved = claim('worker-1', 60000, UNRESOLVED_BALANCE);
    expect(claimedUnresolved).toBeNull();

    // Claim with resolved balance (e.g. $10)
    const claimedResolved = claim('worker-1', 60000, 10.0);
    expect(claimedResolved).not.toBeNull();
    expect(claimedResolved?.id).toBe(spendItem.id);
  });

  it('allows non-spend-bearing items when balance is unresolved (-1)', () => {
    // Enqueue a non-spend-bearing item
    const nonSpendItem = enqueue({
      source: 'maintenance',
      priority: 50,
      payload: { cmd: 'health check' },
      acceptance_predicate: 'result.success === true',
      spend_bearing: false,
    });

    const claimed = claim('worker-1', 60000, UNRESOLVED_BALANCE);
    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(nonSpendItem.id);
  });
});
