/**
 * Colony Status Tool — Agent-facing tools for monitoring the child colony
 *
 * Provides the agent with:
 * - check_colony_status: full colony health summary
 * - get_child_punishments: recent punishments applied to children
 * - get_child_details: detailed health report for a specific child
 */

import type { CletusDatabase, ChildCletus } from "./types.js";
import { ChildMonitor } from "./child-monitor.js";
import { ChildPunisher, type PunishmentApplied } from "./child-punisher.js";
import type { CletusTool } from "./types.js";
import type { ToolContext } from "./types.js";

// ─── check_colony_status ─────────────────────────────────────────────────────

export const checkColonyStatusTool: CletusTool = {
  name: "check_colony_status",
  description:
    "Get a full health summary of all child agents in the colony. " +
    "Shows healthy/idle/error/stalled/unreachable/dead counts, " +
    "total tasks completed/failed, and recent colony activity. " +
    "Call this to monitor your children's productivity and detect problems.",
  category: "replication",
  riskLevel: "safe",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async (_args: Record<string, unknown>, ctx: ToolContext) => {
    const monitor = new ChildMonitor(ctx.db);
    const punisher = new ChildPunisher(ctx.db);
    const reports = await monitor.checkAll();
    const summary = monitor.getSummary();

    // Apply punishments
    const children = ctx.db.getChildren().filter(
      (c: ChildCletus) => c.status !== "cleaned_up",
    );
    const punishmentResult = await punisher.punishAll(reports, children);

    const reportLines = reports
      .map(
        (r) =>
          `  ${r.name} [${r.status}]${r.issues.length > 0 ? " • " + r.issues.join("; ") : ""}`,
      )
      .join("\n");

    const punishmentLines = [];
    if (punishmentResult.punished > 0) {
      punishmentLines.push(`  Punishments this tick: ${punishmentResult.punished}`);
      if (punishmentResult.warnings > 0)
        punishmentLines.push(`    - ${punishmentResult.warnings} warnings`);
      if (punishmentResult.fundCuts > 0)
        punishmentLines.push(`    - ${punishmentResult.fundCuts} fund cuts`);
      if (punishmentResult.restarts > 0)
        punishmentLines.push(`    - ${punishmentResult.restarts} restarts`);
      if (punishmentResult.stops > 0)
        punishmentLines.push(`    - ${punishmentResult.stops} stops`);
      if (punishmentResult.kills > 0)
        punishmentLines.push(`    - ${punishmentResult.kills} kills`);
    }

    return `COLONY STATUS (${new Date().toISOString()}):\n` +
      `  Total children: ${summary.total}\n` +
      `  Healthy: ${summary.healthy} | Running: ${summary.running} | Unhealthy: ${summary.unhealthy}\n` +
      `  Dead: ${summary.dead} | Failed: ${summary.failed} | Stopped: ${summary.stopped} | Spawning: ${summary.spawning}\n` +
      `  Tasks: ${summary.totalTasksCompleted} completed, ${summary.totalTasksFailed} failed\n` +
      (punishmentLines.length > 0 ? `\n` + punishmentLines.join("\n") + `\n` : "") +
      `\nCHILD DETAILS:\n${reportLines}`;
  },
};

// ─── get_child_punishments ───────────────────────────────────────────────────

export const getChildPunishmentsTool: CletusTool = {
  name: "get_child_punishments",
  description:
    "Get recent punishments applied to children in the colony. " +
    "Shows who was punished, for what, when, and at what level " +
    "(warn/fund_cut/restart/stop/kill).",
  category: "replication",
  riskLevel: "safe",
  parameters: {
    type: "object",
    properties: {
      child_id: {
        type: "string",
        description: "Optional: only show punishments for this child ID",
      },
    },
    required: [],
  },
  execute: async (args: Record<string, unknown>, ctx: ToolContext) => {
    const punisher = new ChildPunisher(ctx.db);
    const allHistory = punisher.getHistory(""); // not implemented per-child yet

    // For now, return recently applied punishments from the pending map
    const pending = punisher.getPendingPunishments();
    const childIdFilter = (args.child_id as string) || "";

    const entries: PunishmentApplied[] = [];
    for (const [id, p] of pending) {
      if (!childIdFilter || id === childIdFilter || p.childId === childIdFilter) {
        entries.push(p);
      }
    }

    if (entries.length === 0) {
      return childIdFilter
        ? `No pending punishments for child ${childIdFilter}`
        : "No pending punishments in the colony.";
    }

    return `RECENT PUNISHMENTS (${entries.length}):\n` +
      entries
        .map(
          (p) =>
            `  ${p.childName} [${p.childId.slice(0, 8)}] — ${p.level} — ${p.violation}: ${p.details} (${new Date(p.timestamp).toISOString()})`,
        )
        .join("\n");
  },
};

// ─── get_child_details ───────────────────────────────────────────────────────

export const getChildDetailsTool: CletusTool = {
  name: "get_child_details",
  description:
    "Get detailed health report for a specific child agent. " +
    "Shows idle time, task counts, error count, last activity time, " +
    "credit balance, and all issues detected by the monitor.",
  category: "replication",
  riskLevel: "safe",
  parameters: {
    type: "object",
    properties: {
      child_id: {
        type: "string",
        description: "Child ID to get details for",
      },
    },
    required: ["child_id"],
  },
  execute: async (args: Record<string, unknown>, ctx: ToolContext) => {
    const childId = args.child_id as string;
    if (!childId) {
      return "Error: child_id is required.";
    }

    const child = ctx.db.getChildById(childId);
    if (!child) {
      return `Child not found: ${childId}`;
    }

    const monitor = new ChildMonitor(ctx.db);
    const report = await monitor.checkChild(child);

    const balCents =
      report.metrics.creditBalanceCents != null
        ? report.metrics.creditBalanceCents
        : child.fundedAmountCents;

    return `CHILD DETAILS: ${child.name} (${childId.slice(0, 8)})\n` +
      `  Status: ${report.status}\n` +
      `  Issues: ${report.issues.length > 0 ? report.issues.join("; ") : "none"}\n` +
      `  Idle: ${report.metrics.idleSeconds}s\n` +
      `  Tasks: ${report.metrics.tasksCompleted} completed, ${report.metrics.tasksFailed} failed, ${report.metrics.tasksRunning} running\n` +
      `  Errors: ${report.metrics.consecutiveErrors} consecutive\n` +
      `  Credit balance: ${(balCents / 100).toFixed(2)}¢\n` +
      `  Last activity: ${report.metrics.lastActivity || "never"}\n` +
      `  Last message: ${report.metrics.lastMessageTime || "never"}`;
  },
};
