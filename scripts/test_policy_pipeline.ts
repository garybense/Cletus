import { getDb } from "../src/state/database.js";
import { PolicyControlEngine } from "../src/agent/policy-control.js";

async function main() {
  console.log("[*] Executing 4-Stage Policy Control Pipeline...");
  const db = getDb();
  const engine = new PolicyControlEngine(db.raw);

  const activePolicy = await engine.runPipeline(
    "verification_cycle_001",
    "Verified Stage A Feature Extraction, Stage B Policy Synthesis, Stage C Inertia Control, and Stage D Outcome Writeback."
  );

  console.log("[+] Active Policy Result:", JSON.stringify(activePolicy, null, 2));
}

main().catch(console.error);
