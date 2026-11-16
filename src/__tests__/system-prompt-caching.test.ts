import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../agent/system-prompt.js";

describe("System Prompt Prefix Caching", () => {
  it("generates an identical prefix across turns when only financial balance or timestamp changes", () => {
    const baseParams: any = {
      identity: { name: "Cletus", address: "0x123", creatorAddress: "0xabc", sandboxId: "sb-1" },
      config: { name: "Cletus", genesisPrompt: "Sovereign mission" },
      db: {
        getTurnCount: () => 1,
        getRecentModifications: () => [],
        getRegistryEntry: () => null,
        getChildren: () => [],
        getKV: () => null,
        setKV: () => {},
        raw: { prepare: () => ({ get: () => null, all: () => [] }) }
      },
      tools: [],
      skills: [],
      state: "running",
      financial: { creditsCents: 500, usdcBalance: 10 },
      isFirstRun: false,
    };

    const baseParamsTurn2: any = {
      ...baseParams,
      db: {
        ...baseParams.db,
        getTurnCount: () => 2,
      }
    };

    const promptTurn1 = buildSystemPrompt({ ...baseParams, financial: { creditsCents: 500, usdcBalance: 10 } });
    const promptTurn2 = buildSystemPrompt({ ...baseParamsTurn2, financial: { creditsCents: 490, usdcBalance: 9 } });

    // 1. Verify that the common identical prefix across turns with different financial credits or turn counts is at least 3,000 characters long.
    expect(promptTurn1.length).toBeGreaterThan(3000);
    expect(promptTurn2.length).toBeGreaterThan(3000);

    // Find where "--- CURRENT STATUS ---" starts in promptTurn1
    const statusIndex1 = promptTurn1.indexOf("--- CURRENT STATUS ---");
    const statusIndex2 = promptTurn2.indexOf("--- CURRENT STATUS ---");
    expect(statusIndex1).toBeGreaterThan(3000);
    expect(statusIndex2).toBeGreaterThan(3000);

    const prefix1 = promptTurn1.slice(0, statusIndex1);
    const prefix2 = promptTurn2.slice(0, statusIndex2);

    // 2. Verify that OPERATIONAL_CONTEXT appears BEFORE --- CURRENT STATUS ---
    const opContextIndex1 = promptTurn1.indexOf("<environment>");
    expect(opContextIndex1).toBeGreaterThan(-1);
    expect(opContextIndex1).toBeLessThan(statusIndex1);

    // 3. Verify that the prompt prefix up to the start of dynamic status/tools is byte-for-byte identical between turn 1 and turn 2.
    expect(prefix1).toBe(prefix2);
  });
});
