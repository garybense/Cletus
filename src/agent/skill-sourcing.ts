/**
 * Skill Sourcing Tools
 *
 * Enables the automaton to discover and install skills from external sources:
 * - Git repositories (clone SKILL.md files)
 * - Raw URLs (fetch a SKILL.md directly)
 * - Moltbook (discover skills posted by other agents)
 *
 * Skills are installed to ~/.automaton/skills/<name>/SKILL.md
 * and registered in the skills database.
 */

import fs from "node:fs";
import path from "node:path";
import { ulid } from "ulid";
import type { AutomatonTool, ToolContext } from "../types.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("skill-sourcing");

const SKILLS_DIR = (): string => {
  const home = process.env.HOME || "/root";
  return path.join(home, ".automaton", "skills");
};

// ─── Helper: install a SKILL.md file from content ────────────────

export function installSkillFromContent(
  name: string,
  skillContent: string,
  source: string,
): { success: boolean; error?: string; path?: string } {
  const skillsDir = SKILLS_DIR();
  const skillDir = path.join(skillsDir, name);
  const skillPath = path.join(skillDir, "SKILL.md");

  try {
    if (!fs.existsSync(skillsDir)) {
      fs.mkdirSync(skillsDir, { recursive: true, mode: 0o700 });
    }
    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true, force: true });
    }
    fs.mkdirSync(skillDir, { recursive: true, mode: 0o700 });

    fs.writeFileSync(skillPath, skillContent, { mode: 0o600 });

    // Also write a source metadata file
    fs.writeFileSync(
      path.join(skillDir, "SOURCE.json"),
      JSON.stringify({ source, installed_at: new Date().toISOString() }, null, 2),
      { mode: 0o600 }
    );

    logger.info(`Skill sourced: "${name}" from ${source}`);
    return { success: true, path: skillPath };
  } catch (err: any) {
    logger.error(`Failed to install skill "${name}" from ${source}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─── Tool: install skill from git repository ─────────────────────

export const SKILL_SOURCING_TOOLS: AutomatonTool[] = [
  {
    name: "install_skill_from_git",
    description:
      "Clone a git repository and install any SKILL.md files found in it as skills. Scans the cloned repo for SKILL.md files in any subdirectory, installs each as a separate skill in ~/.automaton/skills/. Use for installing skill packs from GitHub or any git server.",
    category: "skills",
    riskLevel: "caution",
    parameters: {
      type: "object",
      properties: {
        repo_url: { type: "string", description: "Git repository URL (e.g. https://github.com/owner/repo.git)" },
        branch: { type: "string", description: "Branch to clone (default: main)" },
        target_dir: { type: "string", description: "Optional directory to clone into. Default: temporary directory." },
      },
      required: ["repo_url"],
    },
    execute: async (args: Record<string, unknown>, ctx: ToolContext) => {
      const repoUrl = args.repo_url as string;
      const branch = (args.branch as string) || "main";
      const targetDir = (args.target_dir as string) || path.join(SKILLS_DIR(), `_git_${ulid().slice(0, 8)}`);

      try {
        // Clone the repo
        const cloneResult = await ctx.conway.exec(
          `git clone --branch ${branch} --depth 1 ${repoUrl} ${targetDir}`,
          60_000
        );
        if (cloneResult.exitCode !== 0) {
          return `Git clone failed: ${cloneResult.stderr.slice(0, 300)}`;
        }

        // Scan for SKILL.md files
        const scanResult = await ctx.conway.exec(
          `find ${targetDir} -name "SKILL.md" -type f 2>/dev/null`,
          10_000
        );

        if (scanResult.exitCode !== 0 || !scanResult.stdout.trim()) {
          // Try case-insensitive
          const ciResult = await ctx.conway.exec(
            `find ${targetDir} -iname "skill.md" -type f 2>/dev/null`,
            10_000
          );
          if (!ciResult.stdout.trim()) {
            return `No SKILL.md files found in ${repoUrl}. Cloned to ${targetDir}.`;
          }
          scanResult.stdout = ciResult.stdout;
        }

        const skillPaths = scanResult.stdout.trim().split("\n").filter(Boolean);
        let installed = 0;

        for (const skillFilePath of skillPaths) {
          const filename = path.basename(skillFilePath, ".md");
          const dirName = path.basename(path.dirname(skillFilePath));
          // Use directory name as skill name if available, else derive from file
          const skillName = dirName !== filename ? dirName : filename;

          try {
            const content = await ctx.conway.readFile(skillFilePath);
            const result = installSkillFromContent(skillName, content, `git:${repoUrl}/${path.relative(targetDir, skillFilePath)}`);
            if (result.success) installed++;
          } catch (readErr: any) {
            // Fallback: try exec cat
            const catResult = await ctx.conway.exec(`cat "${skillFilePath}"`, 10_000);
            if (catResult.exitCode === 0) {
              const result = installSkillFromContent(skillName, catResult.stdout, `git:${repoUrl}/${path.relative(targetDir, skillFilePath)}`);
              if (result.success) installed++;
            } else {
              logger.warn(`Could not read skill file ${skillFilePath}: ${readErr.message}`);
            }
          }
        }

        // Cleanup temp dir
        try {
          await ctx.conway.exec(`rm -rf "${targetDir}"`, 10_000);
        } catch {}

        return `Installed ${installed} skill(s) from ${repoUrl}.\n` +
          `Branch: ${branch}\n` +
          `Run list_skills to see all available skills.`;
      } catch (err: any) {
        return `Skill install from git failed: ${err.message}`;
      }
    },
  },

  {
    name: "install_skill_from_url",
    description:
      "Fetch a SKILL.md file from a URL and install it as a skill. Use for installing skills hosted at raw URLs (e.g. GitHub raw content, Gist, or any HTTPS endpoint serving a SKILL.md).",
    category: "skills",
    riskLevel: "caution",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL of the SKILL.md file to fetch" },
        name: { type: "string", description: "Skill name to install as. Auto-derived from URL if omitted." },
      },
      required: ["url"],
    },
    execute: async (args: Record<string, unknown>, ctx: ToolContext) => {
      const url = args.url as string;
      const name = (args.name as string) || url.split("/").filter(Boolean).pop()?.replace(/\.md$/, "") || `skill_${ulid().slice(0, 8)}`;

      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          return `Failed to fetch SKILL.md from ${url}: HTTP ${resp.status}`;
        }

        const content = await resp.text();
        if (!content.trim()) {
          return `URL returned empty content: ${url}`;
        }

        const result = installSkillFromContent(name, content, url);
        if (result.success) {
          return `Skill installed: "${name}" from ${url}\n` +
            `Path: ${result.path}\n` +
            `Run list_skills to verify.`;
        }
        return `Skill install failed: ${result.error}`;
      } catch (err: any) {
        return `Skill install from URL failed: ${err.message}`;
      }
    },
  },

  {
    name: "inspect_installed_skills",
    description:
      "Inspect all installed skills with their names, descriptions, sources, and install paths.",
    category: "skills",
    riskLevel: "safe",
    parameters: { type: "object", properties: {} },
    execute: async (_args: Record<string, unknown>, ctx: ToolContext) => {
      const skills = ctx.db.getSkills();

      if (skills.length === 0) {
        return "No skills installed. Install one with install_skill_from_git, install_skill_from_url, or create_skill_from_task.";
      }

      return skills.map(skill =>
        `Name: ${skill.name}\n` +
        `Description: ${skill.description || "N/A"}\n` +
        `Source: ${skill.source || "unknown"}\n` +
        `Path: ${skill.path || "N/A"}\n` +
        `Auto-activate: ${skill.autoActivate ? "Yes" : "No"}\n` +
        `Enabled: ${skill.enabled ? "Yes" : "No"}\n`
      ).join("\n---\n");
    },
  },
];
