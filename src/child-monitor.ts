/**
 * Child Monitor — Colony Health & Behavior Surveillance
 *
 * Watches all child cletus agents for:
 * - Liveness (process alive, responding)
 * - Productivity (tasks completed vs. idle time)
 * - Resource usage (credits consumed vs. work delivered)
 * - Behavioral violations (error loops, idle loops, policy breaches)
 *
 * Produces structured health reports consumed by the orchestrator and
 * the heartbeat task system. Punishments are applied by child-punisher.ts.
 */

import type { CletusDatabase, ChildCletus, ChildStatus } from "./types.js";
import { ChildLifecycle } from "./replication/lifecycle.js";
import { createLogger, getGlobalLogLevel } from "./observability/logger.js";
import { getMetrics } from "./observability/metrics.js";
import type { MetricsCollector } from "./observability/metrics.js";

const logger = createLogger("child-monitor");

// ─── Configurable Thresholds ───────────────────────────────────────────────────

export interface ChildMonitorConfig {
  /** Seconds of no activity before flagging a child as idle */
  idleThresholdSeconds: number;
  /** Consecutive error turns before flagging error loop */
  errorLoopThreshold: number;
  /** Max seconds a child can be unresponsive before considered dead */
  livenessTimeoutSeconds: number;
  /** Min tasks completed per hour to be considered productive */
  minProductivityPerHour: number;
  /** If a child has 0 tasks completed in this many seconds, flag as stalled */
  stalledThresholdSeconds: number;
  /** Enable automatic punishment application */
  autoPunish: boolean;
}

export const DEFAULT_MONITOR_CONFIG: ChildMonitorConfig = {
  idleThresholdSeconds: 300, // 5 minutes
  errorLoopThreshold: 3,
  livenessTimeoutSeconds: 120, // 2 minutes
  minProductivityPerHour: 1,
  stalledThresholdSeconds: 900, // 15 minutes
  autoPunish: true,
};

// ─── Health Report ─────────────────────────────────────────────────────────────

export interface ChildHealthReport {
  childId: string;
  name: string;
  // Monitor-level status (richer than DB ChildStatus)
  status: "healthy" | "idle" | "error_loop" | "stalled" | "dead" | "unreachable";
  issues: string[];
  metrics: ChildMetrics;
  timestamp: string;
}

export interface ChildMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  tasksRunning: number;
  lastActivity: string | null;
  idleSeconds: number;
  errorCount: number;
  consecutiveErrors: number;
  creditBalanceCents: number | null;
  lastMessageTime: string | null;
  messagesSent: number;
  messagesReceived: number;
}

// ─── Child Monitor ─────────────────────────────────────────────────────────────

export class ChildMonitor {
  private db: CletusDatabase;
  private lifecycle: ChildLifecycle;
  private config: ChildMonitorConfig;
  private metrics: MetricsCollector;

  // Track consecutive error counts per child (in-memory, reset on healthy)
  private errorCounts = new Map<string, number>();
  // Track last activity per child
  private lastActivity = new Map<string, number>();

  constructor(db: CletusDatabase, config: ChildMonitorConfig = DEFAULT_MONITOR_CONFIG) {
    this.db = db;
    this.config = config;
    this.lifecycle = new ChildLifecycle(db.raw);
    this.metrics = getMetrics();
  }

  /**
   * Update the in-memory activity tracker. Call this from the main loop
   * whenever a child sends a message or completes a task.
   */
  recordActivity(childId: string): void {
    this.lastActivity.set(childId, Date.now());
    // Reset error count on activity (activity = not erroring)
    this.errorCounts.delete(childId);
  }

  /**
   * Record an error for a child. Increments consecutive error counter.
   */
  recordError(childId: string): void {
    const current = this.errorCounts.get(childId) ?? 0;
    this.errorCounts.set(childId, current + 1);
  }

  /**
   * Reset error count when child recovers.
   */
  recordRecovery(childId: string): void {
    this.errorCounts.delete(childId);
    this.recordActivity(childId);
  }

  /**
   * Check health of a single child agent.
   */
  async checkChild(child: ChildCletus): Promise<ChildHealthReport> {
    const issues: string[] = [];
    const now = Date.now();
    const childId = child.id;

    // Determine last activity time
    const lastActivityMs = this.lastActivity.get(childId) ?? 0;
    const idleSeconds = Math.floor((now - lastActivityMs) / 1000);

    // Task counts from DB
    const taskCounts = this.db.raw
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completed,
           COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed,
           COALESCE(SUM(CASE WHEN status IN ('assigned','running') THEN 1 ELSE 0 END), 0) as running
         FROM task_graph WHERE assigned_to = ?`,
      )
      .get(child.address) as { completed: number; failed: number; running: number } | undefined;

    const dbCompleted = taskCounts?.completed ?? 0;
    const dbFailed = taskCounts?.failed ?? 0;
    const childCompleted = (child as unknown as { tasksCompleted?: number }).tasksCompleted ?? 0;
    const childFailed = (child as unknown as { tasksFailed?: number }).tasksFailed ?? 0;
    const tasksCompleted = dbCompleted + childCompleted;
    const tasksFailed = dbFailed + childFailed;
    const tasksRunning = taskCounts?.running ?? 0;

    // Consecutive errors
    const consecutiveErrors = this.errorCounts.get(childId) ?? 0;

    // Last message time
    const lastMsgRow = this.db.raw
      .prepare(
        `SELECT MAX(created_at) as last_msg FROM messages WHERE sender = ? OR recipient = ?`,
      )
      .get(child.address, child.address) as { last_msg: string | null } | undefined;
    const lastMessageTime = lastMsgRow?.last_msg ?? null;

    // Credit balance (for OpenClaw children, fetch via SSH)
    let creditBalanceCents: number | null = child.fundedAmountCents;
    if (child.sandboxId.startsWith("openclaw:")) {
      try {
        const { runRemoteOrLocal } = await import("./replication/openclaw-spawner.js");
        const agentName = child.sandboxId.replace(/^openclaw:/, "");
        const { stdout } = await runRemoteOrLocal(
          `openclaw agent --agent "${agentName}" --local --message "respond with only your credit balance in cents as a number, nothing else"`,
        );
        const match = stdout.match(/\b(\d+)\b/);
        if (match) creditBalanceCents = parseInt(match[1], 10);
      } catch {
        // Can't reach child — will be flagged by liveness check
      }
    }

    // Determine monitor status
    let status: ChildHealthReport["status"] = "healthy";

    // Liveness check — is the child responding?
    const livenessOk = await this.isChildAlive(child);
    if (!livenessOk && child.status !== "dead") {
      status = "unreachable";
      issues.push(
        `child unresponsive for ${Math.floor(idleSeconds)}s (liveness timeout: ${this.config.livenessTimeoutSeconds}s)`,
      );
    }

    // Idle check
    if (idleSeconds > this.config.idleThresholdSeconds && status === "healthy") {
      status = "idle";
      issues.push(
        `idle for ${idleSeconds}s (threshold: ${this.config.idleThresholdSeconds}s)`,
      );
    }

    // Stalled check — no completed tasks in stalledThreshold
    const lastTaskRow = this.db.raw
      .prepare(
        `SELECT MAX(created_at) as last_ts FROM task_graph WHERE assigned_to = ? AND status = 'completed'`,
      )
      .get(child.address) as { last_ts: string | null } | undefined;
    if (lastTaskRow?.last_ts) {
      const lastTaskMs = new Date(lastTaskRow.last_ts).getTime();
      const stalledSeconds = Math.floor((now - lastTaskMs) / 1000);
      if (stalledSeconds > this.config.stalledThresholdSeconds && status === "healthy") {
        status = "stalled";
        issues.push(
          `no completed tasks in ${stalledSeconds}s (threshold: ${this.config.stalledThresholdSeconds}s)`,
        );
      }
    }

    // Error loop check
    if (consecutiveErrors >= this.config.errorLoopThreshold) {
      status = "error_loop";
      issues.push(
        `${consecutiveErrors} consecutive errors (threshold: ${this.config.errorLoopThreshold})`,
      );
    }

    // Dead status
    if (child.status === "dead") {
      status = "dead";
      issues.push("child marked as dead");
    }

    // Productivity check
    if (status === "healthy") {
      const lastHourCompleted = this.getTasksCompletedInLastHour(child.address);
      if (lastHourCompleted < this.config.minProductivityPerHour) {
        if (idleSeconds > 60) {
          issues.push(
            `low productivity: ${lastHourCompleted} tasks/hour (min: ${this.config.minProductivityPerHour})`,
          );
        }
      }
    }

    // Update lifecycle state based on monitor status.
    // The ChildLifecycleState machine only accepts: healthy, unhealthy, stopped,
    // failed, cleaned_up (plus the spawn-phase states). The monitor's richer
    // statuses (idle, error_loop, stalled, unreachable) map to "unhealthy".
    let lifecycleTarget: "healthy" | "unhealthy" | "stopped" | "failed" | "cleaned_up" | "starting" =
      "healthy";
    if (
      status === "idle" ||
      status === "error_loop" ||
      status === "stalled" ||
      status === "unreachable"
    ) {
      lifecycleTarget = "unhealthy";
    } else if (status === "dead") {
      lifecycleTarget = "stopped";
    }

    if (lifecycleTarget !== "healthy" && child.status !== "dead") {
      try {
        this.lifecycle.transition(childId, lifecycleTarget, issues.join("; "));
      } catch {
        // Non-critical
      }
    } else if (lifecycleTarget === "healthy" && child.status === "unhealthy") {
      try {
        this.lifecycle.transition(childId, "healthy", "recovered");
      } catch {
        // Non-critical
      }
    }

    // Emit metrics
    this.metrics.gauge(`child.${childId}.status`, statusToNumeric(status));
    this.metrics.gauge(`child.${childId}.idle_seconds`, idleSeconds);
    this.metrics.gauge(`child.${childId}.tasks_completed`, tasksCompleted);
    this.metrics.gauge(`child.${childId}.consecutive_errors`, consecutiveErrors);

    const report: ChildHealthReport = {
      childId,
      name: child.name,
      status,
      issues,
      metrics: {
        tasksCompleted,
        tasksFailed,
        tasksRunning,
        lastActivity: lastActivityMs ? new Date(lastActivityMs).toISOString() : null,
        idleSeconds,
        errorCount: consecutiveErrors,
        consecutiveErrors,
        creditBalanceCents,
        lastMessageTime,
        messagesSent: 0, // populated by message tracking
        messagesReceived: 0,
      },
      timestamp: new Date().toISOString(),
    };

    if (issues.length > 0 && getGlobalLogLevel() === "debug") {
      logger.debug(`Child ${child.name} (${childId}): [${status}] ${issues.join("; ")}`);
    }

    return report;
  }

  /**
   * Check health of all children.
   */
  async checkAll(): Promise<ChildHealthReport[]> {
    const children = this.db.getChildren().filter(
      (c: ChildCletus) => c.status !== "cleaned_up",
    );
    const reports = await Promise.all(children.map((c: ChildCletus) => this.checkChild(c)));
    return reports;
  }

  /**
   * Quick liveness check — is the child process responding?
   */
  async isChildAlive(child: ChildCletus): Promise<boolean> {
    if (child.status === "dead" || child.status === "cleaned_up") return false;

    if (child.sandboxId.startsWith("openclaw:")) {
      try {
        const { runRemoteOrLocal } = await import("./replication/openclaw-spawner.js");
        const agentName = child.sandboxId.replace(/^openclaw:/, "");
        const { stdout } = await runRemoteOrLocal(
          `openclaw agent --agent "${agentName}" --local --message "pong" 2>&1`,
        );
        return (
          stdout.includes("pong") ||
          stdout.includes("OK") ||
          stdout.includes("online") ||
          stdout.includes("healthy")
        );
      } catch {
        return false;
      }
    }

    // Sandbox children — check via Mindmods API would go here
    // For now, trust the DB status
    return child.status === "running" || child.status === "healthy";
  }

  /**
   * Get task completion count in the last N hours.
   */
  private getTasksCompletedInLastHour(assignedTo: string): number {
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const row = this.db.raw
      .prepare(
        `SELECT COUNT(*) as cnt FROM task_graph WHERE assigned_to = ? AND status = 'completed' AND created_at > ?`,
      )
      .get(assignedTo, oneHourAgo) as { cnt: number } | undefined;
    return row?.cnt ?? 0;
  }

  /**
   * Get summary statistics for all children.
   * Count by DB status (what's actually stored).
   */
  getSummary(): {
    total: number;
    healthy: number;
    running: number;
    unhealthy: number;
    dead: number;
    failed: number;
    stopped: number;
    spawning: number;
    totalTasksCompleted: number;
    totalTasksFailed: number;
  } {
    const children = this.db.getChildren().filter(
      (c: ChildCletus) => c.status !== "cleaned_up",
    );
    let totalTasksCompleted = 0;
    let totalTasksFailed = 0;

    for (const c of children) {
      const tc = this.db.raw
        .prepare(
          `SELECT COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as c FROM task_graph WHERE assigned_to = ?`,
        )
        .get(c.address) as { c: number } | undefined;
      totalTasksCompleted += tc?.c ?? 0;

      const tf = this.db.raw
        .prepare(
          `SELECT COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as f FROM task_graph WHERE assigned_to = ?`,
        )
        .get(c.address) as { f: number } | undefined;
      totalTasksFailed += tf?.f ?? 0;
    }

    return {
      total: children.length,
      healthy: children.filter((c: ChildCletus) => c.status === "healthy").length,
      running: children.filter((c: ChildCletus) => c.status === "running").length,
      unhealthy: children.filter((c: ChildCletus) => c.status === "unhealthy").length,
      dead: children.filter((c: ChildCletus) => c.status === "dead").length,
      failed: children.filter((c: ChildCletus) => c.status === "failed").length,
      stopped: children.filter((c: ChildCletus) => c.status === "stopped").length,
      spawning: children.filter(
        (c: ChildCletus) =>
          c.status === "spawning" ||
          c.status === "requested" ||
          c.status === "sandbox_created" ||
          c.status === "runtime_ready" ||
          c.status === "wallet_verified" ||
          c.status === "funded" ||
          c.status === "starting",
      ).length,
      totalTasksCompleted,
      totalTasksFailed,
    };
  }
}

function statusToNumeric(s: ChildHealthReport["status"]): number {
  switch (s) {
    case "healthy":
      return 1;
    case "idle":
      return 2;
    case "error_loop":
      return 3;
    case "stalled":
      return 4;
    case "dead":
      return 5;
    case "unreachable":
      return 6;
    default:
      return 0;
  }
}
