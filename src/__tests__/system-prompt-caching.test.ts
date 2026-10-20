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

    const promptTurn1 = buildSystemPrompt({ ...baseParams, financial: { creditsCents: 500, usdcBalance: 10 } });
    const promptTurn2 = buildSystemPrompt({ ...baseParams, financial: { creditsCents: 490, usdcBalance: 9 } });

    expect(promptTurn1.slice(0, 500)).toBe(promptTurn2.slice(0, 500));
  });
});
