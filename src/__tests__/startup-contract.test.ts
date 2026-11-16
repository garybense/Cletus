import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

describe("Workspace Startup Contract (startup.sh)", () => {
  const startupScriptPath = path.join(process.cwd(), "startup.sh");

  it("startup.sh exists at the repository root and is executable", () => {
    expect(fs.existsSync(startupScriptPath)).toBe(true);
    const stats = fs.statSync(startupScriptPath);
    // Verify file mode includes execute permission
    expect(stats.mode & 0o111).toBeGreaterThan(0);
  });

  it("startup.sh contains idempotent health probe checks for port 18888", () => {
    const content = fs.readFileSync(startupScriptPath, "utf-8");
    expect(content).toContain("DASHBOARD_PORT");
    expect(content).toContain("curl -s -f");
    expect(content).toContain("exit 0");
  });

  it("executes startup.sh cleanly with exit code 0", () => {
    const output = execFileSync("bash", [startupScriptPath], {
      encoding: "utf-8",
      env: { ...process.env, DASHBOARD_PORT: "18888" },
    });
    expect(output).toContain("Cletus");
  });
});
