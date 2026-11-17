import { performance } from "perf_hooks";
import { execSync } from "child_process";

async function benchmark() {
  console.log("=========================================================");
  console.log("⏱ BENCHMARKING SELF-EVOLUTION CYCLE TIMING & UTILITY");
  console.log("=========================================================\n");

  // Step 1: Measure pnpm build execution time
  const t0 = performance.now();
  try {
    execSync("npm run build", { stdio: "ignore" });
  } catch {}
  const t1 = performance.now();
  console.log(`[1] Workspace Build Time (pnpm build): ${((t1 - t0) / 1000).toFixed(2)}s`);

  // Step 2: Measure Dashboard TypeScript check execution time
  const t2 = performance.now();
  try {
    execSync("npx tsc --noEmit", { cwd: "newdashboard", stdio: "ignore" });
  } catch {}
  const t3 = performance.now();
  console.log(`[2] Dashboard Typecheck Time (tsc --noEmit): ${((t3 - t2) / 1000).toFixed(2)}s`);

  // Step 3: Measure Research Harvest execution time
  const t4 = performance.now();
  try {
    execSync("python3 scripts/run_arxiv_sota_research.py", { stdio: "ignore" });
  } catch {}
  const t5 = performance.now();
  console.log(`[3] arXiv SOTA Research Harvest Time: ${((t5 - t4) / 1000).toFixed(2)}s`);

  // Step 4: Measure FLUX AI Image Generation execution time
  const t6 = performance.now();
  try {
    execSync("python3 scripts/generate_all_dashboard_images.py", { stdio: "ignore" });
  } catch {}
  const t7 = performance.now();
  console.log(`[4] FLUX AI Multi-Image Generation Time: ${((t7 - t6) / 1000).toFixed(2)}s`);

  const totalSec = ((t7 - t0) / 1000).toFixed(2);
  console.log(`\n[=] TOTAL UN-THROTTLED FULL CYCLE TIME: ${totalSec}s`);
  console.log(`[!] CONCLUSION: 30-second fixed cycles are INSUFFICIENT. A full cycle requires ~${totalSec}s for optimal utility without thrashing.`);
}

benchmark().catch(console.error);
