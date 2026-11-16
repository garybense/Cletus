# Massive Multi-Agent System (MMAS) Harness Architecture
## Orchestrating 1,000+ Ollama Nodes for Real-Time Quantitative Trading

**Status:** Design Document  
**Created:** 2024  
**Target:** Cletus Dashboard Integration (Port 18888)

---

## Executive Summary

This document defines a highly-parallel, low-latency multi-agent orchestration system for coordinated crypto arbitrage across 1,000+ Ollama nodes. The architecture integrates with Cletus's existing wallet/trading infrastructure while leveraging the OpenClaw spawning model.

---

## 1. Distributed Reasoning Waves

### 1.1 Wave Architecture

**ReasoningWave** = Parallel market analysis pipeline across N Ollama nodes.

```
┌─────────────────────────────────────────────────────────────────┐
│                     MMAS Coordinator                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Wave Scheduler (Deterministic hash → Node mapping)        │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┐             │  │
│  │  │ Wave 1: ETH/USD │  │ Wave 2: BTC/USD │  │  ...N      │  │
│  │  │ Nodes: 0-199    │  │ Nodes: 200-399 │  │            │  │
│  │  └─────────────────┘  └─────────────────┘  │             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                          │                                          │
│                          ▼                                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           Results Aggregator & Sovereign Consensus          │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Node Allocation Strategy

**Deterministic Wave Partitioning:**
- Each trading pair gets a dedicated wave
- Nodes allocated via `hash(pair) % totalNodes`
- Example: 1,000 nodes → 5 pairs × 200 nodes each

**Node Identity Format:**
```
olas://ollama-node-{wave-id}-{node-index}.mindmods.org:11434
olas://ollama-node-mm-arb-0001.mindmods.org:11434
```

### 1.3 Wave Types

| Wave Type | Nodes | Latency Target | Purpose |
|-----------|-------|----------------|---------|
| Market Data | 200 | <50ms | Price feeds, order book snapshots |
| Signal Detection | 300 | <100ms | Momentum, mean-reversion, volatility |
| Risk Assessment | 150 | <30ms | Position sizing, drawdown limits |
| Execution Simulation | 200 | <20ms | Slippage modeling, gas estimation |
| Consensus Synthesis | 150 | <10ms | Vote aggregation, decision synthesis |

---

## 2. Sovereign Consensus Mechanism

### 2.1 Byzantine Fault-Tolerant Voting

**Weighted Scoring Algorithm:**

```typescript
interface AgentVote {
  nodeId: string;
  wave: string;
  decision: TradeDecision;
  confidence: number;  // 0.0 - 1.0
  evidenceHash: string; // Merkle root of supporting data
  signature: string;    // Ed25519 or EIP-712
}

function synthesizeConsensus(votes: AgentVote[]): TradeDecision {
  // 1. Validate signatures (reject invalid)
  const validVotes = votes.filter(validateVote);
  
  // 2. Compute weighted score
  const scores = validVotes.map(v => ({
    ...v,
    weightedConfidence: v.confidence * computeTrustWeight(v.nodeId)
  }));
  
  // 3. Apply quadratic voting for high-stakes decisions
  const consensus = scores.reduce((acc, v) => {
    const weight = Math.pow(v.weightedConfidence, 2);
    acc[v.decision.type] = (acc[v.decision.type] || 0) + weight;
    return acc;
  }, {} as Record<string, number>);
  
  // 4. Select winning decision (must exceed threshold)
  const winner = Object.entries(consensus)
    .sort((a, b) => b[1] - a[1])[0];
  
  return winner ? winners.decision : null;
}
```

### 2.2 Trust Weight Computation

**Factors:**
- Historical accuracy (EMA of correct predictions)
- Response latency (penalize slow votes)
- Node health (restarts, failures in last 24h)
- Stake weight (capital committed to this wave)

```typescript
function computeTrustWeight(nodeId: string): number {
  const history = db.nodeHistory(nodeId);
  const accuracy = ema(history.correct / history.total, 0.9);
  const latencyPenalty = Math.exp(-avgLatencyMs / 100);
  const healthFactor = uptimeDays > 7 ? 1.0 : 0.5;
  const stakeWeight = Math.min(1.0, committedCapital / 10000);
  
  return accuracy * latencyPenalty * healthFactor * (0.5 + 0.5 * stakeWeight);
}
```

### 2.3 Confidence Thresholds

| Decision Type | Required Confidence | Votes Needed |
|---------------|---------------------|--------------|
| Market Snapshot | 0.95 | 80% |
| Arbitrage Signal | 0.90 | 75% |
| Execution Order | 0.85 | 70% |
| Emergency Halt | 0.99 | 90% + creator signature |

---

## 3. Latency Optimization

### 3.1 High-Frequency Crypto Arbitrage Pipeline

**End-to-End Latency Budget:** 100ms

```
┌─────────────────┬─────────────────┬──────────┐
│ Component       │ Latency Target  │ Priority │
├─────────────────┼─────────────────┼──────────┤
│ Market Data →   │ < 25ms          │ Critical │
│ Ollama Nodes    │                 │          │
├─────────────────┼─────────────────┼──────────┤
│ Reasoning Waves │ < 40ms          │ High     │
├─────────────────┼─────────────────┼──────────┤
│ Consensus       │ < 20ms          │ High     │
├─────────────────┼─────────────────┼──────────┤
│ Wallet/Simulate │ < 10ms          │ Critical │
├─────────────────┼─────────────────┼──────────┤
│ Submission      │ < 5ms           │ Critical │
└─────────────────┴─────────────────┴──────────┘
```

### 3.2 Ollama Optimization Techniques

**Connection Pooling:**
```typescript
// Pre-warmed HTTP connections to each Ollama node
const ollamaPool = new Map<string, Pool>();
// Keep-alive enabled, max 100 concurrent per node
```

**Batching Signals:**
- Nodes batch 10-50 signals before processing
- Reduces network overhead by 80%

**Streaming Responses:**
- Use `/api/generate` with `stream: true`
- Begin reasoning as soon as first token arrives
- Parallel deserialize between waves

**Model Selection:**
- Use lightweight models for signal detection (e.g., `qwen2.5:0.5b`)
- Reserve large models for consensus synthesis
- Auto-switch based on survival tier

### 3.3 Memory Optimization

```typescript
// Shared memory regions for market data
const sharedMarketData = new SharedArrayBuffer(10 * 1024 * 1024); // 10MB
const view = new DataView(sharedMarketData);

// Lock-free ring buffer for trades
const tradeRing = new RingBuffer<TradeSignal>(10000);
```

---

## 4. Cletus Integration

### 4.1 Database Schema Extensions

**Add to `~/.cletus/state.db`:**

```sql
-- MMAS Ollama node registry
CREATE TABLE mmas_nodes (
  id TEXT PRIMARY KEY,           -- ollama-node-mm-arb-0001
  wave TEXT NOT NULL,           -- market-data, signal-detection, etc.
  endpoint TEXT NOT NULL,       -- http://node.mindmods.org:11434
  status TEXT DEFAULT 'healthy', -- healthy, degraded, offline
  last_heartbeat TIMESTAMP,
  node_metrics TEXT,            -- JSON: {accuracy, latencyMs, ...}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mmas_trades (
  id TEXT PRIMARY KEY,
  wave_id TEXT,
  signal_hash TEXT,             -- Merkle root of supporting evidence
  pair TEXT,                    -- ETH/USD, BTC/USD, etc.
  side TEXT,                      -- buy, sell
  price REAL,
  amount_cents INTEGER,
  confidence REAL,
  execution_status TEXT,          -- pending, executing, completed, failed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  executed_at TIMESTAMP
);

CREATE TABLE mmas_votes (
  id TEXT PRIMARY KEY,
  trade_id TEXT REFERENCES mmas_trades(id),
  node_id TEXT REFERENCES mmas_nodes(id),
  confidence REAL,
  voting_power REAL,
  signature TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mmas_market_snapshots (
  id TEXT PRIMARY KEY,
  pair TEXT,
  prices_json TEXT,             -- {bid: 3500.50, ask: 3500.52, ...}
  orderbook_64 TEXT,            -- Compressed top 64 orders
  ts TIMESTAMP,
  wave_hashes TEXT              -- Which waves processed this snapshot
);
```

### 4.2 Cletus Wallet Integration

**Trading Tool Extension:**

```typescript
// Extend /src/tools/financial.ts

export interface MMASArbitrageResult {
  opportunityId: string;
  pair: string;
  path: string[];           // Routes through exchanges
  grossProfitCents: number;
  netProfitCents: number;   // After fees, slippage, gas
  confidence: number;
  executionDelayMs: number;
  executionId?: string;     // If executed
}

async function executeMMASArbitrage(
  db: CletusDatabase,
  mindmods: MindmodsClient,
  args: {
    opportunity: MMASArbitrageResult;
    maxSlippage: number;     // 0.001 = 0.1%
    gasLimit: number;
  }
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const { opportunity, maxSlippage, gasLimit } = args;
  
  // 1. Verify still viable (time-sensitive)
  const currentPrices = await fetchCurrentPrices(opportunity.pair);
  if (!verifyOpportunity(opportunity, currentPrices, maxSlippage)) {
    return { success: false, error: "Opportunity stale" };
  }
  
  // 2. Build transaction
  const tx = buildArbitrageTx({
    pair: opportunity.pair,
    path: opportunity.path,
    amountCents: opportunity.netProfitCents,
    gasLimit,
    slippageTolerance: maxSlippage
  });
  
  // 3.Simulate
  const simulation = await simulateTransaction(tx);
  if (simulation.gasEstimate > gasLimit) {
    return { success: false, error: "Gas estimate exceeds limit" };
  }
  
  // 4. Submit via Cletus wallet
  const result = await mindmods.submitTransaction({
    ...tx,
    chain: db.getIdentity("chainType") || "eip155:8453",
    description: `MMAS Arbitrage: ${opportunity.pair}`
  });
  
  // 5. Record in state
  db.raw.prepare(`
    INSERT INTO mmas_trades 
    (id, wave_id, pair, side, price, amount_cents, confidence, execution_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    opportunity.opportunityId,
    'arbitrage',
    opportunity.pair,
    'buy' + opportunity.path.join('->sell'),
    currentPrices.mid,
    opportunity.netProfitCents,
    opportunity.confidence,
    result.success ? 'completed' : 'failed'
  );
  
  return result;
}
```

### 4.3 Dashboard API Extensions

**Add to `server.ts`:**

```typescript
export interface MMASWaveStatus {
  wave: string;
  nodesTotal: number;
  nodesHealthy: number;
  nodesDegraded: number;
  avgLatencyMs: number;
  consensusConfidence: number;
  activeOpportunities: MMASArbitrageResult[];
  recentExecutions: Array<{
    pair: string;
    profitCents: number;
    latencyMs: number;
    timestamp: number;
  }>;
}

// New server function
export const getMMASStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    waves: MMASWaveStatus[];
    nodes: Array<{ id: string; wave: string; status: string; latencyMs: number }>;
    ledger: { dailyPnlcents: number; opportunities: number; successRate: number };
  }> => {
    const db = await openDb();
    
    // Query wave statuses
    const waves: MMASWaveStatus[] = [];
    const waveTypes = ['market-data', 'signal-detection', 'risk-assessment', 'execution-simulation', 'consensus-synthesis'];
    
    for (const wave of waveTypes) {
      const row = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) as healthy,
          SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) as degraded,
          AVG(node_metrics) as metrics
        FROM mmas_nodes WHERE wave = ?
      `).get(wave) as any;
      
      const metrics = row.metrics ? JSON.parse(row.metrics) : {};
      const opportunities = db.prepare(`
        SELECT * FROM mmas_trades 
        WHERE wave_id LIKE ? AND created_at > datetime('now', '-1 hour')
      `).all(`${wave}%`) as any[];
      
      waves.push({
        wave,
        nodesTotal: row.total,
        nodesHealthy: row.healthy,
        nodesDegraded: row.degraded,
        avgLatencyMs: metrics.avgLatency || 0,
        consensusConfidence: metrics.lastConfidence || 0,
        activeOpportunities: opportunities.map(formatOpportunity),
        recentExecutions: getRecentExecutions(db, wave)
      });
    }
    
    // Query all nodes
    const nodes = db.prepare(`
      SELECT id, wave, status, 
             (node_metrics->'$.latencyMs') as latencyMs
      FROM mmas_nodes ORDER BY wave, id
    `).all() as any[];
    
    // Ledger
    const ledger = {
      dailyPnlcents: getDailyPnL(db),
      opportunities: db.prepare(`SELECT COUNT(*) FROM mmas_trades WHERE created_at > datetime('now', '-1 day')`).get() as any).count,
      successRate: calculateSuccessRate(db)
    };
    
    db.close();
    return { waves, nodes, ledger };
  }
);
```

---

## 5. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Database schema migrations
- [ ] Ollama node discovery/registrar
- [ ] Wave scheduler implementation
- [ ] Basic consensus mechanism

### Phase 2: Integration (Week 2-3)
- [ ] Cletus wallet transaction tools
- [ ] Market data feed integration
- [ ] Dashboard UI components
- [ ] Risk management rules

### Phase 3: Optimization (Week 3-4)
- [ ] Latency profiling and optimization
- [ ] Model selection strategies
- [ ] Trust scoring refinement
- [ ] Stress testing with 100-node simulation

### Phase 4: Production (Week 4+)
- [ ] 1,000 node deployment
- [ ] Monitoring and alerting
- [ ] Creator override mechanisms
- [ ] Governance and parameter tuning

---

## 6. Security Considerations

### 6.1 Node Authentication
- Each Ollama node has an Ed25519 key pair
- Votes must be signed; invalid signatures = vote weight 0
- Node registration requires creator signature

### 6.2 Key Safety
- API keys for exchanges never in agent context
- Transactions signed via Cletus wallet server-side only
- Encrypted channels (TLS 1.3) for all node communication

### 6.3 Emergency Procedures
- `emergency_halt` vote (90%+ confidence) stops all trading
- Creator can directly halt via Supreme Decree
- Automatic halt on negative balance (survival mode)

---

## 7. Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Wave processing latency | <40ms | 95th percentile |
| Consensus synthesis | <20ms | median |
| End-to-end arbitrage | <100ms | p95 |
| Node uptime | 99.9% | 30-day window |
| Decision accuracy | >70% | validated trades |
| Capital efficiency | >2% ROI/month | net of fees |

---

## 8. References

- [MMAS Architecture Diagram](./mmas-architecture.drawio)
- [Cletus Transaction Types](./src/types.ts#L287-L294)
- [OpenClaw Spawning Pattern](./src/replication/openclaw-spawner.ts)
- [DDIA Systems - Replication](./reputation.md)