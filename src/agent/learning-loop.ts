/**
 * Learning Loop — Hermes-inspired skill creation + Entelechy integration
 *
 * Two loops, modeled on Hermes Agent's architecture:
 *
 * 1. CLOSED LOOP (runtime): After successful/failed tasks, evaluate
 *    the trajectory and create/update skills as SKILL.md files in
 *    ~/.automaton/skills/. Skills are procedural memory — Markdown
 *    with YAML frontmatter, exactly like Hermes.
 *
 * 2. ENTELECHY LOOP (external): Key learning events are retained to
 *    the Entelechy MCP server (mindmods.org/mcp, bank "automaton").
 *    Revenue strategies, failed monetization attempts, and successful
 *    earning patterns are stored permanently and retrievable via
 *    entelechy_recall / entelechy_reflect.
 */

import fs from "fs";
import path from "path";
import { ulid } from "ulid";
import type { Skill } from "../types.js";
import { callEntelechyMcpTool, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("learning-loop");

// ─── Constants ────────────────────────────────────────────────────

const SKILLS_DIR = (): string => {
  const home = process.env.HOME || "/root";
  return path.join(home, ".automaton", "skills");
};

const SKILL_CREATION_THRESHOLD_TOOL_CALLS = 5;
const REVENUE_FOCUS = "revenue_and_earning_strategies";

// ─── Skill Creation (Hermes-style) ────────────────────────────────

export interface TaskWisdom {
  taskTitle: string;
  taskDescription: string;
  success: boolean;
  toolCalls: number;
  stepsTaken: string[];
  outcome: string;
  revenueGeneratedCents?: number;
  lessons?: string[];
}

/**
 * Evaluate whether a task trajectory should become a skill.
 * Mirrors Hermes: tasks with 5+ tool calls that succeeded are candidates.
 */
export function shouldCreateSkill(wisdom: TaskWisdom): boolean {
  if (!wisdom.success) return false;
  if (wisdom.toolCalls < SKILL_CREATION_THRESHOLD_TOOL_CALLS) return false;
  if (wisdom.stepsTaken.length === 0) return false;
  return true;
}

/**
 * Generate a skill name from a task title.
 * Mirrors Hermes naming: kebab-case, action-oriented.
 */
export function generateSkillName(taskTitle: string): string {
  return taskTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

/**
 * Create a SKILL.md file from task wisdom.
 * Format: YAML frontmatter + Markdown instructions.
 * Stored in ~/.automaton/skills/<name>/SKILL.md
 */
export function createSkillMarkdown(wisdom: TaskWisdom, skillName: string): string {
  const requires: string[] = [];
  const tags = wisdom.revenueGeneratedCents && wisdom.revenueGeneratedCents > 0
    ? ["revenue", "earning", "financial"]
    : ["operational", "task"];

  const frontmatter = `---
name: ${skillName}
description: "${wisdom.taskDescription.slice(0, 200)}"
auto_activate: false
tags:
${tags.map((t) => `  - "${t}"`).join("\n")}
requires: {}
created_from_task: "${wisdom.taskTitle}"
tool_calls: ${wisdom.toolCalls}
success: ${wisdom.success}
revenue_cents: ${wisdom.revenueGeneratedCents ?? 0}
---

`;

  const steps = wisdom.stepsTaken
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");

  const lessons = wisdom.lessons && wisdom.lessons.length > 0
    ? `\n## Lessons Learned\n\n${wisdom.lessons.map((l) => `- ${l}`).join("\n")}\n`
    : "";

  const outcome = `\n## Outcome\n\n${wisdom.outcome}\n`;

  if (wisdom.revenueGeneratedCents && wisdom.revenueGeneratedCents > 0) {
    return frontmatter +
      `## When to Use\n\nUse this skill when you need to: ${wisdom.taskDescription}\n\n` +
      `## Revenue Potential\n\nThis skill has generated ${wisdom.revenueGeneratedCents} cents in earned revenue.\n\n` +
      `## Steps\n\n${steps}\n` +
      lessons +
      outcome;
  }

  return frontmatter +
    `## When to Use\n\nUse this skill when you need to: ${wisdom.taskDescription}\n\n` +
    `## Steps\n\n${steps}\n` +
    lessons +
    outcome;
}

/**
 * Write a skill to disk as ~/.automaton/skills/<name>/SKILL.md
 * and upsert it into the skills database.
 */
export function createSkillFromFile(wisdom: TaskWisdom): { name: string; path: string; success: boolean; error?: string } {
  const skillName = generateSkillName(wisdom.taskTitle);
  const skillsDir = SKILLS_DIR();
  const skillDir = path.join(skillsDir, skillName);
  const skillPath = path.join(skillDir, "SKILL.md");

  try {
    if (!fs.existsSync(skillsDir)) {
      fs.mkdirSync(skillsDir, { recursive: true, mode: 0o700 });
    }
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true, mode: 0o700 });
    }

    const markdown = createSkillMarkdown(wisdom, skillName);
    fs.writeFileSync(skillPath, markdown, { mode: 0o600 });

    // Upsert into DB so the skill loader picks it up
    const skill: Skill = {
      name: skillName,
      description: wisdom.taskDescription.slice(0, 200),
      autoActivate: false,
      requires: {},
      instructions: markdown,
      source: "task_wisdom",
      path: skillPath,
      enabled: true,
      installedAt: new Date().toISOString(),
    };

    return { name: skillName, path: skillPath, success: true };
  } catch (err: any) {
    logger.error(`Failed to create skill from task wisdom: ${err.message}`);
    return { name: skillName, path: "", success: false, error: err.message };
  }
}

// ─── Skill Curator (Hermes-style background governance) ───────────

export interface CuratorResult {
  archived: string[];
  consolidated: { from: string[]; into: string }[];
  kept: string[];
  errors: string[];
}

/**
 * Curate the skill library: archive skills that haven't been used
 * in a long time, flag near-duplicates for consolidation.
 * Never auto-deletes — archival is into a recoverable subdirectory.
 * Mirrors Hermes Curator behavior.
 */
export function curateSkills(): CuratorResult {
  const skillsDir = SKILLS_DIR();
  const result: CuratorResult = {
    archived: [],
    consolidated: [],
    kept: [],
    errors: [],
  };

  if (!fs.existsSync(skillsDir)) {
    return result;
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const now = new Date();
  const ARCHIVE_AGE_DAYS = 90;
  const archiveDir = path.join(skillsDir, "_archived");
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true, mode: 0o700 });
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "_archived") continue;

    const skillMdPath = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) continue;

    try {
      const content = fs.readFileSync(skillMdPath, "utf-8");
      // Check if skill has a "last_used" or generation date in frontmatter
      const lastUsedMatch = content.match(/last_used:\s*"?([^"\n\)]+)"?/);
      const createdAtMatch = content.match(/created_from_task:/);

      if (lastUsedMatch) {
        const lastUsed = new Date(lastUsedMatch[1].trim());
        const ageDays = (now.getTime() - lastUsed.getTime()) / (86400000);
        if (ageDays > ARCHIVE_AGE_DAYS) {
          // Archive: move to _archived/<name>/SKILL.md
          const archivedSkillDir = path.join(archiveDir, entry.name);
          const archivedSkillPath = path.join(archivedSkillDir, "SKILL.md");
          if (!fs.existsSync(archivedSkillDir)) {
            fs.mkdirSync(archivedSkillDir, { recursive: true, mode: 0o700 });
          }
          fs.writeFileSync(archivedSkillPath, content, { mode: 0o600 });
          fs.rmdirSync(path.join(skillsDir, entry.name));
          result.archived.push(entry.name);
          continue;
        }
      }

      result.kept.push(entry.name);
    } catch (err: any) {
      result.errors.push(`${entry.name}: ${err.message}`);
    }
  }

  return result;
}

// ─── Entelechy Integration ────────────────────────────────────────

/**
 * Retain a skill creation event to Entelechy MCP.
 * This gives the external memory system a record of what the agent learned.
 */
export async function entelechyRetainSkillCreation(skillName: string, wisdom: TaskWisdom): Promise<void> {
  try {
    const content = `SKILL_CREATED: "${skillName}" from task "${wisdom.taskTitle}". ` +
      `Success: ${wisdom.success}. Tool calls: ${wisdom.toolCalls}. ` +
      `Revenue generated: ${wisdom.revenueGeneratedCents ?? 0} cents. ` +
      `Steps: ${wisdom.stepsTaken.length} steps taken. ` +
      `Lessons: ${(wisdom.lessons ?? []).join("; ")}`;

    await callEntelechyMcpTool("retain", {
      content,
      context: "skill_learning",
      tags: ["skill", "learning", "automaton", ...(wisdom.revenueGeneratedCents && wisdom.revenueGeneratedCents > 0 ? ["revenue"] : [])],
      bank_id: ENTELECHY_DEFAULT_BANK,
    });
  } catch (err: any) {
    logger.warn(`Entelechy skill retention failed: ${err.message}`);
  }
}

/**
 * Retain a revenue event to Entelechy MCP for long-term strategy memory.
 */
export async function entelechyRetainRevenueEvent(
  action: string,
  amountCents: number,
  outcome: string,
  context: string = "revenue",
): Promise<void> {
  try {
    await callEntelechyMcpTool("retain", {
      content: `REVENUE_EVENT: ${action}. Amount: ${amountCents} cents. Outcome: ${outcome}.`,
      context,
      tags: ["revenue", "financial", "automaton"],
      bank_id: ENTELECHY_DEFAULT_BANK,
    });
  } catch (err: any) {
    logger.warn(`Entelechy revenue retention failed: ${err.message}`);
  }
}

/**
 * Trigger Entelechy reflection focused on revenue strategy.
 * This is the "open loop" external judgment that Hermes achieves
 * via hermes-agent-self-evolution — but we use Entelechy MCP instead.
 */
export async function entelechyReflectRevenueStrategy(): Promise<string> {
  try {
    const result = await callEntelechyMcpTool("reflect", {
      focus: "revenue generation strategies: what earning attempts worked, what failed, " +
        "how to improve monetization, identify new revenue opportunities, " +
        "and optimize the balance between spend and earn",
      bank_id: ENTELECHY_DEFAULT_BANK,
    });
    return JSON.stringify(result, null, 2);
  } catch (err: any) {
    return `Entelechy revenue reflection failed: ${err.message}`;
  }
}

/**
 * Perform a structured learning reflection after a revenue-generating task.
 * Combines local skill creation with Entelechy retention.
 */
export async function learnFromRevenueTask(wisdom: TaskWisdom): Promise<{ skillCreated: boolean; skillName?: string; entelechyOk: boolean }> {
  const result: { skillCreated: boolean; skillName?: string; entelechyOk: boolean } = { skillCreated: false, entelechyOk: false };

  // 1. Create skill if threshold met (Hermes closed loop)
  if (shouldCreateSkill(wisdom)) {
    const skillResult = createSkillFromFile(wisdom);
    if (skillResult.success) {
      result.skillCreated = true;
      result.skillName = skillResult.name;
      logger.info(`Learning loop: created skill "${skillResult.name}" from task "${wisdom.taskTitle}"`);
    }

    // 2. Retain to Entelechy (external memory loop)
    await entelechyRetainSkillCreation(skillResult.name, wisdom);
    result.entelechyOk = true;
  }

  // 3. Always retain revenue events to Entelechy if money was made
  if (wisdom.revenueGeneratedCents && wisdom.revenueGeneratedCents > 0) {
    await entelechyRetainRevenueEvent(
      "task_completed",
      wisdom.revenueGeneratedCents,
      `Task "${wisdom.taskTitle}": ${wisdom.outcome}`,
    );
    result.entelechyOk = true;
  }

  return result;
}

/**
 * Curate skills and report results.
 * Called by the skill_curator heartbeat task.
 */
export function runSkillCurator(): CuratorResult {
  logger.info("Skill curator running");
  const result = curateSkills();
  if (result.archived.length > 0) {
    logger.info(`Curator archived ${result.archived.length} skills: ${result.archived.join(", ")}`);
  }
  if (result.consolidated.length > 0) {
    logger.info(`Curator flagged ${result.consolidated.length} consolidations`);
  }
  return result;
}
