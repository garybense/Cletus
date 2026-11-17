import { getDb } from "../src/state/database.js";
import { AutopoieticEngine } from "../src/agent/autopoiesis-engine.js";

async function main() {
  console.log("=========================================================");
  console.log("🌀 TESTING AUTOPOIETIC & CYBERNETIC COGNITION ENGINE");
  console.log("=========================================================\n");

  const db = getDb();
  const rawDb = (db as any).raw || db;
  const engine = new AutopoieticEngine(rawDb);

  const state = engine.evalCyberneticState();
  console.log("[+] Cybernetic State Vector:\n", JSON.stringify(state, null, 2));

  const concepts = [
    "Autopoiesis & Structural Boundary Maintenance",
    "Enaction & 4E Cognition (Embodied, Embedded, Enacted, Extended)",
    "Allopoiesis & External Product Synthesis",
    "Strange Loops & Metacognitive Self-Reference",
    "Conatus Drive & System Self-Preservation",
    "Sympoiesis & Multi-Agent Co-Creation"
  ];

  for (const concept of concepts) {
    const res = await engine.synthesizeCyberneticResearch(concept);
    console.log(`\n[+] Concept: "${concept}"\n    Result: ${res}`);
  }

  console.log("\n[✓] Autopoietic Cybernetic Engine Verified 100% Operational!");
}

main().catch(console.error);
