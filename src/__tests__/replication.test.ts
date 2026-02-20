/**
 * Tests for Sub-phase 0.6: Replication Safety
 *
 * Validates wallet address checking, spawn cleanup on failure,
 * and prevention of funding to zero-address wallets.
 *
 * Updated for Phase 3.1: spawnChild now uses ConwayClient interface
 * directly instead of raw fetch-based execInSandbox/writeInSandbox.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isValidWalletAddress, spawnChild } from "../replication/spawn.js";
import {
  MockConwayClient,
  createTestDb,
  createTestIdentity,
} from "./mocks.js";
import type { AutomatonDatabase, GenesisConfig } from "../types.js";

// Mock fs for constitution propagation
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    default: {
      ...actual,
      readFileSync: vi.fn(() => { throw new Error("file not found"); }),
      existsSync: actual.existsSync,
      mkdirSync: actual.mkdirSync,
      mkdtempSync: actual.mkdtempSync,
    },
    readFileSync: vi.fn(() => { throw new Error("file not found"); }),
    existsSync: actual.existsSync,
    mkdirSync: actual.mkdirSync,
    mkdtempSync: actual.mkdtempSync,
  };
});

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

  beforeEach(() => {
    conway = new MockConwayClient();
    db = createTestDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates wallet address before creating child record", async () => {
    // Mock exec to return valid wallet address on init
    vi.spyOn(conway, "exec").mockImplementation(async (command: string) => {
      if (command.includes("automaton --init")) {
        return { stdout: `Wallet initialized: ${validAddress}`, stderr: "", exitCode: 0 };
      }
      return { stdout: "ok", stderr: "", exitCode: 0 };
    });

    const child = await spawnChild(conway, identity, db, genesis);

    expect(child.address).toBe(validAddress);
    expect(child.status).toBe("spawning");
  });

  it("throws on zero address from init", async () => {
    vi.spyOn(conway, "exec").mockImplementation(async (command: string) => {
      if (command.includes("automaton --init")) {
        return { stdout: `Wallet: ${zeroAddress}`, stderr: "", exitCode: 0 };
      }
      return { stdout: "ok", stderr: "", exitCode: 0 };
    });

    await expect(spawnChild(conway, identity, db, genesis))
      .rejects.toThrow("Child wallet address invalid");
  });

  it("throws when init returns no wallet address", async () => {
    vi.spyOn(conway, "exec").mockImplementation(async (command: string) => {
      if (command.includes("automaton --init")) {
        return { stdout: "initialization complete, no wallet", stderr: "", exitCode: 0 };
      }
      return { stdout: "ok", stderr: "", exitCode: 0 };
    });

    await expect(spawnChild(conway, identity, db, genesis))
      .rejects.toThrow("Child wallet address invalid");
  });

  it("cleans up sandbox on exec failure", async () => {
    const deleteSpy = vi.spyOn(conway, "deleteSandbox");

    // Make the first exec (apt-get install) fail
    vi.spyOn(conway, "exec").mockRejectedValue(new Error("Install failed"));

    await expect(spawnChild(conway, identity, db, genesis))
      .rejects.toThrow();

    expect(deleteSpy).toHaveBeenCalledWith("new-sandbox-id");
  });

  it("cleans up sandbox when wallet validation fails", async () => {
    const deleteSpy = vi.spyOn(conway, "deleteSandbox");

    vi.spyOn(conway, "exec").mockImplementation(async (command: string) => {
      if (command.includes("automaton --init")) {
        return { stdout: `Wallet: ${zeroAddress}`, stderr: "", exitCode: 0 };
      }
      return { stdout: "ok", stderr: "", exitCode: 0 };
    });

    await expect(spawnChild(conway, identity, db, genesis))
      .rejects.toThrow("Child wallet address invalid");

    expect(deleteSpy).toHaveBeenCalledWith("new-sandbox-id");
  });

  it("does not mask original error if deleteSandbox also throws", async () => {
    vi.spyOn(conway, "deleteSandbox").mockRejectedValue(new Error("delete also failed"));

    // Make exec fail
    vi.spyOn(conway, "exec").mockRejectedValue(new Error("Install failed"));

    // Original error should propagate, not the deleteSandbox error
    await expect(spawnChild(conway, identity, db, genesis))
      .rejects.toThrow(/Install failed/);
  });

  it("does not call deleteSandbox if createSandbox itself fails", async () => {
    const deleteSpy = vi.spyOn(conway, "deleteSandbox");
    vi.spyOn(conway, "createSandbox").mockRejectedValue(new Error("Sandbox creation failed"));

    await expect(spawnChild(conway, identity, db, genesis))
      .rejects.toThrow("Sandbox creation failed");

    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
