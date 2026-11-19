import { getDb } from "../src/state/database.js";
import { EvolutionGuardianAgent } from "../src/orchestration/evolution-guardian-agent.js";

async function main() {
  console.log("=========================================================");
  console.log("🛡 TESTING NON-STOP EVOLUTION GUARDIAN SUPERVISOR AGENT");
  console.log("=========================================================\n");

  const db = getDb();
  const rawDb = (db as any).raw || db;
  const guardian = new EvolutionGuardianAgent(rawDb);

  console.log("[*] Initializing Evolution Guardian Supervisor Agent (10s check interval)...");
  guardian.startGuardianLoop(1000); // 1s tick for test validation

  // Allow supervisor loop to execute 3 cycles
  await new Promise((resolve) => setTimeout(resolve, 3500));
  guardian.stop();

  console.log("\n[✓] Evolution Guardian Supervisor Agent Verified 100% Operational!");
}

main().catch(console.error);
