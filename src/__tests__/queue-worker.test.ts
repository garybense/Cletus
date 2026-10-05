import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initDb, closeDb, getDb } from "../state/database";
import { enqueue } from "../work-queue/queue";
import { QueueWorkerDaemon } from "../work-queue/worker";

// Mock runAgentLoop so unit tests execute deterministically and fast without live network LLM calls
vi.mock("../agent/loop.js", () => ({
  runAgentLoop: vi.fn().mockResolvedValue({
    taskDone: true,
    completed: true,
    output: { success: true },
  }),
}));

describe("QueueWorkerDaemon Integration", () => {
  beforeEach(() => {
    initDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("claims and processes enqueued items automatically", async () => {
    const item = enqueue({
      source: "creator",
      priority: 50,
      payload: { task: "unit_test_job" },
      acceptance_predicate: "result.success === true",
    });

    const daemon = new QueueWorkerDaemon({
      workerId: "test-daemon-01",
      pollIntervalMs: 50,
      maxTurnsPerItem: 1,
    });

    // Process one item directly
    const processed = await daemon.processOne();
    expect(processed).toBe(true);

    // Verify DB state updated
    const db = getDb();
    const row = db.prepare("SELECT * FROM work_queue WHERE id = ?").get(item.id) as any;
    expect(row).toBeDefined();
    expect(row.status).toBe("completed");
    expect(row.claimed_by).toBe("test-daemon-01");
  });

  it("returns false when no items are available to process", async () => {
    const daemon = new QueueWorkerDaemon({
      workerId: "test-daemon-02",
      pollIntervalMs: 50,
    });

    const processed = await daemon.processOne();
    expect(processed).toBe(false);
  });
});
