import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initDb, closeDb, getDb } from "../state/database";
import { Orchestrator } from "../orchestration/orchestrator";
import { decomposeGoal } from "../orchestration/task-graph";
import { QueueWorkerDaemon } from "../work-queue/worker";
import { getSnapshotWithDiagnostics } from "../../newdashboard/src/lib/cletus/server";

// Mock runAgentLoop for fast, deterministic end-to-end execution
vi.mock("../agent/loop.js", () => ({
  runAgentLoop: vi.fn().mockImplementation(async (options: any) => {
    return {
      taskDone: true,
      completed: true,
      output: "Completed E2E Task",
      revenueCents: 5000,
    };
  }),
}));

describe("End-to-End Goal Execution Lifecycle", () => {
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `cletus-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    process.env.CLETUS_STATE_DB = testDbPath;
    initDb(testDbPath);
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  it("executes full lifecycle: Goal -> TaskGraph -> WorkQueue -> Worker -> Revenue & Progress -> Dashboard", async () => {
    const db = getDb();

    // ─── STEP 1: Goal Creation ──────────────────────────────────────
    db.prepare(`
      INSERT INTO goals (id, title, description, status, expected_revenue_cents, actual_revenue_cents, created_at)
      VALUES ('goal-e2e-1', 'Earn $100 via Bounty Loop', 'E2E test goal', 'active', 10000, 0, datetime('now'))
    `).run();

    // Decompose into 2 tasks
    decomposeGoal(db, "goal-e2e-1", [
      {
        parentId: null,
        goalId: "goal-e2e-1",
        title: "E2E Bounty Subtask 1",
        description: "First subtask",
        status: "pending",
        assignedTo: null,
        agentRole: "generalist",
        priority: 90,
        dependencies: [],
        result: null,
      },
      {
        parentId: null,
        goalId: "goal-e2e-1",
        title: "E2E Bounty Subtask 2",
        description: "Second subtask",
        status: "pending",
        assignedTo: null,
        agentRole: "generalist",
        priority: 70,
        dependencies: [],
        result: null,
      },
    ]);

    // ─── STEP 2: Orchestrator Auto-Enqueue ─────────────────────────
    const mockAgentTracker: any = {
      getIdle: () => [{ address: "0xparent", name: "parent", role: "generalist" }],
      getBestForTask: () => ({ address: "0xparent", name: "parent" }),
      updateStatus: vi.fn(),
    };
    const mockFunding: any = { fundChild: vi.fn().mockResolvedValue({ success: true }) };
    const mockMessaging: any = { processInbox: vi.fn().mockResolvedValue([]), send: vi.fn() };

    const orchestrator = new Orchestrator({
      db,
      agentTracker: mockAgentTracker,
      funding: mockFunding,
      messaging: mockMessaging,
      inference: {} as any,
      identity: { address: "0xparent", name: "parent" } as any,
      config: {},
    });

    // Tick orchestrator into 'executing' phase
    await orchestrator.tick(); // idle -> classifying
    await orchestrator.tick(); // classifying -> executing
    const tickResult = await orchestrator.tick(); // executing -> auto-enqueues ready tasks
    expect(tickResult.phase).toBe("executing");

    // Verify ready tasks were enqueued into work_queue
    const initialQueueItems = db.prepare("SELECT * FROM work_queue WHERE source = 'orchestrator' ORDER BY priority DESC").all() as any[];
    expect(initialQueueItems.length).toBeGreaterThan(0);
    expect(initialQueueItems[0].status).toBe("pending");

    // ─── STEP 3: Worker Daemon Execution (Task 1) ───────────────────
    const daemon = new QueueWorkerDaemon({
      workerId: "e2e-worker-01",
      pollIntervalMs: 50,
      maxTurnsPerItem: 1,
    });

    // Process Task 1
    const processed1 = await daemon.processOne();
    expect(processed1).toBe(true);

    // Verify Task 1 completed in work_queue and task_graph
    const task1Row = db.prepare("SELECT * FROM task_graph WHERE title = 'E2E Bounty Subtask 1'").get() as any;
    expect(task1Row.status).toBe("completed");

    // ─── STEP 4: Process Task 2 ─────────────────────────────────────
    await orchestrator.tick();

    const processed2 = await daemon.processOne();
    expect(processed2).toBe(true);

    // Verify Task 2 completed
    const task2Row = db.prepare("SELECT * FROM task_graph WHERE title = 'E2E Bounty Subtask 2'").get() as any;
    expect(task2Row.status).toBe("completed");

    // ─── STEP 5: Verify Goal Completion & Revenue Feedback ─────────
    const finalGoal = db.prepare("SELECT * FROM goals WHERE id = 'goal-e2e-1'").get() as any;
    expect(finalGoal.status).toBe("completed");
    expect(finalGoal.actual_revenue_cents).toBe(10000); // $50 + $50 = $100

    // ─── STEP 6: Dashboard Snapshot Verification ─────────────────────
    const { snapshot } = await getSnapshotWithDiagnostics();
    expect(snapshot).toBeDefined();
    expect(snapshot.vitals.name).toBe("Cletus");
    expect(snapshot.workQueue).toBeDefined();
    expect(snapshot.goals.length).toBeGreaterThan(0);

    const goalSnapshot = snapshot.goals.find((g) => g.id === "goal-e2e-1");
    expect(goalSnapshot).toBeDefined();
    expect(goalSnapshot?.progress).toBe(100);
    expect(goalSnapshot?.actualRevenueCents).toBe(10000);
  });
});
