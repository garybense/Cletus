/**
 * Verification Script: Work Queue Control Center Operations Test
 *
 * Tests enqueueing, reprioritizing, boosting to top, re-queuing, failing, and deleting
 * work items directly in the Work Queue pipeline.
 */

import Database from "better-sqlite3";
import path from "path";
import { enqueueWorkItemData, controlWorkItemData } from "../newdashboard/src/lib/cletus/server.js";

async function main() {
  console.log("=== WORK QUEUE CONTROL CENTER VERIFICATION SCRIPT ===");

  const dbPath = path.join(process.env.HOME || "/root", ".cletus", "state.db");
  const db = new Database(dbPath);

  // 1. Enqueue Test Item 1
  console.log("1. Testing Enqueue Work Item...");
  const enqueueResult1 = await enqueueWorkItemData({
    source: "test_suite",
    payloadStr: JSON.stringify({ task: "test_bounty_scan", param: "val1" }),
    acceptancePredicate: "result.success === true",
    priority: 25,
    spendBearing: true,
  });

  console.log(`   ✓ Enqueued item 1: ${enqueueResult1.id}`);

  // 2. Enqueue Test Item 2
  const enqueueResult2 = await enqueueWorkItemData({
    source: "test_suite",
    payloadStr: JSON.stringify({ task: "test_health_check" }),
    acceptancePredicate: "result.status === 'ok'",
    priority: 10,
    spendBearing: false,
  });

  console.log(`   ✓ Enqueued item 2: ${enqueueResult2.id}`);

  // 3. Test Move to Top
  console.log("\n2. Testing Move to Top (move_top)...");
  await controlWorkItemData({
    id: enqueueResult2.id,
    action: "move_top",
  });

  const row2AfterMove = db.prepare("SELECT priority FROM work_queue WHERE id = ?").get(enqueueResult2.id) as any;
  console.log(`   ✓ Item 2 Priority after move_top: ${row2AfterMove.priority} (boosted above item 1 priority of 25)`);
  if (row2AfterMove.priority <= 25) {
    throw new Error("move_top failed to boost priority above max!");
  }

  // 4. Test Reprioritize
  console.log("\n3. Testing Reprioritize (+15)...");
  await controlWorkItemData({
    id: enqueueResult1.id,
    action: "reprioritize",
    newPriority: 40,
  });

  const row1AfterReprioritize = db.prepare("SELECT priority FROM work_queue WHERE id = ?").get(enqueueResult1.id) as any;
  console.log(`   ✓ Item 1 Priority after reprioritize: ${row1AfterReprioritize.priority}`);
  if (row1AfterReprioritize.priority !== 40) {
    throw new Error("reprioritize failed to set new priority!");
  }

  // 5. Test Fail & Retry
  console.log("\n4. Testing Fail & Retry Lifecycle...");
  await controlWorkItemData({
    id: enqueueResult1.id,
    action: "fail",
  });

  const row1Failed = db.prepare("SELECT status FROM work_queue WHERE id = ?").get(enqueueResult1.id) as any;
  console.log(`   ✓ Item 1 Status after fail: ${row1Failed.status}`);
  if (row1Failed.status !== "failed") {
    throw new Error("fail action failed!");
  }

  await controlWorkItemData({
    id: enqueueResult1.id,
    action: "retry",
  });

  const row1Retried = db.prepare("SELECT status FROM work_queue WHERE id = ?").get(enqueueResult1.id) as any;
  console.log(`   ✓ Item 1 Status after retry: ${row1Retried.status}`);
  if (row1Retried.status !== "pending") {
    throw new Error("retry action failed!");
  }

  // 6. Test Clean-up (Delete)
  console.log("\n5. Testing Delete Cleanup...");
  await controlWorkItemData({ id: enqueueResult1.id, action: "delete" });
  await controlWorkItemData({ id: enqueueResult2.id, action: "delete" });

  const check1 = db.prepare("SELECT id FROM work_queue WHERE id = ?").get(enqueueResult1.id);
  const check2 = db.prepare("SELECT id FROM work_queue WHERE id = ?").get(enqueueResult2.id);

  if (check1 || check2) {
    throw new Error("Delete cleanup failed!");
  }
  console.log("   ✓ Test items successfully deleted.");

  console.log("\n=== ALL WORK QUEUE CONTROL CENTER TESTS PASSED SUCCESSFULLY ===");
}

main().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
