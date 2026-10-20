// src/heartbeat/daemon.ts

import { DurableScheduler, TaskHandler, WorkHandler } from './scheduler.js';
import { registerBuiltinHeartbeatTasks } from './tasks.js';

export interface HeartbeatDaemonOptions {
  identity?: unknown;
  config?: unknown;
  heartbeatConfig?: unknown;
  db?: unknown;
  rawDb?: unknown;
  mindmods?: unknown;
  social?: unknown;
  onWakeRequest?: (reason: string) => void;
  tickIntervalMs?: number;
  workerId?: string;
}

export function createHeartbeatDaemon(options: HeartbeatDaemonOptions | number = 60000): HeartbeatDaemon {
  if (typeof options === 'number') {
    const daemon = new HeartbeatDaemon(options);
    registerBuiltinHeartbeatTasks(daemon.getScheduler());
    return daemon;
  }
  const tickIntervalMs = options.tickIntervalMs ?? 60000;
  const workerId = options.workerId ?? 'heartbeat-daemon';
  const daemon = new HeartbeatDaemon(tickIntervalMs, workerId);
  const db = options.rawDb || (options.db as any)?.raw || options.db;
  registerBuiltinHeartbeatTasks(daemon.getScheduler(), db);
  return daemon;
}

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
    this.scheduler.tick().catch((err: unknown) => {
      console.error('[HeartbeatDaemon] Initial tick error:', err);
    });

    this.intervalId = setInterval(() => {
      this.scheduler.tick().catch((err: unknown) => {
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
