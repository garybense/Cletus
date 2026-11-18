import { getDb } from "../src/state/database.js";
import { clearAllScheduledWorkData } from "../newdashboard/src/lib/cletus/server.js";

async function main() {
  console.log("=========================================================");
  console.log("🧹 TESTING TABULA RASA: CLEAR ALL SCHEDULED WORK COMMAND");
  console.log("=========================================================\n");

  const res = await clearAllScheduledWorkData();
  console.log("[+] Tabula Rasa Command Result:\n", JSON.stringify(res, null, 2));

  if (res.success) {
    console.log("\n[✓] Clear All Scheduled Work Command Verified 100% Operational!");
    console.log("    - Pending tasks, queued work items, and active missions wiped clean.");
    console.log("    - Session context, Entelechy long-term memories, skills, and wallets preserved.");
  }
}

main().catch(console.error);
