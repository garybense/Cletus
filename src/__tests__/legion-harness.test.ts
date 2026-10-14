import { describe, it, expect, vi, beforeEach } from "vitest";
import { LegionHarness } from "../agent/harnesses/legion-harness.js";

// Mock better-sqlite3 as a constructor class
vi.mock("better-sqlite3", () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([
            { ip: "127.0.0.1", port: 11434 },
            { ip: "127.0.0.2", port: 11434 }
          ])
        })
      };
    })
  };
});

describe("LegionHarness", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize with correct metadata and tools", () => {
    const harness = new LegionHarness();
    expect(harness.id).toBe("legion");
    expect(harness.description).toContain("Regional Sieve Masters");

    const tools = harness.getToolDefs();
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("legion_dispatch_wave");
  });

  it("should build proper system prompt", () => {
    const harness = new LegionHarness();
    const prompt = harness.buildSystemPrompt();
    expect(prompt).toContain("AETHEL");
    expect(prompt).toContain("Regional Masters");
  });

  it("should dispatch wave using native fetch with AbortController", async () => {
    const harness = new LegionHarness();
    const tools = harness.getToolDefs();
    const dispatchTool = tools[0];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: "Regional consensus signal: positive arbitrage" })
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await dispatchTool.execute({ prompt: "Analyze market spread" });
    expect(result).toContain("Consensus achieved from 2 regions");
    expect(result).toContain("Regional consensus signal: positive arbitrage");
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const firstCallUrl = mockFetch.mock.calls[0][0];
    const firstCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(firstCallUrl).toBe("http://127.0.0.1:11434/api/generate");
    expect(firstCallBody.prompt).toContain("Analyze market spread");
  });
});
