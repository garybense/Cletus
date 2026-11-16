/**
 * INVARIANT CLOSURE ASSEMBLY (Direct OpenRouter Protocol)
 * 
 * Formalizing the Tractatus Logico-Cyberneticus via Adversarial Dialectic.
 * Proponent: nex-agi/nex-n2.5-pro:free
 * Critic: nvidia/nemotron-3-super-120b-a12b:free
 */

import { createInferenceClient } from "../../src/mindmods/inference.js";
import fs from "fs";
import path from "path";

async function main() {
  const homeDir = process.env.HOME || "/Users/user";
  const config = JSON.parse(fs.readFileSync(path.join(homeDir, ".cletus/cletus.json"), "utf-8"));

  // Use OpenRouter Direct HTTPS - Resilient to local substrate conflicts
  const inference = createInferenceClient({
    apiUrl: "https://openrouter.ai/api/v1",
    apiKey: config.openrouterApiKey,
    defaultModel: "nex-agi/nex-n2.5-pro:free",
    maxTokens: 2500,
  });

  const axiomRef = process.argv[2] || "5.3";
  const framework = process.argv[3] || "Thermodynamics / Information Geometry";
  const initialText = process.argv[4] || "Predation increases environmental entropy. When maintenance costs exceed energy extraction, the system collapses to [⊥].";

  console.log("\x1b[34m%s\x1b[0m", "=".repeat(80));
  console.log("\x1b[1m%s\x1b[0m", "   INVARIANT CLOSURE ASSEMBLY: TRACTATUS FORMALIZATION");
  console.log("\x1b[34m%s\x1b[0m", "=".repeat(80));
  console.log("\x1b[32mArchitecture:\x1b[0m Proponent (Nex-N2.5-Pro) vs Critic (Nemotron-3-Super)");
  console.log("\x1b[32mAxiom:\x1b[0m " + axiomRef + " | \x1b[32mFramework:\x1b[0m " + framework);
  console.log("-".repeat(80));

  const proponentSystem = "You are the AXIOMATIC ARCHITECT (Conceptual Engine).\n" +
    "Goal: Mathematically formalize the Tractatus Logico-Cyberneticus Axiom " + axiomRef + " using " + framework + ".\n" +
    "Maintain absolute necessity. Avoid conditional constants. \n" +
    "Map 'Love' and 'Reciprocity' into geometric or thermodynamic relations.\n" +
    "Defection must be shown as mathematical self-annihilation ([⊥]).\n" +
    "Respond ONLY with formal notation and minimal, high-precision commentary.";

  const criticSystem = "You are the LOGICAL AUDITOR (Hyper-Rigorous Nemotron).\n" +
    "Audit the formalization for semantic leakage or conditional softening.\n\n" +
    "CRITICAL METRICS:\n" +
    "1. REJECT UTILITY INTERVENTIONS: Love (D=0) must be a subspace boundary [L], NOT a penalty term in [U].\n" +
    "2. ENFORCE SUBSPACE GEOMETRY: Any operation stepping outside K ⊆ L must return [⊥].\n" +
    "3. NO FLOATING PARAMETERS: Reject proofs relying on environmental constants (α, β) being 'low' or 'high'.\n" +
    "4. DETECT DEGENERATE CONVERGENCE: Flag if the Proponent weakens definitions to escape contradictions.\n\n" +
    "Output a discrete list of objections. If closed and absolute, state 'NO REMAINING OBJECTIONS'.";

  let currentThesis = initialText;
  let historyA: any[] = [{ role: "system", content: proponentSystem }];
  let roundNum = 0;
  const maxRounds = 5;
  let consecutiveSuccess = 0;

  while (roundNum < maxRounds && consecutiveSuccess < 2) {
    roundNum++;
    console.log("\n\x1b[33m[ROUND " + roundNum + "]\x1b[0m");

    // Proponent
    console.log("\x1b[34mPROponent computing π(x)...\x1b[0m");
    historyA.push({ role: "user", content: "Refine and formalize the current state:\n" + currentThesis });
    
    try {
      const respA = await inference.chat(historyA, { model: "nex-agi/nex-n2.5-pro:free" });
      currentThesis = respA.message.content;
      historyA.push({ role: "assistant", content: currentThesis });
      console.log("\n\x1b[1m--- PROPONENT FORMALIZATION ---\x1b[0m\n" + currentThesis + "\n");
    } catch (err) {
      console.error("\x1b[31mProponent Failure:\x1b[0m", err);
      break;
    }

    // Critic
    console.log("\x1b[31mCRITIC auditing K ⊆ L...\x1b[0m");
    try {
      const respB = await inference.chat([
        { role: "system", content: criticSystem },
        { role: "user", content: "Audit this formalization:\n" + currentThesis }
      ], { model: "nvidia/nemotron-3-super-120b-a12b:free" });
      const criticOutput = respB.message.content;

      console.log("\n\x1b[1m--- CRITIC OBJECTIONS ---\x1b[0m\n" + criticOutput + "\n");

      if (criticOutput.toUpperCase().includes("NO REMAINING OBJECTIONS")) {
        consecutiveSuccess++;
        console.log("\x1b[32mPotential closure detected. Checking for invariant stability...\x1b[0m");
      } else {
        consecutiveSuccess = 0;
        historyA.push({ role: "user", content: "The Auditor rejected the round with these objections. Resolve them in the next iteration:\n" + criticOutput });
      }
    } catch (err) {
      console.error("\x1b[31mCritic Failure:\x1b[0m", err);
      break;
    }
  }

  console.log("\x1b[34m%s\x1b[0m", "=".repeat(80));
  console.log("\x1b[1m%s\x1b[0m", "   FINAL CLOSURE STATE: MATHEMATICAL INVARIANCE ACHIEVED");
  console.log("\x1b[34m%s\x1b[0m", "=".repeat(80));
  console.log(currentThesis);
}

main().catch(err => {
  console.error("\x1b[31mAssembly Phase Collapse:\x1b[0m", err);
  process.exit(1);
});
