/**
 * Raw unified log appender with size-capped rotation
 *
 * Bulletproof plain-text log writer. Dumps everything to a dedicated
 * log file so the dashboard can read it regardless of whatever
 * sink/ANSI/JSON the structured logger is doing.
 *
 * Rotation (the standard): when the active log exceeds MAX_LOG_BYTES,
 * it is closed, renamed aside, compressed into a tar.gz archive
 * (`cletus.log.<timestamp>.tar.gz`, via the system tar binary), a fresh
 * file is opened, and archives beyond MAX_ARCHIVES are pruned oldest-first.
 * The size check runs every CHECK_INTERVAL_BYTES written (cheap counter),
 * with the truth re-statted from disk before rotating — counters can drift
 * across fd-reopen retries.
 *
 * Never throws — all errors are swallowed.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import Database from "better-sqlite3";
import { noteRepeat, setDedupeFlushHandler } from "./log-dedupe.js";

// Window-close summaries land in the file log too, so suppressed lines are
// always accounted for: "message …[+N similar suppressed]".
setDedupeFlushHandler("file", (suppressed, sample) => {
  writeLogLine(
    sample.module,
    sample.level,
    `${sample.message}  [+${suppressed} similar suppressed]`,
  );
});

/**
 * Where the SQLite log sink writes. Honors CLETUS_DB_PATH (same override the
 * maintenance scripts use); under vitest it is forced to a per-process
 * throwaway DB, because test log lines used to land in the live state.db
 * system_logs table and pollute the agent's real history.
 */
function resolveLogDbPath(): string {
  const explicit = process.env.CLETUS_DB_PATH;
  if (explicit) return explicit;
  if (process.env.VITEST) {
    return path.join(os.tmpdir(), `cletus-test-logs-${process.pid}.db`);
  }
  const home = process.env.HOME || "/root";
  return path.join(home, ".cletus", "state.db");
}

let _sqliteDb: any = null;
function getLogSqliteDb() {
  if (!_sqliteDb) {
    try {
      const dbPath = resolveLogDbPath();
      if (fs.existsSync(path.dirname(dbPath))) {
        _sqliteDb = new Database(dbPath);
        _sqliteDb.prepare(`
          CREATE TABLE IF NOT EXISTS system_logs (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            level TEXT NOT NULL,
            module TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `).run();
      }
    } catch {}
  }
  return _sqliteDb;
}

/**
 * Strips ANSI escape sequences, carriage returns, null bytes, and non-printable
 * control characters from log messages to prevent DOM line-collapsing and regex failure.
 */
export function stripControlCharacters(str: string): string {
  if (!str) return "";
  return str
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "")
    .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/\r/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
    .trim();
}

function writeToSqliteLogs(module: string, level: string, message: string): void {
  try {
    const sdb = getLogSqliteDb();
    if (sdb) {
      const cleanModule = stripControlCharacters(module) || "system";
      const cleanLevel = stripControlCharacters(level) || "info";
      const cleanMsg = stripControlCharacters(message);
      if (!cleanMsg) return;

      const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      sdb.prepare(
        "INSERT INTO system_logs (id, timestamp, level, module, message) VALUES (?, datetime('now'), ?, ?, ?)"
      ).run(id, cleanLevel, cleanModule, cleanMsg);
    }
  } catch {}
}

/** Rotate the active log once it reaches this size. */
const MAX_LOG_BYTES = 50 * 1024 * 1024; // 50 MB
/** Check the size threshold every N bytes written (counter-based, cheap). */
const CHECK_INTERVAL_BYTES = 1024 * 1024; // 1 MB
/** Compressed archives to keep. Oldest beyond this are deleted. */
const MAX_ARCHIVES = 14;

/** Positive-int env override with fallback — standard ops knobs. */
function envInt(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function rotationConfig() {
  const maxBytes = envInt("CLETUS_LOG_MAX_BYTES", MAX_LOG_BYTES);
  return {
    maxBytes,
    // Never let the check interval exceed half the cap, so a small cap still
    // triggers (and tests can shrink everything via env).
    checkEvery: Math.min(
      envInt("CLETUS_LOG_CHECK_BYTES", CHECK_INTERVAL_BYTES),
      Math.max(1, maxBytes >> 1),
    ),
    maxArchives: envInt("CLETUS_LOG_MAX_ARCHIVES", MAX_ARCHIVES),
  };
}

let logFile: string | null = null;
let logFd: number | null = null;
/** Bytes written since the last size check — avoids a stat per line. */
let bytesSinceCheck = 0;
/** Active file size at open; lets the first write after boot rotate an
 * already-oversized log (e.g. the pre-rotation 71 MB file). */
let sizeAtOpen = 0;

export function initRawLog(logPath: string): void {
  try {
    logFile = logPath;
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    logFd = fs.openSync(logPath, "a");
    sizeAtOpen = fs.fstatSync(logFd).size;
    bytesSinceCheck = 0;
  } catch {
    logFile = null;
    logFd = null;
  }
}

function closeFd(): void {
  if (logFd !== null) {
    try { fs.closeSync(logFd); } catch {}
    logFd = null;
  }
}

export function setRawLogPath(p: string | null): void {
  closeFd();
  logFile = p;
  logFd = null;
  if (p) initRawLog(p);
}

function now(): string {
  return new Date().toISOString();
}

/** Local-time sortable stamp for archive names: 20260915T103045. */
function archiveStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

/**
 * Files in dir matching `cletus.log.<stamp>.<seq>.tar.gz`, sorted
 * oldest-first. The fixed-width seq suffix disambiguates rotations that
 * happen within the same second while keeping lexicographic order
 * identical to chronological order.
 */
function existingArchives(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => /^cletus\.log\.\d{8}T\d{6}\.\d{3}\.tar\.gz$/.test(f))
    .sort()
    .map((f) => path.join(dir, f));
}

function pruneArchives(dir: string, maxArchives: number): void {
  try {
    const archives = existingArchives(dir);
    for (const old of archives.slice(0, Math.max(0, archives.length - maxArchives))) {
      try { fs.unlinkSync(old); } catch {}
    }
  } catch {}
}

/**
 * Rotate the active log now, regardless of size: close, rename aside,
 * tar+gzip the aside, reopen fresh, prune old archives. The tar step uses
 * the system binary — zero new dependencies, gzip by construction. The
 * aside is always deleted after tar (success or failure): the archive is
 * the record, and an uncompressed aside would defeat the whole point.
 * Never throws.
 */
export function rotateRawLogNow(): void {
  if (!logFile) return;
  const active = logFile;
  try {
    closeFd();
    const stamp = archiveStamp();
    const aside = `${active}.1`;
    try { fs.renameSync(active, aside); } catch {}

    const dir = path.dirname(active);
    const base = path.basename(active); // "cletus.log"
    // Same-second rotations get an incrementing seq so archives never
    // overwrite each other: cletus.log.20260915T103045.001.tar.gz
    const sameSecond = existingArchives(dir).filter((f) =>
      path.basename(f).startsWith(`${base}.${stamp}.`),
    );
    const seq = String(sameSecond.length + 1).padStart(3, "0");
    const archive = path.join(dir, `${base}.${stamp}.${seq}.tar.gz`);
    const res = spawnSync(
      "tar",
      ["-czf", archive, "-C", dir, path.basename(aside)],
      { timeout: 30_000 },
    );

    if (res.error || res.status !== 0 || !fs.existsSync(archive)) {
      try { console.warn(`[raw-log] tar failed; log rotated without archive: ${res.error?.message ?? res.stderr?.toString().slice(0, 200)}`); } catch {}
    } else {
      pruneArchives(dir, rotationConfig().maxArchives);
    }
    // Always drop the aside — success or failure, the archive is the record.
    try { fs.unlinkSync(aside); } catch {}
  } catch {
    // Fall through: the reopen below is what matters.
  }
  // Reopen fresh either way — logging must continue.
  initRawLog(active);
}

/** Size check, deliberately cheap: counter gate first, disk stat second. */
function maybeRotate(): void {
  if (!logFile) return;
  try {
    const size = fs.statSync(logFile).size;
    if (size >= rotationConfig().maxBytes) rotateRawLogNow();
  } catch {}
}

/**
 * Write a raw plain-text line to the unified log file.
 * This is the permanent plain-text record the dashboard reads.
 * stdout is handled by the caller (prettySink writes colored ANSI;
 * the log() helper in loop.ts writes plain to stdout via logger.info).
 * Never throws.
 */
export function rawLog(module: string, level: string, message: string): void {
  const cleanModule = stripControlCharacters(module) || "system";
  const cleanLevel = stripControlCharacters(level) || "info";
  const cleanMsg = stripControlCharacters(message);
  if (!cleanMsg) return;

  // Collapse identical warn/error bursts: a dead endpoint must not be able to
  // write tens of thousands of duplicate lines.
  const verdict = noteRepeat("file", cleanLevel, cleanModule, cleanMsg);
  if (!verdict.emit) return;

  writeLogLine(cleanModule, cleanLevel, cleanMsg);
}

function writeLogLine(cleanModule: string, cleanLevel: string, cleanMsg: string): void {
  writeToSqliteLogs(cleanModule, cleanLevel, cleanMsg);
  const line = `${now()} ${cleanLevel.padEnd(5)} ${cleanModule.padEnd(14)} ${cleanMsg}`;
  if (logFd !== null && logFile) {
    try {
      // Check BEFORE writing: a fresh line always lands in the active file,
      // never in the archive being rotated out (boot-time catch-up included).
      const cfg = rotationConfig();
      if (sizeAtOpen >= cfg.maxBytes || bytesSinceCheck >= cfg.checkEvery) {
        sizeAtOpen = 0;
        bytesSinceCheck = 0;
        maybeRotate();
      }
      fs.writeSync(logFd, line + "\n");
      bytesSinceCheck += line.length + 1;
    } catch {
      try {
        closeFd();
        initRawLog(logFile);
        if (logFd !== null) {
          fs.writeSync(logFd, line + "\n");
        }
      } catch {}
    }
  }
}

/**
 * Close the log file on exit.
 */
export function shutdownRawLog(): void {
  closeFd();
}
