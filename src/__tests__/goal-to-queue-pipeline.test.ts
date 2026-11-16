import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initDb, closeDb, getDb } from "../state/database";
import { Orchestrator } from "../orchestration/orchestrator";
import { decomposeGoal } from "../orchestration/task-graph";
import { QueueWorkerDaemon } from "../work-queue/worker";

// Mock runAgentLoop for fast deterministic unit tests
vi.mock("../agent/loop.js", () => ({
  runAgentLoop: vi.fn().mockResolvedValue({
    taskDone: true,
    completed: true,
    output: { success: true },
  }),
}));

describe("Goal-to-Queue Automatic Pipeline", () => {
  beforeEach(() => {
    initDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("automatically enqueues ready tasks when orchestrator ticks and worker daemon executes them", async () => {
    const db = getDb();

    // 1. Insert an active goal into SQLite
    db.prepare(`
      INSERT INTO goals (id, title, description, status, created_at)
      VALUES ('goal-pipeline-1', 'Automated Goal', 'Execute end to end pipeline', 'active', datetime('now'))
    `).run();

    // 2. Decompose goal into a task
    decomposeGoal(db, "goal-pipeline-1", [
      {
        parentId: null,
        goalId: "goal-pipeline-1",
        title: "Pipeline Subtask",
        description: "Task to auto-enqueue",
        status: "pending",
        assignedTo: null,
        agentRole: "generalist",
        priority: 80,
        dependencies: [],
        result: null,
      },
    ]);

    // 3. Create Orchestrator instance
    const mockAgentTracker: any = {
      getIdle: () => [{ address: "0xparent", name: "parent", role: "generalist" }],
      getBestForTask: () => ({ address: "0xparent", name: "parent" }),
      updateStatus: vi.fn(),
    };
    const mockFunding: any = { fundChild: vi.fn().mockResolvedValue({ success: true }) };
    const mockMessaging: any = { processInbox: vi.fn().mockResolvedValue([]), send: vi.fn() };
    const mockInference: any = {};

    const orchestrator = new Orchestrator({
      db,
      agentTracker: mockAgentTracker,
      funding: mockFunding,
      messaging: mockMessaging,
      inference: mockInference,
      identity: { address: "0xparent", name: "parent" } as any,
      config: {},
    });

    // 4. Run Orchestrator ticks until 'executing' phase runs handleExecutingPhase
    await orchestrator.tick(); // idle -> classifying
    await orchestrator.tick(); // classifying -> executing
    const tickResult = await orchestrator.tick(); // executing -> handleExecutingPhase auto-enqueues!
    expect(tickResult.phase).toBe("executing");

    // 5. Verify task was enqueued into work_queue
    const queueRows = db.prepare("SELECT * FROM work_queue WHERE source = 'orchestrator'").all() as any[];
    expect(queueRows.length).toBe(1);
    expect(queueRows[0].status).toBe("pending");
    expect(queueRows[0].priority).toBe(80);

    // 6. Run QueueWorkerDaemon to claim and execute the work item
    const daemon = new QueueWorkerDaemon({
      workerId: "pipeline-worker-01",
      pollIntervalMs: 50,
      maxTurnsPerItem: 1,
    });

    const processed = await daemon.processOne();
    expect(processed).toBe(true);

    // 7. Verify work item completed in work_queue
    const updatedQueueItem = db.prepare("SELECT * FROM work_queue WHERE id = ?").get(queueRows[0].id) as any;
    expect(updatedQueueItem.status).toBe("completed");

    // 8. Verify task completed in task_graph via executor sync
    const taskRow = db.prepare("SELECT * FROM task_graph WHERE goal_id = 'goal-pipeline-1'").get() as any;
    expect(taskRow.status).toBe("completed");
  });
});
