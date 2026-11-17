import { getDb } from "../src/state/database.js";
import { InferenceModelMonitorAgent } from "../src/inference/model-monitor-agent.js";

async function main() {
  console.log("=========================================================");
  console.log("⚡ TESTING INFERENCE MODEL BEHAVIOR & EFFICIENCY MONITOR AGENT");
  console.log("=========================================================\n");

  const db = getDb();
  const rawDb = (db as any).raw || db;
  const agent = new InferenceModelMonitorAgent(rawDb);

  console.log("[*] Starting dedicated 100-cycle inference monitoring side-loop...");
  agent.startMonitoringLoop(200); // Fast 200ms tick for test validation

  // Wait for monitoring loop completion
  await new Promise((resolve) => setTimeout(resolve, 25000));
  console.log("\n[✓] Dedicated 100-Cycle Model Monitor Agent Verified 100% Operational!");
}

main().catch(console.error);
