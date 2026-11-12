/**
 * Log dedupe tests — a repeated failure must collapse into a summarised line,
 * never flood the log.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { noteRepeat, resetDedupe, flushDedupe, setDedupeFlushHandler } from "../observability/log-dedupe.js";

beforeEach(() => {
  resetDedupe();
  delete process.env.CLETUS_LOG_DEDUPE_MAX;
  delete process.env.CLETUS_LOG_DEDUPE_WINDOW_MS;
});

afterEach(() => {
  resetDedupe();
  vi.useRealTimers();
});

describe("log-dedupe", () => {
  it("always emits info and debug lines", () => {
    for (let i = 0; i < 50; i++) {
      expect(noteRepeat("file", "info", "loop", "[WAKE UP] cletus is alive").emit).toBe(true);
    }
  });

  it("emits the first N identical warn/error lines, then suppresses", () => {
    for (let i = 0; i < 3; i++) {
      expect(noteRepeat("file", "error", "harness.base", "HTTPS required").emit).toBe(true);
    }
    for (let i = 0; i < 100; i++) {
      expect(noteRepeat("file", "error", "harness.base", "HTTPS required").emit).toBe(false);
    }
  });

  it("dedupes per module and per message, not globally", () => {
    expect(noteRepeat("file", "error", "mod.a", "boom").emit).toBe(true);
    expect(noteRepeat("file", "error", "mod.a", "boom").emit).toBe(true);
    expect(noteRepeat("file", "error", "mod.b", "boom").emit).toBe(true);
    expect(noteRepeat("file", "error", "mod.a", "different").emit).toBe(true);
  });

  it("flushes a summary for suppressed lines when the window closes", () => {
    vi.useFakeTimers();
    process.env.CLETUS_LOG_DEDUPE_MAX = "1";
    process.env.CLETUS_LOG_DEDUPE_WINDOW_MS = "1000";

    const summaries: Array<{ suppressed: number; message: string }> = [];
    setDedupeFlushHandler("file", (suppressed, sample) => {
      summaries.push({ suppressed, message: sample.message });
    });

    expect(noteRepeat("file", "error", "mod", "endpoint down").emit).toBe(true);
    for (let i = 0; i < 7; i++) {
      expect(noteRepeat("file", "error", "mod", "endpoint down").emit).toBe(false);
    }

    vi.advanceTimersByTime(1500);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].suppressed).toBe(7);
    expect(summaries[0].message).toBe("endpoint down");

    // A fresh window after the flush emits again.
    expect(noteRepeat("file", "error", "mod", "endpoint down").emit).toBe(true);
  });

  it("does not leave a timer running once everything has flushed", () => {
    vi.useFakeTimers();
    process.env.CLETUS_LOG_DEDUPE_MAX = "1";
    process.env.CLETUS_LOG_DEDUPE_WINDOW_MS = "1000";
    expect(noteRepeat("file", "error", "mod", "x").emit).toBe(true);
    for (let i = 0; i < 5; i++) noteRepeat("file", "error", "mod", "x");
    vi.advanceTimersByTime(5000);
    flushDedupe();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never throws", () => {
    setDedupeFlushHandler("file", () => {
      throw new Error("handler blew up");
    });
    expect(() => {
      for (let i = 0; i < 10; i++) noteRepeat("file", "error", "mod", "y");
      flushDedupe();
    }).not.toThrow();
  });
});
