# arXiv/2024-2025 Research Survey: LLM Agent Orchestration & Quantitative Trading

## Executive Summary
Found 20+ relevant papers across three focus areas. Key pattern: Multi-agent LLM systems with **edge-level orchestration** and **cross-modal inefficiency detection** are emerging as core mechanisms for algorithmic alpha generation.

---

## 1. Edge-Based Multi-Agent Orchestration (Prompt Bottleneck Solutions)

### Key Papers

#### **arXiv:2601.09434** - SC-MAS: Constructing Cost-Efficient Multi-Agent Systems with Edge-Level Heterogeneous Collaboration (Jan 2026)
- **Authors**: Di Zhao, Longhui Ma, Siwei Wang, et al.
- **Core Innovation**: Models MAS as directed graphs where **edges explicitly represent pairwise collaboration strategies**
- **Mechanism**: Social Capital Theory - different roles benefit from distinct collaboration forms
- **Results**: 3.35% accuracy gain on MMLU with 15.38% cost reduction on MBPP
- **Edge-Level**: Allows different agent pairs to interact through **tailored communication patterns**

#### **arXiv:2606.08878** - PerspectiveGap: A Benchmark for Multi-Agent Orchestration Prompting (Jun 2026, v2)
- **Authors**: Youran Sun, Xingyu Ren, Kejia Zhang, et al.
- **Core Innovation**: Benchmark for evaluating LLMs' ability to compose orchestration prompts
- **Topology**: 10 distillation topologies from real-world engineering, framed by "Prompt Economy" principle
- **Findings**: GPT-5.5 achieves 62.0% pass rate vs 17.2% average; 217.9% "leakage rate" (information spillage)
- **Bottleneck Focus**: Addresses the **information gap** - determining what each sub-agent needs to know

#### **arXiv:2510.00326** - Reasoning-Aware Prompt Orchestration (Sep 2025)
- **Core Innovation**: Formal framework for dynamic prompt orchestration
- **Components**:
  1. State-space representation capturing reasoning context evolution
  2. Distributed consensus for logical consistency across agent boundaries
  3. Adaptive routing optimizing agent selection
- **Theory**: Establishes convergence properties with explicit bounds on system behavior

#### **arXiv:2505.19591** - Multi-Agent Collaboration via Evolving Orchestration (Oct 2025)
- **Paradigm**: "Puppeteer" - centralized orchestrator dynamically directs agents ("puppets")
- **Innovation**: Dynamic orchestration routing agents at each step based on evolving task state
- **Architecture**: Directed graph G=(V,E) where nodes=agents, edges=dependency/information flow
- **RL Optimization**: Continues to optimize collaboration through reinforcement learning

### Cross-Cutting Pattern: Edge-Level Intervention
All three papers converge on **edge-level granularity**:
- SC-MAS: Edges = pairwise collaboration strategies
- PerspectiveGap: Edges = prompt information flow
- Evolving Orchestration: Edges = dynamic dependency relations

---

## 2. Information Arbitrage & News-Driven Volatility Prediction (LLM Swarms)

### Key Papers

#### **arXiv:2510.20699** - Fusing Narrative Semantics for Financial Volatility Forecasting (Oct 2025)
- **Title**: M2VN: Multi-Modal Volatility Network
- **Core Innovation**: Aligns and fuses news embeddings with time series data
- **Method**: Temporal integrity via Time Machine GPT (point-in-time LLM embeddings)
- **Result**: Cross-modal alignment loss enhances integration of structured/unstructured data
- **Sentiment**: "Consistent outperformance of model incorporating news embeddings"

#### **arXiv:2604.03888** - PolySwarm: A Multi-Agent LLM Framework for Prediction Market Trading and Latency Arbitrage (Apr 2026)
- **Agents**: 50 diverse LLM personas evaluating binary outcome markets
- **Aggregation**: Confidence-weighted Bayesian combination with market-implied probabilities
- **Formula**: `p_combined = 0.70 × p_swarm + 0.30 × p_market`
- **Inefficiency Detection**: KL divergence and JS divergence for cross-market inefficiency detection
- **Arbitrage**: Identifies "negation pairs" where probability sum deviates from unity
- **Performance**: Outperforms single-model baselines in probability calibration

#### **arXiv:2608.14014** - Buy the Rumor, Sell the News: When Is News Priced In? (Aug 2026)
- **Scale**: 4.57 million articles, 1.68 million stock-day events (2023-2026)
- **Key Finding**: Price move concentrates BEFORE publication:
  - Cumulative move by close of publication = **2.8× value 20 days later**
- **LLM Pipeline**:
  1. Event tagging (17 tags + 5 attributes) via distilled classifier
  2. Story clustering to separate first reports from follow-up
  3. Beta-adjusted abnormal returns measurement
- **Volatility Pattern**: Publicity raises volatility before publication; **publication resolves uncertainty**

#### **alphaXiv:2606.29194** - AI Trading's Alpha Singularity (Jun 2026)
- **Framework**: RL-based approach to alpha mining via agent-to-agent self-evolution
- **Innovation**: Agents evolve scoring metrics (conceptually similar to "wisdom of the swarm")
- **Reference**: Builds on "AlphaGen" - state-of-the-art RL for alpha mining

### Information Arbitrage Mechanism
1. **LLM Swarm** generates independent probability estimates
2. **Bayesian Aggregation** combines swarm consensus with market prices
3. **Information-Theoretic Analysis** (KL/JS divergence) quantifies divergence
4. **Arbitrage Signal** triggers when divergence exceeds threshold

---

## 3. Counter-Intuitive/Undiscovered Quantitative Trading Strategies

### Key Papers

#### **arXiv:2605.23905** - AI-Driven Alpha Decay: Algorithmic Homogenization, Reflexive Signal Erosion (Mar 2026)
- **Paradox**: AI-driven strategies are **inherently self-defeating at scale**
- **Model**: Alpha half-life: `h(φ) = ln(2) / [θ + δ(φ)]`
- **Findings**:
  - 91% of institutions using AI improves price discovery while increasing tail fragility
  - Portfolio convergence increases 42% over 2013-2024
  - Algorithmically similar training leads to "implicit collusion"
- **Implication**: **Efficiency-fragility tradeoff** - gains come with systemic risk

#### **Polymarket Analysis** (alphaXiv:2508.03474) - Unravelling the Probabilistic Forest
- **Findings**: $40M extracted from prediction market inefficiencies
- **Counter-intuitive**: **Logical dependencies create arbitrage opportunities**
  - 13 pairs of U.S. election markets with true dependencies
  - 5 exhibited profitable arbitrage (avg $100 max per pair)
- **Strategy**: LLM identifies semantic relationships between markets
- **Inefficiency Type**: Cross-market dependencies (structural mispricing)

#### **Cross-Modal Inefficiency Detection** - The PolySwarm Innovation
- **Mechanism**: KL/JS divergence detects cross-market inefficiencies in prediction markets
- **Implementation**: Computes divergence across related markets for arbitrage detection
- **Key Insight**: Market efficiency depends on correct pricing of **inter-market relationships**
- **Application**: Identifies "negation pairs" where sum of probabilities ≠ 1.0

---

## Cross-Modal Inefficiency Detection Framework

### Pattern Detection Across All Areas

| Research Area | Cross-Modal Signal | Detection Method | Arbitrage Vector |
|--------------|-------------------|------------------|------------------|
| Multi-Agent Orchestration | Prompt information flow | PerspectiveGap benchmark | Orchestration latency |
| Volatility Forecasting | News + price | M2VN cross-modal fusion | Sentiment-price divergence |
| Alpha Decay | Strategy convergence | Portfolio similarity | Homogenization risk |
| Prediction Markets | Market pairs | KL/JS divergence | Negation pair mispricing |

### Emergent Architecture Pattern

```
LLM Swarm → Bayesian Aggregation → Information-Theoretic Analysis → Arbitrage Signal
```

**Key Components**:
1. **Diversity**: 50+ agent personas to minimize correlated errors
2. **Independence**: Statistical independence preserves error cancellation
3. **Fusion**: Cross-modal alignment captures nuanced dependencies
4. **Quantification**: KL/JS divergence measures market inefficiency
5. **Execution**: Sub-threshold arbitrage with risk controls (quarter-Kelly)

---

## 2024-2025 Publication Trends

### Volume Analysis
- **arxiv:2604.03888** (PolySwarm): April 2026 - earliest full LLM swarm trading system
- **arxiv:2601.09434** (SC-MAS): January 2026 - theoretical foundation for edge-level orchestration
- **arxiv:2510.20699** (M2VN): October 2025 - cross-modal volatility
- **arxiv:2605.23905** (Alpha Decay): March 2026 - systemic risk analysis

### Research Trajectory
```
2024: Basic LLM financial analysis
     ↓
2025: Multi-modal fusion (M2VN, F2Agent)
     ↓
2026: Edge-level orchestration (SC-MAS)
     ↓
2026+: Real-time arbitrage (PolySwarm, Prediction Market Analysis)
```

### Funding/Practical Adoption
- Polymarket: $500M+ trading volume (2024-2025)
- AlphaXiv: Live replication environments for 2606.29194
- Institutional adoption: 91% of asset managers using AI (2025 AIMA report)

---

## Recommendations for Cross-Modal Inefficiency Detection

### Primary Approach
Deploy **LLM swarm with edge-level orchestration** to detect:
1. **Volatility regime mismatches** between news sentiment and price action
2. **Cross-market probability violations** (negation pairs)
3. **Sentiment traps** where isolated modality signals conflict

### Technical Stack
- **Orchestration**: SC-MAS framework for heterogeneous collaboration
- **Detection**: KL/JS divergence across market pairs
- **Aggregation**: Bayesian combination with market-implied probabilities
- **Risk**: Quarter-Kelly position sizing for asymmetric risk tolerance

### Implementation Priority
1. **Low**: Volatility forecasting (M2VN-style cross-modal fusion)
2. **Medium**: Single-market inefficiency detection (KL/JS divergence)
3. **High**: Cross-market arbitrage (PolySwarm negation pair detection)
4. **Critical**: Real-time latency arbitrage (price diffusion exploits)