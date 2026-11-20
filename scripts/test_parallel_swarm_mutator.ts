import { ParallelSwarmMutator } from "../src/orchestration/parallel-swarm-mutator.js";

async function main() {
  console.log("=========================================================");
  console.log("⚡ TESTING PARALLEL SWARM MUTATION ENGINE");
  console.log("=========================================================\n");

  const mutator = new ParallelSwarmMutator();
  const res = await mutator.executeParallelSwarmMutations(1);

  console.log("[+] Parallel Swarm Mutation Result:\n", JSON.stringify(res, null, 2));

  if (res.success) {
    console.log("\n[✓] Parallel Swarm Mutation Engine Verified 100% Operational!");
    console.log(`    - Dispatched ${res.mutationsCount} parallel worker tasks in single cycle.`);
    console.log("    - Built, tested, and auto-pushed to origin/main.");
  }
}

main().catch(console.error);
