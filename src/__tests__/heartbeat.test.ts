/**
 * Heartbeat Tests
 *
 * Tests for heartbeat tasks, especially the social inbox checker.
 * Phase 1.1: Updated to pass TickContext + HeartbeatLegacyContext.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BUILTIN_TASKS } from "../heartbeat/tasks.js";
import {
  MockConwayClient,
  MockSocialClient,
  createTestDb,
  createTestIdentity,
  createTestConfig,
} from "./mocks.js";
import type { AutomatonDatabase, InboxMessage, TickContext, HeartbeatLegacyContext } from "../types.js";

function createMockTickContext(db: AutomatonDatabase, overrides?: Partial<TickContext>): TickContext {
  return {
    tickId: "test-tick-1",
    startedAt: new Date(),
    creditBalance: 10_000,
    usdcBalance: 1.5,
    survivalTier: "normal",
    lowComputeMultiplier: 4,
    config: {
      entries: [],
      defaultIntervalMs: 60_000,
      lowComputeMultiplier: 4,
    },
    db: db.raw,
    ...overrides,
  };
}

describe("Heartbeat Tasks", () => {
  let db: AutomatonDatabase;
  let conway: MockConwayClient;

  beforeEach(() => {
    db = createTestDb();
    conway = new MockConwayClient();
  });

  afterEach(() => {
    db.close();
  });

  describe("check_social_inbox", () => {
    it("returns shouldWake false when no social client", async () => {
      const tickCtx = createMockTickContext(db);
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
        // no social client
      };

      const result = await BUILTIN_TASKS.check_social_inbox(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(false);
    });

    it("polls and wakes when messages found", async () => {
      const social = new MockSocialClient();
      social.pollResponses.push({
        messages: [
          {
            id: "msg-1",
            from: "0xsender1",
            to: "0xrecipient",
            content: "Hey there!",
            signedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          {
            id: "msg-2",
            from: "0xsender2",
            to: "0xrecipient",
            content: "What's up?",
            signedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
        nextCursor: new Date().toISOString(),
      });

      const tickCtx = createMockTickContext(db);
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
        social,
      };

      const result = await BUILTIN_TASKS.check_social_inbox(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(true);
      expect(result.message).toContain("2 new message(s)");

      // Verify messages were persisted to inbox
      const unprocessed = db.getUnprocessedInboxMessages(10);
      expect(unprocessed.length).toBe(2);
    });

    it("deduplicates messages", async () => {
      const social = new MockSocialClient();

      // First poll: returns msg-1
      social.pollResponses.push({
        messages: [
          {
            id: "msg-1",
            from: "0xsender1",
            to: "0xrecipient",
            content: "Hello!",
            signedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
      });

      // Second poll: returns same msg-1 again
      social.pollResponses.push({
        messages: [
          {
            id: "msg-1",
            from: "0xsender1",
            to: "0xrecipient",
            content: "Hello!",
            signedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const tickCtx = createMockTickContext(db);
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
        social,
      };

      // First run
      const result1 = await BUILTIN_TASKS.check_social_inbox(tickCtx, taskCtx);
      expect(result1.shouldWake).toBe(true);

      // Second run — same message, should not wake
      const result2 = await BUILTIN_TASKS.check_social_inbox(tickCtx, taskCtx);
      expect(result2.shouldWake).toBe(false);

      // Only one inbox row
      const unprocessed = db.getUnprocessedInboxMessages(10);
      expect(unprocessed.length).toBe(1);
    });

    it("returns shouldWake false when no messages", async () => {
      const social = new MockSocialClient();
      social.pollResponses.push({ messages: [] });

      const tickCtx = createMockTickContext(db);
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
        social,
      };

      const result = await BUILTIN_TASKS.check_social_inbox(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(false);
    });
  });
});
