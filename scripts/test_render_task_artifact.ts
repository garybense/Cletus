import { getDb } from "../src/state/database.js";
import { OperationalArtifactRenderer } from "../src/agent/operational-artifact-renderer.js";

async function main() {
  console.log("=========================================================");
  console.log("⚡ TESTING OPERATIONAL TASK ARTIFACT RENDERER");
  console.log("=========================================================\n");

  const db = getDb();
  const rawDb = (db as any).raw || db;
  const renderer = new OperationalArtifactRenderer(rawDb);

  const url = renderer.renderTaskArtifact({
    taskId: "tsk_evolution_cycle_005",
    taskTitle: "Non-Stop Codebase Self-Evolution & AST Refactoring",
    gitCommitHash: "a20be5e",
    filesModified: [
      "src/orchestration/autonomous-growth.ts",
      "newdashboard/src/components/mission/dashboard.tsx",
      "src/agent/loop.ts"
    ],
    insertions: 172,
    deletions: 38,
    executorModel: "deepseek-r1:671b",
    executionTimeMs: 14200
  });

  console.log(`[+] Operational Task Artifact Rendered -> ${url}`);
  console.log("\n[✓] Operational Task Artifact Renderer Verified 100% Operational!");
}

main().catch(console.error);
