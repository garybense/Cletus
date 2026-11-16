import { SelfEvolutionEngine } from "../src/agent/self-evolution.js";

async function main() {
  console.log("[*] Testing Autonomous Self-Evolution Engine...");
  const engine = new SelfEvolutionEngine();
  const res = await engine.executeEvolutionCycle();
  console.log("[+] Self-Evolution Cycle Result:", JSON.stringify(res, null, 2));
}

main().catch(console.error);
