import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { initDb, closeDb, getDb, createDatabase } from "../state/database";
import { loadSkills, getActiveSkillMenu } from "../skills/loader";

describe("Skills Modularization Loader", () => {
  beforeEach(() => {
    initDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("loads and registers custom packaged skills from src/skills/", () => {
    const rawDb = getDb();
    const db = createDatabase(rawDb);

    const skillsDir = path.join(process.cwd(), "src", "skills");
    const loadedSkills = loadSkills(skillsDir, db);

    expect(loadedSkills.length).toBeGreaterThan(0);

    const names = loadedSkills.map((s) => s.name);
    expect(names).toContain("system-diagnostics");
    expect(names).toContain("filesystem-monitor");
    expect(names).toContain("work-queue-manager");

    const menu = getActiveSkillMenu(loadedSkills);
    expect(menu).toContain("system-diagnostics");
    expect(menu).toContain("filesystem-monitor");
    expect(menu).toContain("work-queue-manager");
  });
});
