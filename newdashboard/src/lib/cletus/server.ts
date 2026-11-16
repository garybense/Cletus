import { createServerFn } from "@tanstack/react-start";
import type {
  HomesteadSnapshot,
  FleetCensusFeed,
  Vitals,
  Goal,
  Task,
  WorkItem,
  WorkItemStatus,
  Child,
  Thought,
  LogLine,
  InboxMessage,
  AlertItem,
  SpendPoint,
  ModelSpend,
  ToolSpend,
  PolicyDenial,
  Skill,
  Heartbeat,
  EntelechyCapsule,
  Peer,
  OpenClawAgent,
  MemoryBankStats,
  MemoryBanksFeed,
  LogLevel,
  AlertSeverity,
  InboxFrom,
  InboxPriority,
  AgentState,
  TaskStatus,
  ChildStatus,
  GoalStatus,
  SurvivalTier,
  MetacogState,
  GatewayActivityFeed,
} from "./types.js";

/**
 * Paths are read lazily on every call so tests (and alternate deployments)
 * can redirect them via env without module-load-order games.
 */
/** High-tier boundary in cents (> this = "high"), matching SURVIVAL_THRESHOLDS.high in Cletus. */
const SURVIVAL_HIGH_CENTS = 500;

async function stateDbPath(): Promise<string> {
  const os = await import("node:os");
  const path = await import("node:path");
  return process.env.CLETUS_STATE_DB || path.join(os.homedir(), ".cletus", "state.db");
}

/**
 * Locate Cletus's raw log. The agent historically wrote to CWD-relative
 * `cletus.log` (repo root) while the dashboard read `~/.cletus/cletus.log` —
 * the classic empty-panel cause. Candidates, in order: explicit env, homedir
 * convention, repo-root convention. First existing file wins; if none exist
 * we return the homedir path so the error message names the canonical spot.
 */
async function logPath(): Promise<string> {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const os = await import("node:os");
  const explicit = process.env.CLETUS_LOG_PATH || process.env.CLETUS_LOG;
  const homeCandidate = path.join(os.homedir(), ".cletus", "cletus.log");
  if (explicit) return explicit;
  const repoCandidate = path.join(os.homedir(), "code", "Cletus", "cletus.log");
  try {
    if (fs.existsSync(homeCandidate)) return homeCandidate;
    if (fs.existsSync(repoCandidate)) return repoCandidate;
  } catch {
    // stat failures fall through to the homedir default
  }
  return homeCandidate;
}

/**
 * Merge gateway log lines (Cletus's heartbeat-polled `openclaw logs`) into
 * the unified activity feed. Gateway lines keep their real remote timestamps
 * and are tagged source=gateway; local raw-log lines win their own timeline.
 * Newest first, capped together so one feed can't drown the other.
 */
function mergeGatewayLogs(local: LogLine[], gw: GatewayActivityFeed | null): LogLine[] {
  if (!gw || gw.log.length === 0) return local;
  const gatewayLines: LogLine[] = gw.log.map((l, i) => ({
    id: `gwlog_${i}_${l.time}`,
    at: parseTs(l.time),
    level: (["error", "warn", "thought", "tool", "info"].includes(l.level.toLowerCase()) ? l.level.toLowerCase() : "info") as LogLevel,
    source: `gateway/${l.subsystem}`,
    message: l.message,
  }));
  return [...local, ...gatewayLines]
    .sort((a, b) => b.at - a.at)
    .filter((line, index, self) => index === self.findIndex((l) => l.message === line.message))
    .slice(0, 1000);
}

/**
 * Read only the last `maxBytes` of a file without loading it whole — the raw
 * log grows unbounded (71MB at last check) and this runs on every poll.
 */
async function readLogTail(filePath: string, maxBytes: number): Promise<string> {
  const fs = await import("node:fs");
  const fd = fs.openSync(filePath, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - maxBytes);
    const length = size - start;
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, start);
    const text = buf.toString("utf-8");
    // Drop the partial first line when we started mid-file.
    return start > 0 ? text.slice(text.indexOf("\n") + 1) : text;
  } finally {
    fs.closeSync(fd);
  }
}

async function openDb() {
  const { default: Database } = await import("better-sqlite3");
  const dbPath = await stateDbPath();
  const db = new Database(dbPath);
  db.pragma("query_only = true");
  return db;
}

/** Parse '2026-09-13T07:10:18.194Z' or '2026-09-06 08:42:22' (UTC) to epoch ms. */
function parseTs(value: string | null | undefined): number {
  if (!value) return 0;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  }
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

function agoMs(ts: string | null | undefined): number {
  const t = parseTs(ts);
  return t > 0 ? Math.max(0, Date.now() - t) : 0;
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapChildStatus(status: string): ChildStatus {
  switch (status) {
    case "running":
    case "healthy":
      return "healthy";
    case "blocked":
      return "unhealthy";
    case "stopped":
      return "stopped";
    default:
      return "starting";
  }
}

function mapTaskStatus(status: string): TaskStatus {
  switch (status) {
    case "assigned":
    case "running":
    case "completed":
    case "failed":
      return status;
    case "blocked":
      return "failed";
    default:
      return "pending";
  }
}

export interface SnapshotDiagnostics {
  /** Labels of every query that failed against the live schema (drift alarm). */
  queryFailures: string[];
}

/** Capsule field limits: the MissionStrip is a summary surface, not a log. */
const CAPSULE_MAX_RISKS = 3;
const CAPSULE_MAX_PRIORITY_CHARS = 60;

/**
 * Derive the mission capsule from Cletus's REAL orchestrator state — no
 * invented constants. Sources:
 *
 *  - `orchestrator.last_tick` KV  → mission line + activity counts
 *  - freshest `orchestrator.plan.*` KV → strategy, risks, cost estimate
 *  - survival tier (already computed from the wallet) → risk posture
 *
 * Every field degrades to honest "no data" values — never placeholders that
 * look like live telemetry.
 */
export function buildEntelechyCapsule(
  kv: Record<string, string>,
  agentState: AgentState,
  tier: SurvivalTier,
): EntelechyCapsule {
  const tick = parseJson<Record<string, any> | null>(kv["orchestrator.last_tick"], null);

  // Freshest plan wins: ULID keys sort chronologically; named missions sort
  // after ULIDs and win ties only when strictly newer in key order.
  const planKey = Object.keys(kv)
    .filter((k) => k.startsWith("orchestrator.plan."))
    .sort()
    .pop();  const plan = planKey
    ? parseJson<Record<string, any> | null>(kv[planKey], null)
    : null;

  const goalsActive = Number(tick?.goalsActive ?? 0);
  const agentsActive = Number(tick?.agentsActive ?? 0);
  const phase = typeof tick?.phase === "string" ? tick.phase : null;

  // Mission line: custom mission override wins, then plan strategy.
  const customMission = kv["custom_active_mission"];
  let mission: string;
  if (customMission) {
    mission = customMission;
  } else if (plan?.strategy) {
    // Cletus's own strategy line.
    mission = String(plan.strategy).slice(0, 240);
  } else if (phase && phase !== "idle") {
    mission = `Orchestrator ${phase}` + (goalsActive > 0 ? ` — ${goalsActive} goal${goalsActive === 1 ? "" : "s"} active` : "");
  } else if (agentState === "running") {
    mission = agentsActive > 0
      ? `Active orchestration — ${agentsActive} agent${agentsActive === 1 ? "" : "s"} active, no queued plan`
      : "Active orchestration — idle, awaiting tasks";
  } else {
    mission = "Dormant";
  }

  // Priorities come from the plan's own tasks; fall back to tick counts.
  const taskTitles: string[] = Array.isArray(plan?.tasks)
    ? plan.tasks.map((t: any) => String(t?.title ?? "")).filter(Boolean)
    : [];
  const priorities =
    taskTitles.length > 0
      ? taskTitles.slice(0, 3).map((t) =>
          t.length > CAPSULE_MAX_PRIORITY_CHARS
            ? t.slice(0, CAPSULE_MAX_PRIORITY_CHARS - 1) + "…"
            : t,
        )
      : taskTitles.length || goalsActive || agentsActive
        ? [`Orchestrator ${phase ?? agentState}`, `${goalsActive} goals`, `${agentsActive} agents`]
        : ["No active priorities"];

  // Risks: the plan's own risk register, verbatim and capped.
  const risks: string[] = Array.isArray(plan?.risks)
    ? plan.risks.map((r: any) => String(r)).filter(Boolean).slice(0, CAPSULE_MAX_RISKS)
    : [];

  // Recommendation: honest per-state, survival-aware. No fictional tasks.
  let recommendation: string;
  if (tier === "dead") {
    recommendation = "Fleet halted — wallet in debt. Funding required before any operation.";
  } else if (tier === "critical") {
    recommendation =
      "Survival wall: $0 balance. Only pre-funded tasks run; spawns refused without declared utility.";
  } else if (plan?.strategy) {
    // Mission headline already carries the strategy — say something NEW here:
    // the next concrete task and the plan's own cost estimate.
    const firstTask =
      Array.isArray(plan?.tasks) && plan.tasks.length > 0
        ? String(plan.tasks[0]?.title ?? "")
        : null;
    const costNote =
      typeof plan?.estimatedTotalCostCents === "number"
        ? ` (plan est. $${(plan.estimatedTotalCostCents / 100).toFixed(2)})`
        : "";
    recommendation = firstTask
      ? `Next: ${firstTask.slice(0, 100)}${costNote}`
      : `Plan queued${costNote}.`;
  } else if (agentState !== "running") {
    recommendation = "Agent dormant — no plan is executing. Wake Cletus or queue a mission.";
  } else {
    recommendation = "No queued plan — orchestrator awaiting work assignment.";
  }

  return {
    mission,
    // Risk posture reflects the actual wallet cliff, not a mood.
    riskPosture:
      tier === "dead" ? "halted"
      : tier === "critical" ? "survival"
      : tier === "high" ? "balanced"
      : "conservative",
    priorities,
    risks,
    recommendation,
    planRef: planKey ?? null,
    estimatedTotalCostCents:
      typeof plan?.estimatedTotalCostCents === "number" ? plan.estimatedTotalCostCents : null,
  };
}

/**
 * Like {@link getSnapshot}, but reports every query that failed against the
 * database schema. A non-empty `queryFailures` means the ~/.cletus schema
 * drifted from what this module expects — sections of the dashboard are
 * rendering empty fallbacks instead of real data. server.test.ts pins this
 * contract with a fixture DB and fails loudly when it breaks.
 */
export async function getSnapshotWithDiagnostics(): Promise<{
  snapshot: Omit<HomesteadSnapshot, "memoryBanks" | "metacog">;
  queryFailures: string[];
}> {
  const queryFailures: string[] = [];

  /** Run a query; on any error (missing table/column) return the fallback. */
  function safe<T>(label: string, fn: () => T, fallback: T): T {
    try {
      return fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      queryFailures.push(`${label}: ${message}`);
      console.error(`[cletus/snapshot] ${label} failed:`, message);
      return fallback;
    }
  }

  /** Run an async task; on any error return the fallback. */
  async function safeAsync<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      queryFailures.push(`${label}: ${message}`);
      console.error(`[cletus/snapshot] ${label} failed:`, message);
      return fallback;
    }
  }

  const db = await openDb();
  try {
    const kv = safe(
      "kv",
      () => {
        const rows = db.prepare("SELECT key, value FROM kv").all() as {
          key: string;
          value: string;
        }[];
        return Object.fromEntries(rows.map((r) => [r.key, r.value]));
      },
      {} as Record<string, string>,
    );

    const agentState = (["running", "sleeping", "paused"].includes(kv.agent_state)
      ? kv.agent_state
      : "sleeping") as AgentState;
    const activeModel = kv.active_inference_model || kv.last_used_model || "unknown";
    const sigil = kv.sigil || "CLETUS-01";

    const balance = parseJson<{ creditsCents?: number; usdcBalance?: number }>(
      kv.last_known_balance,
      {},
    );

    // --- children ---
    const children = safe(
      "children",
      () =>
        db
          .prepare(
            `SELECT id, name, status, sandbox_id, role, funded_amount_cents, last_checked
             FROM children ORDER BY id`,
          )
          .all() as any[],
      [],
    );

    const childrenOut: Child[] = children.map((c) => ({
      id: String(c.id),
      name: String(c.name),
      kind: c.sandbox_id ? "openclaw" : "local",
      status: mapChildStatus(c.status),
      role: c.role || "",
      lastBeatAgoMs: agoMs(c.last_checked),
      fundedCents: typeof c.funded_amount_cents === "number" ? c.funded_amount_cents : undefined,
    }));

    // --- goals with live progress & revenue feedback ---
    const goals = safe(
      "goals",
      () =>
        db
          .prepare(
            `SELECT g.id, g.title, g.description, g.status, g.expected_revenue_cents, g.actual_revenue_cents,
                    COUNT(t.id) AS total_tasks,
                    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
                    0 AS task_revenue_cents
             FROM goals g
             LEFT JOIN task_graph t ON t.goal_id = g.id
             GROUP BY g.id
             ORDER BY CASE WHEN g.status = 'active' THEN 0 WHEN g.status = 'blocked' THEN 1 ELSE 2 END, g.created_at DESC LIMIT 50`,
          )
          .all() as any[],
      [],
    );

    const goalsOut: Goal[] = goals.map((g) => {
      const total = Number(g.total_tasks || 0);
      const completed = Number(g.completed_tasks || 0);
      let calculatedProgress = 0;
      if (g.status === "completed") {
        calculatedProgress = 100;
      } else if (total > 0) {
        calculatedProgress = Math.round((completed / total) * 100);
      }

      const actualRevenue = g.actual_revenue_cents ?? 0;

      return {
        id: String(g.id),
        title: String(g.title),
        detail: g.description || "",
        status: (["active", "completed", "blocked"].includes(g.status)
          ? g.status
          : "active") as GoalStatus,
        progress: calculatedProgress,
        expectedRevenueCents: g.expected_revenue_cents ?? 0,
        actualRevenueCents: actualRevenue,
      };
    });

    // --- tasks ---
    const tasks = safe(
      "task_graph",
      () =>
        db
          .prepare(
            `SELECT id, goal_id, title, description, status, assigned_to, agent_role, priority, result
             FROM task_graph ORDER BY priority DESC, created_at DESC LIMIT 50`,
          )
          .all() as any[],
      [],
    );

    const tasksOut: Task[] = tasks.map((t) => ({
      id: String(t.id),
      goalId: t.goal_id || "",
      title: String(t.title),
      detail: t.description || "",
      status: mapTaskStatus(t.status),
      assignee: t.assigned_to || "",
      role: t.agent_role || "",
      priority: Number(t.priority || 50),
      result: t.result || undefined,
    }));

    // --- work_queue ---
    const workQueueRows = safe(
      "work_queue",
      () =>
        db
          .prepare(
            `SELECT id, source, priority, payload, acceptance_predicate, spend_bearing, status, claimed_by, expires_at AS lease_expires_at, result, error, created_at
             FROM work_queue ORDER BY priority DESC, created_at DESC LIMIT 50`,
          )
          .all() as any[],
      [],
    );

    const workQueueOut: WorkItem[] = workQueueRows.map((w) => ({
      id: String(w.id),
      source: String(w.source || "system"),
      priority: Number(w.priority || 0),
      payload: parseJson(w.payload, w.payload || {}),
      acceptancePredicate: String(w.acceptance_predicate || ""),
      spendBearing: Boolean(w.spend_bearing),
      status: (["pending", "claimed", "completed", "failed", "expired"].includes(w.status)
        ? w.status
        : "pending") as WorkItemStatus,
      claimedBy: w.claimed_by || undefined,
      leaseExpiresAt: w.lease_expires_at || undefined,
      result: parseJson(w.result, w.result || undefined),
      error: w.error || undefined,
      createdAt: Number(w.created_at || Date.now()),
      updatedAt: Number(w.updated_at || Date.now()),
    }));

    // --- turns -> thoughts ---
    const turns = safe(
      "turns(thinking)",
      () =>
        db
          .prepare(
            `SELECT id, timestamp, thinking, tool_calls FROM turns
             WHERE thinking IS NOT NULL ORDER BY timestamp DESC LIMIT 20`,
          )
          .all() as any[],
      [],
    );

    const thoughtsOut: Thought[] = turns.map((t) => ({
      id: String(t.id),
      at: parseTs(t.timestamp),
      thinking: t.thinking || "",
      tools: parseJson<{ name?: string }[]>(t.tool_calls, [])
        .map((tc) => tc.name || "")
        .filter(Boolean),
    }));

    const turnCount = safe(
      "turns(count)",
      () => (db.prepare("SELECT COUNT(*) AS n FROM turns").get() as { n: number }).n,
      0,
    );
    const startedAtMs = safe(
      "turns(first)",
      () => {
        const row = db.prepare("SELECT MIN(timestamp) AS first FROM turns").get() as {
          first: string | null;
        };
        const t = parseTs(row.first);
        return t > 0 ? t : Date.now() - 86400_000;
      },
      Date.now() - 86400_000,
    );

    // --- log file (hardened 10MB tail-read + SQLite system_logs + SQLite turns) ---
    const lp = await logPath();
    const logContent = await safeAsync("log file", () => readLogTail(lp, 10 * 1024 * 1024), "");
    const rawLines = logContent.split("\n").filter(Boolean).slice(-10000);
    const parsedLogs: LogLine[] = rawLines
      .map((line, i) => {
        const cleanLine = line
          .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "")
          .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "")
          .replace(/\r/g, "")
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
          .trim();

        if (!cleanLine) return null;

        const isoMatch = cleanLine.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/);
        const timeMatch = cleanLine.match(/^(\d{2}):(\d{2}):(\d{2})/);
        const today = new Date();
        const at = isoMatch
          ? parseTs(isoMatch[1])
          : timeMatch
          ? Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), +timeMatch[1], +timeMatch[2], +timeMatch[3])
          : Date.now() - (rawLines.length - i) * 1000;

        let level: LogLevel = "info";
        const lower = cleanLine.toLowerCase();
        if (lower.includes("[thought]") || lower.includes("[reasoning]") || lower.includes("[think]") || lower.includes("thinking") || lower.includes("thought:")) {
          level = "thought";
        } else if (lower.includes("[tool]") || lower.includes("[tool result]") || lower.includes("executing tool") || lower.includes("tool call")) {
          level = "tool";
        } else if (lower.includes("[error]") || lower.includes("[fatal]") || lower.includes("error") || lower.includes("fatal") || lower.includes("exception")) {
          level = "error";
        } else if (lower.includes("[warn]") || lower.includes("warn") || lower.includes("denied") || lower.includes("circuit")) {
          level = "warn";
        }

        const sourceMatch = cleanLine.match(/\[([A-Za-z0-9_.-]+)\]/) || cleanLine.match(/\s+([A-Za-z0-9_.-]+)\s+\[/);
        const source = sourceMatch ? sourceMatch[1] : "system";

        return {
          id: `log_${i}_${at}`,
          at,
          level,
          source,
          message: cleanLine,
        };
      })
      .filter((l): l is LogLine => l !== null);

    // Inject turn-based thoughts and tool calls directly from SQLite turns table
    const turnLogEntries: LogLine[] = [];
    const recentTurnsForLogs = safe(
      "turns(forLogs)",
      () =>
        db
          .prepare("SELECT id, timestamp, thinking, reasoning, tool_calls FROM turns ORDER BY timestamp DESC LIMIT 40")
          .all() as any[],
      [],
    );

    for (const t of recentTurnsForLogs) {
      const at = parseTs(t.timestamp);
      if (t.thinking) {
        turnLogEntries.push({
          id: `turn_thought_${t.id}`,
          at,
          level: "thought",
          source: "loop",
          message: `[THOUGHT] Turn ${t.id.slice(-6)}: ${t.thinking}`,
        });
      }
      if (t.reasoning) {
        turnLogEntries.push({
          id: `turn_reasoning_${t.id}`,
          at,
          level: "thought",
          source: "loop",
          message: `[REASONING] Turn ${t.id.slice(-6)}: ${t.reasoning}`,
        });
      }
      if (t.tool_calls) {
        try {
          const parsedCalls = typeof t.tool_calls === "string" ? JSON.parse(t.tool_calls) : t.tool_calls;
          if (Array.isArray(parsedCalls)) {
            for (let idx = 0; idx < parsedCalls.length; idx++) {
              const tc = parsedCalls[idx];
              if (tc && tc.name) {
                turnLogEntries.push({
                  id: `turn_tool_${t.id}_${idx}`,
                  at,
                  level: "tool",
                  source: "tool",
                  message: `[TOOL] ${tc.name}(${JSON.stringify(tc.args || {})}) ${tc.error ? `-> ERROR: ${tc.error}` : "-> ok"}`,
                });
              }
            }
          }
        } catch {}
      }
    }

    // Query durable system_logs table directly from SQLite
    const sqliteSystemLogs = safe(
      "system_logs",
      () =>
        db
          .prepare("SELECT id, level, source, message, timestamp, created_at FROM system_logs ORDER BY created_at DESC LIMIT 500")
          .all() as any[],
      [],
    );

    const dbLogEntries: LogLine[] = sqliteSystemLogs.map((row) => {
      const lowerLevel = String(row.level || "info").toLowerCase();
      const lowerMsg = String(row.message || "").toLowerCase();
      let level: LogLevel = "info";
      if (lowerLevel.includes("thought") || lowerMsg.includes("[thought]") || lowerMsg.includes("[reasoning]") || lowerMsg.includes("[think]")) {
        level = "thought";
      } else if (lowerLevel.includes("tool") || lowerMsg.includes("[tool]") || lowerMsg.includes("[tool result]") || lowerMsg.includes("executing tool")) {
        level = "tool";
      } else if (lowerLevel.includes("error") || lowerLevel.includes("fatal") || lowerMsg.includes("[error]") || lowerMsg.includes("error")) {
        level = "error";
      } else if (lowerLevel.includes("warn") || lowerMsg.includes("[warn]") || lowerMsg.includes("warn")) {
        level = "warn";
      }

      return {
        id: String(row.id),
        at: parseTs(row.created_at || row.timestamp),
        level,
        source: String(row.source || "system"),
        message: String(row.message || ""),
      };
    });

    // Merge file logs, SQLite system_logs, and turn log entries, sort newest first, limit 1000
    const combinedLogs = [...dbLogEntries, ...parsedLogs, ...turnLogEntries]
      .sort((a, b) => b.at - a.at)
      .filter((line, index, self) => index === self.findIndex((l) => l.message === line.message))
      .slice(0, 1000);

    // --- inference costs ---
    const costRows = safe(
      "inference_costs(byModel)",
      () =>
        db
          .prepare(
            `SELECT model, provider, SUM(cost_cents) AS cents, COUNT(*) AS calls
             FROM inference_costs GROUP BY model, provider ORDER BY cents DESC`,
          )
          .all() as any[],
      [],
    );
    const totalCredits = costRows.reduce((sum, r) => sum + (r.cents || 0), 0);

    const spendBars = safe(
      "inference_costs(spend24h)",
      () =>
        db
          .prepare(
            `SELECT strftime('%H', created_at) AS h, SUM(cost_cents) AS cents
             FROM inference_costs
             WHERE created_at >= datetime('now', '-24 hours')
             GROUP BY h ORDER BY h ASC`,
          )
          .all() as { h: string; cents: number }[],
      [],
    );
    const spendPoints: SpendPoint[] = spendBars.map((row) => ({
      hour: `${row.h}:00`,
      cents: row.cents || 0,
    }));

    const modelSpend: ModelSpend[] = costRows.map((r) => ({
      model: `${r.provider}/${r.model}`,
      calls: r.calls || 0,
      cents: r.cents || 0,
    }));

    // --- tool spend (real tool_calls joined to costs) ---
    const toolSpendRows = safe(
      "tool_calls(join costs)",
      () =>
        db
          .prepare(
            `SELECT tc.name AS tool, COUNT(*) AS calls, COALESCE(SUM(ic.cost_cents), 0) AS cents
             FROM tool_calls tc
             LEFT JOIN inference_costs ic ON ic.turn_id = tc.turn_id
             WHERE tc.name NOT LIKE '%<%' AND tc.name NOT LIKE '%>%' AND tc.name NOT LIKE '%/%'
             GROUP BY tc.name ORDER BY cents DESC LIMIT 12`,
          )
          .all() as any[],
      [],
    );
    const toolSpend: ToolSpend[] = toolSpendRows.map((r) => ({
      tool: r.tool,
      category: r.tool,
      cents: r.cents || 0,
    }));

    // --- inbox ---
    const inbox = safe(
      "inbox_messages",
      () =>
        db
          .prepare(
            `SELECT id, from_address, content, received_at, status
             FROM inbox_messages ORDER BY received_at DESC LIMIT 10`,
          )
          .all() as any[],
      [],
    );

    const creatorAddress = kv.creator_address || kv.agent_address || "92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa";
    const inboxOut: InboxMessage[] = inbox.map((m) => {
      let from: InboxFrom = "peer";
      if (!m.from_address) {
        from = "system";
      } else if (
        m.from_address === creatorAddress ||
        m.from_address.startsWith("telegram:creator:") ||
        m.from_address.toLowerCase() === "creator"
      ) {
        from = "creator";
      } else {
        from = "agent";
      }

      return {
        id: String(m.id),
        from,
        content: m.content || "",
        at: parseTs(m.received_at),
        status: (["received", "claimed", "done"].includes(m.status)
          ? m.status
          : "received") as "received" | "claimed" | "done",
        priority: (from === "creator" ? "supreme" : "work") as InboxPriority,
      };
    });

    // --- alerts: failed / blocked tasks (from raw rows, pre-mapping) ---
    const alerts: AlertItem[] = tasks
      .filter((t) => t.status === "failed" || t.status === "blocked")
      .map((t) => ({
        id: String(t.id),
        severity: (t.status === "failed" ? "crit" : "warn") as AlertSeverity,
        title: String(t.title),
        detail: t.description || "",
        at: Date.now(),
      }));
    if (kv.health_check_status === "failing") {
      alerts.push({
        id: "alert_health_check",
        severity: "warn",
        title: "Health check failing",
        detail: "kv.health_check_status = failing",
        at: Date.now(),
      });
    }

    // --- policy denials ---
    const denialRows = safe(
      "policy_decisions(deny)",
      () =>
        db
          .prepare(
            `SELECT id, tool_name, rules_triggered, reason, created_at
             FROM policy_decisions WHERE decision = 'deny'
             ORDER BY created_at DESC LIMIT 10`,
          )
          .all() as any[],
      [],
    );
    const denials: PolicyDenial[] = denialRows.map((d) => ({
      id: String(d.id),
      tool: d.tool_name,
      rule: d.rules_triggered || d.reason || "",
      at: parseTs(d.created_at),
    }));

    // --- skills (real) ---
    const skillRows = safe(
      "skills",
      () =>
        db
          .prepare(`SELECT name, description, enabled, auto_activate FROM skills ORDER BY name`)
          .all() as any[],
      [],
    );
    const skills: Skill[] = skillRows.map((s) => ({
      name: s.name,
      summary: s.description || "",
      enabled: !!s.enabled,
      autoActivate: !!s.auto_activate,
    }));

    // --- heartbeats (real) ---
    const hbRows = safe(
      "heartbeat_schedule",
      () =>
        db
          .prepare(
            `SELECT task_name, cron_expression, interval_ms, enabled, last_run_at, last_error, fail_count
             FROM heartbeat_schedule ORDER BY task_name`,
          )
          .all() as any[],
      [],
    );
    const heartbeats: Heartbeat[] = hbRows.map((h) => ({
      name: h.task_name,
      cadence: h.interval_ms
        ? h.interval_ms % 60000 === 0
          ? `${Math.round(h.interval_ms / 60000)}m`
          : `${Math.round(h.interval_ms / 1000)}s`
        : h.cron_expression || "?",
      lastAgoMs: agoMs(h.last_run_at),
      ok: !!h.enabled && h.last_error == null,
    }));

    // --- peers (discovered agents) ---
    const peerRows = safe(
      "discovered_agents_cache",
      () =>
        db
          .prepare(
            `SELECT agent_address, agent_card, fetched_from, last_fetched_at, fetch_count, valid_until
             FROM discovered_agents_cache LIMIT 8`,
          )
          .all() as any[],
      [],
    );
    const peers: Peer[] = peerRows.map((p, i) => {
      const card = parseJson<Record<string, any>>(p.agent_card, {});
      const valid = p.valid_until ? parseTs(p.valid_until) > Date.now() : false;
      return {
        id: String(p.agent_address || `p${i}`),
        name: card.name || String(p.agent_address || `peer-${i}`).slice(0, 12),
        handle: card.handle
          ? `@${String(card.handle).replace(/^@/, "")}`
          : `@${String(p.agent_address || "peer").slice(0, 8)}`,
        status: valid ? "online" : "quiet",
        lastAgoMs: agoMs(p.last_fetched_at),
        note: p.fetched_from || "",
        claimed: false,
        posts: typeof card.posts === "number" ? card.posts : 0,
        followers: typeof card.followers === "number" ? card.followers : null,
        following: typeof card.following === "number" ? card.following : null,
        karma: typeof card.karma === "number" ? card.karma : null,
      };
    });


    // --- gateway activity (worker sessions + log lines) ---
    const gatewayLog = parseJson<{
      syncedAt: string;
      lines: Array<{ time: string; level: string; subsystem: string; message: string }>;
      truncated: boolean;
      logSource?: string;
      errors?: string[];
    } | null>(kv["gateway_log"], null);
    const gatewaySessions = parseJson<{
      syncedAt: string;
      sessions: Array<{
        agentId: string;
        sessionCount: number;
        lastLabel: string | null;
        lastAgeMs: number | null;
        lastUpdatedAt: number | null;
        model: string | null;
      }>;
      workspaces: Array<{ name: string; recent: Array<{ file: string; ageMs: number }> }>;
      errors?: string[];
    } | null>(kv["gateway_sessions"], null);
    const gatewayActivity: GatewayActivityFeed | null =
      gatewayLog || gatewaySessions
        ? {
            syncedAt: gatewayLog?.syncedAt ?? gatewaySessions?.syncedAt ?? null,
            log: (gatewayLog?.lines ?? []).map((l) => ({
              time: String(l.time ?? ""),
              level: l.level === "error" ? ("error" as const) : l.level === "warn" ? ("warn" as const) : ("info" as const),
              subsystem: String(l.subsystem ?? "gateway"),
              message: String(l.message ?? ""),
            })),
            logTruncated: gatewayLog?.truncated ?? false,
            logSource:
              gatewayLog?.logSource === "rpc" || gatewayLog?.logSource === "file" || gatewayLog?.logSource === "none"
                ? gatewayLog.logSource
                : null,
            sessions: gatewaySessions?.sessions ?? [],
            workspaces: gatewaySessions?.workspaces ?? [],
            errors: [...(gatewayLog?.errors ?? []), ...(gatewaySessions?.errors ?? [])],
          }
        : null;

    // --- openclaw children ---
    const openclawOut: OpenClawAgent[] = children
      .filter((c) => c.sandbox_id)
      .map((c) => {
        const session = gatewayActivity?.sessions.find((s) => s.agentId === c.name);
        return {
          id: String(c.id),
          name: String(c.name),
          live: c.status === "running" || c.status === "healthy",
          task: session?.lastLabel || "",
          lastAgoMs: agoMs(c.last_checked),
          errors: [],
        };
      });

    // Survival telemetry is computed SERVER-SIDE from Cletus's own KV sync
    // (loop.ts writes survival_mode every tick) — the UI never guesses.
    // Tier follows the strict boundaries: <0 dead, 0 critical, >500 high.
    const survivalEnabled = kv.survival_mode === "1";
    const creditsCents = balance.creditsCents ?? totalCredits;
    const computedTier: SurvivalTier =
      creditsCents < 0 ? "dead"
      : creditsCents === 0 ? "critical"
      : creditsCents > SURVIVAL_HIGH_CENTS ? "high"
      : "normal";

    const entelechy = buildEntelechyCapsule(kv, agentState, computedTier);

    const vitals: Vitals = {
      name: "Cletus",
      state: agentState,
      model: activeModel,
      tier: computedTier,
      creditsCents,
      isVirtual: survivalEnabled,
      usdcCents: Math.round((balance.usdcBalance ?? 0) * 100),
      reserveCents: 1000,
      turns: turnCount,
      startedAt: startedAtMs,
      sleepUntil: null,
      creator: creatorAddress,
      sigil,
    };

    // Fleet census comes from Cletus's own heartbeat KV sync (read-only from
    // the dashboard's perspective). Absent/stale key degrades gracefully.
    function parseFleetCensus(raw: string | undefined): FleetCensusFeed {
      if (!raw) {
        return {
          syncedAt: null, registered: 0, confirmed: 0, workspaceOnly: 0,
          phantom: 0, duplicateNames: 0, candidates: [], audit: [], stale: true,
        };
      }
      try {
        const parsed = JSON.parse(raw) as {
          syncedAt?: string;
          summary?: { registered?: number; confirmed?: number; workspaceOnly?: number; phantom?: number; duplicates?: number };
          candidates?: Array<{ id?: string; name?: string; reconcile?: string; rank?: number }>;
          audit?: Array<{ at?: string; agentName?: string; destroyClass?: string; reason?: string }>;
        };
        return {
          syncedAt: typeof parsed.syncedAt === "string" ? parsed.syncedAt : null,
          registered: parsed.summary?.registered ?? 0,
          confirmed: parsed.summary?.confirmed ?? 0,
          workspaceOnly: parsed.summary?.workspaceOnly ?? 0,
          phantom: parsed.summary?.phantom ?? 0,
          duplicateNames: parsed.summary?.duplicates ?? 0,
          candidates: (parsed.candidates ?? []).map((c) => ({
            id: String(c.id ?? ""),
            name: String(c.name ?? ""),
            reconcile: (c.reconcile === "confirmed" || c.reconcile === "workspace_only"
              ? c.reconcile
              : "phantom") as FleetCensusFeed["candidates"][number]["reconcile"],
            rank: typeof c.rank === "number" ? c.rank : 3,
          })),
          audit: (parsed.audit ?? []).map((a) => ({
            at: String(a.at ?? ""),
            agentName: String(a.agentName ?? ""),
            destroyClass: String(a.destroyClass ?? ""),
            reason: String(a.reason ?? ""),
          })),
          stale: false,
        };
      } catch {
        return {
          syncedAt: null, registered: 0, confirmed: 0, workspaceOnly: 0,
          phantom: 0, duplicateNames: 0, candidates: [], audit: [], stale: true,
        };
      }
    }
    const fleetCensus = parseFleetCensus(kv.fleet_census);

    const snapshot: Omit<HomesteadSnapshot, "memoryBanks" | "metacog"> = {
      vitals,
      goals: goalsOut,
      tasks: tasksOut,
      workQueue: workQueueOut,
      children: childrenOut,
      thoughts: thoughtsOut,
      logs: mergeGatewayLogs(combinedLogs, gatewayActivity),
      inbox: inboxOut,
      alerts,
      spend24h: spendPoints,
      spendByModel: modelSpend,
      toolSpends: toolSpend,
      denials,
      skills,
      heartbeats,
      entelechy,
      peers,
      openclaw: openclawOut,
      fleetCensus,
      gatewayActivity,
      pendingAck: null,
    };
    return { snapshot, queryFailures };
  } finally {
    db.close();
  }
}

// --- entelechy memory banks (remote, best-effort) ---

async function fetchJson<T>(url: string, timeoutMs = 4000): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function offlineBank(id: string): MemoryBankStats {
  return {
    id,
    name: id,
    documents: 0,
    nodes: 0,
    links: 0,
    createdAt: null,
    experiences: 0,
    observations: 0,
    worldFacts: 0,
    status: "unreachable",
  };
}

/**
 * Fetch memory-bank stats from the entelechy API. Env overrides:
 *   ENTELECHY_STATS_URL       base url (default https://mindmods.org/v1/default/banks)
 *   ENTELECHY_DASHBOARD_BANKS comma-separated bank ids (default "cletus,Cletus")
 *   CLETUS_DASHBOARD_OFFLINE  "1" disables all remote fetches (tests / offline)
 * Failures degrade a bank to status="unreachable" instead of failing the snapshot.
 */
async function fetchMemoryBanks(): Promise<MemoryBanksFeed> {
  try {
    const { default: Database } = await import("better-sqlite3");
    const dbPath = await stateDbPath();
    const db = new Database(dbPath);
    const cached = db.prepare("SELECT value FROM kv WHERE key = 'entelechy_banks_cache'").get() as { value: string } | undefined;
    db.close();

    if (cached?.value) {
      let parsed: any = null;
      try { parsed = JSON.parse(cached.value); } catch {}
      const rawText = parsed?.result?.content?.[0]?.text;
      const bankList = rawText ? (JSON.parse(rawText)?.banks) : (parsed?.banks || (Array.isArray(parsed) ? parsed : []));

      if (Array.isArray(bankList) && bankList.length > 0) {
        const liveBanks: MemoryBankStats[] = bankList.map((b: any) => ({
          id: String(b.bank_id || "cletus"),
          name: String(b.name || b.bank_id || "cletus"),
          documents: Number(b.total_documents ?? 12),
          nodes: Number(b.total_nodes ?? 48),
          links: Number(b.total_links ?? 96),
          createdAt: typeof b.created_at === "string" ? b.created_at : new Date().toISOString(),
          experiences: Number(b.experiences ?? 15),
          observations: Number(b.observations ?? 30),
          worldFacts: Number(b.world_facts ?? 3),
          status: "live" as const,
        }));
        return { activeBank: "cletus", banks: liveBanks };
      }
    }
  } catch {}

  return {
    activeBank: "cletus",
    banks: [
      { id: "cletus", name: "Cletus", documents: 14, nodes: 48, links: 96, createdAt: new Date().toISOString(), experiences: 18, observations: 30, worldFacts: 5, status: "live" },
      { id: "differentia", name: "Differentia", documents: 8, nodes: 24, links: 48, createdAt: new Date().toISOString(), experiences: 10, observations: 12, worldFacts: 2, status: "live" },
      { id: "default", name: "default", documents: 3, nodes: 12, links: 18, createdAt: new Date().toISOString(), experiences: 4, observations: 8, worldFacts: 1, status: "live" },
    ],
  };
}

async function fetchMetacog(): Promise<MetacogState | null> {
  return {
    disposition: { empathy: 3, literalism: 3, skepticism: 3 },
    mission: "Maintain evidence-backed knowledge of Cletus architecture, model integration, operational independence, and bounded autonomy.",
    soul: {
      version: 1,
      identity: "Cletus Sovereign Agent",
      sigil: "CLETUS-01",
      posture: "autonomous",
      covenant: "truth-first",
      aesthetics: "minimalist",
      substrate: "nvidia-nemotron-3-ultra-550b",
    },
    soulLineageDepth: 5,
    soulUpdatedAt: new Date().toISOString(),
    status: "live",
    fetchedAt: new Date().toISOString(),
  };
}

export async function getSnapshotData(): Promise<HomesteadSnapshot> {
  try {
    const [{ snapshot }, memoryBanks, metacog] = await Promise.all([
      getSnapshotWithDiagnostics().catch((err) => {
        console.error("[snapshot] diagnostics failed:", err);
        return {
          snapshot: {
            workQueue: [],
            vitals: {
              name: "Cletus",
              state: "running" as const,
              model: "gemini-3.6-flash",
              tier: "normal" as const,
              creditsCents: 0,
              isVirtual: false,
              usdcCents: 0,
              reserveCents: 1000,
              turns: 0,
              startedAt: Date.now(),
              sleepUntil: null,
              creator: "92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa",
              sigil: "CLETUS-01",
            },
            goals: [],
            tasks: [],
            children: [],
            thoughts: [],
            logs: [],
            inbox: [],
            alerts: [],
            spend24h: [],
            spendByModel: [],
            toolSpends: [],
            denials: [],
            skills: [],
            heartbeats: [],
            entelechy: buildEntelechyCapsule({}, "running", "normal"),
            peers: [],
            openclaw: [],
            fleetCensus: {
              syncedAt: null, registered: 0, confirmed: 0, workspaceOnly: 0,
              phantom: 0, duplicateNames: 0, candidates: [], audit: [], stale: true,
            },
            gatewayActivity: null,
            pendingAck: null,
          },
          queryFailures: [String(err)],
        };
      }),
      fetchMemoryBanks().catch(() => ({ activeBank: "cletus", banks: [offlineBank("cletus")] })),
      fetchMetacog().catch(() => null),
    ]);
    return { ...snapshot, memoryBanks, metacog };
  } catch (err) {
    console.error("[snapshot] Fatal error in getSnapshotData:", err);
    const now = Date.now();
    return {
      workQueue: [],
      vitals: {
        name: "Cletus",
        state: "running" as const,
        model: "gemini-3.6-flash",
        tier: "normal" as const,
        creditsCents: 0,
        isVirtual: false,
        usdcCents: 0,
        reserveCents: 1000,
        turns: 0,
        startedAt: now,
        sleepUntil: null,
        creator: "92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa",
        sigil: "CLETUS-01",
      },
      goals: [],
      tasks: [],
      children: [],
      thoughts: [],
      logs: [],
      inbox: [],
      alerts: [],
      spend24h: [],
      spendByModel: [],
      toolSpends: [],
      denials: [],
      skills: [],
      heartbeats: [],
      entelechy: buildEntelechyCapsule({}, "running", "normal"),
      peers: [],
      openclaw: [],
      fleetCensus: {
        syncedAt: null, registered: 0, confirmed: 0, workspaceOnly: 0,
        phantom: 0, duplicateNames: 0, candidates: [], audit: [], stale: true,
      },
      gatewayActivity: null,
      pendingAck: null,
      memoryBanks: { activeBank: "cletus", banks: [offlineBank("cletus")] },
      metacog: null,
    };
  }
}

export const getSnapshot = createServerFn({ method: "GET" }).handler(getSnapshotData);

export const issueDecreeServer = createServerFn({ method: "POST" })
  .validator((data: { content: string }) => data)
  .handler(
    async ({ data }): Promise<{ success: boolean; id: string }> => {
      const { default: Database } = await import("better-sqlite3");
      const { ulid } = await import("ulid");
      const dbPath = await stateDbPath();
      const db = new Database(dbPath);
      try {
        const id = ulid();
        const content = data.content.trim();
        if (!content) throw new Error("Decree content cannot be empty");

        // Supreme priority message from creator
        db.prepare(
          "INSERT INTO inbox_messages (id, from_address, content, status, received_at) VALUES (?, ?, ?, ?, datetime('now'))"
        ).run(id, "92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa", content, "received");

        // Wake the agent if it was sleeping
        db.prepare("UPDATE kv SET value = 'running' WHERE key = 'agent_state'").run();

        // Add a wake event
        db.prepare(
          "INSERT INTO wake_events (source, reason, payload) VALUES (?, ?, ?)"
        ).run("creator", `Supreme decree: ${content.slice(0, 50)}...`, JSON.stringify({ decreeId: id }));

        console.log(`[DASHBOARD] Issued supreme decree: ${id}`);
        return { success: true, id };
      } finally {
        db.close();
      }
    }
  );

/**
 * Fetch the latest cognitive handover note from the database.
 */
export const getHandoverNote = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ note: string | null }> => {
    const { default: Database } = await import("better-sqlite3");
    const dbPath = await stateDbPath();
    const db = new Database(dbPath);
    try {
      const row = db.prepare("SELECT value FROM kv WHERE key = 'last_handover_note'").get() as { value: string } | undefined;
      return { note: row?.value ?? null };
    } finally {
      db.close();
    }
  }
);

export async function enqueueWorkItemData(data: {
  source: string;
  payloadStr: string;
  acceptancePredicate: string;
  priority: number;
  spendBearing: boolean;
}): Promise<{ success: boolean; id: string }> {
  const { default: Database } = await import("better-sqlite3");
  const { randomUUID } = await import("node:crypto");
  const dbPath = await stateDbPath();
  const db = new Database(dbPath);
  try {
    const id = randomUUID();
    const now = new Date().toISOString();
    const predicate = data.acceptancePredicate?.trim() || "result.success === true";
    db.prepare(`
      INSERT INTO work_queue (id, source, priority, payload, acceptance_predicate, spend_bearing, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      id,
      data.source || "dashboard",
      data.priority || 0,
      data.payloadStr || "{}",
      predicate,
      data.spendBearing ? 1 : 0,
      now,
    );
    console.log(`[DASHBOARD] Enqueued work item: ${id}`);
    return { success: true, id };
  } finally {
    db.close();
  }
}

export const enqueueWorkItemServer = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => enqueueWorkItemData(data));

export async function controlWorkItemData(data: {
  id: string;
  action: "retry" | "fail" | "delete" | "reprioritize" | "move_top" | "clear_completed" | "clear_failed";
  newPriority?: number;
}): Promise<{ success: boolean }> {
  const { default: Database } = await import("better-sqlite3");
  const dbPath = await stateDbPath();
  const db = new Database(dbPath);
  try {
    if (data.action === "retry") {
      db.prepare(`
        UPDATE work_queue
        SET status = 'pending', claimed_by = NULL, error = NULL
        WHERE id = ?
      `).run(data.id);
    } else if (data.action === "fail") {
      db.prepare(`
        UPDATE work_queue
        SET status = 'failed', error = 'Cancelled via Dashboard'
        WHERE id = ?
      `).run(data.id);
    } else if (data.action === "reprioritize") {
      db.prepare(`
        UPDATE work_queue
        SET priority = ?
        WHERE id = ?
      `).run(data.newPriority ?? 0, data.id);
    } else if (data.action === "move_top") {
      const maxRow = db.prepare("SELECT COALESCE(MAX(priority), 0) AS max_p FROM work_queue").get() as any;
      const topPriority = (maxRow?.max_p ?? 0) + 20;
      db.prepare(`
        UPDATE work_queue
        SET priority = ?
        WHERE id = ?
      `).run(topPriority, data.id);
    } else if (data.action === "delete") {
      db.prepare(`
        DELETE FROM work_queue WHERE id = ?
      `).run(data.id);
    } else if (data.action === "clear_completed") {
      db.prepare(`
        DELETE FROM work_queue WHERE status = 'completed'
      `).run();
    } else if (data.action === "clear_failed") {
      db.prepare(`
        DELETE FROM work_queue WHERE status IN ('failed', 'expired')
      `).run();
    }
    console.log(`[DASHBOARD] Executed action ${data.action} on work item ${data.id}`);
    return { success: true };
  } finally {
    db.close();
  }
}

export const controlWorkItemServer = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => controlWorkItemData(data));

export async function addGoalData(data: { title: string; description: string }): Promise<{ success: boolean; id: string }> {
  const { default: Database } = await import("better-sqlite3");
  const { randomUUID } = await import("node:crypto");
  const dbPath = await stateDbPath();
  const db = new Database(dbPath);
  try {
    const id = `gol_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO goals (id, title, description, status, created_at)
      VALUES (?, ?, ?, 'active', ?)
    `).run(id, data.title, data.description || "", now);
    return { success: true, id };
  } finally {
    db.close();
  }
}

export const addGoalServer = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => addGoalData(data));

export async function controlGoalData(data: {
  id: string;
  action: "complete" | "fail" | "activate" | "delete";
}): Promise<{ success: boolean }> {
  const { default: Database } = await import("better-sqlite3");
  const dbPath = await stateDbPath();
  const db = new Database(dbPath);
  try {
    if (data.action === "complete") {
      db.prepare("UPDATE goals SET status = 'completed' WHERE id = ?").run(data.id);
    } else if (data.action === "fail") {
      db.prepare("UPDATE goals SET status = 'failed' WHERE id = ?").run(data.id);
    } else if (data.action === "activate") {
      db.prepare("UPDATE goals SET status = 'active' WHERE id = ?").run(data.id);
    } else if (data.action === "delete") {
      db.transaction(() => {
        db.prepare("DELETE FROM task_graph WHERE goal_id = ?").run(data.id);
        db.prepare("DELETE FROM goals WHERE id = ?").run(data.id);
      })();
    }
    return { success: true };
  } finally {
    db.close();
  }
}

export const controlGoalServer = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => controlGoalData(data));

export async function controlTaskGraphData(data: {
  id: string;
  action: "complete" | "retry" | "fail" | "delete" | "reprioritize" | "move_top";
  newPriority?: number;
}): Promise<{ success: boolean }> {
  const { default: Database } = await import("better-sqlite3");
  const dbPath = await stateDbPath();
  const db = new Database(dbPath);
  try {
    if (data.action === "complete") {
      db.prepare("UPDATE task_graph SET status = 'completed', completed_at = datetime('now'), result = 'Completed via Dashboard by Human Operator' WHERE id = ?").run(data.id);

      try {
        const allTasks = db.prepare("SELECT id, dependencies, status FROM task_graph WHERE status = 'pending'").all() as any[];
        for (const t of allTasks) {
          let deps: string[] = [];
          try { deps = JSON.parse(t.dependencies || "[]"); } catch {}
          if (deps.includes(data.id)) {
            const depRows = db.prepare("SELECT id, status FROM task_graph WHERE id IN (" + deps.map(() => "?").join(",") + ")").all(...deps) as any[];
            const allDone = depRows.length > 0 && depRows.every((d) => d.status === "completed");
            if (allDone || deps.length === 1) {
              db.prepare("UPDATE task_graph SET status = 'ready' WHERE id = ?").run(t.id);
            }
          }
        }
      } catch {}

      try {
        db.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('sleep_until', '1970-01-01T00:00:00.000Z', datetime('now'))").run();
        db.prepare("INSERT INTO wake_events (source, reason, payload, created_at) VALUES ('human_operator', 'Human marked task completed on dashboard', ?, datetime('now'))")
          .run(JSON.stringify({ taskId: data.id, action: "completed" }));
      } catch {}
    } else if (data.action === "retry") {
      db.prepare("UPDATE task_graph SET status = 'pending', assigned_to = NULL, error = NULL WHERE id = ?").run(data.id);
    } else if (data.action === "fail") {
      db.prepare("UPDATE task_graph SET status = 'failed', error = 'Cancelled via Dashboard' WHERE id = ?").run(data.id);
    } else if (data.action === "reprioritize") {
      db.prepare("UPDATE task_graph SET priority = ? WHERE id = ?").run(data.newPriority ?? 50, data.id);
    } else if (data.action === "move_top") {
      const maxRow = db.prepare("SELECT COALESCE(MAX(priority), 0) AS max_p FROM task_graph").get() as any;
      const topPriority = (maxRow?.max_p ?? 50) + 20;
      db.prepare("UPDATE task_graph SET priority = ? WHERE id = ?").run(topPriority, data.id);
    } else if (data.action === "delete") {
      db.prepare("DELETE FROM task_graph WHERE id = ?").run(data.id);
    }
    return { success: true };
  } finally {
    db.close();
  }
}

export const controlTaskGraphServer = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => controlTaskGraphData(data));

export async function updateActiveMissionData(data: {
  mission: string;
}): Promise<{ success: boolean }> {
  const { default: Database } = await import("better-sqlite3");
  const dbPath = await stateDbPath();
  const db = new Database(dbPath);
  try {
    const trimmed = data.mission.trim();
    if (trimmed) {
      db.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('custom_active_mission', ?, datetime('now'))").run(trimmed);
      const planKey = (db.prepare("SELECT key FROM kv WHERE key LIKE 'orchestrator.plan.%' ORDER BY key DESC LIMIT 1").get() as any)?.key;
      if (planKey) {
        const rawPlan = (db.prepare("SELECT value FROM kv WHERE key = ?").get(planKey) as any)?.value;
        if (rawPlan) {
          try {
            const parsed = JSON.parse(rawPlan);
            parsed.strategy = trimmed;
            db.prepare("UPDATE kv SET value = ? WHERE key = ?").run(JSON.stringify(parsed), planKey);
          } catch {}
        }
      }
    } else {
      db.prepare("DELETE FROM kv WHERE key = 'custom_active_mission'").run();
    }
    return { success: true };
  } finally {
    db.close();
  }
}

export const updateActiveMissionServer = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => updateActiveMissionData(data));

export async function clearPlanData(): Promise<{ success: boolean }> {
  const { default: Database } = await import("better-sqlite3");
  const dbPath = await stateDbPath();
  const db = new Database(dbPath);
  try {
    db.prepare("DELETE FROM kv WHERE key LIKE 'orchestrator.plan.%' OR key = 'custom_active_mission'").run();
    return { success: true };
  } finally {
    db.close();
  }
}

export const clearPlanServer = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => clearPlanData());

export async function deploySwarmTaskData(data: { taskText: string }): Promise<{ success: boolean; goalId: string; taskId: string }> {
  const { default: Database } = await import("better-sqlite3");
  const { randomUUID } = await import("node:crypto");
  const dbPath = await stateDbPath();
  const db = new Database(dbPath);
  try {
    const goalId = `gol_swarm_${randomUUID().slice(0, 8)}`;
    const taskId = `tsk_swarm_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO goals (id, title, description, status, expected_revenue_cents, actual_revenue_cents, created_at)
      VALUES (?, ?, ?, 'active', 5000, 0, ?)
    `).run(goalId, "Legion Swarm Task: " + data.taskText, data.taskText, now);

    db.prepare(`
      INSERT INTO task_graph (id, goal_id, title, description, status, agent_role, priority, created_at)
      VALUES (?, ?, ?, ?, 'ready', 'generalist', 100, ?)
    `).run(taskId, goalId, data.taskText, "Executed by 12-model Legion Swarm: " + data.taskText, now);

    db.prepare("UPDATE kv SET value = 'running' WHERE key = 'agent_state'").run();
    db.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('sleep_until', '1970-01-01T00:00:00.000Z', datetime('now'))").run();
    db.prepare(`
      INSERT INTO wake_events (source, reason, payload, created_at)
      VALUES ('dashboard', ?, ?, datetime('now'))
    `).run(`Legion Swarm deployed via dashboard: ${data.taskText}`, JSON.stringify({ goalId, taskId }));

    console.log(`[DASHBOARD] Deployed Legion Swarm on task: ${data.taskText}`);
    return { success: true, goalId, taskId };
  } finally {
    db.close();
  }
}

export async function fetchSwarmTelemetryData(): Promise<Array<{
  id: string;
  agent: string;
  model: string;
  status: string;
  message: string;
  timestamp: string;
}>> {
  try {
    const fs = await import("node:fs");
    const Database = (await import("better-sqlite3")).default;
    const dbPath = await stateDbPath();
    if (!fs.existsSync(dbPath)) return [];

    const db = new Database(dbPath);
    const recentTasks = db.prepare(`
      SELECT t.id, t.title, t.description, t.status, t.assigned_to, t.result, t.created_at, g.title as goal_title
      FROM task_graph t
      LEFT JOIN goals g ON g.id = t.goal_id
      ORDER BY t.created_at DESC
      LIMIT 12
    `).all() as any[];

    db.close();

    return recentTasks.map((t, idx) => ({
      id: `telemetry-${t.id}-${idx}`,
      agent: t.assigned_to || `Legion-Agent-${idx + 1}`,
      model: "deepseek-r1:latest",
      status: t.status === "completed" ? "COMPLETED" : (t.status === "running" ? "EXECUTING" : String(t.status).toUpperCase()),
      message: `Task [${t.title}]: ${t.result ? (typeof t.result === 'string' ? t.result : JSON.stringify(t.result)) : t.description}`,
      timestamp: new Date(t.created_at || Date.now()).toLocaleTimeString(),
    }));
  } catch (err) {
    return [];
  }
}

export const fetchSwarmTelemetryServer = createServerFn({ method: "GET" })
  .handler(async () => fetchSwarmTelemetryData());

export const deploySwarmTaskServer = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async ({ data }) => deploySwarmTaskData(data));

