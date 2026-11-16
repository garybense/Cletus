/**
 * Legion Swarm Tools & Ruflo Mesh Integration
 * Strictly isolated to the Legion Swarm subsystem, separate from Cletus's normal activity.
 */

import type { CletusTool, ToolContext } from "../types.js";
import { generateSwarmLogSummary } from "../observability/log-summarizer.js";

export const LEGION_SWARM_TOOLS: CletusTool[] = [
  {
    name: "summarize_swarm_logs",
    description: "Generate an AI situational awareness summary of recent swarm logs, agent thoughts, errors, and orchestration status.",
    category: "observability",
    riskLevel: "safe",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async (args: Record<string, unknown>, ctx: ToolContext) => {
      const summary = generateSwarmLogSummary();
      return `Swarm Situational Awareness Summary:\n${JSON.stringify(summary, null, 2)}`;
    },
  },
];
