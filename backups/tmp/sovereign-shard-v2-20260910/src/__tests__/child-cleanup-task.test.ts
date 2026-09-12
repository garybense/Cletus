import { describe, it, expect, beforeEach } from "vitest";
import { DurableScheduler } from "../heartbeat/scheduler.js";
import { registerBuiltinHeartbeatTasks } from "../heartbeat/tasks.js";
import { createTestDb } from "./mocks.js";

describe("Heartbeat Cleanup Task", () => {
  let db: any;
  let scheduler: DurableScheduler;

  beforeEach(() => {
    db = createTestDb();
    scheduler = new DurableScheduler("test-worker", undefined, undefined, undefined);
    (scheduler as any).rawDb = db.raw;
  });

  it("reaps stale stopped and failed children when CLEANUP task runs", async () => {
    const oldCutoff = new Date(Date.now() - 7200_000).toISOString();
    const recent = new Date().toISOString();

    db.insertChild({
      id: 'child-1',
      address: '0x1',
      name: 'c1',
      status: 'failed',
      sandboxId: 'sb-1',
      genesisPrompt: 'test',
      fundedAmountCents: 0,
      createdAt: oldCutoff,
    });
    db.insertChild({
      id: 'child-2',
      address: '0x2',
      name: 'c2',
      status: 'stopped',
      sandboxId: 'sb-2',
      genesisPrompt: 'test',
      fundedAmountCents: 0,
      createdAt: oldCutoff,
    });
    db.insertChild({
      id: 'child-3',
      address: '0x3',
      name: 'c3',
      status: 'failed',
      sandboxId: 'sb-3',
      genesisPrompt: 'test',
      fundedAmountCents: 0,
      createdAt: recent,
    });
    db.insertChild({
      id: 'child-4',
      address: '0x4',
      name: 'c4',
      status: 'running',
      sandboxId: 'sb-4',
      genesisPrompt: 'test',
      fundedAmountCents: 0,
      createdAt: oldCutoff,
    });

    db.raw.prepare("UPDATE children SET last_checked = ? WHERE id IN ('child-1', 'child-2', 'child-4')").run(oldCutoff);
    db.raw.prepare("UPDATE children SET last_checked = ? WHERE id = 'child-3'").run(recent);

    registerBuiltinHeartbeatTasks(scheduler, db.raw);

    const result = await scheduler.tick();
    expect(result.executedTasks).toBeGreaterThan(0);

    const runRow = db.raw.prepare("SELECT result_json FROM heartbeat_runs WHERE schedule_id = 'default_cleanup'").get() as { result_json: string } | undefined;
    expect(runRow).toBeDefined();
    const parsed = JSON.parse(runRow!.result_json);
    expect(parsed).toEqual(
      expect.objectContaining({
        status: "cleaned",
        reapedCount: 2,
      })
    );

    const rows = db.raw.prepare("SELECT id, status FROM children ORDER BY id").all() as Array<{ id: string; status: string }>;
    expect(rows).toEqual([
      { id: "child-1", status: "cleaned_up" },
      { id: "child-2", status: "cleaned_up" },
      { id: "child-3", status: "failed" },
      { id: "child-4", status: "running" },
    ]);
  });
});
