import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initDb, closeDb, getDb } from "../state/database";
import { TelegramClient, TelegramPollingDaemon, extractNumericChatId } from "../social/telegram-client";

describe("Hardened Telegram Inbound Polling Daemon", () => {
  beforeEach(() => {
    initDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("extractNumericChatId parses clean numeric IDs from string prefixes", () => {
    expect(extractNumericChatId("telegram:creator:987654321")).toBe(987654321);
    expect(extractNumericChatId("telegram:987654321")).toBe(987654321);
    expect(extractNumericChatId("-100123456789")).toBe(-100123456789);
    expect(extractNumericChatId(12345)).toBe(12345);
  });

  it("persists last offset to kv table and tags creator messages vs guest messages", async () => {
    const db = getDb();

    // Mock TelegramClient getUpdates
    const mockClient: any = {
      creatorChatId: "telegram:creator:987654321", // String prefix format
      getUpdates: vi.fn().mockResolvedValue([
        {
          id: 1001,
          chatId: 987654321, // Creator match after numeric extraction
          text: "Authorized creator decree",
          timestamp: Math.floor(Date.now() / 1000),
        },
        {
          id: 1002,
          chatId: 111222333, // Guest match
          text: "Guest message from public",
          timestamp: Math.floor(Date.now() / 1000),
        },
      ]),
    };

    const daemon = new TelegramPollingDaemon({
      client: mockClient,
      db,
      pollIntervalMs: 50,
    });

    const count = await daemon.pollOnce();
    expect(count).toBe(2);

    // Verify creator vs guest tagging in inbox_messages
    const creatorMsg = db.prepare("SELECT * FROM inbox_messages WHERE from_address = 'telegram:creator:987654321'").get() as any;
    expect(creatorMsg).toBeDefined();
    expect(creatorMsg.content).toBe("Authorized creator decree");

    const guestMsg = db.prepare("SELECT * FROM inbox_messages WHERE from_address = 'telegram:guest:111222333'").get() as any;
    expect(guestMsg).toBeDefined();
    expect(guestMsg.content).toBe("Guest message from public");

    // Verify offset persisted to kv table
    const kvOffset = db.prepare("SELECT value FROM kv WHERE key = 'telegram.last_offset'").get() as any;
    expect(kvOffset).toBeDefined();
    expect(kvOffset.value).toBe("1003");
  });

  it("truncates long messages exceeding maxMessageLength boundary", async () => {
    const db = getDb();

    const longText = "A".repeat(15_000);
    const mockClient: any = {
      creatorChatId: 987654321,
      getUpdates: vi.fn().mockResolvedValue([
        {
          id: 2001,
          chatId: 987654321,
          text: longText,
          timestamp: Math.floor(Date.now() / 1000),
        },
      ]),
    };

    const daemon = new TelegramPollingDaemon({
      client: mockClient,
      db,
      maxMessageLength: 1000,
    });

    await daemon.pollOnce();

    const msg = db.prepare("SELECT * FROM inbox_messages WHERE id = 'tg-2001'").get() as any;
    expect(msg).toBeDefined();
    expect(msg.content.length).toBe(1000);
  });
});
