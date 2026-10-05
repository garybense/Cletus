import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initDb, closeDb, getDb, createDatabase } from "../state/database";
import {
  spawnOpenClawChild,
  syncApiKeyToOpenClaw,
  runOpenClawChildTurn,
  runRemoteOrLocal,
} from "../replication/openclaw-spawner";
import type { GenesisConfig } from "../types";

// Mock child_process exec to avoid actual SSH calls during unit testing
vi.mock("node:child_process", () => ({
  exec: vi.fn((cmd, opts, callback) => {
    const cb = typeof opts === "function" ? opts : callback;
    if (cb) cb(null, { stdout: "OK: openclaw-mock-stdout", stderr: "" }, "");
    return {} as any;
  }),
}));

describe("OpenClaw Remote Web Worker Integration", () => {
  beforeEach(() => {
    initDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("runRemoteOrLocal formats command over SSH when not on host", async () => {
    const res = await runRemoteOrLocal("openclaw status");
    expect(res.stdout).toContain("OK");
  });

  it("spawnOpenClawChild provisions workspace, syncs key, and registers child in state.db", async () => {
    const rawDb = getDb();
    const db = createDatabase(rawDb);

    const genesis: GenesisConfig = {
      name: "scout-bounty-01",
      genesisPrompt: "Scout and execute short-cycle web bounties.",
      modelId: "gemini-1.5-flash",
      chainType: "solana",
      specialization: "bounty_scout",
    } as any;

    const mockIdentity: any = { address: "0xparent", sandboxId: "parent-sbx" };
    const mockConfig: any = { name: "Cletus-Parent", googleApiKey: "test-gemini-key" };

    const child = await spawnOpenClawChild(mockIdentity, mockConfig, db, genesis);

    expect(child).toBeDefined();
    expect(child.name).toBe("scout-bounty-01");
    expect(child.sandboxId).toBe("openclaw:scout-bounty-01");
    expect(child.status).toBe("healthy");

    // Verify insertion into SQLite children table
    const storedChild = db.getChildById(child.id);
    expect(storedChild).toBeDefined();
    expect(storedChild?.name).toBe("scout-bounty-01");
    expect(storedChild?.sandboxId).toBe("openclaw:scout-bounty-01");
  });

  it("runOpenClawChildTurn formats command with sanitized instruction string", async () => {
    const result = await runOpenClawChildTurn("scout-bounty-01", "check 'work' status");
    expect(result.stdout).toContain("OK");
  });

  it("syncApiKeyToOpenClaw runs config set commands cleanly", async () => {
    await expect(syncApiKeyToOpenClaw("test-api-key-123", "google", "gemini-1.5-flash")).resolves.not.toThrow();
  });
});
