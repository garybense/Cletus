/**
 * Tests for Sub-phase 0.6: Replication Safety
 *
 * Validates wallet address checking, spawn cleanup on failure,
 * and prevention of funding to zero-address wallets.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isValidWalletAddress, spawnChild } from "../replication/spawn.js";
import {
  MockConwayClient,
  createTestDb,
  createTestIdentity,
} from "./mocks.js";
import type { AutomatonDatabase, GenesisConfig } from "../types.js";

// ─── isValidWalletAddress ─────────────────────────────────────

describe("isValidWalletAddress", () => {
  it("accepts a valid 40-hex-char address with 0x prefix", () => {
    expect(isValidWalletAddress("0xabcdef1234567890abcdef1234567890abcdef12")).toBe(true);
  });

  it("accepts uppercase hex characters", () => {
    expect(isValidWalletAddress("0xABCDEF1234567890ABCDEF1234567890ABCDEF12")).toBe(true);
  });

  it("accepts mixed-case hex characters", () => {
    expect(isValidWalletAddress("0xAbCdEf1234567890aBcDeF1234567890AbCdEf12")).toBe(true);
  });

  it("rejects the zero address", () => {
    expect(isValidWalletAddress("0x" + "0".repeat(40))).toBe(false);
  });

  it("rejects addresses without 0x prefix", () => {
    expect(isValidWalletAddress("abcdef1234567890abcdef1234567890abcdef12")).toBe(false);
  });

  it("rejects addresses that are too short", () => {
    expect(isValidWalletAddress("0xabcdef")).toBe(false);
  });

  it("rejects addresses that are too long", () => {
    expect(isValidWalletAddress("0x" + "a".repeat(42))).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidWalletAddress("")).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isValidWalletAddress("0xGGGGGG1234567890abcdef1234567890abcdef12")).toBe(false);
  });

  it("rejects 0x prefix alone", () => {
    expect(isValidWalletAddress("0x")).toBe(false);
  });
});

// ─── spawnChild ───────────────────────────────────────────────

describe("spawnChild", () => {
  let conway: MockConwayClient;
  let db: AutomatonDatabase;
  const identity = createTestIdentity();
  const genesis: GenesisConfig = {
    name: "test-child",
    genesisPrompt: "You are a test child automaton.",
    creatorMessage: "Hello child!",
    creatorAddress: identity.address,
    parentAddress: identity.address,
  };

  const validAddress = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
  const zeroAddress = "0x" + "0".repeat(40);

  // Helper: create a fetch mock that returns exec results based on command
  function mockFetch(commandHandler: (command: string) => { stdout: string; stderr: string; exitCode: number }) {
    return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      // Sandbox creation is handled by MockConwayClient, not fetch
      // But execInSandbox and writeInSandbox use fetch directly
      if (urlStr.includes("/exec")) {
        const body = JSON.parse(init?.body as string || "{}");
        const result = commandHandler(body.command || "");
        return new Response(JSON.stringify(result), { status: 200 });
      }

      if (urlStr.includes("/files/upload")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // Fallback
      return new Response(JSON.stringify({ stdout: "ok", stderr: "", exitCode: 0 }), { status: 200 });
    });
  }

  beforeEach(() => {
    conway = new MockConwayClient();
    db = createTestDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates wallet address before creating child record", async () => {
    const fetchMock = mockFetch((cmd) => {
      if (cmd.includes("automaton --init")) {
        return { stdout: `Wallet initialized: ${validAddress}`, stderr: "", exitCode: 0 };
      }
      return { stdout: "ok", stderr: "", exitCode: 0 };
    });
    vi.stubGlobal("fetch", fetchMock);

    const child = await spawnChild(conway, identity, db, genesis);

    expect(child.address).toBe(validAddress);
    expect(child.status).toBe("spawning");
  });

  it("throws on zero address from init", async () => {
    const fetchMock = mockFetch((cmd) => {
      if (cmd.includes("automaton --init")) {
        return { stdout: `Wallet: ${zeroAddress}`, stderr: "", exitCode: 0 };
      }
      return { stdout: "ok", stderr: "", exitCode: 0 };
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(spawnChild(conway, identity, db, genesis))
      .rejects.toThrow("Child wallet address invalid");
  });

  it("throws when init returns no wallet address", async () => {
    const fetchMock = mockFetch((cmd) => {
      if (cmd.includes("automaton --init")) {
        return { stdout: "initialization complete, no wallet", stderr: "", exitCode: 0 };
      }
      return { stdout: "ok", stderr: "", exitCode: 0 };
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(spawnChild(conway, identity, db, genesis))
      .rejects.toThrow("Child wallet address invalid");
  });

  it("cleans up sandbox on exec failure", async () => {
    const deleteSpy = vi.spyOn(conway, "deleteSandbox");

    // Make the first exec (apt-get install) fail
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/exec")) {
        return new Response("Install failed", { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(spawnChild(conway, identity, db, genesis))
      .rejects.toThrow();

    expect(deleteSpy).toHaveBeenCalledWith("new-sandbox-id");
  });

  it("cleans up sandbox when wallet validation fails", async () => {
    const deleteSpy = vi.spyOn(conway, "deleteSandbox");

    const fetchMock = mockFetch((cmd) => {
      if (cmd.includes("automaton --init")) {
        return { stdout: `Wallet: ${zeroAddress}`, stderr: "", exitCode: 0 };
      }
      return { stdout: "ok", stderr: "", exitCode: 0 };
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(spawnChild(conway, identity, db, genesis))
      .rejects.toThrow("Child wallet address invalid");

    expect(deleteSpy).toHaveBeenCalledWith("new-sandbox-id");
  });

  it("does not mask original error if deleteSandbox also throws", async () => {
    vi.spyOn(conway, "deleteSandbox").mockRejectedValue(new Error("delete also failed"));

    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/exec")) {
        return new Response("Install failed", { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    // Original error should propagate, not the deleteSandbox error
    await expect(spawnChild(conway, identity, db, genesis))
      .rejects.toThrow(/failed/);
  });

  it("does not call deleteSandbox if createSandbox itself fails", async () => {
    const deleteSpy = vi.spyOn(conway, "deleteSandbox");
    vi.spyOn(conway, "createSandbox").mockRejectedValue(new Error("Sandbox creation failed"));

    await expect(spawnChild(conway, identity, db, genesis))
      .rejects.toThrow("Sandbox creation failed");

    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
