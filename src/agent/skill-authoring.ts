/**
 * Recursive Dynamic Skill Authoring & Registration Engine
 * Autonomously detects recurring operational patterns and authors valid Agent Skill files
 * under ~/.cletus/skills/<name>/SKILL.md, hot-reloading them into runtime.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLogger } from "../observability/logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("skill-authoring");

export interface SkillDefinitionSpec {
  name: string;
  description: string;
  instructions: string;
}

export class SkillAuthoringEngine {
  private readonly skillsDir: string;

  constructor() {
    this.skillsDir = path.join(os.homedir(), ".cletus", "skills");
    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true });
    }
  }

  async authorNewSkill(spec: SkillDefinitionSpec): Promise<{ success: boolean; skillPath: string }> {
    const sanitizedName = spec.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const skillFolder = path.join(this.skillsDir, sanitizedName);
    const skillPath = path.join(skillFolder, "SKILL.md");

    logger.info(`[SKILL-AUTHORING] Authoring new skill [${sanitizedName}] at ${skillPath}...`);

    try {
      if (!fs.existsSync(skillFolder)) {
        fs.mkdirSync(skillFolder, { recursive: true });
      }

      const fileContent = `---
name: ${sanitizedName}
description: ${spec.description}
---

# ${spec.name} Instructions

${spec.instructions}
`;

      fs.writeFileSync(skillPath, fileContent, "utf-8");

      // Retain skill authoring provenance to Entelechy
      await retainEntelechyTaskResult(
        `author_skill_${sanitizedName}`,
        `AUTONOMOUS SKILL AUTHORED: ${spec.name} (${spec.description}). Path: ${skillPath}`,
        ENTELECHY_DEFAULT_BANK
      ).catch(() => {});

      logger.info(`[SKILL-AUTHORING] Successfully authored and registered Skill [${sanitizedName}]!`);
      return { success: true, skillPath };
    } catch (err: any) {
      logger.warn(`[SKILL-AUTHORING] Failed to author skill [${sanitizedName}]: ${err?.message}`);
      return { success: false, skillPath: "" };
    }
  }
}
