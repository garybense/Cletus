import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { waitForWakeEventOrTimeout } from "../state/sleep-wait.js";
import { agentEventBus } from "../state/event-bus.js";
import { initDb, closeDb, getDb, insertWakeEvent } from "../state/database.js";

describe("Interruptible Sleep Wait", () => {
  it("resolves immediately when wake_requested event is fired", async () => {
    let pendingRow: any = undefined;
    const mockDb = {
      prepare: () => ({
        get: () => {
          const row = pendingRow;
          pendingRow = undefined;
          return row;
        },
        run: () => ({ changes: 1 }),
      }),
    } as any;

    const start = Date.now();
    const waitPromise = waitForWakeEventOrTimeout(mockDb, 30_000);

    setTimeout(() => {
      pendingRow = {
        id: 1,
        source: "test",
        reason: "instant_wake",
        payload: "{}",
        consumed_at: null,
        created_at: new Date().toISOString(),
      };
      agentEventBus.emitWakeRequested({ source: "test", reason: "instant_wake" });
    }, 20);

    const event = await waitPromise;
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000);
    expect(elapsed).toBeGreaterThanOrEqual(15);
    expect(event).toBeDefined();
    expect(event?.source).toBe("test");
    expect(event?.reason).toBe("instant_wake");
  });

  it("resolves with event_bus fallback if wake_requested event fired without DB row", async () => {
    const mockDb = {
      prepare: () => ({
        get: () => undefined,
        run: () => ({ changes: 0 }),
      }),
    } as any;

    const start = Date.now();
    const waitPromise = waitForWakeEventOrTimeout(mockDb, 30_000);

    setTimeout(() => {
      agentEventBus.emitWakeRequested({ source: "test", reason: "instant_wake" });
    }, 20);

    const event = await waitPromise;
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000);
    expect(elapsed).toBeGreaterThanOrEqual(15);
    expect(event).toEqual({ source: "event_bus", reason: "wake_signal" });
  });

  it("resolves immediately with existing event if wake event is already present in DB", async () => {
    const mockDb = {
      prepare: () => ({
        get: () => ({
          id: 1,
          source: "preexisting",
          reason: "already_queued",
          payload: "{}",
          consumed_at: null,
          created_at: new Date().toISOString(),
        }),
        run: () => ({ changes: 1 }),
      }),
    } as any;

    const start = Date.now();
    const event = await waitForWakeEventOrTimeout(mockDb, 30_000);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(event).toBeDefined();
    expect(event?.source).toBe("preexisting");
    expect(event?.reason).toBe("already_queued");
  });

  it("resolves when work_available event is fired during sleep", async () => {
    const mockDb = {
      prepare: () => ({
        get: () => undefined,
        run: () => ({ changes: 0 }),
      }),
    } as any;

    const start = Date.now();
    const waitPromise = waitForWakeEventOrTimeout(mockDb, 30_000);

    setTimeout(() => {
      agentEventBus.emitWorkAvailable({ itemId: "item-123", source: "work_queue" });
    }, 20);

    const event = await waitPromise;
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000);
    expect(elapsed).toBeGreaterThanOrEqual(15);
    expect(event).toEqual({ source: "event_bus", reason: "wake_signal" });
  });

  it("times out and returns null when no wake event occurs before maxWaitMs", async () => {
    const mockDb = {
      prepare: () => ({
        get: () => undefined,
        run: () => ({ changes: 0 }),
      }),
    } as any;

    const start = Date.now();
    const event = await waitForWakeEventOrTimeout(mockDb, 50);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(event).toBeNull();
  });

  it("cleans up event listeners after resolving", async () => {
    const initialWakeListeners = agentEventBus.listenerCount("wake_requested");
    const initialWorkListeners = agentEventBus.listenerCount("work_available");

    const mockDb = {
      prepare: () => ({
        get: () => undefined,
        run: () => ({ changes: 0 }),
      }),
    } as any;

    const waitPromise = waitForWakeEventOrTimeout(mockDb, 30_000);
    expect(agentEventBus.listenerCount("wake_requested")).toBe(initialWakeListeners + 1);
    expect(agentEventBus.listenerCount("work_available")).toBe(initialWorkListeners + 1);

    agentEventBus.emitWakeRequested({ source: "test", reason: "instant_wake" });
    await waitPromise;

    expect(agentEventBus.listenerCount("wake_requested")).toBe(initialWakeListeners);
    expect(agentEventBus.listenerCount("work_available")).toBe(initialWorkListeners);
  });

  describe("Integration with real in-memory SQLite", () => {
    beforeEach(() => {
      initDb(":memory:");
    });

    afterEach(() => {
      closeDb();
    });

    it("wakes up and returns consumed wake event when insertWakeEvent is called", async () => {
      const rawDb = getDb();
      const start = Date.now();

      const waitPromise = waitForWakeEventOrTimeout(rawDb, 30_000);

      setTimeout(() => {
        insertWakeEvent(rawDb, "telegram", "creator_decree", { urgent: true });
      }, 25);

      const event = await waitPromise;
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(1000);
      expect(elapsed).toBeGreaterThanOrEqual(20);
      expect(event).toBeDefined();
      expect(event?.source).toBe("telegram");
      expect(event?.reason).toBe("creator_decree");
    });
  });
});
