// src/heartbeat/daemon.ts

import { DurableScheduler, TaskHandler, WorkHandler } from './scheduler';

export class HeartbeatDaemon {
  private scheduler: DurableScheduler;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private tickIntervalMs: number;

  constructor(tickIntervalMs = 60000, workerId = 'heartbeat-daemon') {
    this.tickIntervalMs = tickIntervalMs;
    this.scheduler = new DurableScheduler(workerId);
  }

  getScheduler(): DurableScheduler {
    return this.scheduler;
  }

  registerTask(type: string, handler: TaskHandler): void {
    this.scheduler.registerTask(type, handler);
  }

  registerWorkHandler(handler: WorkHandler): void {
    this.scheduler.registerWorkHandler(handler);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Run immediate first tick
    this.scheduler.tick().catch((err) => {
      console.error('[HeartbeatDaemon] Initial tick error:', err);
    });

    this.intervalId = setInterval(() => {
      this.scheduler.tick().catch((err) => {
        console.error('[HeartbeatDaemon] Tick error:', err);
      });
    }, this.tickIntervalMs);
  }

  stop(): void {
    if (!this.isRunning) return;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }
}
