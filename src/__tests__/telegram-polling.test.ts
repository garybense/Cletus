import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initDb, closeDb, getDb } from "../state/database";
import { TelegramClient, TelegramPollingDaemon } from "../social/telegram-client";

describe("Telegram Inbound Polling Daemon", () => {
  beforeEach(() => {
    initDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("polls Telegram updates, inserts inbox_messages, and creates wake events", async () => {
    const db = getDb();

    // Mock TelegramClient getUpdates
    const mockClient: any = {
      getUpdates: vi.fn().mockResolvedValue([
        {
          id: 1001,
          chatId: 987654321,
          text: "Deploy high-priority bounty scout worker",
          timestamp: Math.floor(Date.now() / 1000),
        },
      ]),
    };

    const daemon = new TelegramPollingDaemon({
      client: mockClient,
      db,
      pollIntervalMs: 50,
    });

    // Execute pollOnce
    const count = await daemon.pollOnce();
    expect(count).toBe(1);

    // Verify inbox_messages insertion
    const inboxRows = db.prepare("SELECT * FROM inbox_messages WHERE from_address = 'telegram:987654321'").all() as any[];
    expect(inboxRows.length).toBe(1);
    expect(inboxRows[0].content).toBe("Deploy high-priority bounty scout worker");
    expect(inboxRows[0].status).toBe("received");

    // Verify wake_events insertion
    const wakeRows = db.prepare("SELECT * FROM wake_events WHERE source = 'telegram'").all() as any[];
    expect(wakeRows.length).toBe(1);
    expect(wakeRows[0].reason).toContain("Deploy high-priority bounty scout worker");
  });

  it("handles empty updates gracefully", async () => {
    const db = getDb();

    const mockClient: any = {
      getUpdates: vi.fn().mockResolvedValue([]),
    };

    const daemon = new TelegramPollingDaemon({
      client: mockClient,
      db,
    });

    const count = await daemon.pollOnce();
    expect(count).toBe(0);

    const inboxRows = db.prepare("SELECT * FROM inbox_messages").all();
    expect(inboxRows.length).toBe(0);
  });
});
