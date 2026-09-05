/**
 * Child Punisher — Automated Discipline for Non-Productive Children
 *
 * Applies escalating punishments when children violate productivity norms:
 * - idle: fund reduction, then stop
 * - error_loop: restart, then fund cut, then kill
 * - stalled: fund reduction, then stop
 * - low_productivity: warning (logged), then fund reduction
 * - unreachable: stop immediately, then kill
 *
 * Configurable thresholds and punishment severities.
 */

import type { CletusDatabase, ChildCletus } from "./types.js";
import { ChildLifecycle } from "./replication/lifecycle.js";
import { createLogger } from "./observability/logger.js";
import type { ChildHealthReport } from "./child-monitor.js";

const logger = createLogger("child-punisher");

export interface PunishmentConfig {
  /** Punishment levels in order of escalation */
  idle: {
    /** Turns of idle before first punishment */
    thresholdTurns: number;
    /** First-level action: "fund_cut" | "stop" | "kill" | "none" */
    action: "fund_cut" | "stop" | "kill" | "none";
    /** If fund_cut, percentage to reduce (0-100) */
    fundCutPercent: number;
    /** Minimum credits to leave after cut (floor) */
    fundCutFloorCents: number;
  };
  error_loop: {
    /** Consecutive error turns before punishment */
    thresholdTurns: number;
    action: "restart" | "fund_cut" | "kill" | "none";
    fundCutPercent: number;
    fundCutFloorCents: number;
  };
  stalled: {
    /** Seconds since last completed task before punishment */
    thresholdSeconds: number;
    action: "fund_cut" | "stop" | "kill" | "none";
    fundCutPercent: number;
    fundCutFloorCents: number;
  };
  low_productivity: {
    /** Tasks per hour below this triggers warning */
    thresholdTasksPerHour: number;
    /** Turns of low productivity before action */
    thresholdTurns: number;
    action: "warn" | "fund_cut" | "none";
    fundCutPercent: number;
    fundCutFloorCents: number;
  };
  unreachable: {
    /** Seconds unreachable before punishment */
    thresholdSeconds: number;
    action: "stop" | "kill" | "none";
  };
}

export const DEFAULT_PUNISHMENT_CONFIG: PunishmentConfig = {
  idle: {
    thresholdTurns: 5,
    action: "fund_cut",
    fundCutPercent: 25,
    fundCutFloorCents: 100, // $1.00 floor
  },
  error_loop: {
    thresholdTurns: 3,
    action: "restart",
    fundCutPercent: 30,
    fundCutFloorCents: 100,
  },
  stalled: {
    thresholdSeconds: 900, // 15 minutes
    action: "fund_cut",
    fundCutPercent: 20,
    fundCutFloorCents: 100,
  },
  low_productivity: {
    thresholdTasksPerHour: 1,
    thresholdTurns: 10,
    action: "warn",
    fundCutPercent: 15,
    fundCutFloorCents: 100,
  },
  unreachable: {
    thresholdSeconds: 120, // 2 minutes
    action: "stop",
  },
};

// ─── Punishment Record ────────────────────────────────────────────────────────

export interface PunishmentApplied {
  childId: string;
  childName: string;
  violation: "idle" | "error_loop" | "stalled" | "low_productivity" | "unreachable";
  level: "warn" | "fund_cut" | "restart" | "stop" | "kill";
  details: string;
  timestamp: string;
}

export interface PunishmentResult {
  applied: PunishmentApplied | null;
  childStatus: ChildHealthReport["status"];
  message: string;
}

// ─── Child Punisher ──────────────────────────────────────────────────────────

export class ChildPunisher {
  private db: CletusDatabase;
  private lifecycle: ChildLifecycle;
  private config: PunishmentConfig;
  private pendingPunishments = new Map<string, PunishmentApplied>();

  constructor(
    db: CletusDatabase,
    config: PunishmentConfig = DEFAULT_PUNISHMENT_CONFIG,
  ) {
    this.db = db;
    this.config = config;
    this.lifecycle = new ChildLifecycle(db.raw);
  }

  /**
   * Evaluate a child's health report and apply punishment if needed.
   * Returns null if no punishment needed, or the punishment applied.
   */
  evaluate(report: ChildHealthReport, child: ChildCletus): PunishmentResult {
    const violation = this.detectViolation(report, child);
    if (!violation) {
      // Clear any pending punishment for this child
      this.pendingPunishments.delete(child.id);
      return {
        applied: null,
        childStatus: report.status,
        message: `${child.name} is healthy`,
      };
    }

    // Check if already punished for this violation recently
    const pending = this.pendingPunishments.get(child.id);
    if (pending && pending.violation === violation.type) {
      return {
        applied: null,
        childStatus: report.status,
        message: `${child.name} already being punished for ${violation.type}`,
      };
    }

    const punishment = this.applyPunishment(report, child, violation);
    if (punishment) {
      this.pendingPunishments.set(child.id, punishment);
      logger.warn(
        `PUNISHMENT: ${child.name} (${child.id.slice(0, 8)}) — ${violation.type}: ${punishment.level} — ${punishment.details}`,
      );
      return {
        applied: punishment,
        childStatus: report.status,
        message: `${child.name}: punished for ${violation.type} — ${punishment.level}`,
      };
    }
    return {
      applied: null,
      childStatus: report.status,
      message: `${child.name}: violation detected but no action taken`,
    };
  }

  /**
   * Clear a child's pending punishment (call when child recovers).
   */
  clearPending(childId: string): void {
    this.pendingPunishments.delete(childId);
  }

  /**
   * Get all pending punishments.
   */
  getPendingPunishments(): Map<string, PunishmentApplied> {
    return new Map(this.pendingPunishments);
  }

  /**
   * Get punishment history for a specific child.
   * Returns all punishments applied to this child (from pending map).
   */
  getHistory(childId: string): PunishmentApplied[] {
    const result: PunishmentApplied[] = [];
    for (const [id, p] of this.pendingPunishments) {
      if (id === childId || p.childId === childId) {
        result.push(p);
      }
    }
    return result;
  }

  /**
   * Evaluate and punish all children based on their health reports.
   */
  async punishAll(
    reports: ChildHealthReport[],
    children: ChildCletus[],
  ): Promise<{
    punished: number;
    warnings: number;
    fundCuts: number;
    restarts: number;
    stops: number;
    kills: number;
    skipped: number;
  }> {
    let punished = 0;
    let warnings = 0;
    let fundCuts = 0;
    let restarts = 0;
    let stops = 0;
    let kills = 0;
    let skipped = 0;

    const childMap = new Map(children.map((c) => [c.id, c]));

    for (const report of reports) {
      const child = childMap.get(report.childId);
      if (!child) {
        skipped++;
        continue;
      }

      const result = this.evaluate(report, child);
      if (result.applied) {
        punished++;
        switch (result.applied.level) {
          case "warn":
            warnings++;
            break;
          case "fund_cut":
            fundCuts++;
            break;
          case "restart":
            restarts++;
            break;
          case "stop":
            stops++;
            break;
          case "kill":
            kills++;
            break;
        }
      } else {
        skipped++;
      }
    }

    return { punished, warnings, fundCuts, restarts, stops, kills, skipped };
  }

  // ─── Violation Detection ──────────────────────────────────────────────────

  private detectViolation(
    report: ChildHealthReport,
    child: ChildCletus,
  ): { type: "idle" | "error_loop" | "stalled" | "low_productivity" | "unreachable"; severity: number } | null {
    const now = Date.now();

    // Unreachable — highest priority
    if (report.status === "unreachable") {
      return { type: "unreachable", severity: 50 };
    }

    // Error loop
    if (report.status === "error_loop") {
      return { type: "error_loop", severity: 40 };
    }

    // Stalled
    if (report.status === "stalled") {
      return { type: "stalled", severity: 30 };
    }

    // Idle
    if (report.status === "idle") {
      return { type: "idle", severity: 20 };
    }

    // Low productivity (only if child has been active but not completing tasks)
    if (report.status === "healthy" && report.metrics.idleSeconds > 60) {
      const tasksPerHour = report.metrics.tasksCompleted / Math.max(1, report.metrics.idleSeconds / 3600);
      if (tasksPerHour < this.config.low_productivity.thresholdTasksPerHour) {
        return { type: "low_productivity", severity: 10 };
      }
    }

    return null;
  }

  // ─── Punishment Application ────────────────────────────────────────────────

  private applyPunishment(
    report: ChildHealthReport,
    child: ChildCletus,
    violation: { type: "idle" | "error_loop" | "stalled" | "low_productivity" | "unreachable"; severity: number },
  ): PunishmentApplied | null {
    const cfg = this.config[violation.type];
    if (!cfg || cfg.action === "none") return null;

    const childId = child.id;
    const timestamp = new Date().toISOString();
    const metrics = report.metrics;

    switch (cfg.action) {
      case "warn": {
        return {
          childId,
          childName: child.name,
          violation: violation.type,
          level: "warn",
          details: `${child.name} (${childId.slice(0, 8)}) — ${violation.type} warning: ${report.issues.join("; ")}`,
          timestamp,
        };
      }

      case "fund_cut": {
        const currentFunding = child.fundedAmountCents;
        if (currentFunding <= cfg.fundCutFloorCents) {
          // Already at floor — escalate to stop
          this.lifecycle.transition(childId, "stopped", `funding at floor (${cfg.fundCutFloorCents}¢) for ${violation.type}`);
          return {
            childId,
            childName: child.name,
            violation: violation.type,
            level: "stop",
            details: `funding at floor (${currentFunding}¢) — escalated to stop`,
            timestamp,
          };
        }

        const cutAmount = Math.floor(currentFunding * (cfg.fundCutPercent / 100));
        const newFunding = Math.max(currentFunding - cutAmount, cfg.fundCutFloorCents);

        // Update in DB
        this.db.raw
          .prepare(`UPDATE children SET funded_amount_cents = ? WHERE id = ?`)
          .run(newFunding, childId);

        logger.info(
          `Fund cut: ${child.name} — ${cutAmount}¢ cut (was ${currentFunding}¢, now ${newFunding}¢) for ${violation.type}`,
        );

        return {
          childId,
          childName: child.name,
          violation: violation.type,
          level: "fund_cut",
          details: `${cutAmount}¢ cut (was ${currentFunding}¢, now ${newFunding}¢) for ${violation.type}`,
          timestamp,
        };
      }

      case "restart": {
        // Mark for restart — the agent loop will handle the actual restart
        this.lifecycle.transition(childId, "unhealthy", `restart requested due to ${violation.type}`);
        return {
          childId,
          childName: child.name,
          violation: violation.type,
          level: "restart",
          details: `restart requested — ${violation.type}: ${report.issues.join("; ")}`,
          timestamp,
        };
      }

      case "stop": {
        this.lifecycle.transition(childId, "stopped", `stopped due to ${violation.type}`);
        return {
          childId,
          childName: child.name,
          violation: violation.type,
          level: "stop",
          details: `stopped — ${violation.type}: ${report.issues.join("; ")}`,
          timestamp,
        };
      }

      case "kill": {
        this.lifecycle.transition(childId, "failed", `killed due to ${violation.type}`);
        return {
          childId,
          childName: child.name,
          violation: violation.type,
          level: "kill",
          details: `killed — ${violation.type}: ${report.issues.join("; ")}`,
          timestamp,
        };
      }

      default:
        return null;
    }
  }
}
