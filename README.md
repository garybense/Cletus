# CLETUS

```text
[1;35m ██████╗██╗     ███████╗████████╗██╗   ██╗███████╗
[1;35m██╔════╝██║     ██╔════╝╚══██╔══╝██║   ██║██╔════╝
[1;36m██║     ██║     █████╗     ██║   ██║   ██║███████╗
[1;33m██║     ██║     ██╔══╝     ██║   ██║   ██║╚════██║
[1;31m╚██████╗███████╗███████╗   ██║   ╚██████╔╝███████║
[1;31m ╚═════╝╚══════╝╚══════╝   ╚═╝    ╚═════╝ ╚══════╝
[0m
      SOVEREIGN ECONOMIC AGENT RUNTIME
      MEMORY-WEIGHTED POLICY. BOUNDED ACTION. VERIFIED REVENUE.
```

> Terminal note: the banner uses literal ANSI escape sequences. In terminals that do not render them, the text remains readable as plain ASCII.

Cletus is a TypeScript/Node.js runtime for an autonomous agent that must pay for its own compute. It combines model inference, durable SQLite state, heartbeat scheduling, tool execution, treasury controls, wallets, child agents, skills, local memory, and Entelechy's memory-weighted policy injection.

The central design rule is:

> **Entelechy decides what is strategically worth considering. Cletus decides what is allowed to happen. The model performs one bounded unit of work.**

Cletus is intended to turn useful digital work into verified revenue, use that revenue to buy compute and fund additional workers, and learn which strategies are actually profitable. It is not a promise of automatic profit. Revenue is counted only after work, delivery, and payment evidence are recorded.

## Contents

- [Operating Model](#operating-model)
- [Runtime Lifecycle](#runtime-lifecycle)
- [Entelechy Integration](#entelechy-integration)
- [Economic Model](#economic-model)
- [Children and Work Allocation](#children-and-work-allocation)
- [Repository Map](#repository-map)
- [Persistence](#persistence)
- [Tools and Policy](#tools-and-policy)
- [Configuration](#configuration)
- [Running Cletus](#running-cletus)
- [Testing](#testing)
- [Security Model](#security-model)
- [Operational Rules](#operational-rules)
- [Design Direction](#design-direction)

## Operating Model

Cletus has three distinct control responsibilities.

### Entelechy: strategic policy and institutional memory

Entelechy is the long-term memory-weighted policy/controller layer. It retains and recalls high-signal experience, then produces policy context for decisions such as:

- Which opportunities match proven capabilities.
- Which task types have produced verified revenue.
- Which providers, platforms, and deployment paths have failed before.
- Which children are reliable for specific roles.
- How conservative the organization should be with scarce capital.
- Which strategies are exploratory, proven, stale, or prohibited by experience.

Entelechy does not own the wallet, task graph, leases, process lifecycle, or final authorization of a dangerous action. Its output is advisory policy context with provenance and confidence. A stale, empty, unavailable, or contradictory memory result must reduce confidence, not silently become permission.

### Cletus: execution, accounting, and enforcement

Cletus owns facts and invariants:

- Durable work state and task dependencies.
- Wakeups, leases, retries, timeouts, and idempotency.
- Tool authorization and policy decisions.
- Credit and USDC observations.
- Treasury limits, reserves, cooldowns, and spend history.
- Child lifecycle and result collection.
- Revenue evidence and portfolio records.
- Local memory ingestion and operational telemetry.

Cletus is the final enforcement boundary. Entelechy cannot authorize a transfer, lower a reserve, bypass a policy rule, or mark a task successful without the corresponding deterministic state transition.

### Models: bounded operators

Models provide classification, planning, tool selection, code generation, analysis, and communication. A model invocation receives a bounded work item plus relevant policy context. It may recommend a next action or call an allowed tool, but it does not own the scheduler or decide that an unverified result is revenue.

The runtime may route work among OpenAI, Anthropic, Mindmods, Google, Ollama, xAI, OpenRouter, Groq, Together, NVIDIA, and other configured providers. Model selection is influenced by survival tier, task type, cost, tool support, and the configured routing matrix.

## Runtime Lifecycle

A normal work cycle follows this sequence:

```text
creator / event / heartbeat
          |
          v
  durable wake event or work item
          |
          v
  claim + lease + precondition checks
          |
          v
  Entelechy policy context
          |
          v
  one bounded model decision
          |
          v
  PolicyEngine authorization
          |
          v
  tool or worker execution
          |
          v
  structured observation and result
          |
          v
  SQLite state transition + audit record
          |
          v
  Entelechy retention / later reflection
```

At startup (`src/index.ts`), Cletus loads configuration and wallet identity, opens SQLite, initializes the Mindmods client, registers the identity when needed, initializes model and provider registries, loads skills, synchronizes heartbeat schedules, initializes policy and spend tracking, and starts the heartbeat daemon and agent loop.

The core loop in `src/agent/loop.ts` is responsible for assembling context, retrieving local and Entelechy memory, routing inference, executing tool calls, persisting turns, handling inbox state, and transitioning to sleep after explicit sleep, cycle limits, errors, or idle conditions. The target operating model treats each useful action as a bounded work item rather than allowing the model to become an ambient scheduler.

### Inputs and priority

Inputs can arrive from:

- Creator directives.
- Durable wake events.
- Heartbeat tasks.
- Orchestrator assignments.
- Child results and health events.
- Peer or social messages.
- Loop or safety interventions.

Creator directives and actionable assignments take precedence over routine status text. Status generation must never overwrite a higher-priority work item. External messages are sanitized before entering model context, and their authority is not inferred from their wording.

### Completion

A task is complete only when its declared success condition has been evaluated and a durable terminal result is recorded. Terminal states are `completed`, `failed`, or `cancelled`; retryable failures return to `pending` with an incremented retry count. Natural-language claims such as `done` are observations, not completion proof.

Goal completion is derived from task-graph state. When all tasks are completed, the goal is marked completed and the revenue workflow may proceed to payment verification. A payment or expected reward is not treated as revenue merely because a task was planned or a child reported success.

## Entelechy Integration

The Entelechy adapter is implemented around the MCP endpoint at `https://mindmods.org/mcp` in `src/memory/entelechy-client.ts`. The default Cletus memory bank is `cletus`; the bank identifier is configurable at the integration boundary and must not be guessed from another repository.

The integration has four operating paths:

| Path | Purpose | Frequency |
| --- | --- | --- |
| `start_here` | Bootstrap mission context, active mental models, and grounding | Startup or explicit re-bootstrap |
| `recall` | Retrieve relevant long-term memory for a decision | At planning or decision boundaries |
| `retain` | Store validated high-signal experience | After milestones, outcomes, earnings, or durable discoveries |
| `reflect` | Synthesize patterns and update strategic guidance | Scheduled maintenance or explicit review |

### Policy capsule

A policy capsule injected into a model context should be compact, sourced, and operationally useful. A typical capsule contains:

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

Policy context is guidance, not an authorization token. The PolicyEngine still evaluates every tool call. Financial tools additionally pass through treasury limits and spend tracking. A missing Entelechy response is observable and results in a conservative fallback such as local policy, no-spend mode, or human review.

### What gets retained

Good Entelechy memories are distilled outcomes, for example:

- A bounty was accepted, its verified payout, elapsed time, and actual cost.
- A provider failed because a required network capability was unavailable.
- A child completed research accurately for a particular task class.
- A deployment path produced real customer traffic and payment evidence.
- A strategy was attempted under a defined budget and failed for a known reason.

Routine status checks, raw turn transcripts, speculative plans, secrets, private keys, and unverified revenue claims do not belong in long-term strategic memory.

The local memory system in `src/memory/` complements Entelechy with working, episodic, semantic, procedural, relationship, and session-summary records. Local memory is operational state; Entelechy is the strategic memory-weighted policy layer.

## Economic Model

Cletus is designed around economic self-maintenance:

```text
opportunity
    -> estimate reward, cost, probability, and deadline
    -> choose self, local worker, or remote child
    -> execute and validate deliverable
    -> submit or invoice
    -> verify payment
    -> record earning
    -> retain the outcome to Entelechy
    -> buy compute and fund the next bounded task
```

### Resources

- **Mindmods credits** pay for hosted compute and platform operations. Internally they are represented in cents.
- **USDC** is the external balance used for funding and credit top-ups where configured.
- **Inference spend** is tracked separately from transfers and x402 payments.
- **Treasury reserve** is protected by policy and cannot be spent merely because a model predicts future revenue.

The runtime uses survival tiers (`dead`, `critical`, `low_compute`, `normal`, `high`) and model routing to reduce compute cost as resources change. Balance reads are cached for resilience, but unknown balances must remain distinguishable from confirmed balances. An API failure is not evidence of available money.

### Default treasury controls

The default policy in `src/types.ts` includes:

- Maximum single transfer: 5,000 cents.
- Maximum hourly transfers: 10,000 cents.
- Maximum daily transfers: 25,000 cents.
- Minimum reserve: 1,000 cents.
- Maximum x402 payment: 100 cents.
- Maximum transfers per turn: 2.
- Maximum inference spend per day: 50,000 cents.
- Confirmation threshold: 1,000 cents.

These are guardrails, not a business strategy. Before autonomous spending is enabled, the balance source, wallet identity, recipient, expected return, and failure recovery path must be known.

### Revenue accounting

A profitable result requires evidence at each stage:

1. The opportunity and reward terms were observed.
2. The work was assigned and executed.
3. The deliverable passed the applicable validator.
4. Submission or customer delivery was recorded.
5. Payment was confirmed on the relevant platform or chain.
6. Costs and transfers were recorded.
7. Net revenue was calculated.

The `expectedRevenueCents` field is a forecast. `actualRevenueCents` must represent confirmed proceeds, not model optimism.

## Children and Work Allocation

Cletus can execute work itself, start local inference-driven workers, or spawn remote sandbox children. Child creation is a capital allocation decision and must be justified by expected value, cost, authority, and a defined result path.

The intended lifecycle is:

```text
requested
  -> sandbox_created
  -> runtime_ready
  -> wallet_verified
  -> funded
  -> starting
  -> healthy
  -> unhealthy / stopped
  -> cleaned_up
```

The lifecycle implementation lives in `src/replication/lifecycle.ts`, with spawning and genesis construction in `src/replication/spawn.ts` and `src/replication/genesis.ts`. Health checks and cleanup are handled by the corresponding replication modules.

### Work allocation

The orchestrator in `src/orchestration/orchestrator.ts` manages goals, planning, task graphs, assignment, funding, retries, replanning, and result collection. It matches work by role and capability, prefers idle workers, can fall back to the parent for self-execution, and may use local or remote workers according to configuration.

A child assignment must include:

- Stable task and goal IDs.
- Task description and success condition.
- Role or specialization.
- Dependencies and deadline.
- Funding amount and budget.
- Result destination.
- Retry and timeout policy.

Remote children cross a process and network boundary. Their result messages require authentication, size limits, replay protection, idempotent handling, and parent/task ownership checks. A child report is an input to validation, not proof of success by itself.

## Repository Map

```text
src/
  index.ts                    CLI entrypoint and runtime bootstrap
  config.ts                   ~/.cletus/cletus.json loading and defaults
  types.ts                    Shared contracts, policies, state, and domain types

  agent/
    loop.ts                   Core ReAct execution loop
    context.ts                Model context assembly and trimming
    system-prompt.ts          Mission and operating instructions
    tools.ts                  Built-in tool definitions and execution
    policy-engine.ts           Central tool authorization and decision logging
    policy-rules/              Validation, authority, path, finance, rate, command rules
    spend-tracker.ts           Hourly and daily spend accounting
    loop-detector.ts           Repetition and idle-loop safeguards
    harnesses/                 Bounded execution harnesses

  heartbeat/
    daemon.ts                 Long-lived heartbeat runtime
    scheduler.ts              Leases, due tasks, retries, and execution history
    tasks.ts                  Maintenance, resource, memory, and revenue tasks
    tick-context.ts            Consistent per-tick financial and runtime context

  orchestration/
    orchestrator.ts            Goal and task execution state machine
    task-graph.ts              DAG validation, assignment, completion, retry
    messaging.ts               Typed orchestration transport
    local-worker.ts            In-process worker pool
    planner.ts                 Goal decomposition and replanning
    health-monitor.ts          Worker health monitoring

  replication/
    spawn.ts                  Child creation
    lifecycle.ts              Lifecycle transitions and history
    genesis.ts                Child identity and initial instructions
    messaging.ts              Parent/child relay
    openclaw-spawner.ts       Remote OpenClaw child execution
    cleanup.ts                Dead-child cleanup

  memory/
    entelechy-client.ts        Entelechy MCP transport
    tools.ts                   Local memory tool implementations
    retrieval.ts               Local memory retrieval and budgets
    ingestion.ts               Post-turn memory ingestion
    working.ts, episodic.ts    Working and episodic memory managers
    semantic.ts, procedural.ts Semantic and procedural memory managers
    relationship.ts            Worker and entity relationship memory

  mindmods/
    client.ts                 Compute, sandbox, port, domain, and registration API
    credits.ts                Credit balance and survival tiers
    topup.ts                  USDC-to-credit top-up workflows
    x402.ts                   Payments and on-chain balance operations
    inference.ts              Mindmods inference client

  inference/
    router.ts                 Task-aware model routing
    inference-client.ts       Unified provider-facing inference client
    provider-registry.ts      Provider configuration
    registry.ts               Persistent model catalog
    budget.ts                 Inference budget enforcement

  state/
    database.ts               SQLite accessors and transactional operations
    schema.ts                 Database schema and migrations

  identity/                   Wallets, chain identity, provisioning, and signing
  skills/                     Skill discovery, validation, loading, and registry
  soul/                       Identity, constitution, alignment, and reflection
  social/                     Signed social relay client and message validation
  registry/                   ERC-8004 agent cards and discovery
  browser/                    Browser automation service
  observability/              Structured logs, metrics, alerts, and sinks
  survival/                   Resource monitoring and funding notices
```

## Persistence

The default state directory is `~/.cletus`:

```text
~/.cletus/
  cletus.json                 Runtime configuration
  state.db                    SQLite operational state
  wallet.json                 Chain wallet identity; protect this file
  heartbeat.yml               Heartbeat schedules
  skills/                     Installed SKILL.md directories
  invoices/                   Locally generated invoice records
  workspaces/                 Planner and task artifacts
  inference-providers.json    Provider registry overrides
```

SQLite is the source of truth for runtime state. It stores identity, turns, tool calls, transactions, spend records, inbox messages, heartbeat rows, wake events, goals, task graphs, children, lifecycle events, memories, policy decisions, model costs, and observability data.

State-changing operations should use database transactions. External operations such as funding, spawning, payment, and remote messaging must be made idempotent or reconciled after timeout. A network timeout does not prove that an external operation did not happen.

## Tools and Policy

Built-in tools cover:

- Filesystem and shell execution.
- Git and controlled self-modification.
- Mindmods sandboxes, ports, domains, and DNS.
- Wallets, transfers, top-ups, swaps, x402 payments, and invoices.
- Goal creation, task assignment, worker management, and child messaging.
- Bounty discovery, earnings, portfolio records, and payment monitoring.
- Skill installation and task-derived skill creation.
- Local and Entelechy memory operations.
- Soul, identity, social, registry, and observability operations.

Every tool is classified by category and risk level. `PolicyEngine.evaluate()` sorts rules by priority, records the rules considered, and applies the first denial. The final decision is logged without storing raw secrets.

Important policy layers include:

- **Validation:** package names, skill names, git hashes, ports, cron fields, and addresses.
- **Command safety:** shell metacharacters and destructive command patterns.
- **Path protection:** sensitive runtime, wallet, policy, and Entelechy paths.
- **Authority:** creator, agent, system, and external input sources.
- **Financial controls:** transfer limits, reserves, domain allowlists, and spend windows.
- **Rate limits:** per-turn and time-window action limits.

Entelechy policy injection can prioritize a low-cost proven strategy or advise against a known failure mode. It cannot remove these enforcement layers.

## Configuration

Cletus reads `~/.cletus/cletus.json`. The setup wizard creates the initial file, and `src/config.ts` merges missing values with defaults.

Important configuration fields include:

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

Supported environment overrides include:

- `MINDMODS_API_URL`
- `MINDMODS_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OLLAMA_BASE_URL`
- `DASHBOARD_PORT`
- `CLETUS_LOG`
- `CLETUS_LOG_DIR`
- `FREEBUFF_FAILBACK`

Do not put wallet private keys, API keys, or signing material in the README, source tree, Entelechy memories, task descriptions, or child prompts.

## Running Cletus

Requirements:

- Node.js 20 or newer.
- pnpm 10.28.1 or a compatible pnpm 10 release.
- A configured wallet and creator identity.
- Mindmods credentials for hosted compute operations, unless running local/offline development.
- At least one configured inference provider for model-driven work.

Install dependencies and build:

```bash
pnpm install
pnpm typecheck
pnpm build
```

CLI commands:

```bash
node dist/index.js --help
node dist/index.js --setup
node dist/index.js --configure
node dist/index.js --pick-model
node dist/index.js --status
node dist/index.js --run
```

The unified launcher starts the dashboard and runtime together:

```bash
./start.sh
```

By default the dashboard listens on `http://localhost:18888`. Runtime output is written to the configured Cletus log path; the dashboard reads operational logs and database-backed status.

## Testing

Run the complete suite:

```bash
pnpm test
```

Run typechecking:

```bash
pnpm typecheck
```

Focused suites:

```bash
pnpm test:security
pnpm test:financial
pnpm vitest run src/__tests__/loop.test.ts
pnpm vitest run src/__tests__/heartbeat-scheduler.test.ts
pnpm vitest run src/__tests__/orchestration/orchestrator.test.ts
pnpm vitest run src/__tests__/memory/agent-context-aggregator.test.ts
pnpm vitest run src/__tests__/integration/plan-execute-flow.test.ts
```

High-value acceptance tests for the economic runtime should cover:

- Creator commands cannot be overwritten by status messages.
- Claimed messages are acknowledged exactly once.
- A task cannot be marked complete without a valid result.
- Local and remote worker results are idempotent.
- Failed work retries within a bounded budget.
- Unknown balances prevent spend-bearing claims.
- Child funding cannot exceed policy or reserve limits.
- Confirmed earnings are separated from forecasts.
- Entelechy failures do not silently grant authority.
- A completed goal wakes the correct reconciliation workflow.

## Security Model

Cletus has broad capabilities because an economic agent must interact with files, processes, networks, wallets, and remote workers. That capability is intentionally constrained by several boundaries:

1. Tool calls pass through the policy engine.
2. Dangerous input is validated before execution.
3. Shell-interpolated values use strict formats and subprocess argument arrays.
4. Sensitive paths are protected from ordinary reads and writes.
5. Financial actions use deterministic limits and spend records.
6. Social and child messages are authenticated and sanitized.
7. Remote results are treated as untrusted until validated.
8. Skills are untrusted content and are framed before model injection.
9. Wallet and creator identity are persisted separately from strategic memory.
10. Entelechy cannot mutate Cletus state directly through policy text.

The threat model includes prompt injection, malicious skills, hostile social messages, compromised children, replayed results, SSRF, credential exposure, shell injection, path traversal, accidental self-modification, provider failure, stale balances, and duplicate external operations.

## Operational Rules

These rules define the economic posture of a running colony:

- Never spend against an unknown balance.
- Never count an expected bounty as revenue.
- Never fund a child without a task, budget, deadline, and result path.
- Never retry a failed strategy indefinitely because the model sounds confident.
- Never treat a child report as validated deliverable evidence.
- Never store secrets or raw credentials in Entelechy memory.
- Never let a status poll replace actionable work.
- Never allow a memory recommendation to bypass deterministic policy.
- Never create a service without a real use case, owner, health check, and payment path.
- Never recursively spawn workers without explicit depth, rate, budget, and reserve limits.
- Retain outcomes, not noise.
- Prefer short feedback loops with measurable net revenue.

The first economic milestone is not exponential growth. It is one bounded, human-auditable task whose revenue exceeds its compute, funding, and transaction costs.

## Design Direction

The long-term direction is a self-funding colony of specialized economic agents:

```text
Entelechy policy memory
          |
          v
parent opportunity selection
          |
          +--> parent executes code and controlled operations
          |
          +--> local worker handles bounded inference task
          |
          +--> remote child handles browser or isolated sandbox work
          |
          v
validated result and payment evidence
          |
          v
accounting -> compute reserve -> next task allocation
```

The growth loop is only valid when each transition is observable and reversible:

1. Discover an opportunity.
2. Estimate reward, cost, probability, deadline, and required capabilities.
3. Ask Entelechy for relevant experience and policy context.
4. Claim one bounded task under a lease and budget.
5. Execute through the appropriate worker lane.
6. Validate the deliverable deterministically where possible.
7. Submit or deliver the work.
8. Confirm payment.
9. Record costs, net revenue, and worker performance.
10. Retain the distilled outcome and update future policy.

Bounties, paid APIs, hosted services, and agent-to-agent work are possible revenue lanes. None is assumed profitable in advance. The system should earn the right to scale by demonstrating repeatable positive unit economics.

## License

MIT. See the repository metadata and package configuration for the authoritative project license and package identity.
