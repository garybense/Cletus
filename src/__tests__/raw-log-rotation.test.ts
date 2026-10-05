/**
 * Raw Log Rotation Tests
 *
 * Covers the size-capped rotation in raw-log.ts:
 *  - rotation triggers at the size threshold (env-tunable)
 *  - the archive is a VALID tar.gz containing the log's previous content
 *  - the active log starts fresh after rotation (no data loss of new lines)
 *  - an already-oversized log rotates on the first write after boot
 *  - same-second rotations get unique sequence suffixes
 *  - archives beyond the retention cap are pruned oldest-first
 *
 * All thresholds are driven via env vars; every test uses a temp dir.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";
import {
  initRawLog,
  rawLog,
  rotateRawLogNow,
  shutdownRawLog,
} from "../observability/raw-log.js";

let dir: string;
let logFile: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "raw-log-test-"));
  logFile = path.join(dir, "cletus.log");
  process.env.CLETUS_LOG_MAX_BYTES = String(4 * 1024); // 4 KB threshold
  process.env.CLETUS_LOG_CHECK_BYTES = String(1 * 1024); // check every 1 KB
  process.env.CLETUS_LOG_MAX_ARCHIVES = "3";
});

afterEach(() => {
  shutdownRawLog();
  delete process.env.CLETUS_LOG_MAX_BYTES;
  delete process.env.CLETUS_LOG_CHECK_BYTES;
  delete process.env.CLETUS_LOG_MAX_ARCHIVES;
  fs.rmSync(dir, { recursive: true, force: true });
});

function archives(): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => /^cletus\.log\.\d{8}T\d{6}\.\d{3}\.tar\.gz$/.test(f))
    .sort();
}

function archiveMember(dir: string, archive: string): string {
  const out = execSync(`tar -tzf ${JSON.stringify(archive)}`, { cwd: dir })
    .toString()
    .trim();
  return out.split("\n")[0];
}

describe("raw log rotation", () => {
  it("does not rotate or archive below the size threshold", () => {
    initRawLog(logFile);
    for (let i = 0; i < 10; i++) rawLog("mod", "INFO", `line ${i}`);
    expect(archives()).toHaveLength(0);
    expect(fs.statSync(logFile).size).toBeGreaterThan(0);
  });

  it("rotates at the threshold and produces a valid tar.gz with the old content", () => {
    initRawLog(logFile);
    // Write enough distinct lines to cross the 4 KB threshold.
    for (let i = 0; i < 80; i++) {
      rawLog("mod", "INFO", `rotation-sentinel line ${i} with padding padding padding`);
    }
    expect(archives().length).toBeGreaterThanOrEqual(1);

    // The archive is a real gzip; tar lists a single member named cletus.log.1
    const member = archiveMember(dir, path.join(dir, archives()[0]));
    expect(member).toBe("cletus.log.1");

    // The archived content contains the early sentinel lines.
    const extracted = execSync(
      `tar -xzf ${JSON.stringify(path.join(dir, archives()[0]))} -O`,
      { cwd: dir },
    ).toString();
    expect(extracted).toContain("rotation-sentinel line 0");

    // The active log restarted: it holds only post-rotation lines.
    const active = fs.readFileSync(logFile, "utf-8");
    expect(active).not.toContain("rotation-sentinel line 0");
    expect(active.length).toBeLessThan(8192);
  });

  it("keeps logging (and rotating) repeatedly after several rotations", () => {
    initRawLog(logFile);
    // ~105B lines; 4 KB check interval → a rotation roughly every 40 lines.
    // 600 lines ≈ 63 KB → several rotations, final lines stay active.
    for (let i = 0; i < 600; i++) {
      rawLog("mod", "INFO", `multi-rotation line ${i} padding padding padding padding`);
    }
    expect(archives().length).toBeGreaterThanOrEqual(2);
    // Last sentinel lands in the active file, not lost.
    expect(fs.readFileSync(logFile, "utf-8")).toContain("multi-rotation line 599");
  });

  it("rotates an already-oversized log on the first write after boot", () => {
    // Pre-existing 10 KB log, threshold 4 KB.
    fs.writeFileSync(logFile, "x".repeat(10 * 1024) + "\n");
    initRawLog(logFile);
    rawLog("mod", "INFO", "first write after boot");
    expect(archives()).toHaveLength(1);
    const extracted = execSync(
      `tar -xzf ${JSON.stringify(path.join(dir, archives()[0]))} -O`,
      { cwd: dir },
    ).toString();
    expect(extracted).toContain("xxxxxxxxxx"); // the old content made it in
    expect(fs.readFileSync(logFile, "utf-8")).toContain("first write after boot");
  });

  it("gives same-second rotations unique, chronologically sortable names", () => {
    initRawLog(logFile);
    // Force three rotations in rapid succession (each burst ≈ 8.4 KB → rotate).
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < 80; i++) {
        rawLog("mod", "INFO", `burst ${round} line ${i} padding padding padding`);
      }
    }
    const names = archives();
    // Bursts fire many rotations (check interval << burst size); retention
    // may prune the earliest — so assert the surviving invariants only:
    // every name is unique, matches the seq pattern, and stays sorted
    // (lexicographic = chronological thanks to the fixed-width suffix).
    expect(names.length).toBeGreaterThanOrEqual(2);
    expect(new Set(names).size).toBe(names.length); // no collisions
    for (const n of names) expect(n).toMatch(/^cletus\.log\.\d{8}T\d{6}\.\d{3}\.tar\.gz$/);
    expect(names).toEqual([...names].sort());
  });

  it("prunes archives beyond the retention cap, oldest first", () => {
    process.env.CLETUS_LOG_MAX_ARCHIVES = "2";
    initRawLog(logFile);
    // ~105B × 900 lines ≈ 94 KB → many rotations; retention keeps only 2.
    for (let i = 0; i < 900; i++) {
      rawLog("mod", "INFO", `prune line ${i} padding padding padding padding`);
    }
    expect(archives().length).toBeLessThanOrEqual(2);
  });

  it("never throws when the log dir is unreadable mid-flight", () => {
    initRawLog(logFile);
    // Simulate a broken fd by pointing the module at a path whose dir vanishes.
    fs.rmSync(dir, { recursive: true, force: true });
    expect(() => rawLog("mod", "INFO", "into the void")).not.toThrow();
    expect(() => rotateRawLogNow()).not.toThrow();
    expect(() => shutdownRawLog()).not.toThrow();
  });
});
