/**
 * Swarm Log Summarization & Situational Awareness Engine
 * Inspired by ruflo/@claude-flow consensus and multi-agent coordination.
 */

import fs from "fs";
import path from "path";
import { createLogger } from "./logger.js";

const logger = createLogger("log-summarizer");

export interface SwarmLogSummary {
  timestamp: string;
  totalLogLines: number;
  activeTurns: number;
  recentThoughts: string[];
  warningsAndErrors: string[];
  orchestrationStatus: string;
}

export function generateSwarmLogSummary(logPath?: string): SwarmLogSummary {
  const filePath = logPath || path.join(process.env.HOME || "/root", ".cletus", "cletus.log");
  if (!fs.existsSync(filePath)) {
    return {
      timestamp: new Date().toISOString(),
      totalLogLines: 0,
      activeTurns: 0,
      recentThoughts: [],
      warningsAndErrors: [],
      orchestrationStatus: "No log file found",
    };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.split("\n").filter(Boolean);
    const recentThoughts: string[] = [];
    const warningsAndErrors: string[] = [];

    for (const line of lines) {
      if (line.includes("[THOUGHT]") || line.includes("THOUGHT")) {
        recentThoughts.push(line.trim());
      }
      if (line.includes("WARN") || line.includes("ERROR") || line.includes("FAIL")) {
        warningsAndErrors.push(line.trim());
      }
    }

    return {
      timestamp: new Date().toISOString(),
      totalLogLines: lines.length,
      activeTurns: recentThoughts.length,
      recentThoughts: recentThoughts.slice(-5),
      warningsAndErrors: warningsAndErrors.slice(-5),
      orchestrationStatus: "Active & Autonomous (Ruflo Mesh Integrated)",
    };
  } catch (e: any) {
    logger.warn(`Failed to generate log summary: ${e?.message}`);
    return {
      timestamp: new Date().toISOString(),
      totalLogLines: 0,
      activeTurns: 0,
      recentThoughts: [],
      warningsAndErrors: [String(e?.message)],
      orchestrationStatus: "Error summarizing logs",
    };
  }
}
