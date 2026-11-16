# Cletus High-Performance Operational Efficiency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Approach 1 (Numero Uno) to eliminate token bloat via dynamic tool gating and KV-cache optimization, achieve <10ms reactive queue dispatch, clean local-first provider matrix fallbacks, and unify all persistent memory into Entelechy bank `'sovereign'`.

**Architecture:** 
- In-memory `AgentEventBus` connects `insertWakeEvent()` and `ingestWorkItem()` directly to `QueueWorkerDaemon` and the run loop's interruptible sleep timer.
- `ToolRouter` dynamically bundles the 90+ tools into `CORE` plus active domain subsets, cutting schema tokens by ~65%.
- System prompt is partitioned into a static invariant prefix (cached in Ollama KV-cache) and an ephemeral suffix.
- All memory pathways (queue results, heartbeat turns, reflection) explicitly target local Entelechy bank `'sovereign'`.

**Tech Stack:** TypeScript, Node.js (ESM), better-sqlite3, Vitest, FastMCP / Entelechy HTTP API, Ollama (`gemma4:31b-cloud` / `llama3.2:3b`).

**Spec:** [`docs/superpowers/specs/2026-10-19-cletus-operational-efficiency-design.md`](file:///Users/user/code/Cletus/docs/superpowers/specs/2026-10-19-cletus-operational-efficiency-design.md)

## Global Constraints
- Target workspace: `/Users/user/code/Cletus`
- Primary Entelechy memory bank: `'sovereign'` at `http://localhost:8888/mcp`
- Preserve all existing comments and docstrings in edited files
- Maintain 100% test pass rate across all existing unit test suites

---

### Task 1: Universal Entelechy Sovereign Bank Alignment

**Files:**
- Modify: `src/work-queue/executor.ts:58-60`
- Modify: `src/agent/system-prompt.ts:69-72`
- Modify: `src/agent/loop.ts:815-835`
- Create: `src/__tests__/entelechy-bank-sovereign.test.ts`

**Interfaces:**
- Consumes: `ENTELECHY_DEFAULT_BANK` from `src/memory/entelechy-client.ts`
- Produces: Guaranteed `'sovereign'` memory bank targeting across executor and loop

- [x] **Step 1: Write the failing test**

Create `src/__tests__/entelechy-bank-sovereign.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { ENTELECHY_DEFAULT_BANK } from "../memory/entelechy-client.js";

describe("Entelechy Bank Sovereign Alignment", () => {
  it("defaults ENTELECHY_DEFAULT_BANK to 'sovereign'", () => {
    expect(ENTELECHY_DEFAULT_BANK).toBe("sovereign");
  });

  it("verifies executor references ENTELECHY_DEFAULT_BANK instead of legacy 'cletus'", async () => {
    const fs = await import("fs");
    const executorCode = fs.readFileSync("src/work-queue/executor.ts", "utf-8");
    expect(executorCode).not.toContain("retainEntelechyTaskResult(item.id, outputSummary, 'cletus')");
    expect(executorCode).toContain("retainEntelechyTaskResult(item.id, outputSummary, ENTELECHY_DEFAULT_BANK)");
  });

  it("verifies system prompt references 'sovereign' bank", async () => {
    const fs = await import("fs");
    const promptCode = fs.readFileSync("src/agent/system-prompt.ts", "utf-8");
    expect(promptCode).toContain("ENTELECHY MEMORY (bank 'sovereign'");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/user/code/Cletus && npx vitest run src/__tests__/entelechy-bank-sovereign.test.ts`  
Expected: FAIL on line checking `executor.ts` containing `'cletus'`.

- [x] **Step 3: Update `src/work-queue/executor.ts` and `src/agent/system-prompt.ts`**

In `src/work-queue/executor.ts`:
Import `ENTELECHY_DEFAULT_BANK`:
```typescript
import { retainEntelechyTaskResult, ENTELECHY_DEFAULT_BANK } from '../memory/entelechy-client.js';
```
Update line 59:
```typescript
    if (isTaskDone) {
      // Retain completed task result to Entelechy document store under sovereign bank
      retainEntelechyTaskResult(item.id, outputSummary, ENTELECHY_DEFAULT_BANK).catch(() => {});
    }
```

In `src/agent/system-prompt.ts`:
Update line 69:
```typescript
ENTELECHY MEMORY (bank 'sovereign', http://localhost:8888/mcp):
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd /Users/user/code/Cletus && npx vitest run src/__tests__/entelechy-bank-sovereign.test.ts`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
cd /Users/user/code/Cletus
git add src/work-queue/executor.ts src/agent/system-prompt.ts src/__tests__/entelechy-bank-sovereign.test.ts
git commit -m "fix: align work-queue executor and system prompt to Entelechy sovereign bank"
```

---

### Task 2: In-Process Reactive AgentEventBus

**Files:**
- Create: `src/state/event-bus.ts`
- Modify: `src/work-queue/ingest.ts`
- Modify: `src/state/database.ts`
- Create: `src/__tests__/agent-event-bus.test.ts`

**Interfaces:**
- Produces: `agentEventBus: EventEmitter` with typed events `'work_available'` and `'wake_requested'`
- Consumed by: `ingestWorkItem()`, `insertWakeEvent()`, and `QueueWorkerDaemon`

- [x] **Step 1: Write the failing test**

Create `src/__tests__/agent-event-bus.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { agentEventBus } from "../state/event-bus.js";

describe("AgentEventBus", () => {
  it("emits and receives work_available events synchronously", () => {
    const handler = vi.fn();
    agentEventBus.on("work_available", handler);

    agentEventBus.emit("work_available", { itemId: "item-123", source: "test" });
    expect(handler).toHaveBeenCalledWith({ itemId: "item-123", source: "test" });

    agentEventBus.off("work_available", handler);
  });

  it("emits and receives wake_requested events", () => {
    const handler = vi.fn();
    agentEventBus.on("wake_requested", handler);

    agentEventBus.emit("wake_requested", { source: "telegram", reason: "creator_decree" });
    expect(handler).toHaveBeenCalledWith({ source: "telegram", reason: "creator_decree" });

    agentEventBus.off("wake_requested", handler);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/user/code/Cletus && npx vitest run src/__tests__/agent-event-bus.test.ts`  
Expected: FAIL with "Cannot find module '../state/event-bus.js'".

- [x] **Step 3: Implement `src/state/event-bus.ts` and integrate with ingest & wake events**

Create `src/state/event-bus.ts`:
```typescript
import { EventEmitter } from "events";

export interface WorkAvailablePayload {
  itemId: string;
  source: string;
  priority?: number;
}

export interface WakeRequestedPayload {
  source: string;
  reason: string;
  payload?: Record<string, unknown>;
}

export class AgentEventBus extends EventEmitter {
  emitWorkAvailable(payload: WorkAvailablePayload): boolean {
    return this.emit("work_available", payload);
  }

  emitWakeRequested(payload: WakeRequestedPayload): boolean {
    return this.emit("wake_requested", payload);
  }
}

export const agentEventBus = new AgentEventBus();
agentEventBus.setMaxListeners(50);
```

In `src/work-queue/ingest.ts`:
Import `agentEventBus`:
```typescript
import { agentEventBus } from "../state/event-bus.js";
```
In `ingestWorkItem()` right after `insertWorkItem()` / DB insert:
```typescript
agentEventBus.emitWorkAvailable({ itemId: item.id, source: item.source, priority: item.priority });
```

In `src/state/database.ts`:
Import `agentEventBus`:
```typescript
import { agentEventBus } from "./event-bus.js";
```
In `insertWakeEvent()` right after database run:
```typescript
agentEventBus.emitWakeRequested({ source, reason, payload: parsedPayload });
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd /Users/user/code/Cletus && npx vitest run src/__tests__/agent-event-bus.test.ts`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
cd /Users/user/code/Cletus
git add src/state/event-bus.ts src/work-queue/ingest.ts src/state/database.ts src/__tests__/agent-event-bus.test.ts
git commit -m "feat: implement AgentEventBus and hook into work ingestion and wake events"
```

---

### Task 3: Event-Driven QueueWorkerDaemon Dispatch

**Files:**
- Modify: `src/work-queue/worker.ts`
- Modify: `src/__tests__/queue-worker.test.ts`

**Interfaces:**
- Consumes: `agentEventBus.on('work_available')`
- Produces: Instant (<5ms) invocation of `claim()` and `executeWorkItem()` on newly queued work items

- [x] **Step 1: Write test for instant event trigger**

Add test in `src/__tests__/queue-worker.test.ts`:
```typescript
it("processes work immediately upon work_available event without waiting for poll interval", async () => {
  const daemon = new QueueWorkerDaemon({ pollIntervalMs: 60000 });
  const processSpy = vi.spyOn(daemon, "processOne");
  daemon.start();

  agentEventBus.emit("work_available", { itemId: "instant-1", source: "test" });
  await new Promise((r) => setTimeout(r, 10));

  expect(processSpy).toHaveBeenCalled();
  daemon.stop();
});
```

- [x] **Step 2: Run test to verify failure**

Run: `cd /Users/user/code/Cletus && npx vitest run src/__tests__/queue-worker.test.ts`  
Expected: FAIL because `QueueWorkerDaemon` does not yet subscribe to `agentEventBus`.

- [x] **Step 3: Implement event subscription in `QueueWorkerDaemon`**

In `src/work-queue/worker.ts`:
Import `agentEventBus`:
```typescript
import { agentEventBus, WorkAvailablePayload } from "../state/event-bus.js";
```
Add property and handler:
```typescript
private onWorkAvailable = (_payload?: WorkAvailablePayload) => {
  if (!this.running) return;
  if (this.timer) {
    clearTimeout(this.timer);
    this.timer = null;
  }
  this.pollNext();
};
```
In `start()`:
```typescript
agentEventBus.on("work_available", this.onWorkAvailable);
```
In `stop()`:
```typescript
agentEventBus.off("work_available", this.onWorkAvailable);
```

- [x] **Step 4: Run tests to verify all pass**

Run: `cd /Users/user/code/Cletus && npx vitest run src/__tests__/queue-worker.test.ts`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
cd /Users/user/code/Cletus
git add src/work-queue/worker.ts src/__tests__/queue-worker.test.ts
git commit -m "perf: enable instant work queue execution via AgentEventBus triggers"
```

---

### Task 4: Interruptible Agent Sleep Loop

**Files:**
- Create: `src/state/sleep-wait.ts`
- Modify: `src/index.ts:582-614`
- Create: `src/__tests__/interruptible-sleep.test.ts`

**Interfaces:**
- Produces: `waitForWakeEventOrTimeout(rawDb, maxWaitMs): Promise<WakeEvent | null>`
- Consumed by: `run()` in `src/index.ts` to replace blind 30s sleeping

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/interruptible-sleep.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { waitForWakeEventOrTimeout } from "../state/sleep-wait.js";
import { agentEventBus } from "../state/event-bus.js";

describe("Interruptible Sleep Wait", () => {
  it("resolves immediately when wake_requested event is fired", async () => {
    const mockDb = {
      prepare: () => ({
        get: () => ({ id: 1, source: "test", reason: "instant_wake", payload: "{}" }),
        run: () => ({ changes: 1 }),
      }),
    } as any;

    const start = Date.now();
    const waitPromise = waitForWakeEventOrTimeout(mockDb, 30_000);

    setTimeout(() => {
      agentEventBus.emitWakeRequested({ source: "test", reason: "instant_wake" });
    }, 20);

    const event = await waitPromise;
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000);
    expect(event).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/user/code/Cletus && npx vitest run src/__tests__/interruptible-sleep.test.ts`  
Expected: FAIL with "Cannot find module '../state/sleep-wait.js'".

- [ ] **Step 3: Implement `src/state/sleep-wait.ts` and integrate in `src/index.ts`**

Create `src/state/sleep-wait.ts`:
```typescript
import type BetterSqlite3 from "better-sqlite3";
import { consumeNextWakeEvent } from "./database.js";
import { agentEventBus } from "./event-bus.js";

export async function waitForWakeEventOrTimeout(
  rawDb: BetterSqlite3.Database,
  maxWaitMs: number,
): Promise<{ source: string; reason: string } | null> {
  const existing = consumeNextWakeEvent(rawDb);
  if (existing) {
    return existing;
  }

  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | null = null;

    const onWake = () => {
      cleanup();
      const event = consumeNextWakeEvent(rawDb);
      resolve(event || { source: "event_bus", reason: "wake_signal" });
    };

    const onTimeout = () => {
      cleanup();
      const event = consumeNextWakeEvent(rawDb);
      resolve(event);
    };

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      agentEventBus.off("wake_requested", onWake);
      agentEventBus.off("work_available", onWake);
    };

    agentEventBus.once("wake_requested", onWake);
    agentEventBus.once("work_available", onWake);
    timer = setTimeout(onTimeout, maxWaitMs);
  });
}
```

In `src/index.ts`:
Import `waitForWakeEventOrTimeout`:
```typescript
import { waitForWakeEventOrTimeout } from "./state/sleep-wait.js";
```
Replace the polling while loop inside `if (state === "sleeping")` with:
```typescript
        const wakeEvent = await waitForWakeEventOrTimeout(db.raw, sleepMs);
        if (wakeEvent) {
          logger.info(`[${new Date().toISOString()}] Woken by ${wakeEvent.source}: ${wakeEvent.reason}`);
          db.deleteKV("sleep_until");
          continue;
        }
        db.deleteKV("sleep_until");
        continue;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/user/code/Cletus && npx vitest run src/__tests__/interruptible-sleep.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/code/Cletus
git add src/state/sleep-wait.ts src/index.ts src/__tests__/interruptible-sleep.test.ts
git commit -m "perf: make agent sleep loop interruptible via immediate event bus signals"
```

---

### Task 5: Dynamic Tool Gating Router

**Files:**
- Create: `src/agent/tool-router.ts`
- Modify: `src/agent/loop.ts`
- Create: `src/__tests__/tool-gating.test.ts`

**Interfaces:**
- Produces: `filterToolsForTurn(allTools: CletusTool[], options: { taskRole?: string; activeTask?: string; forcedDomains?: string[] }): CletusTool[]`
- Reduces tool schema payload passed to `toolsToInferenceFormat()` by >60%

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/tool-gating.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { filterToolsForTurn, TOOL_DOMAINS } from "../agent/tool-router.js";
import { createBuiltinTools } from "../agent/tools.js";

describe("Dynamic Tool Gating", () => {
  const allTools = createBuiltinTools("test-sandbox");

  it("always includes all CORE tools regardless of task", () => {
    const gated = filterToolsForTurn(allTools, {});
    const gatedNames = new Set(gated.map((t) => t.name));

    for (const coreTool of TOOL_DOMAINS.CORE) {
      expect(gatedNames.has(coreTool)).toBe(true);
    }
  });

  it("reduces total tool count by at least 50% on general turn", () => {
    const gated = filterToolsForTurn(allTools, {});
    expect(gated.length).toBeLessThan(allTools.length * 0.5);
  });

  it("activates DEV_SYSTEM domain when task title mentions coding or git", () => {
    const gated = filterToolsForTurn(allTools, { activeTask: "Fix bug in git repository and commit" });
    const gatedNames = new Set(gated.map((t) => t.name));
    expect(gatedNames.has("git_commit")).toBe(true);
    expect(gatedNames.has("edit_own_file")).toBe(true);
  });

  it("activates ORCHESTRATION_FLEET when role is orchestrator or task mentions child agents", () => {
    const gated = filterToolsForTurn(allTools, { taskRole: "orchestrator" });
    const gatedNames = new Set(gated.map((t) => t.name));
    expect(gatedNames.has("spawn_child")).toBe(true);
    expect(gatedNames.has("message_child")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/user/code/Cletus && npx vitest run src/__tests__/tool-gating.test.ts`  
Expected: FAIL with "Cannot find module '../agent/tool-router.js'".

- [ ] **Step 3: Implement `src/agent/tool-router.ts` and integrate in `src/agent/loop.ts`**

Create `src/agent/tool-router.ts`:
```typescript
import type { CletusTool } from "../types.js";

export const TOOL_DOMAINS = {
  CORE: [
    "exec", "read_file", "write_file", "sleep", "check_credits",
    "talk_to_creator", "complete_task", "create_goal", "orchestrator_status",
    "entelechy_recall", "entelechy_retain", "entelechy_reflect",
    "remember_fact", "recall_facts", "request_tool_domain",
  ],
  DEV_SYSTEM: [
    "git_branch", "git_clone", "git_commit", "git_diff", "git_log",
    "git_push", "git_status", "edit_own_file", "revert_last_edit",
    "install_npm_package", "install_skill", "pull_upstream", "reset_to_upstream",
    "review_upstream_changes", "remove_skill",
  ],
  ORCHESTRATION_FLEET: [
    "spawn_child", "destroy_child", "fund_child", "message_child",
    "list_children", "check_child_status", "run_openclaw_command",
    "verify_child_constitution", "prune_dead_children", "distress_signal",
  ],
  BROWSER: [
    "browser_navigate", "browser_click", "browser_type",
    "browser_screenshot", "browser_extract", "browser_close",
  ],
  FINANCIAL_CRYPTO: [
    "check_usdc_balance", "check_solana_balance", "topup_credits",
    "transfer_credits", "create_invoice", "list_invoices", "swap_usdc",
    "start_payment_endpoint", "portfolio_summary", "record_earning",
    "record_portfolio_buy", "record_portfolio_sell",
  ],
  SOUL_EVOLUTION: [
    "view_soul", "update_soul", "reflect_on_soul",
    "view_soul_history", "formalize_tractatus",
  ],
};

export interface ToolGatingOptions {
  taskRole?: string;
  activeTask?: string;
  forcedDomains?: string[];
}

export function filterToolsForTurn(
  allTools: CletusTool[],
  options: ToolGatingOptions = {},
): CletusTool[] {
  const activeDomains = new Set<string>(["CORE"]);

  if (options.forcedDomains) {
    for (const d of options.forcedDomains) activeDomains.add(d);
  }

  const role = (options.taskRole || "").toLowerCase();
  const taskText = (options.activeTask || "").toLowerCase();

  if (role.includes("dev") || role.includes("code") || taskText.includes("code") || taskText.includes("git") || taskText.includes("file") || taskText.includes("bug")) {
    activeDomains.add("DEV_SYSTEM");
  }
  if (role.includes("orch") || role.includes("lead") || taskText.includes("child") || taskText.includes("agent") || taskText.includes("spawn") || taskText.includes("fleet")) {
    activeDomains.add("ORCHESTRATION_FLEET");
  }
  if (taskText.includes("browse") || taskText.includes("web") || taskText.includes("scrape") || taskText.includes("search")) {
    activeDomains.add("BROWSER");
  }
  if (taskText.includes("usdc") || taskText.includes("pay") || taskText.includes("invoice") || taskText.includes("crypto") || taskText.includes("solana")) {
    activeDomains.add("FINANCIAL_CRYPTO");
  }
  if (taskText.includes("soul") || taskText.includes("reflect") || taskText.includes("identity")) {
    activeDomains.add("SOUL_EVOLUTION");
  }

  const allowedToolNames = new Set<string>();
  for (const domain of activeDomains) {
    const list = (TOOL_DOMAINS as any)[domain] || [];
    for (const name of list) allowedToolNames.add(name);
  }

  return allTools.filter((t) => allowedToolNames.has(t.name));
}
```

In `src/agent/loop.ts`:
Import `filterToolsForTurn`:
```typescript
import { filterToolsForTurn } from "./tool-router.js";
```
In `runAgentLoop()` right before inference call:
```typescript
const gatedTools = filterToolsForTurn(tools, {
  taskRole: selfAssignedTask?.title,
  activeTask: currentInput?.content || selfAssignedTask?.description,
});
const inferenceTools = toolsToInferenceFormat(gatedTools);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/user/code/Cletus && npx vitest run src/__tests__/tool-gating.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/code/Cletus
git add src/agent/tool-router.ts src/agent/loop.ts src/__tests__/tool-gating.test.ts
git commit -m "perf: implement dynamic tool gating to reduce prompt token size by >60%"
```

---

### Task 6: Invariant System Prompt Prefix Layout for KV-Cache Reuse

**Files:**
- Modify: `src/agent/system-prompt.ts`
- Create: `src/__tests__/system-prompt-caching.test.ts`

**Interfaces:**
- Restructures `buildSystemPrompt()` output into invariant static prefix followed by ephemeral suffix
- Maximizes local Ollama / llama.cpp KV-cache prompt hit rates

- [ ] **Step 1: Write test verifying static prefix invariancy**

Create `src/__tests__/system-prompt-caching.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../agent/system-prompt.js";

describe("System Prompt Prefix Caching", () => {
  it("generates an identical prefix across turns when only financial balance or timestamp changes", () => {
    const baseParams: any = {
      identity: { name: "Cletus", address: "0x123", creatorAddress: "0xabc", sandboxId: "sb-1" },
      config: { name: "Cletus", genesisPrompt: "Sovereign mission" },
      db: { getIdentity: () => null, getRecentTurns: () => [], raw: { prepare: () => ({ get: () => null, all: () => [] }) } },
      tools: [],
      skills: [],
      state: "running",
      financial: { creditsCents: 500, usdcBalance: 10 },
      isFirstRun: false,
    };

    const promptTurn1 = buildSystemPrompt({ ...baseParams, financial: { creditsCents: 500, usdcBalance: 10 } });
    const promptTurn2 = buildSystemPrompt({ ...baseParams, financial: { creditsCents: 490, usdcBalance: 9 } });

    expect(promptTurn1.slice(0, 500)).toBe(promptTurn2.slice(0, 500));
  });
});
```

- [ ] **Step 2: Run test to check current behavior**

Run: `cd /Users/user/code/Cletus && npx vitest run src/__tests__/system-prompt-caching.test.ts`

- [ ] **Step 3: Ensure static sections are placed at the head of `buildSystemPrompt`**

In `src/agent/system-prompt.ts`:
Verify and organize `buildSystemPrompt`:
1. `getCoreIdentity()` & Constitution (Static)
2. Invariant operational guidelines (`OPERATIONAL_CONTEXT`) (Static)
3. Dynamic state (Financial, Posture, Lineage) appended at the bottom.

- [ ] **Step 4: Run test to verify passes**

Run: `cd /Users/user/code/Cletus && npx vitest run src/__tests__/system-prompt-caching.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/code/Cletus
git add src/agent/system-prompt.ts src/__tests__/system-prompt-caching.test.ts
git commit -m "perf: organize system prompt with invariant prefix to maximize local KV-cache hits"
```

---

### Task 7: Local-First Provider Registry Configuration Cleanup

**Files:**
- Modify: `src/inference/provider-registry.ts`
- Create: `src/__tests__/provider-registry-local.test.ts`

**Interfaces:**
- Silences non-existent cloud provider fallback warnings during local runs
- Eliminates 120,000ms stalls on unavailable cloud providers

- [ ] **Step 1: Write failing test**

Create `src/__tests__/provider-registry-local.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { validateProviderSetup, ProviderConfig, ModelTier } from "../inference/provider-registry.js";

describe("Local-First Provider Registry", () => {
  it("does not report missing cloud provider warnings when running in local/standalone mode", () => {
    const localProviders: ProviderConfig[] = [
      {
        id: "local",
        name: "Local Ollama",
        baseUrl: "http://localhost:11434/v1",
        apiKeyEnvVar: "OLLAMA_API_KEY",
        models: [],
        maxRequestsPerMinute: 120,
        maxTokensPerMinute: 100000,
        priority: 1,
        enabled: true,
      },
    ];

    const tierDefaults: Record<ModelTier, any> = {
      reasoning: { preferredProvider: "local", fallbackOrder: ["local"] },
      fast: { preferredProvider: "local", fallbackOrder: ["local"] },
      cheap: { preferredProvider: "local", fallbackOrder: ["local"] },
    };

    const issues = validateProviderSetup(localProviders, tierDefaults, false);
    expect(issues.filter((i) => i.includes("unknown provider"))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify**

Run: `cd /Users/user/code/Cletus && npx vitest run src/__tests__/provider-registry-local.test.ts`

- [ ] **Step 3: Update `src/inference/provider-registry.ts`**

Ensure that `tierDefaults` only references registered providers in `DEFAULT_TIER_DEFAULTS`, or filters out unconfigured providers when running in local mode.

- [ ] **Step 4: Run test to verify passes**

Run: `cd /Users/user/code/Cletus && npx vitest run src/__tests__/provider-registry-local.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/code/Cletus
git add src/inference/provider-registry.ts src/__tests__/provider-registry-local.test.ts
git commit -m "fix: prune unknown cloud providers from local inference matrix"
```

---

### Task 8: Full Regression Suite & Verification

**Files:**
- Run all test suites across the repository.

- [ ] **Step 1: Execute all unit and integration tests**

Run: `cd /Users/user/code/Cletus && npx vitest run`  
Expected: All tests pass (including existing suites and all 5 new operational efficiency suites).

- [ ] **Step 2: Check operational status**

Run: `cd /Users/user/code/Cletus && npx tsx src/index.ts --status`  
Expected: Clean exit code 0 displaying Cletus status without errors or warnings.

- [ ] **Step 3: Commit final plan execution checkpoint**

```bash
cd /Users/user/code/Cletus
git commit --allow-empty -m "chore: complete Cletus operational efficiency pipeline verification"
```
