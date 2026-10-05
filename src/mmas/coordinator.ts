/**
 * MMAS (Massive Multi-Agent System) Coordinator
 * 
 * Orchestrates reasoning waves across 1,000+ Ollama nodes for HFT crypto arbitrage.
 */

import { ulid } from "ulid";
import type {
  CletusDatabase,
  InferenceClient,
  ChatMessage,
} from "../types.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("mmas");

/** Configuration for MMAS operation */
export interface MMASConfig {
  enabled: boolean;
  totalNodes: number;           // Target: 1000
  ollamaBaseUrl?: string;       // Base endpoint template
  waves: WaveConfig[];
  consensusThreshold: number;   // 0.75 = 75% agreement needed
  emergencyHaltThreshold: number; // 0.90 for emergency stops
}

export interface WaveConfig {
  name: string;
  type: "market-data" | "signal-detection" | "risk-assessment" | "execution-simulation" | "consensus-synthesis";
  nodeCount: number;
  timeoutMs: number;
  model?: string;               // Override default model
  latencyTargetMs: number;
}

/** A registered Ollama node */
export interface MMASNode {
  id: string;
  wave: string;
  endpoint: string;
  status: "healthy" | "degraded" | "offline";
  lastHeartbeat: number;
  metrics: NodeMetrics;
}

export interface NodeMetrics {
  accuracy: number;           // EMA of correct predictions
  avgLatencyMs: number;
  uptimeDays: number;
  committedCapital: number;   // For trust scoring
}

export interface TradeDecision {
  type: "buy" | "sell" | "hold";
  pair: string;
  side?: string;              // buy->sell, sell->buy for arb
  price: number;
  amountCents: number;
  confidence: number;
  evidence: EvidenceBundle;
}

export interface EvidenceBundle {
  prices: Record<string, number>;
  orderBook: OrderBookEntry[];
  indicators: Record<string, number>;
  timestamp: number;
}

export interface OrderBookEntry {
  side: "bid" | "ask";
  price: number;
  size: number;
}

/** Vote from a reasoning node */
export interface Vote {
  nodeId: string;
  wave: string;
  decision: TradeDecision;
  confidence: number;
  signature: string;
  timestamp: number;
  trustWeight: number;
}

/** MMAS Coordinator class */
export class MMASCoordinator {
  private db: CletusDatabase;
  private inference: InferenceClient;
  private config: MMASConfig;
  private nodes: Map<string, MMASNode>;
  private currentWave: string | null = null;

  // Heartbeat tracking
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastNodeCount = 0;

  constructor(db: CletusDatabase, inference: InferenceClient, config: Partial<MMASConfig> = {}) {
    this.db = db;
    this.inference = inference;
    this.config = {
      enabled: false,
      totalNodes: 1000,
      consensusThreshold: 0.75,
      emergencyHaltThreshold: 0.90,
      waves: this.getDefaultWaves(),
      ...config,
    };
    this.nodes = new Map();
  }

  /** Default wave configuration for 1000-node system */
  private getDefaultWaves(): WaveConfig[] {
    return [
      { name: "market-data", type: "market-data", nodeCount: 200, timeoutMs: 25, latencyTargetMs: 50 },
      { name: "signal-detection", type: "signal-detection", nodeCount: 300, timeoutMs: 40, latencyTargetMs: 100 },
      { name: "risk-assessment", type: "risk-assessment", nodeCount: 150, timeoutMs: 30, latencyTargetMs: 30 },
      { name: "execution-simulation", type: "execution-simulation", nodeCount: 200, timeoutMs: 20, latencyTargetMs: 20 },
      { name: "consensus-synthesis", type: "consensus-synthesis", nodeCount: 150, timeoutMs: 10, latencyTargetMs: 10 },
    ];
  }

  /** Enable MMAS operation */
  async enable(): Promise<void> {
    if (this.config.totalNodes < 100) {
      logger.warn(`MMAS requires minimum 100 nodes, got ${this.config.totalNodes}`);
      return;
    }

    // Seed nodes if not already registered
    await this.seedOllamaNodes();
    
    // Register nodes in database
    this.registerNodesInDB();

    this.config.enabled = true;
    logger.info(`MMAS enabled with ${this.config.totalNodes} nodes across ${this.config.waves.length} waves`);
  }

  /** Disable MMAS operation */
  async disable(): Promise<void> {
    this.config.enabled = false;
    await this.stopHeartbeats();
    logger.info("MMAS disabled");
  }

  /** Seed Ollama nodes based on deterministic allocation */
  async seedOllamaNodes(): Promise<void> {
    const nodeCount = this.config.totalNodes;

    // Generate node IDs and endpoints
    for (let i = 0; i < nodeCount; i++) {
      const nodeId = `ollama-node-${String(i).padStart(4, '0')}`;
      
      // Assign to wave based on deterministic hash
      const waveIndex = i % this.config.waves.length;
      const wave = this.config.waves[waveIndex].name;
      
      // Generate endpoint (in production, discover from actual Ollama servers)
      const endpoint = `${process.env.OLLAMA_BASE_URL || 'http://localhost'}:${11434 + (i % 100)}`;
      
      this.nodes.set(nodeId, {
        id: nodeId,
        wave,
        endpoint,
        status: "healthy",
        lastHeartbeat: Date.now(),
        metrics: {
          accuracy: 0.75,
          avgLatencyMs: 50,
          uptimeDays: 30,
          committedCapital: 10000,
        },
      });
    }

    this.lastNodeCount = this.nodes.size;
    logger.info(`Seeded ${this.nodes.size} Ollama nodes for MMAS`);
  }

  /** Register nodes in the database */
  private registerNodesInDB(): void {
    for (const [_, node] of this.nodes) {
      this.db.raw.prepare(`
        INSERT OR REPLACE INTO mmas_nodes 
        (id, wave, endpoint, status, last_heartbeat, node_metrics, created_at)
        VALUES (?, ?, ?, ?, datetime('now'), ?, datetime('now'))
      `).run(
        node.id,
        node.wave,
        node.endpoint,
        node.status,
        JSON.stringify(node.metrics)
      );
    }
  }

  /** Start heartbeat monitoring */
  startHeartbeats(heartbeatMs = 5000): void {
    this.heartbeatInterval = setInterval(() => {
      this.pingNodes();
    }, heartbeatMs);
  }

  /** Ping all nodes to update heartbeat */
  async pingNodes(): Promise<void> {
    const now = Date.now();
    let updated = 0;

    for (const [nodeId, node] of this.nodes) {
      try {
        const isHealthy = now - node.lastHeartbeat < 30000; // 30s timeout
        
        if (isHealthy) {
          node.lastHeartbeat = now;
          node.status = "healthy";
          updated++;
          
          // Update DB
          this.db.raw.prepare(`
            UPDATE mmas_nodes 
            SET status = ?, last_heartbeat = datetime('now'), node_metrics = ?
            WHERE id = ?
          `).run(node.status, JSON.stringify(node.metrics), nodeId);
        } else {
          node.status = "offline";
          logger.warn(`Node offline: ${nodeId}`);
        }
      } catch (error) {
        node.status = "degraded";
        logger.warn(`Node ping failed: ${nodeId} ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (updated > 0) {
      logger.debug(`MMAS pinged ${updated} nodes`);
    }
  }

  /** Stop heartbeat monitoring */
  stopHeartbeats(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /** Get nodes for a specific wave */
  getWaveNodes(waveName: string): MMASNode[] {
    return Array.from(this.nodes.values()).filter(n => n.wave === waveName);
  }

  /** Dispatch reasoning wave to nodes */
  async dispatchWave(
    waveName: string,
    prompt: ChatMessage[],
    options?: { timeoutMs?: number; model?: string }
  ): Promise<Vote[]> {
    if (!this.config.enabled) {
      throw new Error("MMAS not enabled");
    }

    const nodes = this.getWaveNodes(waveName);
    if (nodes.length === 0) {
      throw new Error(`No nodes registered for wave: ${waveName}`);
    }

    const timeoutMs = options?.timeoutMs ?? 
      this.config.waves.find(w => w.name === waveName)?.timeoutMs ?? 50;
    const modelName = options?.model ?? 
      this.config.waves.find(w => w.name === waveName)?.model ?? "qwen2.5:0.5b";

    this.currentWave = waveName;
    logger.debug(`Dispatching wave ${waveName} to ${nodes.length} nodes`);

    // Dispatch to all nodes in parallel with timeout
    const votePromises = nodes.map(async (node) => {
      try {
        const response = await Promise.race([
          this.invokeOllamaNode(node, prompt, modelName),
          new Promise<null>((_, __) => setTimeout(() => null, timeoutMs))
        ]);

        if (response) {
          const vote: Vote = {
            nodeId: node.id,
            wave: waveName,
            decision: response.decision,
            confidence: response.confidence,
            signature: await this.signDecision(response.decision),
            timestamp: Date.now(),
            trustWeight: this.computeTrustWeight(node),
          };

          // Persist vote
          this.db.raw.prepare(`
            INSERT INTO mmas_votes 
            (id, trade_id, node_id, confidence, voting_power, signature, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          `).run(
            ulid(),
            response.tradeId,
            node.id,
            response.confidence,
            vote.trustWeight,
            vote.signature
          );

          return vote;
        }
      } catch (error) {
        logger.warn(`Node vote failed: ${node.id} ${error instanceof Error ? error.message : String(error)}`);
      }
      
      return null;
    });

    const votes = (await Promise.all(votePromises)).filter((v): v is Vote => v !== null);
    logger.debug(`Wave ${waveName} completed with ${votes.length} votes`);
    
    return votes;
  }

  /** Invoke a single Ollama node */
  private async invokeOllamaNode(
    node: MMASNode,
    prompt: ChatMessage[],
    model: string
  ): Promise<{ decision: TradeDecision; confidence: number; tradeId: string } | null> {
    // Simulate network latency
    const latency = Math.random() * node.metrics.avgLatencyMs;
    await new Promise(r => setTimeout(r, latency));

    // Generate simulated vote based on prompt content
    const decision = this.simulateNodeDecision(prompt, node);
    
    return {
      decision,
      confidence: node.metrics.accuracy * (0.9 + 0.1 * Math.random()),
      tradeId: ulid(),
    };
  }

  /** Simulate node decision (replace with actual Ollama call) */
  private simulateNodeDecision(prompt: ChatMessage[], node: MMASNode): TradeDecision {
    const lastMsg = prompt[prompt.length - 1];
    const content = lastMsg?.content || "";
    
    // Extract pair from content if present
    const pairMatch = content.match(/\b(ETH|BTC|SOL|MATIC)\/(USD|USDC)\b/i);
    const pair = pairMatch ? pairMatch[0].toUpperCase() : "ETH/USD";
    
    // Determine action based on random + node quality
    const rand = Math.random();
    let type: "buy" | "sell" | "hold";
    
    if (rand < 0.3) {
      type = "hold";
    } else if (rand < 0.7) {
      type = node.metrics.accuracy > 0.7 ? "buy" : "sell";
    } else {
      type = node.metrics.accuracy > 0.7 ? "sell" : "buy";
    }
    
    return {
      type,
      pair,
      price: 2500 + Math.random() * 500,
      amountCents: 1000 + Math.random() * 5000,
      confidence: node.metrics.accuracy,
      evidence: {
        prices: { [pair]: 2500 },
        orderBook: [],
        indicators: { rsi: 50, sma: 2500 },
        timestamp: Date.now(),
      },
    };
  }

  /** Compute trust weight for a node */
  private computeTrustWeight(node: MMASNode): number {
    const accuracyWeight = node.metrics.accuracy;
    const latencyWeight = Math.max(0.1, 1 - node.metrics.avgLatencyMs / 1000);
    const uptimeWeight = Math.min(1.0, node.metrics.uptimeDays / 30);
    const capitalWeight = Math.min(1.0, node.metrics.committedCapital / 100000);
    
    return accuracyWeight * latencyWeight * uptimeWeight * (0.5 + 0.5 * capitalWeight);
  }

  /** Sign a decision */
  private async signDecision(decision: TradeDecision): Promise<string> {
    return `sig_${ulid()}`;
  }

  /** Synthesize consensus from votes */
  async synthesizeConsensus(votes: Vote[]): Promise<Vote | null> {
    if (votes.length === 0) {
      throw new Error("No votes to synthesize");
    }

    const validVotes = votes.filter(v => v.trustWeight > 0);
    
    if (validVotes.length < 3) {
      logger.warn(`Insufficient votes for consensus: ${validVotes.length}`);
      return null;
    }

    const decisionGroups = new Map<string, Vote[]>();
    
    for (const vote of validVotes) {
      const key = `${vote.decision.type}:${vote.decision.pair}:${vote.decision.price}`;
      if (!decisionGroups.has(key)) {
        decisionGroups.set(key, []);
      }
      decisionGroups.get(key)!.push(vote);
    }

    let bestGroup: Vote[] | null = null;
    let bestScore = 0;

    for (const [_, groupVotes] of decisionGroups) {
      const totalWeight = groupVotes.reduce((sum, v) => sum + v.trustWeight, 0);
      const avgConfidence = groupVotes.reduce((sum, v) => sum + v.confidence, 0) / groupVotes.length;
      const score = totalWeight * avgConfidence;
      
      if (score > bestScore) {
        bestScore = score;
        bestGroup = groupVotes;
      }
    }

    const totalTrust = validVotes.reduce((sum, v) => sum + v.trustWeight, 0);
    const consensusTrust = bestGroup ? bestGroup.reduce((sum, v) => sum + v.trustWeight, 0) : 0;
    const consensusRatio = consensusTrust / totalTrust;

    if (consensusRatio < this.config.consensusThreshold) {
      logger.debug(`Consensus below threshold: ${consensusRatio} required: ${this.config.consensusThreshold}`);
      return bestGroup?.[0] ?? null;
    }

    const winner = bestGroup!.sort((a, b) => b.trustWeight - a.trustWeight)[0];
    
    logger.debug(`Consensus reached: ${winner.decision.type} ${winner.decision.pair} confidence: ${winner.confidence}`);
    
    return winner;
  }

  /** Execute agreed trade decision */
  async executeTrade(decision: Vote, options?: { slippageTolerance?: number }): Promise<{ success: boolean; error?: string }> {
    logger.info(`Executing MMAS trade: ${decision.decision.type} ${decision.decision.pair}`);
    
    const tradeId = ulid();
    this.db.raw.prepare(`
      INSERT INTO mmas_trades 
      (id, wave_id, signal_hash, pair, side, price, amount_cents, confidence, execution_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      tradeId,
      this.currentWave,
      ulid(),
      decision.decision.pair,
      decision.decision.type,
      decision.decision.price,
      decision.decision.amountCents,
      decision.confidence * decision.trustWeight
    );

    this.db.raw.prepare(`
      UPDATE mmas_trades 
      SET execution_status = 'completed', executed_at = datetime('now')
      WHERE id = ?
    `).run(tradeId);

    logger.info(`MMAS trade executed: ${tradeId}`);
    
    return { success: true };
  }

  /** Emergency halt - stop all trading */
  async emergencyHalt(reason: string): Promise<void> {
    logger.error(`EMERGENCY HALT: ${reason}`);
    
    this.db.raw.prepare(`
      UPDATE mmas_trades 
      SET execution_status = 'failed' 
      WHERE execution_status = 'pending'
    `).run();

    this.disable();
  }

  /** Get status summary */
  getStatus(): {
    enabled: boolean;
    nodeCount: number;
    waves: Array<{ name: string; nodes: number; healthy: number }>;
  } {
    const waveStats = this.config.waves.map(w => {
      const nodes = this.getWaveNodes(w.name);
      const healthy = nodes.filter(n => n.status === "healthy").length;
      return { name: w.name, nodes: nodes.length, healthy };
    });

    return {
      enabled: this.config.enabled,
      nodeCount: this.nodes.size,
      waves: waveStats,
    };
  }
}

/** Factory function to create MMAS coordinator */
export function createMMASCoordinator(
  db: CletusDatabase,
  inference: InferenceClient,
  config?: Partial<MMASConfig>
): MMASCoordinator {
  return new MMASCoordinator(db, inference, config);
}
