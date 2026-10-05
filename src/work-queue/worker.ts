/**
 * Background Work Queue Worker Daemon
 *
 * Continuously polls state.db for pending work items, claims them,
 * executes them via bounded agent loop runs, and records completion state.
 */

import { claim, complete, fail } from "./queue.js";
import { executeWorkItem } from "./executor.js";
import type { WorkItem } from "./types.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("work-queue.worker");

export interface WorkerOptions {
  workerId?: string;
  pollIntervalMs?: number;
  leaseDurationMs?: number;
  maxTurnsPerItem?: number;
}

export class QueueWorkerDaemon {
  private workerId: string;
  private pollIntervalMs: number;
  private leaseDurationMs: number;
  private maxTurnsPerItem: number;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: WorkerOptions = {}) {
    this.workerId = options.workerId || `worker-${Math.random().toString(36).substring(2, 9)}`;
    this.pollIntervalMs = options.pollIntervalMs || 3000;
    this.leaseDurationMs = options.leaseDurationMs || 60000;
    this.maxTurnsPerItem = options.maxTurnsPerItem || 5;
  }

  /** Start the queue worker polling loop */
  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info(`Started Work Queue Worker Daemon [${this.workerId}]`);
    this.pollNext();
  }

  /** Stop the queue worker */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info(`Stopped Work Queue Worker Daemon [${this.workerId}]`);
  }

  /** Process one item if available */
  async processOne(): Promise<boolean> {
    try {
      const item = claim(this.workerId, this.leaseDurationMs);
      if (!item) return false;

      logger.info(`Claimed work item [${item.id}] source=${item.source} priority=${item.priority}`);

      const result = await executeWorkItem(item, {
        agentId: this.workerId,
        maxToolCallsPerInvocation: this.maxTurnsPerItem,
      });

      if (result.success) {
        const comp = complete(item.id, result);
        if (comp.success) {
          logger.info(`Completed work item [${item.id}] successfully`);
        } else {
          logger.warn(`Work item [${item.id}] execution finished but acceptance predicate failed`);
        }
      } else {
        fail(item.id, result.error || "Execution failed");
        logger.error(`Failed work item [${item.id}]: ${result.error}`);
      }

      return true;
    } catch (err: any) {
      logger.error(`Error processing work item: ${err?.message || String(err)}`);
      return false;
    }
  }

  private async pollNext(): Promise<void> {
    if (!this.running) return;

    const processed = await this.processOne();

    // If an item was processed, poll immediately for next; otherwise wait for pollInterval
    const nextInterval = processed ? 100 : this.pollIntervalMs;
    this.timer = setTimeout(() => this.pollNext(), nextInterval);
  }
}
