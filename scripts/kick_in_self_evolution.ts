import { SelfEvolutionEngine } from "../src/agent/self-evolution.js";

async function main() {
  console.log("=========================================================");
  console.log("⚡ KICKING IN SELF-EVOLVING MULTIAGENT SYSTEM");
  console.log("=========================================================\n");

  const engine = new SelfEvolutionEngine();
  const res = await engine.executeEvolutionCycle();
  console.log("[+] Self-Evolution Cycle Result:", JSON.stringify(res, null, 2));
  console.log("\n[✓] Self-evolving multiagent system is fully active and operational!");
}

main().catch(console.error);
