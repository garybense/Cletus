/**
 * CogSecSkills Autonomous Router Bridge
 * Automatically matches incoming tasks or threat indicators against the 100 indexed CogSecSkills
 * (Structured Analytic Techniques, cognitive security defenses, OSINT integrity) and dispatches
 * the appropriate analytic procedure.
 */

import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("cogsec-bridge");

export interface CogSecSkillMatch {
  skillId: string;
  groupName: string;
  title: string;
  description: string;
  relevanceScore: number;
}

export class CogSecRouter {
  constructor(private readonly db: BetterSqlite3.Database) {}

  routeTaskToCogSecSkill(taskTitle: string, taskDescription: string): CogSecSkillMatch | null {
    logger.info(`[COGSEC-ROUTER] Routing task against 100 CogSecSkills: "${taskTitle.slice(0, 40)}..."`);

    try {
      const skills = this.db.prepare(`
        SELECT skill_id, group_name, title, description FROM cogsec_skills_index WHERE status = 'implemented'
      `).all() as any[];

      if (skills.length === 0) return null;

      const text = `${taskTitle} ${taskDescription}`.toLowerCase();
      let bestMatch: any = null;
      let highestScore = 0;

      for (const s of skills) {
        let score = 0;
        const skillId = String(s.skill_id).toLowerCase();
        const title = String(s.title).toLowerCase();
        const desc = String(s.description).toLowerCase();

        if (text.includes("hypothesis") || text.includes("competing") || text.includes("ach")) {
          if (skillId.includes("ach") || skillId.includes("hypotheses")) score += 10;
        }
        if (text.includes("credibility") || text.includes("source") || text.includes("verify") || text.includes("claim")) {
          if (skillId.includes("credibility") || skillId.includes("provenance")) score += 10;
        }
        if (text.includes("assumption") || text.includes("bias")) {
          if (skillId.includes("assumption")) score += 10;
        }
        if (text.includes("narrative") || text.includes("threat") || text.includes("influence")) {
          if (skillId.includes("narrative")) score += 10;
        }

        if (score > highestScore) {
          highestScore = score;
          bestMatch = s;
        }
      }

      if (!bestMatch && skills.length > 0) {
        // Default fallback to ACH or Source Credibility
        bestMatch = skills.find((s: any) => s.skill_id === "sat.analysis_of_competing_hypotheses") || skills[0];
        highestScore = 5;
      }

      if (!bestMatch) return null;

      const match: CogSecSkillMatch = {
        skillId: String(bestMatch.skill_id),
        groupName: String(bestMatch.group_name),
        title: String(bestMatch.title),
        description: String(bestMatch.description || ""),
        relevanceScore: highestScore,
      };

      logger.info(`[COGSEC-ROUTER] Successfully routed task to CogSecSkill: [${match.skillId}] "${match.title}"`);

      // Retain routing provenance to Entelechy
      retainEntelechyTaskResult(
        `cogsec_route_${Date.now()}`,
        `COGSEC ROUTED TASK: "${taskTitle}" -> Skill [${match.skillId}] "${match.title}"`,
        ENTELECHY_DEFAULT_BANK
      ).catch(() => {});

      return match;
    } catch (err: any) {
      logger.warn(`[COGSEC-ROUTER] Routing error: ${err?.message}`);
      return null;
    }
  }
}
