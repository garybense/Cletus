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
    level: l.level,
    source: `gateway/${l.subsystem}`,
    message: l.message,
  }));
  return [...local, ...gatewayLines]
    .sort((a, b) => b.at - a.at)
    .slice(0, 120);
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

  // Mission line: phase + what the orchestrator is actually holding.
  let mission: string;
  if (plan?.strategy) {
    // Cletus's own strategy line, truncated for the strip.
    mission = String(plan.strategy).slice(0, 160);
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
                    SUM(CASE WHEN t.status = 'completed' THEN COALESCE(CAST(json_extract(t.result, '$.revenueCents') AS INTEGER), 0) ELSE 0 END) AS task_revenue_cents
             FROM goals g
             LEFT JOIN task_graph t ON t.goal_id = g.id
             GROUP BY g.id
             ORDER BY g.created_at DESC LIMIT 20`,
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
            `SELECT id, goal_id, title, description, status, assigned_to, agent_role, result
             FROM task_graph ORDER BY created_at DESC LIMIT 20`,
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
      result: t.result || undefined,
    }));

    // --- work_queue ---
    const workQueueRows = safe(
      "work_queue",
      () =>
        db
          .prepare(
            `SELECT id, source, priority, payload, acceptance_predicate, spend_bearing, status, claimed_by, lease_expires_at, result, error, created_at, updated_at
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

    // --- log file (tail-read: the raw log can be tens of MB) ---
    const lp = await logPath();
    const logContent = await safeAsync("log file", () => readLogTail(lp, 256 * 1024), "");
    const logLines = logContent.split("\n").filter(Boolean).slice(-200);
    const parsedLogs: LogLine[] = logLines
      .map((line, i) => {
        const match = line.match(/^(\d{2}:\d{2}:\d{2})\s+(\w+)\s+(.+)$/);
        if (match) {
          return {
            id: `log_${i}`,
            at: Date.now() - (logLines.length - i) * 60000,
            level: match[2] as LogLevel,
            source: match[3].split(" ")[0] || "system",
            message: match[3],
          };
        }
        return {
          id: `log_${i}`,
          at: Date.now(),
          level: "info" as LogLevel,
          source: "log",
          message: line,
        };
      })
      .reverse()
      .slice(0, 50);

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
      } else if (m.from_address === creatorAddress) {
        from = "creator";
      } else {
        // If it's not the creator, assume it's Cletus himself or a child
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
      logs: mergeGatewayLogs(parsedLogs, gatewayActivity),
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
  if (process.env.CLETUS_DASHBOARD_OFFLINE === "1") {
    return { activeBank: "cletus", banks: [offlineBank("cletus")] };
  }
  const base = (process.env.ENTELECHY_STATS_URL || "https://mindmods.org/v1/default/banks").replace(/\/$/, "");
  const wanted = (process.env.ENTELECHY_DASHBOARD_BANKS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const names = wanted.length ? wanted : ["cletus", "Cletus"];
  const banks = await Promise.all(
    names.map(async (id) => {
      const stats = await fetchJson<Record<string, any>>(`${base}/${encodeURIComponent(id)}/stats`);
      if (!stats) return offlineBank(id);
      const byType = (stats.nodes_by_fact_type || {}) as Record<string, unknown>;
      return {
        id: String(stats.bank_id ?? id),
        name: String(stats.bank_id ?? id),
        documents: Number(stats.total_documents ?? 0),
        nodes: Number(stats.total_nodes ?? 0),
        links: Number(stats.total_links ?? 0),
        createdAt: typeof stats.created_at === "string" ? stats.created_at : null,
        experiences: Number(byType.experience ?? 0),
        observations: Number(byType.observation ?? 0),
        worldFacts: Number(byType.world ?? 0),
        status: "live" as const,
      };
    }),
  );
  return { activeBank: wanted[0] ?? "cletus", banks };
}

/**
 * Call an Entelechy MCP tool (JSON-RPC over POST; response may be SSE-framed
 * or plain JSON; tool results arrive as text-content JSON). Self-contained —
 * the dashboard does not import from the Cletus agent app.
 */
async function callEntelechyMcp(
  toolName: string,
  args: Record<string, unknown>,
): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (process.env.ENTELECHY_API_KEY) {
    headers.Authorization = `Bearer ${process.env.ENTELECHY_API_KEY}`;
  }
  const resp = await fetch(process.env.ENTELECHY_MCP_URL || "https://mindmods.org/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `metacog-${toolName}-${Date.now()}`,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const raw = await resp.text().catch(() => "");
  if (!resp.ok) throw new Error(`entelechy mcp ${resp.status}: ${raw.slice(0, 200)}`);

  // Tolerant unwrap: last SSE data line, else the raw body.
  const dataLine = raw
    .split("\n")
    .reverse()
    .find((l) => l.trimStart().startsWith("data:"));
  const jsonText = dataLine ? dataLine.trimStart().slice(5).trim() : raw;
  const parsed = JSON.parse(jsonText);
  if (parsed?.error) throw new Error(parsed.error.message ?? "mcp error");
  const content = parsed?.result?.content;
  if (Array.isArray(content) && content[0]?.type === "text") {
    return JSON.parse(content[0].text);
  }
  return parsed?.result ?? parsed;
}

/**
 * Fetch Cletus's metacognitive state (disposition, mission, soul encoding,
 * molt lineage) from the Entelechy MCP server — the same surface Cletus uses
 * for ritual/feel/become. Read-only tools only. Env overrides:
 *   ENTELECHY_MCP_URL          default https://mindmods.org/mcp
 *   ENTELECHY_DASHBOARD_BANKS  first entry picks the bank (default "cletus,Cletus")
 *   CLETUS_DASHBOARD_OFFLINE   "1" disables all remote fetches (tests / offline)
 * Any failure returns null — the dashboard degrades, never breaks.
 */
async function fetchMetacog(): Promise<MetacogState | null> {
  if (process.env.CLETUS_DASHBOARD_OFFLINE === "1") return null;
  const bank =
    (process.env.ENTELECHY_DASHBOARD_BANKS || "cletus,Cletus")
      .split(",")[0]
      ?.trim() || "cletus";
  try {
    const [bankProfile, soul, lineage] = await Promise.all([
      callEntelechyMcp("get_bank", { bank_id: bank }),
      callEntelechyMcp("get_soul", { bank_id: bank }).catch(() => null),
      callEntelechyMcp("list_soul_lineage", { bank_id: bank }).catch(() => []),
    ]);

    const enc = (soul?.encoding ?? null) as Record<string, any> | null;
    const lineageList = Array.isArray(lineage) ? lineage : [];
    const newestSoul = [...lineageList]
      .filter((s: any) => typeof s?.created_at === "string")
      .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
      .pop();

    return {
      disposition:
        bankProfile?.disposition && typeof bankProfile.disposition === "object"
          ? (bankProfile.disposition as Record<string, number>)
          : {},
      mission: typeof bankProfile?.mission === "string" ? bankProfile.mission : null,
      soul: enc
        ? {
            version: Number(soul?.version ?? 0),
            identity: typeof enc.identity === "string" ? enc.identity : null,
            sigil: typeof enc.sigil === "string" ? enc.sigil : null,
            posture: typeof enc.posture === "string" ? enc.posture : null,
            covenant: typeof enc.covenant === "string" ? enc.covenant : null,
            aesthetics: typeof enc.aesthetics === "string" ? enc.aesthetics : null,
            substrate: typeof enc.substrate === "string" ? enc.substrate : null,
          }
        : null,
      soulLineageDepth: lineageList.length,
      soulUpdatedAt: typeof newestSoul?.created_at === "string" ? newestSoul.created_at : null,
      status: "live",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export const getSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomesteadSnapshot> => {
    // DB snapshot, bank stats, and metacog state all run in parallel; entelechy
    // latency or outages never slow or break the local snapshot.
    const [{ snapshot }, memoryBanks, metacog] = await Promise.all([
      getSnapshotWithDiagnostics(),
      fetchMemoryBanks(),
      fetchMetacog(),
    ]);
    return { ...snapshot, memoryBanks, metacog };
  }
);

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

export const enqueueWorkItemServer = createServerFn({ method: "POST" })
  .validator((data: {
    source: string;
    payloadStr: string;
    acceptancePredicate: string;
    priority: number;
    spendBearing: boolean;
  }) => data)
  .handler(
    async ({
      data,
    }): Promise<{ success: boolean; id: string }> => {
      const { default: Database } = await import("better-sqlite3");
      const { randomUUID } = await import("node:crypto");
      const dbPath = await stateDbPath();
      const db = new Database(dbPath);
      try {
        const id = randomUUID();
        const now = Date.now();
        const predicate = data.acceptancePredicate?.trim() || "result.success === true";
        db.prepare(`
          INSERT INTO work_queue (id, source, priority, payload, acceptance_predicate, spend_bearing, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        `).run(
          id,
          data.source || "dashboard",
          data.priority || 0,
          data.payloadStr || "{}",
          predicate,
          data.spendBearing ? 1 : 0,
          now,
          now
        );
        console.log(`[DASHBOARD] Enqueued work item: ${id}`);
        return { success: true, id };
      } finally {
        db.close();
      }
    }
  );

export const controlWorkItemServer = createServerFn({ method: "POST" })
  .validator((data: {
    id: string;
    action: "retry" | "fail" | "delete" | "reprioritize";
    newPriority?: number;
  }) => data)
  .handler(
    async ({
      data,
    }): Promise<{ success: boolean }> => {
      const { default: Database } = await import("better-sqlite3");
      const dbPath = await stateDbPath();
      const db = new Database(dbPath);
      try {
        const now = Date.now();
        if (data.action === "retry") {
          db.prepare(`
            UPDATE work_queue
            SET status = 'pending', claimed_by = NULL, lease_expires_at = NULL, error = NULL, updated_at = ?
            WHERE id = ?
          `).run(now, data.id);
        } else if (data.action === "fail") {
          db.prepare(`
            UPDATE work_queue
            SET status = 'failed', error = 'Cancelled via Dashboard', updated_at = ?
            WHERE id = ?
          `).run(now, data.id);
        } else if (data.action === "reprioritize") {
          db.prepare(`
            UPDATE work_queue
            SET priority = ?, updated_at = ?
            WHERE id = ?
          `).run(data.newPriority ?? 0, now, data.id);
        } else if (data.action === "delete") {
          db.prepare(`
            DELETE FROM work_queue WHERE id = ?
          `).run(data.id);
        }
        console.log(`[DASHBOARD] Executed action ${data.action} on work item ${data.id}`);
        return { success: true };
      } finally {
        db.close();
      }
    }
  );
