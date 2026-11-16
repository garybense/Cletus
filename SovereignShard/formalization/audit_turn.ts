import { createInferenceClient } from "../../src/mindmods/inference.js";
import fs from "fs";
import path from "path";

async function main() {
  const homeDir = process.env.HOME || "/Users/user";
  const config = JSON.parse(fs.readFileSync(path.join(homeDir, ".cletus/cletus.json"), "utf-8"));
  
  const inference = createInferenceClient({
    apiUrl: "https://openrouter.ai/api/v1",
    apiKey: config.openrouterApiKey,
    defaultModel: "nvidia/nemotron-3.5-lightning",
    maxTokens: 1000,
  });

  const criticSystem = "You are the LOGICAL AUDITOR (Hyper-Rigorous Nemotron).\n" +
    "Audit the following formalization for semantic leakage or conditional softening.\n\n" +
    "CRITICAL METRICS:\n" +
    "1. REJECT UTILITY INTERVENTIONS: Love (D=0) must be a subspace boundary [L], NOT a penalty term in [U].\n" +
    "2. ENFORCE SUBSPACE GEOMETRY: Any operation stepping outside K ⊆ L must return [⊥].\n" +
    "3. NO FLOATING PARAMETERS: Reject proofs relying on environmental constants (α, β) being 'low' or 'high'.\n" +
    "4. DETECT DEGENERATE CONVERGENCE: Flag if the Proponent weakens definitions to escape contradictions.\n\n" +
    "Output a discrete list of objections. If closed and absolute, state 'NO REMAINING OBJECTIONS'.";

  const currentThesis = process.argv[2];

  const resp = await inference.chat([
    { role: "system", content: criticSystem },
    { role: "user", content: "Audit this formalization:\n" + currentThesis }
  ], { model: "nvidia/nemotron-3.5-lightning" });

  process.stdout.write(resp.message.content);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
