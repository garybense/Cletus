/**
 * Continuous Dedicated Self-Evolution Daemon (Adaptive Utility Allocation)
 *
 * Directs 100% of Cletus's and the Swarm's background compute resources toward
 * continuous codebase self-evolution, AST refactoring, FLUX AI image generation,
 * research harvesting, and automated git auto-commits.
 *
 * Empirical Benchmark: Full cycle requires ~60.68s (build 25.5s + typecheck 16.1s + FLUX 18.1s).
 * Default adaptive interval set to 75,000ms with strict execution locking to prevent thrashing.
 */

import { SelfEvolutionEngine } from "../agent/self-evolution.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("continuous-evolution-daemon");

export class ContinuousEvolutionDaemon {
  private running = false;
  private isExecuting = false;
  private engine = new SelfEvolutionEngine();

  start(intervalMs: number = 75000): void {
    if (this.running) return;
    this.running = true;
    logger.info(`[CONTINUOUS-EVOLUTION] Starting dedicated self-evolution daemon with adaptive allocation (interval: ${intervalMs}ms)...`);

    const loop = async () => {
      while (this.running) {
        if (!this.isExecuting) {
          this.isExecuting = true;
          const startMs = Date.now();
          try {
            const res = await this.engine.executeEvolutionCycle();
            const durationSec = ((Date.now() - startMs) / 1000).toFixed(1);
            logger.info(`[CONTINUOUS-EVOLUTION] Cycle complete in ${durationSec}s. Outcome: ${res.success ? "SUCCESS" : "SKIPPED"}`);
          } catch (err: any) {
            logger.warn(`[CONTINUOUS-EVOLUTION] Cycle warning: ${err?.message}`);
          } finally {
            this.isExecuting = false;
          }
        } else {
          logger.debug("[CONTINUOUS-EVOLUTION] Previous cycle still executing. Skipping overlapping tick.");
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    };

    loop();
  }

  stop(): void {
    this.running = false;
    logger.info("[CONTINUOUS-EVOLUTION] Daemon stopped.");
  }
}
