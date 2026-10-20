import { describe, it, expect, vi } from "vitest";
import { ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";
import fs from "fs";
import path from "path";

function readSource(relPath: string): string {
  if (fs.existsSync(relPath)) {
    return fs.readFileSync(relPath, "utf-8");
  }
  return fs.readFileSync(path.resolve(__dirname, "../../", relPath), "utf-8");
}

describe("Entelechy Bank Sovereign Alignment", () => {
  it("defaults ENTELECHY_DEFAULT_BANK to 'sovereign'", () => {
    expect(ENTELECHY_DEFAULT_BANK).toBe("sovereign");
  });

  it("verifies executor references ENTELECHY_DEFAULT_BANK instead of legacy 'cletus'", async () => {
    const executorCode = readSource("src/work-queue/executor.ts");
    expect(executorCode).not.toContain("retainEntelechyTaskResult(item.id, outputSummary, 'cletus')");
    expect(executorCode).toContain("retainEntelechyTaskResult(item.id, outputSummary, ENTELECHY_DEFAULT_BANK)");
  });

  it("verifies system prompt references 'sovereign' bank", async () => {
    const promptCode = readSource("src/agent/system-prompt.ts");
    expect(promptCode).toContain("ENTELECHY MEMORY (bank 'sovereign'");
  });
});
