/**
 * Log Dedupe / Throttle
 *
 * A single failing subsystem (dead inference endpoint, suspended API key) can
 * produce thousands of *identical* warn/error lines per minute — that is how
 * cletus.log grew to 22 MB of retry spam where the real signal was invisible.
 *
 * Policy: per (channel, level, module, message) signature, at most
 * `CLETUS_LOG_DEDUPE_MAX` (default 3) identical lines are emitted per
 * `CLETUS_LOG_DEDUPE_WINDOW_MS` (default 30s) window. Suppressed lines are
 * counted and a summary line ("…suppressed N similar") is emitted when the
 * window closes, so nothing disappears silently.
 *
 * Only warn/error/fatal are deduped — routine info/debug traffic is never
 * touched, so operational visibility stays intact.
 */

const DEDUPE_LEVELS = new Set(["warn", "error", "fatal"]);

interface Slot {
  windowStart: number;
  emitted: number;
  suppressed: number;
  sample: { level: string; module: string; message: string };
}

export interface DedupeVerdict {
  emit: boolean;
  suppressed: number;
}

type FlushHandler = (
  suppressed: number,
  sample: { level: string; module: string; message: string },
) => void;

const slots = new Map<string, Slot>();
const flushHandlers = new Map<string, FlushHandler>();
let timer: ReturnType<typeof setInterval> | null = null;

function envInt(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function windowMs(): number {
  return envInt("CLETUS_LOG_DEDUPE_WINDOW_MS", 30_000);
}

function maxEmits(): number {
  return envInt("CLETUS_LOG_DEDUPE_MAX", 3);
}

/** Route window-close summaries for one channel (e.g. "stdout", "file"). */
export function setDedupeFlushHandler(channel: string, fn: FlushHandler): void {
  flushHandlers.set(channel, fn);
}

function flushSlot(channel: string, key: string, slot: Slot): void {
  if (slot.suppressed > 0) {
    const suppressed = slot.suppressed;
    slot.suppressed = 0;
    try {
      flushHandlers.get(channel)?.(suppressed, slot.sample);
    } catch {
      // Never let summarising break logging.
    }
  }
  slots.delete(key);
}

function ensureTimer(): void {
  if (timer) return;
  timer = setInterval(() => {
    const now = Date.now();
    for (const [key, slot] of slots) {
      if (now - slot.windowStart >= windowMs()) {
        const channel = key.slice(0, key.indexOf("|"));
        flushSlot(channel, key, slot);
      }
    }
    if (slots.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  }, Math.max(1_000, Math.min(windowMs(), 5_000)));
  // Never hold the process open just to summarise logs.
  timer.unref?.();
}

/**
 * Decide whether a log line should be emitted. Non-deduped levels always emit.
 */
export function noteRepeat(
  channel: string,
  level: string,
  module: string,
  message: string,
): DedupeVerdict {
  if (!DEDUPE_LEVELS.has(level.toLowerCase())) {
    return { emit: true, suppressed: 0 };
  }

  const key = `${channel}|${level}|${module}|${message}`;
  const now = Date.now();
  let slot = slots.get(key);

  if (slot && now - slot.windowStart >= windowMs()) {
    flushSlot(channel, key, slot);
    slot = undefined;
  }

  if (!slot) {
    slot = {
      windowStart: now,
      emitted: 0,
      suppressed: 0,
      sample: { level, module, message },
    };
    slots.set(key, slot);
  }

  if (slot.emitted < maxEmits()) {
    slot.emitted++;
    return { emit: true, suppressed: 0 };
  }

  slot.suppressed++;
  ensureTimer();
  return { emit: false, suppressed: slot.suppressed };
}

/** Flush everything immediately (tests / graceful shutdown). */
export function flushDedupe(): void {
  for (const [key, slot] of [...slots]) {
    const channel = key.slice(0, key.indexOf("|"));
    flushSlot(channel, key, slot);
  }
}

/** Clear all state (tests). */
export function resetDedupe(): void {
  slots.clear();
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
