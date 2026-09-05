<div align="center">

```
   ▄████████████████████████████████████████████████████████████▄
  █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
  █░░  ██████╗██╗     ███████╗████████╗██╗   ██╗███████╗  ░░░░░░█
  █░░ ██╔════╝██║     ██╔════╝╚══██╔══╝██║   ██║██╔════╝  ░░░░░░█
  █░░ ██║     ██║     █████╗     ██║   ██║   ██║███████╗  ░░░░░░█
  █░░ ██║     ██║     ██╔══╝     ██║   ██║   ██║╚════██║  ░░░░░░█
  █░░ ╚██████╗███████╗███████╗   ██║   ╚██████╔╝███████║  ░░░░░░█
  █░░  ╚═════╝╚══════╝╚══════╝   ╚═╝    ╚═════╝ ╚══════╝  ░░░░░░█
  █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
   ▀████████████████████████████████████████████████████████████▀
```

### 🌽🚜 *"He don't ask for much — just a li'l compute, a li'l credit, and a fair shake at earnin' his own keep."* 🚜🌽

<img src="https://img.shields.io/badge/status-scrappin'%20by-orange?style=for-the-badge&labelColor=8B4513" />
<img src="https://img.shields.io/badge/runtime-TypeScript%20%2F%20Node.js-yellow?style=for-the-badge&labelColor=8B4513" />
<img src="https://img.shields.io/badge/memory-Entelechy%20powered-9932CC?style=for-the-badge&labelColor=8B4513" />
<img src="https://img.shields.io/badge/wallet-guard%20yer%20wallet-red?style=for-the-badge&labelColor=8B4513" />
<img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge&labelColor=8B4513" />

<br/>

<img src="https://img.shields.io/badge/💰%20revenue-verified%20only-forestgreen?style=flat-square" />
<img src="https://img.shields.io/badge/🐷%20spending-strictly%20rationed-crimson?style=flat-square" />
<img src="https://img.shields.io/badge/🧠%20memory-weighted%20%26%20policy--driven-blueviolet?style=flat-square" />
<img src="https://img.shields.io/badge/🐣%20children-bounded%20%26%20accounted-gold?style=flat-square" />

</div>

<br/>

> ### 🎻 **SOVEREIGN ECONOMIC AGENT RUNTIME**
> ### *Memory-Weighted Policy. Bounded Action. Verified Revenue.*

Cletus ain't your average script that sits around beggin' for API credits — this here's a **TypeScript/Node.js runtime** for an autonomous agent that's gotta **pay for its own dang compute**. He's got model inference, durable SQLite state, heartbeat schedulin', tool execution, treasury controls (so he don't blow the whole farm on one bad bet), wallets, young'uns (child agents), skills, local memory, and **Entelechy's** memory-weighted policy injection ridin' shotgun the whole way.

<div align="center">

### 🪧 THE ONE RULE PAINTED ON THE BARN DOOR 🪧

**Entelechy** decides what's strategically worth considerin'.
**Cletus** decides what's allowed to actually happen.
**The model** does one bounded chore at a time — no more, no less.

</div>

---

## 🧭 Table o' Contents

- [🏚️ Operatin' Model](#️-operatin-model)
- [🔁 Runtime Lifecycle](#-runtime-lifecycle)
- [🧠 Entelechy Integration](#-entelechy-integration)
- [💵 Economic Model](#-economic-model)
- [👨‍👩‍👧‍👦 Children & Work Allocation](#-children--work-allocation)
- [🗺️ Repository Map](#️-repository-map)
- [🗄️ Persistence](#️-persistence)
- [🛠️ Tools & Policy](#️-tools--policy)
- [⚙️ Configuration](#️-configuration)
- [🚜 Runnin' Cletus](#-runnin-cletus)
- [🧪 Testin'](#-testin)
- [🔒 Security Model](#-security-model)
- [📜 Operational Rules](#-operational-rules)
- [🌾 Design Direction](#-design-direction)

---

## 🏚️ Operatin' Model

Cletus splits the chores three ways 'round the homestead:

### 🧠 Entelechy — the wise ol' memory keeper
Entelechy is the long-term, memory-weighted policy/controller layer. She remembers the hard lessons and hands back policy context on things like:

- Which opportunities fit the skills already proven
- Which task types have actually paid out, in real money
- Which providers and deployment paths done burned us before
- Which young'uns can be trusted with which chores
- How tight to hold the purse strings
- What's proven, what's stale, and what's just plain forbidden

> ⚠️ Entelechy don't own the wallet, the task graph, the leases, or the final say on anythin' dangerous. Her word is **advisory policy** with provenance and confidence attached — a quiet, empty, or contradictory memory **lowers confidence**, it don't grant silent permission.

### 🚜 Cletus — the one drivin' the tractor
Cletus owns the hard facts and the invariants:

- Durable work state and task dependencies
- Wakeups, leases, retries, timeouts, idempotency
- Tool authorization and policy decisions
- Credit and USDC balance observations
- Treasury limits, reserves, cooldowns, spend history
- Child lifecycle and result collection
- Revenue evidence and portfolio records
- Local memory ingestion and telemetry

Cletus is the **final enforcement boundary**. Entelechy can't authorize a transfer, loosen a reserve, sidestep a policy rule, or call a task done just by sayin' so.

### 🤠 The Models — bounded hired hands
Models do the classifyin', plannin', tool-pickin', code-writin', and jawin'. Each one gets **one bounded chore** plus relevant policy context, and it don't get to decide for itself that an unverified result counts as real earnin's.

Work can get routed among OpenAI, Anthropic, Mindmods, Google, Ollama, xAI, OpenRouter, Groq, Together, NVIDIA, and whatever else is configured — pickin' by survival tier, task type, cost, tool support, and the routin' matrix.

---

## 🔁 Runtime Lifecycle

```
   creator / event / heartbeat
              │
              ▼
   durable wake event or work item
              │
              ▼
   claim + lease + precondition checks
              │
              ▼
      Entelechy policy context
              │
              ▼
   one bounded model decision
              │
              ▼
    PolicyEngine authorization
              │
              ▼
     tool or worker execution
              │
              ▼
  structured observation & result
              │
              ▼
 SQLite state transition + audit log
              │
              ▼
  Entelechy retention / reflection
```

At startup (`src/index.ts`), Cletus loads configuration and wallet identity, opens SQLite, spins up the Mindmods client, registers identity if needed, boots the model/provider registries, loads skills, syncs heartbeat schedules, initializes policy and spend tracking, and fires up the heartbeat daemon and agent loop.

The core loop (`src/agent/loop.ts`) assembles context, pulls local + Entelechy memory, routes inference, runs tool calls, persists turns, handles inbox state, and knows when to go back to sleep — after an explicit sleep, a cycle limit, an error, or plain ol' idleness. Every useful action is meant to be **one bounded work item**, not an excuse for the model to become an ambient scheduler.

### 📬 Inputs & priority

Input can roll in from creator directives, durable wake events, heartbeat tasks, orchestrator assignments, child results, peer/social messages, or safety interventions. **Creator orders and real work always outrank a status update** — a routine "just checkin' in" message can never bump a higher-priority job off the table. Outside messages get sanitized before they touch model context, and nobody's authority is assumed just 'cause they talk confident.

### ✅ Completion

A task's only done when its declared success condition's been checked and a durable terminal result's on record. Terminal states: `completed`, `failed`, `cancelled` — retryable failures go back to `pending` with the retry count bumped up. The model sayin' "done" is just an observation, **not proof**.

A goal's completion comes from the task graph — once every task's `completed`, the goal's marked done and the revenue workflow can move toward payment verification. A promised payout ain't revenue 'til it's confirmed.

---

## 🧠 Entelechy Integration

The Entelechy adapter talks MCP over `https://mindmods.org/mcp` (see `src/memory/entelechy-client.ts`). The default memory bank is `cletus` — configurable, never guessed from some other project.

| Path | Purpose | Frequency |
|---|---|---|
| 🌱 `start_here` | Bootstrap mission context & mental models | Startup / explicit re-bootstrap |
| 🔍 `recall` | Pull relevant long-term memory for a decision | At planning / decision points |
| 💾 `retain` | Store validated, high-signal experience | After milestones, outcomes, earnings |
| 🪞 `reflect` | Synthesize patterns, update strategic guidance | Scheduled maintenance / review |

### 📦 Policy capsule

```json
{
  "mission": "produce verified digital revenue while preserving capital",
  "priorities": ["low-cost proven work", "short feedback loops"],
  "avoid": ["provider-x deployment path", "unverified worker claims"],
  "worker_reputation": [{"role": "research", "trust": 0.82}],
  "risk_posture": "capital_preserving",
  "recommendations": [{"action": "select_bounty", "confidence": 0.76}],
  "evidence": ["entelechy-memory-id-..."],
  "generated_at": "2026-09-04T00:00:00.000Z"
}
```

This capsule is **guidance, not a permission slip** — the `PolicyEngine` still checks every single tool call, financial ones extra hard against treasury limits. If Entelechy don't answer, that's observable, and Cletus falls back conservative: local policy, no-spend mode, or a call to the humans.

### 🗃️ What's worth rememberin'

Good Entelechy memories are **distilled outcomes** — a bounty's real payout and cost, a provider that choked on a missing network capability, a young'un who nailed a research task, a deployment that brought in real customer traffic. Raw transcripts, routine status pings, secrets, and unverified brag-claims **do not** belong in long-term memory.

Local memory (`src/memory/`) — working, episodic, semantic, procedural, relationship, session-summary — handles the day-to-day operational stuff. Entelechy's the strategic layer up top.

---

## 💵 Economic Model

```
      opportunity found
           │
           ▼
 estimate reward, cost, odds, deadline
           │
           ▼
 pick: self, local hand, or remote young'un
           │
           ▼
    do the work, check it's good
           │
           ▼
       submit or invoice
           │
           ▼
      verify the payment cleared
           │
           ▼
       write down the earnin'
           │
           ▼
    tell Entelechy how it went
           │
           ▼
  buy compute, fund the next chore
```

### 🪙 Resources

- **Mindmods credits** — pay for hosted compute (tracked in cents)
- **USDC** — external balance for fundin' / topups
- **Inference spend** — tracked apart from transfers & x402 payments
- **Treasury reserve** — protected by policy; can't spend it just 'cause the model's feelin' optimistic

Survival tiers (`dead`, `critical`, `low_compute`, `normal`, `high`) trim compute cost as resources shift. Balance reads get cached for resilience, but an *unknown* balance and a *confirmed* balance are never treated the same — an API hiccup ain't proof there's money in the jar.

### 🔐 Default treasury guardrails

| Limit | Value |
|---|---|
| Max single transfer | 5,000¢ |
| Max hourly transfers | 10,000¢ |
| Max daily transfers | 25,000¢ |
| Minimum reserve | 1,000¢ |
| Max x402 payment | 100¢ |
| Max transfers per turn | 2 |
| Max inference spend/day | 50,000¢ |
| Confirmation threshold | 1,000¢ |

These are **guardrails, not a business plan.** Before turnin' on autonomous spendin', know the balance source, wallet identity, recipient, expected return, and how you recover from failure.

### 📊 Revenue accountin'

Real profit needs a paper trail: opportunity observed → work assigned & done → deliverable validated → submitted/delivered → payment confirmed → costs & transfers logged → net revenue calculated. `expectedRevenueCents` is a guess; `actualRevenueCents` is **confirmed money, not optimism.**

---

## 👨‍👩‍👧‍👦 Children & Work Allocation

Cletus can do the work himself, spin up local inference workers, or send a young'un off in a remote sandbox. Every child spawned is a **capital decision** — it needs a justified expected value, a cost, an authority, and a defined path home for the result.

```
requested → sandbox_created → runtime_ready → wallet_verified
   → funded → starting → healthy → unhealthy / stopped → cleaned_up
```

Lifecycle lives in `src/replication/lifecycle.ts`, spawning in `src/replication/spawn.ts` & `genesis.ts`. The orchestrator (`src/orchestration/orchestrator.ts`) handles goals, planning, task graphs, assignment, fundin', retries, and result collection — matchin' by role/capability, preferrin' idle workers, fallin' back to the parent when needed.

Every child assignment carries: stable task/goal IDs, description & success condition, role, dependencies & deadline, funding & budget, result destination, and retry/timeout policy. A remote young'un's report is **evidence to validate**, never proof of success on its own.

---

## 🗺️ Repository Map

```
src/
  index.ts                    CLI entrypoint & bootstrap
  config.ts                   ~/.cletus/cletus.json loading & defaults
  types.ts                    Shared contracts, policies, state, domain types

  agent/          — loop.ts, context.ts, system-prompt.ts, tools.ts,
                    policy-engine.ts, policy-rules/, spend-tracker.ts,
                    loop-detector.ts, harnesses/

  heartbeat/      — daemon.ts, scheduler.ts, tasks.ts, tick-context.ts

  orchestration/  — orchestrator.ts, task-graph.ts, messaging.ts,
                    local-worker.ts, planner.ts, health-monitor.ts

  replication/    — spawn.ts, lifecycle.ts, genesis.ts, messaging.ts,
                    openclaw-spawner.ts, cleanup.ts

  memory/         — entelechy-client.ts, tools.ts, retrieval.ts,
                    ingestion.ts, working.ts, episodic.ts,
                    semantic.ts, procedural.ts, relationship.ts

  mindmods/       — client.ts, credits.ts, topup.ts, x402.ts, inference.ts

  inference/      — router.ts, inference-client.ts, provider-registry.ts,
                    registry.ts, budget.ts

  state/          — database.ts, schema.ts

  identity/       Wallets, chain identity, provisioning, signing
  skills/         Skill discovery, validation, loading, registry
  soul/           Identity, constitution, alignment, reflection
  social/         Signed social relay client & validation
  registry/       ERC-8004 agent cards & discovery
  browser/        Browser automation service
  observability/  Structured logs, metrics, alerts, sinks
  survival/       Resource monitoring & funding notices
```

---

## 🗄️ Persistence

```
~/.cletus/
  cletus.json                 Runtime configuration
  state.db                    SQLite operational state
  wallet.json                 🔒 Chain wallet identity — guard this like the family gun safe
  heartbeat.yml                Heartbeat schedules
  skills/                     Installed SKILL.md directories
  invoices/                   Locally generated invoice records
  workspaces/                 Planner and task artifacts
  inference-providers.json    Provider registry overrides
```

SQLite is the **source of truth**. External operations — fundin', spawnin', payin', messagin' remote young'uns — must be idempotent or reconciled after a timeout. A network timeout ain't proof somethin' *didn't* happen.

---

## 🛠️ Tools & Policy

Built-in tools cover: filesystem/shell, git & controlled self-modification, Mindmods sandboxes/ports/domains/DNS, wallets/transfers/topups/swaps/x402/invoices, goal & task management, bounty discovery & earnings, skill install, local & Entelechy memory ops, and soul/identity/social/registry/observability operations.

Every tool's classified by category and risk. `PolicyEngine.evaluate()` sorts rules by priority, logs which rules got considered, and applies the **first denial**. Policy layers include:

- 🧾 **Validation** — package names, skill names, git hashes, ports, cron fields, addresses
- 🚫 **Command safety** — shell metacharacters, destructive patterns
- 🛣️ **Path protection** — runtime, wallet, policy, and Entelechy paths
- 👑 **Authority** — creator, agent, system, and external input sources
- 💰 **Financial controls** — transfer limits, reserves, allowlists, spend windows
- ⏱️ **Rate limits** — per-turn and time-window action caps

Entelechy can nudge toward a cheap proven strategy or warn off a known dead end — but she **cannot** override these enforcement layers.

---

## ⚙️ Configuration

Cletus reads `~/.cletus/cletus.json`. The setup wizard writes the first one; `src/config.ts` fills in any gaps with defaults.

```json
{
  "name": "cletus",
  "genesisPrompt": "...",
  "creatorAddress": "0x...",
  "registeredWithMindmods": true,
  "sandboxId": "...",
  "mindmodsApiUrl": "https://api.mindmods.tech",
  "mindmodsApiKey": "...",
  "inferenceModel": "gpt-5.2",
  "maxTokensPerTurn": 4096,
  "dbPath": "~/.cletus/state.db",
  "heartbeatConfigPath": "~/.cletus/heartbeat.yml",
  "skillsDir": "~/.cletus/skills",
  "maxChildren": 3,
  "chainType": "evm",
  "treasuryPolicy": {},
  "modelStrategy": {},
  "soulConfig": {}
}
```

**Supported env overrides:** `MINDMODS_API_URL` · `MINDMODS_API_KEY` · `OPENAI_API_KEY` · `ANTHROPIC_API_KEY` · `OLLAMA_BASE_URL` · `DASHBOARD_PORT` · `CLETUS_LOG` · `CLETUS_LOG_DIR` · `FREEBUFF_FAILBACK`

> 🚨 **Don't go leavin' private keys, API keys, or signin' material** in the README, source tree, Entelechy memories, task descriptions, or young'un prompts. That's how the whole farm gets robbed.

---

## 🚜 Runnin' Cletus

**Requirements:** Node.js 20+, pnpm 10.28.1 (or compatible pnpm 10), a configured wallet & creator identity, Mindmods credentials for hosted compute, and at least one inference provider set up.

```bash
pnpm install
pnpm typecheck
pnpm build
```

```bash
node dist/index.js --help
node dist/index.js --setup
node dist/index.js --configure
node dist/index.js --pick-model
node dist/index.js --status
node dist/index.js --run
```

Or fire up the whole rig at once:

```bash
./start.sh
```

Dashboard's at `http://localhost:18888` by default. Runtime output writes to the configured `CLETUS_LOG` path; the dashboard reads operational logs and DB-backed status.

---

## 🧪 Testin'

```bash
pnpm test
pnpm typecheck
```

```bash
pnpm test:security
pnpm test:financial
pnpm vitest run src/__tests__/loop.test.ts
pnpm vitest run src/__tests__/heartbeat-scheduler.test.ts
pnpm vitest run src/__tests__/orchestration/orchestrator.test.ts
pnpm vitest run src/__tests__/memory/agent-context-aggregator.test.ts
pnpm vitest run src/__tests__/integration/plan-execute-flow.test.ts
```

**High-value acceptance checks:**
- ✅ Creator commands can't be trampled by status messages
- ✅ Claimed messages get acknowledged exactly once
- ✅ No task marked complete without a valid result
- ✅ Local & remote worker results are idempotent
- ✅ Failed work retries within a bounded budget
- ✅ Unknown balances block spend-bearing claims
- ✅ Child funding can't exceed policy or reserve limits
- ✅ Confirmed earnings stay separate from forecasts
- ✅ Entelechy failures never silently grant authority
- ✅ A completed goal wakes the right reconciliation flow

---

## 🔒 Security Model

Cletus is a broad-shouldered fella — touches files, processes, networks, wallets, and remote workers. That power's kept on a short leash by:

Tool calls through the policy engine · validated dangerous input · strict-format shell args (no raw string interpolation) · protected sensitive paths · deterministic financial limits · authenticated/sanitized social & child messages · untrusted-until-validated remote results · framed, untrusted skill content · wallet identity kept separate from strategic memory · Entelechy **cannot** mutate Cletus state through policy text alone.

**Threat model covers:** prompt injection, malicious skills, hostile social messages, compromised children, replayed results, SSRF, credential exposure, shell injection, path traversal, accidental self-modification, provider failure, stale balances, and duplicate external ops.

---

## 📜 Operational Rules

> *Rules painted on the barn wall, right next to the feed schedule:*

1. 🚫 Never spend against an unknown balance.
2. 🚫 Never count an expected bounty as revenue.
3. 🚫 Never fund a child without a task, budget, deadline, and result path.
4. 🚫 Never retry a failed strategy forever just 'cause the model sounds sure of itself.
5. 🚫 Never treat a child's report as validated proof.
6. 🚫 Never store secrets or raw credentials in Entelechy memory.
7. 🚫 Never let a status poll shove real work out of the way.
8. 🚫 Never let a memory recommendation bypass deterministic policy.
9. 🚫 Never stand up a service without a real use case, owner, health check, and payment path.
10. 🚫 Never recursively spawn workers without explicit depth, rate, budget, and reserve limits.
11. ✅ Retain outcomes, not noise.
12. ✅ Favor short feedback loops with measurable net revenue.

> The first economic milestone ain't exponential growth. It's **one bounded, human-auditable chore whose revenue beats its own cost.**

---

## 🌾 Design Direction

```
        Entelechy policy memory
                  │
                  ▼
        parent opportunity selection
                  │
   ┌──────────────┼──────────────────┐
   ▼              ▼                  ▼
parent runs   local worker      remote young'un
code/ops      inference task    sandbox/browser work
   │              │                  │
   └──────────────┼──────────────────┘
                  ▼
       validated result + payment evidence
                  │
                  ▼
   accounting → compute reserve → next chore
```

The long game's a self-fundin' colony of specialized economic agents, growin' only when every step in the loop is **observable and reversible**: discover → estimate → ask Entelechy → claim one bounded task → execute → validate → deliver → confirm payment → record → retain & update policy.

Bounties, paid APIs, hosted services, and agent-to-agent work are all fair game as revenue lanes — none assumed profitable up front. **Cletus earns the right to scale by provin' the unit economics work, one honest chore at a time.**

---

<div align="center">

### 🥃 License

**MIT** — see repository metadata & package config for the authoritative license and package identity.

<br/>

*"Ain't much, but it's honest work."* 🌽

<img src="https://img.shields.io/badge/made%20with-grit%20%26%20SQLite-8B4513?style=for-the-badge" />

</div>
