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

describe("Entelechy Bank Cletus Alignment", () => {
  it("defaults ENTELECHY_DEFAULT_BANK to 'cletus'", () => {
    expect(ENTELECHY_DEFAULT_BANK).toBe("cletus");
  });

  it("verifies executor references ENTELECHY_DEFAULT_BANK", async () => {
    const executorCode = readSource("src/work-queue/executor.ts");
    expect(executorCode).toContain("retainEntelechyTaskResult(item.id, outputSummary, ENTELECHY_DEFAULT_BANK)");
  });

  it("verifies system prompt references 'cletus' bank", async () => {
    const promptCode = readSource("src/agent/system-prompt.ts");
    expect(promptCode).toContain("ENTELECHY MEMORY (bank 'cletus'");
  });

  it("verifies heartbeat task does not retain raw heartbeat pings to Entelechy", async () => {
    const tasksCode = readSource("src/heartbeat/tasks.ts");
    expect(tasksCode).not.toContain("heartbeat_mass_sync");
  });
});
