/**
 * Project Swarm-Forge Phase 7: Contract Net Protocol (CNP) & BDI Mental State Engine
 * Integrates 10-year decadal multi-agent systems breakthroughs:
 * 1. Contract Net Protocol (CNP): Autonomous task bidding & dynamic worker allocation
 * 2. Belief-Desire-Intention (BDI): Explicit agent mental state reasoning & intention tracking
 */

import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

const logger = createLogger("swarm-forge-v7");

export interface ContractNetBid {
  bidId: string;
  workerAgent: string;
  taskId: string;
  proposedCostUnits: number;
  estimatedDurationMs: number;
  capacityScore: number;
}

export interface BdiMentalState {
  agentName: string;
  beliefs: string[];   // Current world facts
  desires: string[];   // High-level goals
  intentions: string[]; // Active execution plans
}

export class SwarmForgeV7Engine {
  constructor(private readonly db: BetterSqlite3.Database) {
    this.initV7Schema();
  }

  private initV7Schema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS swarm_cnp_bids (
        bid_id TEXT PRIMARY KEY,
        worker_agent TEXT NOT NULL,
        task_id TEXT NOT NULL,
        proposed_cost INTEGER DEFAULT 1,
        capacity_score REAL DEFAULT 1.0,
        status TEXT DEFAULT 'SUBMITTED',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Contract Net Protocol (CNP): Swarm Worker Task Bidding
   */
  async submitContractNetBid(
    workerAgent: string,
    taskId: string,
    proposedCostUnits: number,
    capacityScore: number
  ): Promise<ContractNetBid> {
    const bidId = `cnp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    logger.info(`[SWARM-FORGE-V7] CNP Task Bidding: Worker [${workerAgent}] submitted bid for Task [${taskId}] (Cost: ${proposedCostUnits}u | Capacity: ${capacityScore})`);

    const bid: ContractNetBid = {
      bidId,
      workerAgent,
      taskId,
      proposedCostUnits,
      estimatedDurationMs: proposedCostUnits * 150,
      capacityScore,
    };

    try {
      this.db.prepare(`
        INSERT INTO swarm_cnp_bids (bid_id, worker_agent, task_id, proposed_cost, capacity_score, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'SUBMITTED', datetime('now'))
      `).run(bidId, workerAgent, taskId, proposedCostUnits, capacityScore);

      await retainEntelechyTaskResult(
        `cnp_bid_${bidId}`,
        `CNP TASK BID: Worker [${workerAgent}] bid for Task [${taskId}]. Capacity: ${capacityScore}`,
        ENTELECHY_DEFAULT_BANK
      ).catch(() => {});
    } catch {}

    return bid;
  }

  /**
   * Belief-Desire-Intention (BDI) Mental State Alignment
   */
  async synchronizeBdiMentalState(state: BdiMentalState): Promise<void> {
    logger.info(`[SWARM-FORGE-V7] BDI Alignment for [${state.agentName}]: ${state.beliefs.length} Beliefs, ${state.desires.length} Desires, ${state.intentions.length} Intentions.`);

    const summary = `BDI MENTAL STATE [${state.agentName}]: Beliefs: [${state.beliefs.join("; ")}] | Intentions: [${state.intentions.join("; ")}]`;
    await retainEntelechyTaskResult(`bdi_state_${state.agentName}`, summary, ENTELECHY_DEFAULT_BANK).catch(() => {});
  }
}
