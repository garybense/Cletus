/**
 * Verification Script: Hardened Logging & Control Character Sanitization Test
 *
 * Validates that rawLog and system_logs strip control characters (\r, ANSI codes, null bytes),
 * that thought and tool levels are correctly classified, and that getSnapshotData() returns
 * a clean, non-vanishing log feed.
 */

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { rawLog, stripControlCharacters } from "../src/observability/raw-log.js";
import { getSnapshotData } from "../newdashboard/src/lib/cletus/server.js";

async function main() {
  console.log("=== LOG HARDENING VERIFICATION SCRIPT ===");

  // 1. Test Control Character Sanitizer
  const messyInput = "\x1b[31m\x1b[1m[THOUGHT] Turn 101: \rAnalyzing\r\n data...\x1b[0m\0";
  const cleaned = stripControlCharacters(messyInput);
  console.log("1. Sanitizer Test:");
  console.log("   Input:", JSON.stringify(messyInput));
  console.log("   Output:", JSON.stringify(cleaned));

  if (/\r|\x1b|[\x00-\x08]/.test(cleaned)) {
    throw new Error("Sanitizer failed to strip control characters!");
  }
  console.log("   ✓ Control character sanitization PASSED.");

  // 2. Inject Test Log Entries
  const testModule = "test-harness";
  const testThought = `[THOUGHT] Testing thought line classification ${Date.now()}`;
  const testTool = `[TOOL] exec({"command": "echo test"}) -> ok ${Date.now()}`;
  const testMessyErr = `\x1b[31m[ERROR] High severity test error with carriage return \r\n ${Date.now()}\x1b[0m`;

  rawLog(testModule, "THOUGHT", testThought);
  rawLog(testModule, "TOOL", testTool);
  rawLog(testModule, "ERROR", testMessyErr);

  // 3. Verify SQLite DB Storage
  const dbPath = path.join(process.env.HOME || "/root", ".cletus", "state.db");
  const db = new Database(dbPath);

  const rows = db.prepare(
    "SELECT * FROM system_logs WHERE module = 'test-harness' ORDER BY created_at DESC LIMIT 10"
  ).all() as any[];

  console.log(`\n2. SQLite system_logs Verification (${rows.length} rows inserted):`);
  let foundControlInDb = false;

  for (const r of rows) {
    if (/\r|\x1b/.test(r.message) || /\r|\x1b/.test(r.level) || /\r|\x1b/.test(r.module)) {
      foundControlInDb = true;
      console.error("   ❌ Control character leaked into DB row:", r);
    }
  }

  if (foundControlInDb) {
    throw new Error("Control characters found in system_logs database table!");
  }
  console.log("   ✓ SQLite system_logs table is 100% control-character free.");

  // 4. Verify Snapshot Ingestion & Classification
  console.log("\n3. Testing Snapshot Log Pipeline (getSnapshotData)...");
  const snapshot = await getSnapshotData();
  const snapshotLogs = snapshot.logs || [];

  console.log(`   Total Log Lines in Snapshot: ${snapshotLogs.length}`);
  const testHarnessLines = snapshotLogs.filter((l) => l.source === "test-harness" || l.message.includes("test-harness") || l.message.includes("Testing thought"));
  console.log("   Test harness lines found in snapshot:", JSON.stringify(testHarnessLines, null, 2));

  const thoughtLines = snapshotLogs.filter((l) => l.level === "thought");
  const toolLines = snapshotLogs.filter((l) => l.level === "tool");
  const errorLines = snapshotLogs.filter((l) => l.level === "error");

  console.log(`   - Thought lines classified: ${thoughtLines.length}`);
  console.log(`   - Tool lines classified: ${toolLines.length}`);
  console.log(`   - Error lines classified: ${errorLines.length}`);

  if (thoughtLines.length === 0) {
    throw new Error("No thought lines found in snapshot logs!");
  }
  if (toolLines.length === 0) {
    throw new Error("No tool lines found in snapshot logs!");
  }

  // Check 0 control characters in any snapshot line
  let controlInSnapshot = false;
  for (const l of snapshotLogs) {
    if (/\r|\x1b/.test(l.message)) {
      controlInSnapshot = true;
      console.error("   ❌ Control character leaked into snapshot line:", l);
      break;
    }
  }

  if (controlInSnapshot) {
    throw new Error("Control characters leaked into snapshot log output!");
  }

  console.log("   ✓ Snapshot pipeline classification & sanitization PASSED.");
  console.log("\n=== ALL LOG HARDENING VERIFICATION TESTS PASSED SUCCESSFULLY ===");
}

main().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
