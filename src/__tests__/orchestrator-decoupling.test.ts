import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, initDb, closeDb } from '../state/database';
import { DurableScheduler } from '../heartbeat/scheduler';
import { registerBuiltinHeartbeatTasks, BUILTIN_TASK_TYPES } from '../heartbeat/tasks';

describe('Orchestrator Decoupling (Phase 4)', () => {
  beforeEach(() => {
    initDb(':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  it('registers orchestrator_tick heartbeat task and enqueues scheduled orchestrator tasks', async () => {
    const scheduler = new DurableScheduler('test-orchestrator-scheduler');
    registerBuiltinHeartbeatTasks(scheduler);

    // Run tick
    const stats = await scheduler.tick();
    expect(stats.executedTasks).toBeGreaterThan(0);

    const db = getDb();
    const queuedItems = db.prepare(`SELECT * FROM work_queue WHERE source = 'orchestrator'`).all();
    expect(queuedItems.length).toBeGreaterThan(0);
  });
});
