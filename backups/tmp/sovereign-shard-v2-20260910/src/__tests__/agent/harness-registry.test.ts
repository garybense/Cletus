import { describe, expect, it } from "vitest";
import type { TaskResult } from "../../orchestration/task-graph.js";
import type { AgentHarness, HarnessContext, HarnessTool } from "../../agent/harness-types.js";
import { HarnessRegistry } from "../../agent/harness-registry.js";

class DummyHarness implements AgentHarness {
  readonly id = "dummy";
  readonly description = "dummy";
  async initialize(): Promise<void> {}
  async execute(): Promise<TaskResult> {
    return { success: true, output: "ok", artifacts: [], costCents: 0, duration: 0 };
  }
  getToolDefs(): HarnessTool[] {
    return [];
  }
  buildSystemPrompt(): string {
    return "";
  }
  buildTaskPrompt(): string {
    return "";
  }
}

describe("agent/HarnessRegistry", () => {
  it("maps executor to coding and orchestrator to orchestrator harness", () => {
    const registry = new HarnessRegistry();
    expect(registry.getHarnessIdForRole("executor")).toBe("coding");
    expect(registry.getHarnessIdForRole("orchestrator")).toBe("orchestrator");
  });

  it("falls back to the general harness for unknown roles", () => {
    const registry = new HarnessRegistry();
    expect(registry.getHarnessIdForRole("unknown-role")).toBe("general");
    expect(registry.getHarnessIdForRole(null)).toBe("general");
  });

  it("treats role lookups as case-insensitive", () => {
    const registry = new HarnessRegistry();
    expect(registry.getHarnessIdForRole("ExEcUtOr")).toBe("coding");
  });

  it("allows custom registrations to override defaults", () => {
    const registry = new HarnessRegistry();
    registry.register("executor", DummyHarness);
    expect(registry.getHarnessIdForRole("executor")).toBe("dummy");
  });

  it("only enables the Freebuff harness through explicit failback", () => {
    const registry = new HarnessRegistry();
    expect(registry.createForFailback(false).id).toBe("general");
    registry.enableFailback();
    expect(registry.createForFailback(true).id).toBe("freebuff");
    expect(registry.getHarnessIdForRole("generalist")).toBe("general");
    registry.disableFailback();
    expect(registry.createForFailback(true).id).toBe("general");
  });

  it("lists mappings with harness ids", () => {
    const registry = new HarnessRegistry();
    const mappings = registry.listMappings();
    expect(mappings.some((mapping) => mapping.role === "generalist" && mapping.harnessId === "general")).toBe(true);
    expect(mappings.some((mapping) => mapping.role === "executor" && mapping.harnessId === "coding")).toBe(true);
  });
});
