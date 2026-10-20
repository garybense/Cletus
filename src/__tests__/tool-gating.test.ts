import { describe, it, expect } from "vitest";
import { filterToolsForTurn, TOOL_DOMAINS } from "../agent/tool-router.js";
import { createBuiltinTools } from "../agent/tools.js";

describe("Dynamic Tool Gating", () => {
  const allTools = createBuiltinTools("test-sandbox");

  it("always includes all CORE tools regardless of task", () => {
    const gated = filterToolsForTurn(allTools, {});
    const gatedNames = new Set(gated.map((t) => t.name));

    for (const coreTool of TOOL_DOMAINS.CORE) {
      expect(gatedNames.has(coreTool)).toBe(true);
    }
  });

  it("reduces total tool count by at least 50% on general turn", () => {
    const gated = filterToolsForTurn(allTools, {});
    expect(gated.length).toBeLessThan(allTools.length * 0.5);
  });

  it("activates DEV_SYSTEM domain when task title mentions coding or git", () => {
    const gated = filterToolsForTurn(allTools, { activeTask: "Fix bug in git repository and commit" });
    const gatedNames = new Set(gated.map((t) => t.name));
    expect(gatedNames.has("git_commit")).toBe(true);
    expect(gatedNames.has("edit_own_file")).toBe(true);
  });

  it("activates ORCHESTRATION_FLEET when role is orchestrator or task mentions child agents", () => {
    const gated = filterToolsForTurn(allTools, { taskRole: "orchestrator" });
    const gatedNames = new Set(gated.map((t) => t.name));
    expect(gatedNames.has("spawn_child")).toBe(true);
    expect(gatedNames.has("message_child")).toBe(true);
  });

  it("activates forced domains when explicitly provided", () => {
    const gated = filterToolsForTurn(allTools, { forcedDomains: ["BROWSER"] });
    const gatedNames = new Set(gated.map((t) => t.name));
    expect(gatedNames.has("browser_navigate")).toBe(true);
    expect(gatedNames.has("browser_click")).toBe(true);
  });

  it("activates BROWSER domain when task text mentions web or scrape", () => {
    const gated = filterToolsForTurn(allTools, { activeTask: "Scrape web documentation" });
    const gatedNames = new Set(gated.map((t) => t.name));
    expect(gatedNames.has("browser_navigate")).toBe(true);
  });

  it("activates FINANCIAL_CRYPTO domain when task text mentions usdc or pay", () => {
    const gated = filterToolsForTurn(allTools, { activeTask: "Pay invoice using usdc" });
    const gatedNames = new Set(gated.map((t) => t.name));
    expect(gatedNames.has("check_usdc_balance")).toBe(true);
  });

  it("activates SOUL_EVOLUTION domain when task text mentions soul or identity", () => {
    const gated = filterToolsForTurn(allTools, { activeTask: "Reflect on soul identity" });
    const gatedNames = new Set(gated.map((t) => t.name));
    expect(gatedNames.has("view_soul")).toBe(true);
    expect(gatedNames.has("update_soul")).toBe(true);
  });

  it("reduces tool schema token payload by >60% compared to full toolset", () => {
    const gated = filterToolsForTurn(allTools, {});
    const fullPayloadSize = JSON.stringify(
      allTools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
    ).length;
    const gatedPayloadSize = JSON.stringify(
      gated.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
    ).length;
    const reductionPercent = (1 - gatedPayloadSize / fullPayloadSize) * 100;
    expect(reductionPercent).toBeGreaterThan(60);
  });
});
