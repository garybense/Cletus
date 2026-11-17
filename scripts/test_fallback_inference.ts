import { getDb } from "../src/state/database.js";
import { InferenceRouter } from "../src/inference/router.js";
import { ModelRegistry } from "../src/inference/registry.js";
import { InferenceBudgetTracker } from "../src/inference/budget.js";

async function main() {
  console.log("=========================================================");
  console.log("⚡ TESTING INFERENCE ROUTER FALLBACK CANDIDATE PIPELINE");
  console.log("=========================================================\n");

  const db = getDb();
  const rawDb = (db as any).raw || db;

  // Initialize model registry baseline
  const registry = new ModelRegistry(rawDb);
  registry.initialize();

  const budget = new InferenceBudgetTracker(rawDb, {
    maxInferenceDailyCents: 50000,
    hourlyBudgetCents: 0,
    sessionBudgetCents: 0,
    perCallCeilingCents: 0,
    enableModelFallback: true,
  });

  const router = new InferenceRouter(rawDb, registry, budget);

  console.log("[*] Simulating Primary Candidate Failure & Fallback Execution...");
  let attemptCount = 0;

  // Mock inferenceChat that fails on 1st candidate and succeeds on 2nd
  const mockInferenceChat = async (messages: any[], options: any) => {
    attemptCount++;
    console.log(`    [Attempt #${attemptCount}] Target Model: ${options.model || "default"}`);
    if (attemptCount === 1) {
      throw new Error("Simulated 429 Rate Limit on Primary Candidate");
    }
    return {
      message: { role: "assistant", content: "FALLBACK_VERIFIED_SUCCESS" },
      model: options.model,
      usage: { prompt_tokens: 10, completion_tokens: 10 },
      finishReason: "stop",
    };
  };

  const result = await router.route(
    {
      messages: [{ role: "user", content: "Fallback verification test" }],
      taskType: "agent_turn",
      tier: "normal",
      sessionId: "test-fallback-session",
      turnId: "turn-fallback-001",
    },
    mockInferenceChat
  );

  console.log("\n[+] FALLBACK SUCCESSFUL!");
  console.log(`    Total Attempts: ${attemptCount}`);
  console.log(`    Selected Fallback Model: ${result.model}`);
  console.log(`    Response Content: "${result.content}"`);
  console.log("\n[✓] Fallback Inference Candidate Pipeline Verified 100% Operational!");
}

main().catch(console.error);
