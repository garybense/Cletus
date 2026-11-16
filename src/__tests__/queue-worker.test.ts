import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initDb, closeDb, getDb } from "../state/database";
import { enqueue } from "../work-queue/queue";
import { QueueWorkerDaemon } from "../work-queue/worker";
import { agentEventBus } from "../state/event-bus.js";

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

  it("processes work immediately upon work_available event without waiting for poll interval", async () => {
    const daemon = new QueueWorkerDaemon({ pollIntervalMs: 60000 });
    const processSpy = vi.spyOn(daemon, "processOne");
    daemon.start();
    // Allow initial startup poll to run and clear spy
    await new Promise((r) => setTimeout(r, 10));
    processSpy.mockClear();

    agentEventBus.emit("work_available", { itemId: "instant-1", source: "test" });
    await new Promise((r) => setTimeout(r, 10));

    expect(processSpy).toHaveBeenCalled();
    daemon.stop();
  });

  it("does not spawn concurrent processOne executions on rapid consecutive work_available events", async () => {
    const daemon = new QueueWorkerDaemon({ pollIntervalMs: 60000 });
    let concurrentCount = 0;
    let maxConcurrency = 0;

    vi.spyOn(daemon, "processOne").mockImplementation(async () => {
      concurrentCount++;
      if (concurrentCount > maxConcurrency) {
        maxConcurrency = concurrentCount;
      }
      await new Promise((r) => setTimeout(r, 20));
      concurrentCount--;
      return true;
    });

    daemon.start();

    // Fire multiple rapid work_available events in burst
    for (let i = 0; i < 5; i++) {
      agentEventBus.emit("work_available", { itemId: `burst-${i}`, source: "test" });
    }

    // Wait for in-flight tasks
    await new Promise((r) => setTimeout(r, 80));

    expect(maxConcurrency).toBe(1);
    expect(concurrentCount).toBe(0);
    daemon.stop();
  });
});
