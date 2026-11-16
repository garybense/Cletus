/**
 * CRDT State Synchronizer for Distributed Swarm Nodes
 *
 * Inspired by Ruflo / Claude-Flow v3 crdt-synchronizer.md.
 * Ensures conflict-free state convergence across distributed cluster worker nodes.
 */

import { createLogger } from "../observability/logger.js";

const logger = createLogger("orchestration.crdt-sync");

export interface LWWRegister<T> {
  value: T;
  timestamp: number;
  nodeId: string;
}

export class CRDTSwarmState {
  private registers = new Map<string, LWWRegister<any>>();
  private nodeId: string;

  constructor(nodeId: string = "cletus-primary") {
    this.nodeId = nodeId;
  }

  /**
   * Set a register value using Last-Write-Wins (LWW) semantics.
   */
  set<T>(key: string, value: T, timestamp: number = Date.now()): void {
    const existing = this.registers.get(key);
    if (!existing || timestamp > existing.timestamp || (timestamp === existing.timestamp && this.nodeId > existing.nodeId)) {
      this.registers.set(key, { value, timestamp, nodeId: this.nodeId });
      logger.debug(`CRDT: Updated register "${key}" to value from node ${this.nodeId} at ts ${timestamp}`);
    }
  }

  /**
   * Get a register value.
   */
  get<T>(key: string): T | undefined {
    return this.registers.get(key)?.value;
  }

  /**
   * Merge state from another node using LWW conflict resolution.
   */
  merge(incomingState: Array<{ key: string; value: any; timestamp: number; nodeId: string }>): void {
    for (const item of incomingState) {
      const existing = this.registers.get(item.key);
      if (!existing || item.timestamp > existing.timestamp || (item.timestamp === existing.timestamp && item.nodeId > existing.nodeId)) {
        this.registers.set(item.key, {
          value: item.value,
          timestamp: item.timestamp,
          nodeId: item.nodeId,
        });
        logger.debug(`CRDT: Merged remote register "${item.key}" from node ${item.nodeId}`);
      }
    }
  }

  /**
   * Export state snapshot for broadcast to peer swarm nodes.
   */
  exportState(): Array<{ key: string; value: any; timestamp: number; nodeId: string }> {
    const snapshot: Array<{ key: string; value: any; timestamp: number; nodeId: string }> = [];
    for (const [key, reg] of this.registers.entries()) {
      snapshot.push({
        key,
        value: reg.value,
        timestamp: reg.timestamp,
        nodeId: reg.nodeId,
      });
    }
    return snapshot;
  }
}
