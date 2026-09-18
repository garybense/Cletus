import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { loadConfig, createConfig, getConfigPath } from "../config.js";
import type { CletusConfig } from "../types.js";

describe("CLETUS_MAX_CHILDREN Environment Variable", () => {
  const originalEnv = process.env.CLETUS_MAX_CHILDREN;
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cletus-config-test-"));
    process.env.HOME = tmpDir;
    configPath = getConfigPath();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CLETUS_MAX_CHILDREN = originalEnv;
    } else {
      delete process.env.CLETUS_MAX_CHILDREN;
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it("should use default maxChildren when env var is not set", () => {
    delete process.env.CLETUS_MAX_CHILDREN;
    const dummyConfig = {
      name: "cletus-test",
      maxChildren: 3,
    };
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(dummyConfig));

    const loaded = loadConfig();
    expect(loaded).not.toBeNull();
    expect(loaded?.maxChildren).toBe(3);
  });

  it("should override maxChildren in loadConfig when CLETUS_MAX_CHILDREN is set", () => {
    process.env.CLETUS_MAX_CHILDREN = "5";
    const dummyConfig = {
      name: "cletus-test",
      maxChildren: 3,
    };
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(dummyConfig));

    const loaded = loadConfig();
    expect(loaded).not.toBeNull();
    expect(loaded?.maxChildren).toBe(5);
  });

  it("should ignore invalid CLETUS_MAX_CHILDREN values", () => {
    process.env.CLETUS_MAX_CHILDREN = "invalid";
    const dummyConfig = {
      name: "cletus-test",
      maxChildren: 3,
    };
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(dummyConfig));

    const loaded = loadConfig();
    expect(loaded).not.toBeNull();
    expect(loaded?.maxChildren).toBe(3);
  });

  it("should override maxChildren in createConfig when CLETUS_MAX_CHILDREN is set", () => {
    process.env.CLETUS_MAX_CHILDREN = "7";
    const created = createConfig({
      name: "cletus-fresh",
      genesisPrompt: "prompt",
      creatorAddress: "0x123",
      registeredWithMindmods: false,
      sandboxId: "sb-1",
      walletAddress: "0x456",
      apiKey: "key",
    });

    expect(created.maxChildren).toBe(7);
  });
});
