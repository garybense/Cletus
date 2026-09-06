import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, initDb, closeDb } from '../state/database';
import { claim } from '../work-queue/queue';
import { ingestCreatorDecree, ingestOrchestratorStatus, ingestMaintenanceSignal, SOURCE_PRIORITIES } from '../work-queue/ingest';

describe('Inbox Ingestion & Decree Protection (Phase 2)', () => {
  beforeEach(() => {
    initDb(':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  it('assigns correct source priorities', () => {
    expect(SOURCE_PRIORITIES.creator).toBeGreaterThan(SOURCE_PRIORITIES.orchestrator);
    expect(SOURCE_PRIORITIES.orchestrator).toBeGreaterThan(SOURCE_PRIORITIES.maintenance);
  });

  it('prevents orchestrator status from overwriting or starving creator decrees (decree-overwrite bug regression)', () => {
    // 1. Ingest an orchestrator status update first
    ingestOrchestratorStatus('ORCHESTRATOR STATUS: idle, waiting for tasks...');

    // 2. Ingest a creator decree second
    const decreeItem = ingestCreatorDecree('BUILD NEW DASHBOARD FEATURE IMMEDIATELY');

    // 3. Ingest another orchestrator status update third
    ingestOrchestratorStatus('ORCHESTRATOR STATUS: checking system health...');

    // 4. Claim the next item from the queue
    const claimed = claim('test-worker');

    // Verification: The creator decree MUST be claimed first regardless of order of ingestion
    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(decreeItem.id);
    expect(claimed?.source).toBe('creator');
    expect(claimed?.payload.text).toBe('BUILD NEW DASHBOARD FEATURE IMMEDIATELY');
  });
});
