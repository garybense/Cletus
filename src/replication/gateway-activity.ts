/**
 * Gateway Activity Collector
 *
 * Answers "what are the workers actually doing?" from three read-only
 * OpenClaw surfaces, synced to KV so the dashboard can show live worker
 * activity with zero new remote calls (it rides the kv scan, like the
 * fleet census):
 *
 *   1. `openclaw logs --json`          — gateway log lines (RPC tail, poll mode)
 *   2. `openclaw sessions --all-agents --json` — per-agent conversation
 *      sessions with labels ("Automation: Memory Dreaming Promotion"), model,
 *      and recency — the honest answer for gateway-registered agents.
 *   3. Workspace activity sweep — for the 14 workspace-only children that are
 *      NOT registered on the gateway, one flat find over
 *      /home/debian/code/auto/*: the 3 most recently touched files each.
 *   4. Gateway file logs (`/tmp/openclaw/openclaw-<date>.log`) — FALLBACK
 *      ONLY, consulted when the RPC yields nothing (gateway down / RPC
 *      sick): the flushed NDJSON ground truth with true levels, read via
 *      plain SSH. House rule: the OpenClaw API is the preferred path; the
 *      SSH file read exists so a dead gateway still leaves its last words
 *      on the dashboard. `logSource` records which path fed the log.
 *
 * Every collector is fail-soft: failures degrade that section, never the sync.
 */

import path from "path";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("gateway.activity");

/** KV keys (dashboard consumption). */
export const GATEWAY_LOG_KV = "gateway_log";
export const GATEWAY_SESSIONS_KV = "gateway_sessions";

/** Gateway file logs on the remote host — ground truth when the RPC is sick. */
export const FILE_LOG_DIR = "/tmp/openclaw";

const AUTO_WORKSPACE_DIR = "/home/debian/code/auto";
const MAX_LOG_LINES = 200;
const MAX_TAIL_LINES = 3;
/** Cap the flat find output — plenty to cover every workspace's newest files. */
const MAX_WORKSPACE_FILES = 150;
/** Local wall-clock cap per collector — SSH stalls must never hang the heartbeat. */
const RUNNER_TIMEOUT_MS = 120_000;

/** Race a runner call against a local timeout (fail-soft, never throws). */
function withTimeout(
  p: Promise<{ stdout: string; stderr: string }>,
  label: string,
): Promise<{ stdout: string; stderr: string }> {
  return Promise.race([
    p,
    new Promise<{ stdout: string; stderr: string }>((resolve) =>
      setTimeout(() => resolve({ stdout: "", stderr: `${label}: local timeout after ${RUNNER_TIMEOUT_MS / 1000}s` }), RUNNER_TIMEOUT_MS),
    ),
  ]);
}

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

export interface GatewayLogLine {
  time: string;
  level: "info" | "warn" | "error";
  subsystem: string;
  message: string;
}

export interface GatewayAgentSession {
  agentId: string;
  sessionCount: number;
  lastLabel: string | null;
  lastAgeMs: number | null;
  lastUpdatedAt: number | null;
  model: string | null;
}

/**
 * Recent workspace activity for a workspace-only child. These workspaces
 * contain no log files — the honest signal is which files were touched most
 * recently (AGENTS.md, memory/, etc.) and how long ago.
 */
export interface WorkspaceTail {
  name: string;
  /** Up to 3 most recently modified files, newest first. */
  recent: Array<{ file: string; ageMs: number }>;
}

export interface GatewayActivity {
  syncedAt: string;
  log: GatewayLogLine[];
  logTruncated: boolean;
  /** Which path fed `log`: the OpenClaw API, the SSH file fallback, or neither. */
  logSource: "rpc" | "file" | "none";
  sessions: GatewayAgentSession[];
  workspaces: WorkspaceTail[];
  errors: string[];
}

export type RemoteRunner = (command: string) => Promise<{ stdout: string; stderr: string }>;

/* ------------------------------------------------------------------ */
/* Parsers (tolerant — the CLI may change shape; degradation beats crash) */
/* ------------------------------------------------------------------ */

/** Parse NDJSON `openclaw logs --json` output into normalized lines. */
export function parseGatewayLogs(stdout: string): { lines: GatewayLogLine[]; truncated: boolean } {
  const lines: GatewayLogLine[] = [];
  let truncated = false;
  for (const raw of stdout.split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    let obj: any;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (obj?.type === "notice") {
      if (/truncat/i.test(String(obj.message ?? ""))) truncated = true;
      continue;
    }
    if (obj?.type !== "log") continue;
    const level = obj.level === "error" ? "error" : obj.level === "warn" ? "warn" : "info";
    lines.push({
      time: String(obj.time ?? ""),
      level,
      subsystem: String(obj.subsystem ?? "gateway"),
      message: String(obj.message ?? ""),
    });
  }
  return { lines: lines.slice(-MAX_LOG_LINES), truncated };
}

/** Top-level `message` missing? Rebuild one from the numbered detail fields. */
function fileLogMessage(obj: any): string {
  const msg = obj?.message;
  if (typeof msg === "string" && msg.trim()) return msg;
  const parts: string[] = [];
  for (const key of ["1", "2"]) {
    const v = obj?.[key];
    if (typeof v === "string" && v.trim()) parts.push(v);
    else if (v && typeof v === "object" && typeof v.label === "string") parts.push(v.label);
  }
  return parts.join(" — ") || "(empty)";
}

/**
 * Parse the gateway's file-log NDJSON (`/tmp/openclaw/openclaw-<date>.log`):
 * `{time, message, _meta:{logLevelName, name:"{\"subsystem\":\"…\"}"}}` —
 * flushed ground truth with true levels, readable over plain SSH even when
 * the gateway RPC is unhealthy.
 */
export function parseFileLogNdjson(stdout: string): GatewayLogLine[] {
  const lines: GatewayLogLine[] = [];
  for (const raw of stdout.split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    let obj: any;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!obj || typeof obj !== "object" || obj.type) continue;
    const levelName = String(obj?._meta?.logLevelName ?? "INFO").toUpperCase();
    const subsystem = String(obj?._meta?.name ?? "").match(/"subsystem":"([^"]+)"/);
    lines.push({
      time: String(obj.time ?? ""),
      level:
        levelName === "ERROR" || levelName === "FATAL"
          ? "error"
          : levelName === "WARN"
            ? "warn"
            : "info",
      subsystem: subsystem ? subsystem[1] : "gateway",
      message: fileLogMessage(obj),
    });
  }
  return lines.slice(-MAX_LOG_LINES);
}

/** Parse `openclaw sessions --all-agents --json` into per-agent summaries. */
export function parseGatewaySessions(stdout: string): GatewayAgentSession[] {
  let doc: any;
  try {
    doc = JSON.parse(stdout);
  } catch {
    return [];
  }
  const sessions: any[] = Array.isArray(doc?.sessions) ? doc.sessions : [];
  const byAgent = new Map<string, GatewayAgentSession>();
  for (const s of sessions) {
    const agentId = String(s?.agentId ?? "unknown");
    const prev = byAgent.get(agentId);
    const updatedAt = typeof s?.updatedAt === "number" ? s.updatedAt : null;
    if (!prev) {
      byAgent.set(agentId, {
        agentId,
        sessionCount: 1,
        lastLabel: typeof s?.label === "string" ? s.label : null,
        lastUpdatedAt: updatedAt,
        lastAgeMs: typeof s?.ageMs === "number" ? s.ageMs : null,
        model: typeof s?.model === "string" ? s.model : null,
      });
    } else {
      prev.sessionCount += 1;
      if (updatedAt !== null && (prev.lastUpdatedAt === null || updatedAt > prev.lastUpdatedAt)) {
        prev.lastUpdatedAt = updatedAt;
        prev.lastLabel = typeof s?.label === "string" ? s.label : prev.lastLabel;
        prev.lastAgeMs = typeof s?.ageMs === "number" ? s.ageMs : prev.lastAgeMs;
        prev.model = typeof s?.model === "string" ? s.model : prev.model;
      }
    }
  }
  return [...byAgent.values()].sort((a, b) =>
    (a.lastUpdatedAt ?? 0) - (b.lastUpdatedAt ?? 0),
  );
}

/**
 * Parse the flat find output (`<epoch-mtime> <full-path>` lines, newest
 * first) into per-workspace buckets keyed by the path segment after
 * /code/auto/. Each bucket keeps its 3 newest files.
 */
export function parseWorkspaceTails(stdout: string): WorkspaceTail[] {
  const byWorkspace = new Map<string, WorkspaceTail>();
  const prefix = /\/code\/auto\/([^/]+)\//;
  for (const raw of stdout.split("\n")) {
    const line = raw.replace(/\r$/, "").trim();
    if (!line) continue;
    const file = line.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    if (!file) continue;
    const wsMatch = file[2].match(prefix);
    if (!wsMatch) continue;
    const name = wsMatch[1];
    let bucket = byWorkspace.get(name);
    if (!bucket) {
      bucket = { name, recent: [] };
      byWorkspace.set(name, bucket);
    }
    if (bucket.recent.length < MAX_TAIL_LINES) {
      const epoch = Number.parseFloat(file[1]);
      if (Number.isFinite(epoch)) {
        bucket.recent.push({
          file: path.basename(file[2].trim()),
          ageMs: Math.max(0, Date.now() - epoch * 1000),
        });
      }
    }
  }
  return [...byWorkspace.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ */
/* Collectors                                                          */
/* ------------------------------------------------------------------ */

// NOTE: runRemoteOrLocal already sources nvm.sh inside its SSH wrapper —
// commands passed here must be bare (no env sourcing), or the nested quote
// escaping collides and the remote command dies. The fleet-census collectors
// run through the same transport unwrapped.

const WRAPPER_NOTE =
  "Note: the openclaw CLI prints plugin/otel banners on stderr for some " +
  "subcommands; stdout JSON is the contract and stderr is ignored.";

/**
 * Build the workspace activity command — ONE flat find over all workspaces.
 * No shell substitution, no double quotes (the SSH transport escapes only
 * double quotes; $() nesting collides with its escaping). The output is
 * `<epoch-mtime> <full-path>` lines; the parser buckets by workspace from
 * the path. Single quotes only — they pass through the transport untouched.
 */
export function buildWorkspaceTailCommand(): string {
  return (
    `find ${AUTO_WORKSPACE_DIR} -type f -not -path '*node_modules*' ` +
    `-printf '%T@ %p\\n' 2>/dev/null | sort -rn | head -${MAX_WORKSPACE_FILES}`
  );
}

/**
 * Tail the newest gateway file logs. Both day-files are tailed and the merge
 * dedupes the overlap; `-q` suppresses tail's `==> file <==` headers. No
 * `$(date)` — that doesn't survive the SSH transport's escaping.
 */
export function buildFileLogTailCommand(): string {
  return `tail -qn ${MAX_LOG_LINES} ${FILE_LOG_DIR}/openclaw-*.log`;
}

/* ------------------------------------------------------------------ */
/* KV sync                                                             */
/* ------------------------------------------------------------------ */

/** Structural DB view (full CletusDatabase or the heartbeat raw adapter). */
export type GatewayActivityDb = {
  getKV(key: string): string | undefined;
  setKV(key: string, value: string): void;
};

export async function gatherGatewayActivity(
  runner: RemoteRunner,
): Promise<GatewayActivity> {
  const errors: string[] = [];

  // Sequential, not parallel: three simultaneous SSH sessions can trip the
  // host's sshd session limits (observed live: "Session open refused by peer").
  const run = async (cmd: string, label: string) =>
    withTimeout(
      runner(cmd).catch((e) => ({ stdout: "", stderr: String(e?.message ?? e) })),
      label,
    );

  // API-first (house rule: Cletus↔server communication stays on OpenClaw).
  // The file log is a FALLBACK for when the RPC yields nothing — gateway down
  // or RPC sick — exactly when the flushed file log is the only witness.
  const logsRes = await run(`timeout 60 openclaw logs --json --limit ${MAX_LOG_LINES} --plain 2>/dev/null`, "logs");
  if (!logsRes.stdout.trim()) errors.push(`logs: no output (${logsRes.stderr.slice(0, 120) || "empty"})`);
  const rpcLog = parseGatewayLogs(logsRes.stdout);

  let fileLines: GatewayLogLine[] = [];
  if (rpcLog.lines.length === 0) {
    const fileRes = await run(`${buildFileLogTailCommand()} 2>/dev/null`, "file logs");
    if (!fileRes.stdout.trim()) errors.push(`file logs: no output (${fileRes.stderr.slice(0, 120) || "empty"})`);
    fileLines = parseFileLogNdjson(fileRes.stdout);
  }

  const sessionsRes = await run(`timeout 30 openclaw sessions --all-agents --json --limit 50 2>/dev/null`, "sessions");
  const tailsRes = await run(`timeout 30 ${buildWorkspaceTailCommand()} 2>/dev/null`, "workspace tails");
  if (!sessionsRes.stdout.trim()) errors.push(`sessions: no output (${sessionsRes.stderr.slice(0, 120) || "empty"})`);
  if (!tailsRes.stdout.trim()) errors.push(`workspace tails: no output (${tailsRes.stderr.slice(0, 120) || "empty"})`);

  const merged: GatewayLogLine[] = [...rpcLog.lines, ...fileLines].sort((a, b) =>
    a.time.localeCompare(b.time),
  );
  const logSource: GatewayActivity["logSource"] =
    rpcLog.lines.length > 0 ? "rpc" : fileLines.length > 0 ? "file" : "none";

  const sessions = parseGatewaySessions(sessionsRes.stdout);
  const workspaces = parseWorkspaceTails(tailsRes.stdout);

  return {
    syncedAt: new Date().toISOString(),
    log: merged.slice(-MAX_LOG_LINES),
    logTruncated: rpcLog.truncated,
    logSource,
    sessions,
    workspaces,
    errors,
  };
}

export async function syncGatewayActivityToKV(
  db: GatewayActivityDb,
  runner: RemoteRunner,
): Promise<void> {
  try {
    const activity = await gatherGatewayActivity(runner);
    db.setKV(
      GATEWAY_LOG_KV,
      JSON.stringify({
        syncedAt: activity.syncedAt,
        lines: activity.log,
        truncated: activity.logTruncated,
        logSource: activity.logSource,
        errors: activity.errors.filter((e) => e.startsWith("logs") || e.startsWith("file")),
      }),
    );
    db.setKV(
      GATEWAY_SESSIONS_KV,
      JSON.stringify({
        syncedAt: activity.syncedAt,
        sessions: activity.sessions,
        workspaces: activity.workspaces,
        errors: activity.errors.filter((e) => !e.startsWith("logs") && !e.startsWith("file")),
      }),
    );
    logger.info(
      `gateway activity synced: ${activity.log.length} log lines, ` +
        `${activity.sessions.length} gateway agents, ${activity.workspaces.length} workspace tails`,
    );
  } catch (err: any) {
    logger.warn(`gateway activity sync failed: ${err?.message ?? err}`);
  }
}

export { WRAPPER_NOTE };
