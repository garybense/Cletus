import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { agentEventBus } from "../state/event-bus.js";
import { ingestWorkItem } from "../work-queue/ingest.js";
import { initDb, closeDb, getDb, insertWakeEvent } from "../state/database.js";

describe("AgentEventBus", () => {
  it("emits and receives work_available events synchronously", () => {
    const handler = vi.fn();
    agentEventBus.on("work_available", handler);

    agentEventBus.emit("work_available", { itemId: "item-123", source: "test" });
    expect(handler).toHaveBeenCalledWith({ itemId: "item-123", source: "test" });

    agentEventBus.off("work_available", handler);
  });

  it("emits and receives wake_requested events", () => {
    const handler = vi.fn();
    agentEventBus.on("wake_requested", handler);

    agentEventBus.emit("wake_requested", { source: "telegram", reason: "creator_decree" });
    expect(handler).toHaveBeenCalledWith({ source: "telegram", reason: "creator_decree" });

    agentEventBus.off("wake_requested", handler);
  });

  it("supports typed helper methods emitWorkAvailable and emitWakeRequested", () => {
    const workHandler = vi.fn();
    const wakeHandler = vi.fn();

    agentEventBus.on("work_available", workHandler);
    agentEventBus.on("wake_requested", wakeHandler);

    agentEventBus.emitWorkAvailable({ itemId: "item-456", source: "creator", priority: 100 });
    expect(workHandler).toHaveBeenCalledWith({ itemId: "item-456", source: "creator", priority: 100 });

    agentEventBus.emitWakeRequested({ source: "heartbeat", reason: "scheduled_check", payload: { foo: "bar" } });
    expect(wakeHandler).toHaveBeenCalledWith({
      source: "heartbeat",
      reason: "scheduled_check",
      payload: { foo: "bar" },
    });

    agentEventBus.off("work_available", workHandler);
    agentEventBus.off("wake_requested", wakeHandler);
  });

  describe("Integration with ingestWorkItem and insertWakeEvent", () => {
    beforeEach(() => {
      initDb(":memory:");
    });

    afterEach(() => {
      closeDb();
    });

    it("emits work_available when ingestWorkItem is called", () => {
      const handler = vi.fn();
      agentEventBus.on("work_available", handler);

      const item = ingestWorkItem({
        source: "creator",
        payload: { command: "test" },
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        itemId: item.id,
        source: "creator",
        priority: 100,
      });

      agentEventBus.off("work_available", handler);
    });

    it("emits wake_requested when insertWakeEvent is called", () => {
      const handler = vi.fn();
      agentEventBus.on("wake_requested", handler);

      const rawDb = getDb();
      insertWakeEvent(rawDb, "orchestrator", "task_done", { taskId: "task-1" });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        source: "orchestrator",
        reason: "task_done",
        payload: { taskId: "task-1" },
      });

      agentEventBus.off("wake_requested", handler);
    });
  });
});
