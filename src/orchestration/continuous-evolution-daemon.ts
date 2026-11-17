/**
 * Continuous Dedicated Self-Evolution Daemon
 *
 * Runs non-stop 30-second cycles directing 100% of Cletus's and the Swarm's
 * background compute resources toward codebase self-evolution, AST refactoring,
 * research harvesting, and automated git auto-commits.
 */

import { SelfEvolutionEngine } from "../agent/self-evolution.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("continuous-evolution-daemon");

export class ContinuousEvolutionDaemon {
  private running = false;
  private engine = new SelfEvolutionEngine();

  start(intervalMs: number = 30000): void {
    if (this.running) return;
    this.running = true;
    logger.info(`[CONTINUOUS-EVOLUTION] Starting dedicated 100% resource self-evolution daemon (interval: ${intervalMs}ms)...`);

    const loop = async () => {
      while (this.running) {
        try {
          await this.engine.executeEvolutionCycle();
        } catch (err: any) {
          logger.warn(`[CONTINUOUS-EVOLUTION] Cycle warning: ${err?.message}`);
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
