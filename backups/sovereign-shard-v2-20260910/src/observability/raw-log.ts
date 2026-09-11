/**
 * Raw unified log appender
 *
 * Bulletproof plain-text log writer. Dumps everything to a dedicated
 * log file so the dashboard's /api/logs can read it regardless of
 * whatever sink/ANSI/JSON the structured logger is doing.
 *
 * Never throws — all errors are swallowed.
 */

import fs from "fs";
import path from "path";

let logFile: string | null = null;
let logFd: number | null = null;

export function initRawLog(logPath: string): void {
  try {
    logFile = logPath;
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    logFd = fs.openSync(logPath, "a");
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
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

/**
 * Write a raw plain-text line to the unified log file.
 * This is the permanent plain-text record the dashboard /api/logs reads.
 * stdout is handled by the caller (prettySink writes colored ANSI;
 * the log() helper in loop.ts writes plain to stdout via logger.info).
 * Never throws.
 */
export function rawLog(module: string, level: string, message: string): void {
  const line = `${now()} ${level.padEnd(5)} ${module.padEnd(14)} ${message}`;
  if (logFd !== null && logFile) {
    try {
      fs.writeSync(logFd, line + "\n");
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
