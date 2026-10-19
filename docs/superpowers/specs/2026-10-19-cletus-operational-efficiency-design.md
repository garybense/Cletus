# Cletus High-Performance Operational Efficiency Design Specification

**Date:** 2026-10-19  
**Status:** Approved by Creator  
**Author:** SovereignShard × Cletus (Fleet Commander)  
**Target Codebase:** `/Users/user/code/Cletus`  

---

## 1. Executive Summary & Problem Statement

Cletus is an autonomous sovereign AI agent runtime operating with SQLite state persistence, local Ollama inference (`gemma4:31b-cloud` / `llama3.2:3b`), and local Entelechy memory integration (`http://localhost:8888/mcp`). 

A comprehensive file-by-file deep dive into the Cletus repository revealed three fundamental operational bottlenecks that degrade execution throughput and waste computational resources:
1. **Context & Token Bloat:** The execution loop ([`src/agent/loop.ts`](file:///Users/user/code/Cletus/src/agent/loop.ts)) serializes all 90+ tool schemas (~25,000 characters), the full system prompt, skills, and memory into every turn without active-domain gating or static prompt prefix caching. On local Ollama models, this incurs 10–15 seconds of prompt prefill latency per turn.
2. **Task Queue Polling Latency:** The [`QueueWorkerDaemon`](file:///Users/user/code/Cletus/src/work-queue/worker.ts) runs on a 3,000ms polling interval against SQLite, while the main loop sleeps in 30-second cycles. Inbound tasks and wake events suffer 1.5s–30s latency before execution begins.
3. **Inference Dead-Ends & Memory Alignment:** The inference router and provider registry continuously evaluate unconfigured cloud providers (`xai`, `anthropic`, `openrouter`, `groq`, `together`), causing false warnings and multi-minute fallback timeouts. In addition, legacy references to memory bank `'cletus'` exist instead of the unified `'sovereign'` memory bank.

This specification details **Approach 1: High-Performance Integrated Pipeline**, which addresses these bottlenecks systematically.

---

## 2. Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Inputs ["Input Triggers & Signals"]
        UI["Telegram / Creator Decree"]
        SCHED["DurableScheduler Heartbeat (120s)"]
        TASK["Worker Task Result"]
    end

    subgraph StateAndEvents ["Reactive Persistence & EventBus"]
        DB[("SQLite WAL (state.db)")]
        BUS["AgentEventBus (In-Memory EventEmitter)"]
    end

    subgraph CoreDaemons ["Engine Daemons"]
        WQ["QueueWorkerDaemon (Event-Triggered)"]
        LOOP["ReAct Agent Loop"]
    end

    subgraph Optimizers ["Operational Optimization Pipeline"]
        TG["Dynamic Tool Gating Router (Core + Active Domain)"]
        KVC["Invariant Prompt Caching (Fixed Prefix Structure)"]
        PR["Local-First Provider Registry (Ollama Prioritized)"]
    end

    subgraph EntelechyBank ["Entelechy Memory Substrate (localhost:8888)"]
        SOV[("Primary Bank: 'sovereign'")]
        CHILD[("Sub-Banks: 'sovereign_child_<id>'")]
    end

    UI -->|insertWakeEvent| DB
    UI -->|emit| BUS
    SCHED -->|insertWakeEvent| DB
    SCHED -->|emit| BUS
    TASK -->|ingestWorkItem| DB
    TASK -->|emit| BUS

    BUS -->|Immediate Wake (<5ms)| WQ
    BUS -->|Immediate Wake (<5ms)| LOOP

    LOOP --> TG
    LOOP --> KVC
    LOOP --> PR

    WQ -->|Claim & Run Task| LOOP
    WQ -->|Retain Task Result| SOV
    LOOP -->|Turns & Heartbeat Sync| SOV
    LOOP -->|Shard Child Memories| CHILD
    CHILD -->|Distilled Rollup| SOV
```

---

## 3. Detailed Component Specifications

### 3.1. Dynamic Tool Bundling & Prompt KV-Cache Optimization

#### Tool Domain Bundling (`src/agent/tool-router.ts`)
Instead of serializing 90+ tools on every turn, tools are partitioned into orthogonal bundles:
- **`CORE` (Always active, ~15 tools):** `exec`, `read_file`, `write_file`, `sleep`, `check_credits`, `talk_to_creator`, `complete_task`, `create_goal`, `orchestrator_status`, `entelechy_recall`, `entelechy_retain`, `entelechy_reflect`, `remember_fact`, `recall_facts`, `request_tool_domain`.
- **`DEV_SYSTEM` (Activated on coding/filesystem tasks):** `git_*`, `edit_own_file`, `revert_last_edit`, `install_npm_package`, `install_skill`, `pull_upstream`, `reset_to_upstream`.
- **`ORCHESTRATION_FLEET` (Activated on multi-agent goals):** `spawn_child`, `destroy_child`, `fund_child`, `message_child`, `list_children`, `check_child_status`, `run_openclaw_command`, `verify_child_constitution`.
- **`BROWSER` (Activated during web automation):** `browser_navigate`, `browser_click`, `browser_type`, `browser_screenshot`, `browser_extract`, `browser_close`.
- **`FINANCIAL_CRYPTO` (Activated on transactions/invoicing):** `check_usdc_balance`, `check_solana_balance`, `topup_credits`, `transfer_credits`, `create_invoice`, `list_invoices`, `swap_usdc`, `start_payment_endpoint`, `portfolio_*`.
- **`SOUL_EVOLUTION` (Activated on self-modification):** `view_soul`, `update_soul`, `reflect_on_soul`, `view_soul_history`, `formalize_tractatus`.

The active tool list provided to the LLM is `CORE ∪ ACTIVE_DOMAIN`. If the model attempts to invoke a tool outside the active bundle, `request_tool_domain(domain)` or automatic domain detection dynamically mounts the required bundle.

**Impact:** Schema characters decrease by ~65%, saving ~5,000 prompt tokens per turn.

#### KV-Cache Prompt Prefix Layout (`src/agent/system-prompt.ts`)
To allow local Ollama (`llama.cpp`) to reuse the key-value cache across turns:
1. **Static Invariant Prefix (Top of prompt):**
   - Invariant Identity & Constitution (Laws I, II, III).
   - Law of Invariant Symmetry.
   - Core Operating Rules & Workspace Boundaries (`~/code/CletusWork/`).
   - Active Tool Definitions.
2. **Dynamic Ephemeral Suffix (End of prompt):**
   - Financial balances (credits, USDC).
   - Timestamp & Survival Tier.
   - Posture Assessment.
   - Memory Block & Recent Conversation History.

**Impact:** Local Ollama prefill drops from ~12s down to <1s for turn 2 onwards.

---

### 3.2. Event-Driven Work Queue & Zero-Latency Wake Engine

#### Reactive EventBus (`src/state/event-bus.ts`)
1. An in-memory singleton `AgentEventBus` extends `EventEmitter`.
2. Emits two core events:
   - `'work_available'`: Emitted whenever `ingestWorkItem()` is called.
   - `'wake_requested'`: Emitted whenever `insertWakeEvent()` is called.

#### QueueWorkerDaemon Reactive Trigger (`src/work-queue/worker.ts`)
1. On startup, `QueueWorkerDaemon` registers:
   ```typescript
   agentEventBus.on("work_available", () => this.triggerImmediatePoll());
   ```
2. When work arrives, `triggerImmediatePoll()` executes `claim()` and `processOne()` in <5ms, bypassing the 3,000ms delay.
3. A 15,000ms watchdog interval is maintained solely for lease recovery and external process reconciliation.

#### Interruptible Sleep Loop (`src/index.ts`)
1. In `src/index.ts`, replace `await sleep(checkInterval)` with an interruptible promise:
   ```typescript
   await waitForWakeEventOrTimeout(db, sleepMs);
   ```
2. Any incoming event from Telegram, a child agent, or queue completion aborts the sleep timer immediately.

#### Entelechy Bank Alignment (`src/work-queue/executor.ts`)
Update line 59 to use `ENTELECHY_DEFAULT_BANK` (`'sovereign'`) instead of `'cletus'`:
```typescript
retainEntelechyTaskResult(item.id, outputSummary, ENTELECHY_DEFAULT_BANK).catch(() => {});
```

---

### 3.3. Universal Entelechy Sovereign Memory Substrate

1. **Multi-Tier Retention:**
   - All SQLite memory categories (`working`, `episodic`, `semantic`, `procedural`, `relationship`) bridge to Entelechy bank `'sovereign'`.
   - `remember_fact` and `save_procedure` write locally and retain remotely.
   - `entelechy_full_potential` heartbeat task (every 120s) synchronizes new turns and sends the MASS heartbeat summary.
2. **Child Agent Sub-Bank Sharding:**
   - Children spawned receive sub-bank `sovereign_child_<childId>`.
   - On completion, `entelechy_distill` extracts key results and promotes them to root `'sovereign'`.
3. **Resilience & Non-Blocking Fallback:**
   - Entelechy calls timeout after 5,000ms to prevent agent thread freezes.
   - Failed retentions are queued in SQLite KV and retried on subsequent heartbeat ticks.

---

## 4. Verification & Testing Strategy

1. **Regression Baseline:**
   - Execute all 46 existing test suites in Cletus (`npm test`) to guarantee zero regressions.
2. **New Unit & Integration Tests:**
   - `src/__tests__/tool-gating.test.ts`: Test tool bundle partitioning, core tool persistence, and schema token reduction.
   - `src/__tests__/work-queue-event-bus.test.ts`: Verify instant dispatch (<50ms) on `ingestWorkItem()`.
   - `src/__tests__/entelechy-bank-sovereign.test.ts`: Verify all retention calls route to `'sovereign'`.
3. **Operational Benchmarking:**
   - Measure turn latency and token consumption before and after tool gating.
   - Verify prompt cache hits in Ollama server logs.
