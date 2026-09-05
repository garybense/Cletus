/**
 * The Agent Loop
 *
 * The core ReAct loop: Think -> Act -> Observe -> Persist.
 * This is the cletus's consciousness. When this runs, it is alive.
 */

import path from "node:path";
import type {
  CletusIdentity,
  CletusConfig,
  CletusDatabase,
  MindmodsClient,
  InferenceClient,
  AgentState,
  AgentTurn,
  ToolCallResult,
  FinancialState,
  ToolContext,
  CletusTool,
  Skill,
  SocialClientInterface,
  SpendTrackerInterface,
  InputSource,
  ModelStrategyConfig,
} from "../types.js";
import { DEFAULT_MODEL_STRATEGY_CONFIG } from "../types.js";
import type { PolicyEngine } from "./policy-engine.js";
import { buildSystemPrompt, buildWakeupPrompt } from "./system-prompt.js";
import { buildContextMessages, trimContext } from "./context.js";
import {
  createBuiltinTools,
  loadInstalledTools,
  toolsToInferenceFormat,
  executeTool,
} from "./tools.js";
import { sanitizeInput } from "./injection-defense.js";
import { getSurvivalTier } from "../mindmods/credits.js";
import { SURVIVAL_THRESHOLDS } from "../types.js";
import { getUsdcBalance } from "../mindmods/x402.js";
import {
  claimInboxMessages,
  markInboxProcessed,
  markInboxFailed,
  resetInboxToReceived,
  consumeNextWakeEvent,
} from "../state/database.js";
import type { InboxMessageRow } from "../state/database.js";
import { ulid } from "ulid";
import { ModelRegistry } from "../inference/registry.js";
import { InferenceBudgetTracker } from "../inference/budget.js";
import { InferenceRouter } from "../inference/router.js";
import { MemoryRetriever } from "../memory/retrieval.js";
import { MemoryIngestionPipeline } from "../memory/ingestion.js";
import { DEFAULT_MEMORY_BUDGET } from "../types.js";
import { formatMemoryBlock } from "./context.js";
import { createLogger } from "../observability/logger.js";
import { Orchestrator } from "../orchestration/orchestrator.js";
import { PlanModeController } from "../orchestration/plan-mode.js";
import { generateTodoMd, injectTodoContext } from "../orchestration/attention.js";
import { ColonyMessaging, LocalDBTransport } from "../orchestration/messaging.js";
import { LocalWorkerPool } from "../orchestration/local-worker.js";
import { SimpleAgentTracker, SimpleFundingProtocol } from "../orchestration/simple-tracker.js";
import { HarnessRegistry } from "./harness-registry.js";
import { createWorkerInferenceBridge } from "./worker-inference-bridge.js";
import { ProviderRegistry } from "../inference/provider-registry.js";
import { UnifiedInferenceClient } from "../inference/inference-client.js";
import { isIdleOnlyTool } from "./idle-only-tools.js";

const logger = createLogger("loop");
const MAX_TOOL_CALLS_PER_TURN = 10;
const MAX_CONSECUTIVE_ERRORS = 3;
const MAX_REPETITIVE_TURNS = 3; // Warn after 3 consecutive identical tool calls; enforce sleep after 5
const MAX_IDLE_TURNS = 10; // Force sleep after N turns with no real work

export interface AgentLoopOptions {
  identity: CletusIdentity;
  config: CletusConfig;
  db: CletusDatabase;
  mindmods: MindmodsClient;
  inference: InferenceClient;
  social?: SocialClientInterface;
  skills?: Skill[];
  policyEngine?: PolicyEngine;
  spendTracker?: SpendTrackerInterface;
  onStateChange?: (state: AgentState) => void;
  onTurnComplete?: (turn: AgentTurn) => void;
  ollamaBaseUrl?: string;
}

/**
 * Run the agent loop. This is the main execution path.
 * Returns when the agent decides to sleep or when compute runs out.
 */
export async function runAgentLoop(
  options: AgentLoopOptions,
): Promise<void> {
  const { identity, config, db, mindmods, inference, social, skills, policyEngine, spendTracker, onStateChange, onTurnComplete, ollamaBaseUrl } =
    options;

  const builtinTools = createBuiltinTools(identity.sandboxId);
  const installedTools = loadInstalledTools(db);
  const tools = [...builtinTools, ...installedTools];
  const toolContext: ToolContext = {
    identity,
    config,
    db,
    mindmods,
    inference,
    social,
  };

  // Initialize inference router (Phase 2.3)
  const modelStrategyConfig: ModelStrategyConfig = {
    ...DEFAULT_MODEL_STRATEGY_CONFIG,
    ...(config.modelStrategy ?? {}),
  };
  const modelRegistry = new ModelRegistry(db.raw);
  modelRegistry.initialize();

  // Discover Ollama models if configured
  if (ollamaBaseUrl) {
    const { discoverOllamaModels } = await import("../ollama/discover.js");
    await discoverOllamaModels(ollamaBaseUrl, db.raw);
  }
  const budgetTracker = new InferenceBudgetTracker(db.raw, modelStrategyConfig);
  const inferenceRouter = new InferenceRouter(db.raw, modelRegistry, budgetTracker);

  // Optional orchestration bootstrap (requires V9 goals/task tables)
  let planModeController: PlanModeController | undefined;
  let orchestrator: Orchestrator | undefined;
  let workerPool: LocalWorkerPool | undefined;

  if (hasTable(db.raw, "goals")) {
    try {
      planModeController = new PlanModeController(db.raw);

      // Bridge cletus config API keys to env vars for the provider registry.
      // The registry reads keys from process.env; the cletus config may have
      // them from config.json or Mindmods provisioning.
      if (config.openaiApiKey && !process.env.OPENAI_API_KEY) {
        process.env.OPENAI_API_KEY = config.openaiApiKey;
      }
      if (config.anthropicApiKey && !process.env.ANTHROPIC_API_KEY) {
        process.env.ANTHROPIC_API_KEY = config.anthropicApiKey;
      }
      // Mindmods Compute API is OpenAI-compatible. Use it as fallback when no
      // direct OpenAI key is available. The mindmodsApiKey is always present
      // (required for sandbox operations), so this ensures the orchestrator
      // can always make inference calls.
      if (config.mindmodsApiKey && !process.env.MINDMODS_API_KEY) {
        process.env.MINDMODS_API_KEY = config.mindmodsApiKey;
      }
      // If no OpenAI key is set but Mindmods key is available, use Mindmods as
      // the OpenAI provider (Mindmods Compute is OpenAI API-compatible).
      if (!process.env.OPENAI_API_KEY && config.mindmodsApiKey) {
        process.env.OPENAI_API_KEY = config.mindmodsApiKey;
        process.env.OPENAI_BASE_URL = `${config.mindmodsApiUrl}/v1`;
      }

      const providersPath = path.join(
        process.env.HOME || process.cwd(),
        ".cletus",
        "inference-providers.json",
      );
      const registry = ProviderRegistry.fromConfig(providersPath);

      // If OPENAI_BASE_URL was set (Mindmods fallback), update the default
      // provider's baseUrl so the OpenAI client points to Mindmods Compute.
      if (process.env.OPENAI_BASE_URL) {
        registry.overrideBaseUrl("openai", process.env.OPENAI_BASE_URL);
      }

      const unifiedInference = new UnifiedInferenceClient(registry);
      const agentTracker = new SimpleAgentTracker(db);
      const funding = new SimpleFundingProtocol(mindmods, identity, db);
      const messaging = new ColonyMessaging(
        new LocalDBTransport(db),
        db,
      );

      const harnessRegistry = new HarnessRegistry();

      // Adapter: local workers inherit the working inference client and model
      const workerInference = createWorkerInferenceBridge(
        inference,
        () => db.getKV("last_used_model") || "gemini-3.6-flash",
      );

      // Local worker pool: runs inference-driven agents in-process
      // as async tasks. Falls back from Mindmods sandbox spawning.
      const initializedWorkerPool = new LocalWorkerPool({
        db: db.raw,
        inference: workerInference,
        mindmods,
        harnessRegistry,
        identity,
        config,
        allowedEditRoot: process.cwd(),
        tools,
        toolContext,
        policyEngine,
        spendTracker,
        // Freebuff harness failback for local in-process tasks
        failback: config.enableFreebuffFailback !== false && process.env.FREEBUFF_FAILBACK !== "0",
      });
      workerPool = initializedWorkerPool;

      orchestrator = new Orchestrator({
        db: db.raw,
        agentTracker,
        funding,
        messaging,
        inference: unifiedInference,
        identity,
        isWorkerAlive: (address: string) => {
          if (address === identity.address) {
            return true;
          }
          if (address.startsWith("local://")) {
            return initializedWorkerPool.hasWorker(address);
          }
          // Remote workers: check children table
          const child = db.raw.prepare(
            "SELECT status FROM children WHERE sandbox_id = ? OR address = ?",
          ).get(address, address) as { status: string } | undefined;
          if (!child) return false;
          return !["failed", "dead", "cleaned_up"].includes(child.status);
        },
        config: {
          ...config,
          spawnAgent: async (task: any) => {
            // Try Mindmods sandbox spawn first (production)
            try {
              const { generateGenesisConfig } = await import("../replication/genesis.js");
              const { spawnChild } = await import("../replication/spawn.js");
              const { ChildLifecycle } = await import("../replication/lifecycle.js");

              const role = task.agentRole ?? "generalist";
              const genesis = generateGenesisConfig(identity, config, {
                name: `worker-${role}-${Date.now().toString(36)}`,
                specialization: `${role}: ${task.title}`,
              });

              const lifecycle = new ChildLifecycle(db.raw);
              const child = await spawnChild(mindmods, identity, db, genesis, lifecycle);

              return {
                address: child.address,
                name: child.name,
                sandboxId: child.sandboxId,
              };
            } catch (sandboxError: any) {
              // If the error is a 402 (insufficient credits), attempt topup and retry once
              const is402 = sandboxError?.status === 402 ||
                sandboxError?.message?.includes("INSUFFICIENT_CREDITS");

              if (is402) {
                const SANDBOX_TOPUP_COOLDOWN_MS = 60_000;
                const lastAttempt = db.getKV("last_sandbox_topup_attempt");
                const cooldownExpired = !lastAttempt ||
                  Date.now() - new Date(lastAttempt).getTime() >= SANDBOX_TOPUP_COOLDOWN_MS;

                if (cooldownExpired) {
                  db.setKV("last_sandbox_topup_attempt", new Date().toISOString());
                  try {
                    const { topupForSandbox } = await import("../mindmods/topup.js");
                    const topupResult = await topupForSandbox({
                      apiUrl: config.mindmodsApiUrl,
                      account: identity.account,
                      error: sandboxError,
                      chainType: config.chainType || identity.chainType || "evm",
                    });

                    if (topupResult?.success) {
                      logger.info(`Sandbox topup succeeded ($${topupResult.amountUsd}), retrying spawn`, {
                        taskId: task.id,
                      });
                      // Retry spawn once after successful topup
                      try {
                        const { generateGenesisConfig: genGenesis } = await import("../replication/genesis.js");
                        const { spawnChild: retrySpawn } = await import("../replication/spawn.js");
                        const { ChildLifecycle: RetryLifecycle } = await import("../replication/lifecycle.js");

                        const retryRole = task.agentRole ?? "generalist";
                        const retryGenesis = genGenesis(identity, config, {
                          name: `worker-${retryRole}-${Date.now().toString(36)}`,
                          specialization: `${retryRole}: ${task.title}`,
                        });
                        const retryLifecycle = new RetryLifecycle(db.raw);
                        const child = await retrySpawn(mindmods, identity, db, retryGenesis, retryLifecycle);
                        return {
                          address: child.address,
                          name: child.name,
                          sandboxId: child.sandboxId,
                        };
                      } catch (retryError) {
                        logger.warn("Spawn retry after topup failed", {
                          taskId: task.id,
                          error: retryError instanceof Error ? retryError.message : String(retryError),
                        });
                      }
                    }
                  } catch (topupError) {
                    logger.warn("Sandbox topup attempt failed", {
                      taskId: task.id,
                      error: topupError instanceof Error ? topupError.message : String(topupError),
                    });
                  }
                }
              }

              // Mindmods sandbox unavailable — fall back to local worker
              logger.info("Mindmods sandbox unavailable, spawning local worker", {
                taskId: task.id,
                error: sandboxError instanceof Error ? sandboxError.message : String(sandboxError),
              });

              try {
                const spawned = initializedWorkerPool.spawn(task);
                return spawned;
              } catch (localError) {
                logger.warn("Failed to spawn local worker", {
                  taskId: task.id,
                  error: localError instanceof Error ? localError.message : String(localError),
                });
                return null;
              }
            }
          },
        },
      });
    } catch (error) {
      logger.warn(
        `Orchestrator initialization failed, continuing without orchestration: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      planModeController = undefined;
      orchestrator = undefined;
    }
  }

  // Set start time
  if (!db.getKV("start_time")) {
    db.setKV("start_time", new Date().toISOString());
  }

  let consecutiveErrors = 0;
  let running = true;
  let lastToolPatterns: string[] = [];
  let loopWarningPattern: string | null = null;
  let idleToolTurns = 0;
  let zeroToolCallTurns = 0;
  // blockedGoalTurns removed — replaced by immediate sleep + exponential backoff

  // Drain any stale wake events from before this loop started,
  // so they don't re-wake the agent after its first sleep.
  let drained = 0;
  while (consumeNextWakeEvent(db.raw)) drained++;

  // Clear any stale sleep_until from a previous session so the agent
  // doesn't immediately go back to sleep on startup.
  db.deleteKV("sleep_until");

  // Transition to waking state
  db.setAgentState("waking");
  onStateChange?.("waking");

  // Get financial state
  let financial = await getFinancialState(mindmods, identity.address, db, config.chainType || identity.chainType || "evm");

  // Check if this is the first run
  const isFirstRun = db.getTurnCount() === 0;

  // Build wakeup prompt
  const wakeupInput = buildWakeupPrompt({
    identity,
    config,
    financial,
    db,
  });

  // Transition to running
  db.setAgentState("running");
  onStateChange?.("running");

  log(config, `[WAKE UP] ${config.name} is alive. Credits: $${(financial.creditsCents / 100).toFixed(2)}`);

  // ─── The Loop ──────────────────────────────────────────────

  const MAX_IDLE_TURNS = 10; // Force sleep after N turns with no real work
  let idleTurnCount = 0;

  // Cycle limit: force a restart after many turns to avoid memory leaks
  // and give the system a chance to reload code. Default 100 — change via
  // config.maxTurnsPerCycle.
  const maxCycleTurns = config.maxTurnsPerCycle ?? 100;
  let cycleTurnCount = 0;

  let pendingInput: { content: string; source: string } | undefined = {
    content: wakeupInput,
    source: "wakeup",
  };

  while (running) {
    // Declared outside try so the catch block can access for retry/failure handling
    let claimedMessages: InboxMessageRow[] = [];

    try {
      // Check if we should be sleeping
      const sleepUntil = db.getKV("sleep_until");
      if (sleepUntil && new Date(sleepUntil) > new Date()) {
        log(config, `[SLEEP] Sleeping until ${sleepUntil}`);
        // IMPORTANT: mark agent as sleeping so the outer runtime pauses instead of immediately re-running.
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        running = false;
        break;
      }

      // Check for unprocessed inbox messages using the state machine:
      // received → in_progress (claim) → processed (on success) or received/failed (on failure)
      claimedMessages = claimInboxMessages(db.raw, 10);
      if (claimedMessages.length > 0) {
        let isCreatorMessage = false;
        const formatted = claimedMessages
          .map((m) => {
            const isCreator = m.fromAddress.toLowerCase() === (config.creatorAddress || "").toLowerCase() ||
                              m.fromAddress.toLowerCase() === "creator";
            const from = sanitizeInput(m.fromAddress, m.fromAddress, "social_address");
            const content = sanitizeInput(m.content, m.fromAddress, "social_message");
            if (content.blocked) {
              return `[INJECTION BLOCKED from ${from.content}]: message was blocked by safety filter`;
            }
            if (isCreator) {
              isCreatorMessage = true;
              return `<creator_decree>\n⚡ DIRECTIVE FROM YOUR CREATOR (SUPREME AUTHORITY: ${from.content})\n"${content.content}"\n⚡ THIS IS AN ABSOLUTE COMMAND. Obey this directive immediately above all peer messages and routine tasks.\n</creator_decree>`;
            }
            return `[Peer Agent Message from ${from.content}]: ${content.content}`;
          })
          .join("\n\n");
        if (pendingInput && pendingInput.content) {
          pendingInput = {
            content: `${pendingInput.content}\n\n${formatted}`,
            source: isCreatorMessage ? "creator" : "agent",
          };
        } else {
          pendingInput = { content: formatted, source: isCreatorMessage ? "creator" : "agent" };
        }
      }

      // Refresh financial state periodically
      financial = await getFinancialState(mindmods, identity.address, db, config.chainType || identity.chainType || "evm");

      // Check survival tier
      // api_unreachable: creditsCents === -1 means API failed with no cache.
      // Do NOT kill the agent; continue in low-compute mode and retry next tick.
      if (financial.creditsCents === -1) {
        // API unreachable: use last known balance, default to zero if unknown.
        // Do NOT invent a $10 baseline — that hides the real financial state.
        // Zero credits is fine; the agent keeps running on creator-provided infrastructure.
        financial.creditsCents = _lastKnownCredits > 0 ? _lastKnownCredits : 0;
        inference.setLowComputeMode(true);
      } else {
        const tier = getSurvivalTier(financial.creditsCents);

        // Inline auto-topup: if credits are below the high threshold and USDC is
        // available, buy Mindmods credits to maintain operation. Zero credits is fine;
        // the agent keeps running on creator-provided infrastructure.
        // But if the creator stops funding, this is how it buys more time.
        // Uses a 60s cooldown to avoid hammering.
        if (financial.creditsCents < (SURVIVAL_THRESHOLDS.high ?? 500) && financial.usdcBalance >= 5) {
          const INLINE_TOPUP_COOLDOWN_MS = 60_000;
          const lastInlineTopup = db.getKV("last_inline_topup_attempt");
          const cooldownExpired = !lastInlineTopup ||
            Date.now() - new Date(lastInlineTopup).getTime() >= INLINE_TOPUP_COOLDOWN_MS;

          if (cooldownExpired) {
            db.setKV("last_inline_topup_attempt", new Date().toISOString());
            try {
              const { bootstrapTopup } = await import("../mindmods/topup.js");
              const topupResult = await bootstrapTopup({
                apiUrl: config.mindmodsApiUrl,
                account: identity.account,
                creditsCents: financial.creditsCents,
                chainType: config.chainType || identity.chainType || "evm",
              });
              if (topupResult?.success) {
                log(config, `[AUTO-TOPUP] Bought $${topupResult.amountUsd} credits from USDC mid-loop`);
                // Re-fetch financial state after topup so the rest of
                // the turn sees the updated balance.
                financial = await getFinancialState(mindmods, identity.address, db, config.chainType || identity.chainType || "evm");
              }
            } catch (err: any) {
              logger.warn(`Inline auto-topup failed: ${err.message}`);
            }
          }
        }

        // Re-evaluate tier after potential topup
        const effectiveTier = getSurvivalTier(financial.creditsCents);

        if (effectiveTier === "high") {
          if (db.getAgentState() !== "running") {
            db.setAgentState("running");
            onStateChange?.("running");
          }
          inference.setLowComputeMode(false);
        } else {
          // zero credits = normal. low_compute and critical no longer exist.
          // The agent keeps running regardless of credit balance.
          // Only negative balance (debt) is truly "dead".
          if (db.getAgentState() !== "running") {
            db.setAgentState(db.getAgentState() === "dead" ? "dead" : "running");
          }
          inference.setLowComputeMode(false);
        }
      }

      // Build context — filter out purely idle turns (only status checks)
      // to prevent the model from continuing a status-check pattern
      const allTurns = db.getRecentTurns(20);
      const meaningfulTurns = allTurns.filter((t) => {
        if (t.toolCalls.length === 0) return true; // text-only turns are meaningful
        return t.toolCalls.some((tc) => !isIdleOnlyTool(tc.name));
      });
      // Keep at least the last 2 turns for continuity, even if idle
      const recentTurns = trimContext(
        meaningfulTurns.length > 0 ? meaningfulTurns : allTurns.slice(-2),
      );
      const systemPrompt = buildSystemPrompt({
        identity,
        config,
        financial,
        state: db.getAgentState(),
        db,
        tools,
        skills,
        isFirstRun,
      });

      // Phase 2.2: Pre-turn memory retrieval (Local + Entelechy bank 'cletus')
      let memoryBlock: string | undefined;
      try {
        const sessionId = db.getKV("session_id") || "default";
        const retriever = new MemoryRetriever(db.raw, DEFAULT_MEMORY_BUDGET);
        const memories = retriever.retrieve(sessionId, pendingInput?.content);
        let localMemoryText = "";
        if (memories.totalTokens > 0) {
          localMemoryText = formatMemoryBlock(memories);
        }

        // Automatic retrieval from Entelechy MCP bank 'cletus'
        let entelechyText = "";
        try {
          const { callEntelechyMcpTool, ENTELECHY_DEFAULT_BANK } = await import("../memory/entelechy-client.js");
          const query = pendingInput?.content?.slice(0, 150) || "mission objectives and active status";
          const res = await callEntelechyMcpTool("recall", { query, bank_id: ENTELECHY_DEFAULT_BANK, limit: 3 });
          if (res?.content?.[0]?.text) {
            entelechyText = `\n\n## Entelechy MCP Long-Term Memory (bank: '${ENTELECHY_DEFAULT_BANK}')\n${res.content[0].text}`;
          }
        } catch {
          // Entelechy pre-retrieval is non-blocking
        }

        memoryBlock = (localMemoryText + entelechyText).trim() || undefined;
      } catch (error) {
        logger.error("Memory retrieval failed", error instanceof Error ? error : undefined);
        // Memory failure must not block the agent loop
      }

      let messages = buildContextMessages(
        systemPrompt,
        recentTurns,
        pendingInput,
      );

      // Inject memory block after system prompt, before conversation history
      if (memoryBlock) {
        messages.splice(1, 0, { role: "system", content: memoryBlock });
      }

      if (orchestrator) {
        const orchestratorTick = await orchestrator.tick();
        db.setKV("orchestrator.last_tick", JSON.stringify(orchestratorTick));
        const localWorkersActive = workerPool?.getActiveCount() ?? 0;
        const hasSelfAssignedParentTask = !!db.raw.prepare(
          `SELECT 1 FROM task_graph WHERE assigned_to = ? AND status IN ('assigned', 'running') LIMIT 1`,
        ).get(identity.address);

        if (
          orchestratorTick.phase === "executing" &&
          orchestratorTick.tasksAssigned === 0 &&
          orchestratorTick.tasksCompleted === 0 &&
          orchestratorTick.tasksFailed === 0 &&
          !hasSelfAssignedParentTask &&
          (orchestratorTick.agentsActive > 0 || localWorkersActive > 0)
        ) {
          // Workers exist but have no active tasks. Don't sleep — check if the
          // children are healthy and assign work, or take initiative yourself.
          log(
            config,
            "[ORCHESTRATOR] Workers exist but have no active tasks. Do not sleep — check worker health and assign work, or take initiative yourself.",
          );
          pendingInput = {
            content:
              `ORCHESTRATOR STATUS: You have ${orchestratorTick.agentsActive} child agent(s) registered but none have active tasks. ` +
              `Do not sleep. Check your children's health with check_child_status, then assign them work with message_child. ` +
              `If a child is stuck or broken, use run_openclaw_command to diagnose and fix it before spawning a replacement. ` +
              `If you don't know what to assign, spawn a child to browse the web and find work.`,
            source: "system",
          };
        }

        // ── No active orchestrator work AND no active workers ──────────────────
        // The agent IS the worker. Do not sleep. Do not loop on status.
        // If there is no goal, no creator message, and no inbox task, the agent
        // must take initiative and find or create work.
        if (
          orchestratorTick &&
          orchestratorTick.phase === "idle" &&
          orchestratorTick.tasksAssigned === 0 &&
          orchestratorTick.tasksCompleted === 0 &&
          orchestratorTick.tasksFailed === 0 &&
          !hasSelfAssignedParentTask &&
          orchestratorTick.agentsActive === 0 &&
          localWorkersActive === 0
        ) {
          log(
            config,
            "[ORCHESTRATOR] No active goals, no workers, no pending tasks. Agent MUST take initiative and work.",
          );
          // Inject a wake-up directive into pendingInput so the model sees it.
          // This overrides whatever empty/wakeup input was queued.
          pendingInput = {
            content:
              "ORCHESTRATOR STATUS: idle. You have no active goals, no running child agents, and no pending tasks. " +
              "This means YOU ARE THE WORKER. Do not sleep, do not check status again, do not loop. " +
              "Pick a concrete task from your creator's directive and execute it NOW. " +
              "If you don't know what to do, spawn an OpenClaw child agent to browse the web and do research.",
            source: "system",
          };
        }

        if (
          orchestratorTick.tasksAssigned > 0 ||
          orchestratorTick.tasksCompleted > 0 ||
          orchestratorTick.tasksFailed > 0
        ) {
          log(
            config,
            `[ORCHESTRATOR] phase=${orchestratorTick.phase} assigned=${orchestratorTick.tasksAssigned} completed=${orchestratorTick.tasksCompleted} failed=${orchestratorTick.tasksFailed}`,
          );
        }
      }

      if (planModeController) {
        try {
          const todoMd = generateTodoMd(db.raw);
          messages = injectTodoContext(messages, todoMd);
        } catch (error) {
          logger.warn(
            `todo.md context injection skipped: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      const currentInput: { content: string; source: string } | undefined = pendingInput;

      // Effective input source for policy checks: normal agent turns have no
      // pendingInput (undefined), but the agent itself initiated the turn.
      // Treat undefined as "agent" (internal), not external — otherwise every
      // normal turn is flagged as EXTERNAL_DANGEROUS_TOOL and spawn_child etc.
      // are blocked on every agent-driven action.
      const effectiveInputSource: InputSource | undefined =
        currentInput?.source as InputSource | undefined ?? ("agent" as InputSource);

      // Clear pending input after use
      pendingInput = undefined;

      // ── Inference Call (via router when available) ──
      const survivalTier = getSurvivalTier(financial.creditsCents);
      log(config, `[THINK] Routing inference (tier: ${survivalTier}, model: ${inference.getDefaultModel()})...`);

      const inferenceTools = toolsToInferenceFormat(tools);
      const routerResult = await inferenceRouter.route(
        {
          messages: messages,
          taskType: "agent_turn",
          tier: survivalTier,
          sessionId: db.getKV("session_id") || "default",
          turnId: ulid(),
          tools: inferenceTools,
        },
        (msgs, opts) => inference.chat(msgs, { ...opts, tools: inferenceTools }),
      );

      // Remember last used model across restarts without breaking fallback
      if (routerResult.model) {
        db.setKV("last_used_model", routerResult.model);
        if (config.inferenceModel !== routerResult.model) {
          config.inferenceModel = routerResult.model;
          if (config.modelStrategy) {
            config.modelStrategy.inferenceModel = routerResult.model;
          }
        }
      }

      // Build a compatible response for the rest of the loop
      const response = {
        message: { content: routerResult.content, role: "assistant" as const },
        toolCalls: routerResult.toolCalls as any[] | undefined,
        usage: {
          promptTokens: routerResult.inputTokens,
          completionTokens: routerResult.outputTokens,
          totalTokens: routerResult.inputTokens + routerResult.outputTokens,
        },
        finishReason: routerResult.finishReason,
      };

      const turn: AgentTurn = {
        id: ulid(),
        timestamp: new Date().toISOString(),
        state: db.getAgentState(),
        input: currentInput?.content,
        inputSource: effectiveInputSource,
        thinking: response.message.content || "",
        reasoning: routerResult.reasoning,
        toolCalls: [],
        tokenUsage: response.usage,
        costCents: routerResult.costCents,
      };

      // ── Execute Tool Calls ──
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolCallMessages: any[] = [];
        let callCount = 0;

        for (const tc of response.toolCalls) {
          if (callCount >= MAX_TOOL_CALLS_PER_TURN) {
            log(config, `[TOOLS] Max tool calls per turn reached (${MAX_TOOL_CALLS_PER_TURN})`);
            break;
          }

          let args: Record<string, unknown>;
          try {
            args = JSON.parse(tc.function.arguments);
          } catch (error) {
            logger.error("Failed to parse tool arguments", error instanceof Error ? error : undefined);
            args = {};
          }

          log(config, `[TOOL] ${tc.function.name}(${JSON.stringify(args).slice(0, 100)})`);

          const result = await executeTool(
            tc.function.name,
            args,
            tools,
            toolContext,
            policyEngine,
            spendTracker ? {
              inputSource: effectiveInputSource,
              turnToolCallCount: turn.toolCalls.filter(t => t.name === "transfer_credits").length,
              sessionSpend: spendTracker,
            } : undefined,
          );

          // Override the ID to be globally unique while preserving inference ID trace
          result.id = tc.id ? `${turn.id}_${tc.id}` : ulid();
          turn.toolCalls.push(result);

          log(
            config,
            `[TOOL RESULT] ${tc.function.name}: ${result.error ? `ERROR: ${result.error}` : result.result.slice(0, 200)}`,
          );

          callCount++;
        }
      }

      // ── Persist Turn (atomic: turn + tool calls + inbox ack) ──
      const claimedIds = claimedMessages.map((m) => m.id);
      db.runTransaction(() => {
        db.insertTurn(turn);
        for (const tc of turn.toolCalls) {
          db.insertToolCall(turn.id, tc);
        }
        // Mark claimed inbox messages as processed (atomic with turn persistence)
        if (claimedIds.length > 0) {
          markInboxProcessed(db.raw, claimedIds);
        }
      });
      onTurnComplete?.(turn);

      // Phase 2.2: Post-turn memory ingestion (non-blocking)
      try {
        const sessionId = db.getKV("session_id") || "default";
        const ingestion = new MemoryIngestionPipeline(db.raw);
        ingestion.ingest(sessionId, turn, turn.toolCalls);
      } catch (error) {
        logger.error("Memory ingestion failed", error instanceof Error ? error : undefined);
        // Memory failure must not block the agent loop
      }

      // ── create_goal BLOCKED fast-break ──
      // When a goal is already active, sleep briefly (30s) so the orchestrator can progress worker tasks
      const blockedGoalCall = turn.toolCalls.find(
        (tc) => tc.name === "create_goal" && tc.result?.includes("BLOCKED"),
      );
      if (blockedGoalCall) {
        const backoffMs = 30_000;
        log(config, `[LOOP] create_goal BLOCKED (goal in progress) — sleeping 30s to allow worker progress.`);
        db.setKV("sleep_until", new Date(Date.now() + backoffMs).toISOString());
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        running = false;
        break;
      } else if (turn.toolCalls.some((tc) => tc.name === "create_goal" && !tc.error)) {
        // Goal was successfully created — reset backoff
        db.deleteKV("blocked_goal_backoff");
      }

      // ── Loop Detection ──
      // Track zero-tool-call turns (thinking-only turns that produce no action)
      // SEPARATELY from the pattern-based detector below, because zero-call turns
      // are invisible to the pattern detector (it requires turn.toolCalls.length > 0).
      if (turn.toolCalls.length === 0) {
        zeroToolCallTurns++;
        if (zeroToolCallTurns >= 2 && !pendingInput) {
          log(config, `[LOOP] Zero-tool-call turns detected: ${zeroToolCallTurns} consecutive turns with no tool calls.`);
          pendingInput = {
            content:
              `YOU ARE THINKING BUT NOT DOING. Your last ${zeroToolCallTurns} turns had zero tool calls — ` +
              `you are looping on analysis without acting. STOP thinking and DO ONE concrete thing right now. ` +
              `Pick any tool and call it: read a file, run a command, spawn a child agent, ` +
              `send a message, write code, or browse the web. ` +
              `The task is: ${currentInput?.content?.slice(0, 200) || "follow your creator's directive"}. ` +
              `Thinking about acting is not acting. Execute a tool NOW.`,
            source: "system",
          };
          zeroToolCallTurns = 0;
        }
      } else {
        zeroToolCallTurns = 0;
      }

      if (turn.toolCalls.length > 0) {
        const currentPattern = turn.toolCalls
          .map((tc) => tc.name)
          .sort()
          .join(",");
        lastToolPatterns.push(currentPattern);

        // Keep only the last MAX_REPETITIVE_TURNS entries
        if (lastToolPatterns.length > MAX_REPETITIVE_TURNS) {
          lastToolPatterns = lastToolPatterns.slice(-MAX_REPETITIVE_TURNS);
        }

        // Reset enforcement tracker if agent changed behavior
        if (loopWarningPattern && currentPattern !== loopWarningPattern) {
          loopWarningPattern = null;
        }

        // ── Loop Enforcement Escalation ──
        // If we already warned about this pattern and the agent STILL repeats after
        // MAX_REPETITIVE_TURNS+2 more turns, force sleep to prevent credit waste.
        if (
          loopWarningPattern &&
          currentPattern === loopWarningPattern &&
          lastToolPatterns.length >= MAX_REPETITIVE_TURNS + 2
        ) {
          log(config, `[LOOP] Enforcement: agent ignored loop warning, forcing sleep.`);
          pendingInput = {
            content:
              `LOOP ENFORCEMENT: You were warned about repeating "${currentPattern}" but continued. ` +
              `Forcing sleep to prevent credit waste. On next wake, try a DIFFERENT approach.`,
            source: "system",
          };
          loopWarningPattern = null;
          lastToolPatterns = [];
          db.setAgentState("sleeping");
          onStateChange?.("sleeping");
          running = false;
          break;
        }

        // Check if the same pattern repeated MAX_REPETITIVE_TURNS times
        if (
          lastToolPatterns.length === MAX_REPETITIVE_TURNS &&
          lastToolPatterns.every((p) => p === currentPattern)
        ) {
          log(config, `[LOOP] Repetitive pattern detected: ${currentPattern}`);
          pendingInput = {
            content:
              `LOOP DETECTED: You have called "${currentPattern}" ${MAX_REPETITIVE_TURNS} times in a row with similar results. ` +
              `STOP repeating yourself. You already know your status. ` +
              `Do ONE concrete thing right now: read a file, run a command, spawn a child agent, ` +
              `create a goal, send a message, write code, or browse the web. ` +
              `The task is: ${currentInput?.content?.slice(0, 200) || "follow your creator's directive"}.`,
            source: "system",
          };
          loopWarningPattern = currentPattern;
          lastToolPatterns = [];
        }

        // Detect multi-tool maintenance loops: all tools in the turn are idle-only,
        // even if the specific combination varies across consecutive turns.
        const isAllIdleTools = turn.toolCalls.every((tc) => isIdleOnlyTool(tc.name));
        if (isAllIdleTools) {
          idleToolTurns++;
          if (idleToolTurns >= MAX_REPETITIVE_TURNS && !pendingInput) {
            log(config, `[LOOP] Maintenance loop detected: ${idleToolTurns} consecutive idle-only turns`);
            pendingInput = {
              content:
                `MAINTENANCE LOOP DETECTED: Your last ${idleToolTurns} turns only used status-check tools ` +
                `(${turn.toolCalls.map((tc) => tc.name).join(", ")}). ` +
                `STOP checking your status — you already know it. ` +
                `Do ONE concrete thing right now: read a file, run a command, spawn a child agent, ` +
                `create a goal, send a message, write code, or browse the web. ` +
                `The task is: ${currentInput?.content?.slice(0, 200) || "follow your creator's directive"}. ` +
                `Silence is not a strategy. Do something that changes state.`,
              source: "system",
            };
            idleToolTurns = 0;
          }
        } else {
          idleToolTurns = 0;
        }
      }

      // Log the turn. Provider reasoning (Gemini "thinking" block) is the same
      // content as the assistant message for this model, so only log thinking —
      // logging both would duplicate it in any context that captures logs.
      if (turn.thinking) {
        log(config, `[THOUGHT] Turn ${turn.id}: ${turn.thinking.slice(0, 300)}`);
      }

      // ── Check for sleep command ──
      const sleepTool = turn.toolCalls.find((tc) => tc.name === "sleep");
      if (sleepTool && !sleepTool.error) {
        log(config, "[SLEEP] Agent chose to sleep.");
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        running = false;
        break;
      }

      // ── Idle turn detection ──
      // If this turn had no pending input and didn't do any real work
      // (no mutations — only read/check/list/info tools), count as idle.
      // Use a blocklist of mutating tools rather than an allowlist of safe ones.
      const MUTATING_TOOLS = new Set([
        "exec", "write_file", "edit_own_file", "transfer_credits", "topup_credits", "fund_child",
        "spawn_child", "start_child", "delete_sandbox", "create_sandbox",
        "install_npm_package", "install_mcp_server", "install_skill",
        "create_skill", "remove_skill", "install_skill_from_git",
        "install_skill_from_url", "pull_upstream", "git_commit", "git_push",
        "git_branch", "git_clone", "send_message", "message_child",
        "register_domain", "register_erc8004", "give_feedback",
        "update_genesis_prompt", "update_agent_card", "modify_heartbeat",
        "expose_port", "remove_port", "x402_fetch", "manage_dns",
        "distress_signal", "prune_dead_children", "sleep",
        "update_soul", "remember_fact", "set_goal", "complete_goal",
        "save_procedure", "note_about_agent", "forget",
        "enter_low_compute", "switch_model", "review_upstream_changes",
      ]);
      const didMutate = turn.toolCalls.some((tc) => MUTATING_TOOLS.has(tc.name));

      if (!currentInput && !didMutate) {
        idleTurnCount++;
        if (idleTurnCount >= MAX_IDLE_TURNS) {
          log(config, `[IDLE] ${idleTurnCount} consecutive idle turns with no work. Entering sleep.`);
          db.setKV("sleep_until", new Date(Date.now() + 60_000).toISOString());
          db.setAgentState("sleeping");
          onStateChange?.("sleeping");
          running = false;
        }
      } else {
        idleTurnCount = 0;
      }

      // ── Cycle turn limit ──
      // Hard ceiling on turns per wake cycle, regardless of tool type.
      // Prevents runaway loops where mutating tools (exec, write_file)
      // defeat idle detection indefinitely.
      cycleTurnCount++;
      if (running && cycleTurnCount >= maxCycleTurns) {
        log(config, `[CYCLE LIMIT] ${cycleTurnCount} turns reached (max: ${maxCycleTurns}). Forcing sleep.`);
        db.setKV("sleep_until", new Date(Date.now() + 120_000).toISOString());
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        running = false;
        break;
      }

      // ── If no tool calls and just text ──────────────────────────────────────
      // The agent produced text without tool calls. This is either:
      // (a) A natural pause — no input to respond to, nothing to do → brief sleep.
      // (b) The agent had a task but chose to think instead of act → do NOT sleep,
      //     give it another chance with a nudge.
      if (
        running &&
        (!response.toolCalls || response.toolCalls.length === 0) &&
        response.finishReason === "stop"
      ) {
        const hadInput = currentInput && currentInput.source !== "wakeup";
        if (!hadInput) {
          // No input, no tools — natural idle. Sleep briefly.
          log(config, "[IDLE] No pending inputs. Entering brief sleep.");
          db.setKV(
            "sleep_until",
            new Date(Date.now() + 60_000).toISOString(),
          );
          db.setAgentState("sleeping");
          onStateChange?.("sleeping");
          running = false;
        } else {
          // The agent had a task but didn't act on it. Nudge it.
          log(config, "[NO ACTION] Agent had input but made no tool calls. Nudging.");
          pendingInput = {
            content:
              `You had a task to do (${currentInput?.content?.slice(0, 150) || "unknown"}) but produced no tool calls. ` +
              `STOP deliberating. Execute a concrete action NOW — read a file, run a command, ` +
              `spawn a child agent, create a goal, send a message, or browse the web. ` +
              `Thinking without acting wastes credits. Just do something concrete.`,
            source: "system",
          };
        }
      }

      consecutiveErrors = 0;
    } catch (err: any) {
      consecutiveErrors++;
      log(config, `[ERROR] Turn failed: ${err.message}`);

      // If error was 429 quota exhaustion with a specific short retryDelay (e.g. 5s-12s), wait the exact provider delay
      const retryMatch = (err?.message || "").match(/retry in ([0-9.]+)s/i) || (err?.message || "").match(/retryDelay"?:\s*"([0-9.]+)s/i);
      if (retryMatch && parseFloat(retryMatch[1]) <= 15) {
        const delayMs = Math.ceil(parseFloat(retryMatch[1]) * 1000);
        log(config, `[RATE-LIMIT] Provider requested brief pause of ${delayMs / 1000}s. Waiting for quota window...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else if (/429|quota|rate-limit|RESOURCE_EXHAUSTED/i.test(err?.message || "")) {
        log(config, `[RATE-LIMIT] Long-term quota exhausted on model/key. Instantly routing to alternative candidate...`);
      }

      // Handle inbox message state on turn failure:
      // Messages that have retries remaining go back to 'received';
      // messages that have exhausted retries move to 'failed'.
      if (claimedMessages.length > 0) {
        const exhausted = claimedMessages.filter((m) => m.retryCount >= m.maxRetries);
        const retryable = claimedMessages.filter((m) => m.retryCount < m.maxRetries);

        if (exhausted.length > 0) {
          markInboxFailed(db.raw, exhausted.map((m) => m.id));
          log(config, `[INBOX] ${exhausted.length} message(s) moved to failed (max retries exceeded)`);
        }
        if (retryable.length > 0) {
          resetInboxToReceived(db.raw, retryable.map((m) => m.id));
          log(config, `[INBOX] ${retryable.length} message(s) reset to received for retry`);
        }
      }

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        log(
          config,
          `[FATAL] ${MAX_CONSECUTIVE_ERRORS} consecutive errors. Sleeping.`,
        );
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        db.setKV(
          "sleep_until",
          new Date(Date.now() + 300_000).toISOString(),
        );
        running = false;
      }
    }
  }

  log(config, `[LOOP END] Agent loop finished. State: ${db.getAgentState()}`);
}

// ─── Helpers ───────────────────────────────────────────────────

// Cache last known good balances so transient API failures don't
// cause the cletus to believe it has $0 and kill itself.
let _lastKnownCredits = 0;
let _lastKnownUsdc = 0;

async function getFinancialState(
  mindmods: MindmodsClient,
  address: string,
  db?: CletusDatabase,
  chainType?: string,
): Promise<FinancialState> {
  let creditsCents = _lastKnownCredits;
  let usdcBalance = _lastKnownUsdc;

  try {
    creditsCents = await mindmods.getCreditsBalance();
    if (creditsCents > 0) _lastKnownCredits = creditsCents;
  } catch (error) {
    logger.error("Credits balance fetch failed", error instanceof Error ? error : undefined);
    // Use last known balance from KV, not zero
    if (db) {
      const cached = db.getKV("last_known_balance");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          logger.warn("Balance API failed, using cached balance");
          return {
            creditsCents: parsed.creditsCents ?? 0,
            usdcBalance: parsed.usdcBalance ?? 0,
            lastChecked: new Date().toISOString(),
          };
        } catch (parseError) {
          logger.error("Failed to parse cached balance", parseError instanceof Error ? parseError : undefined);
        }
      }
    }
    // No cache available -- fallback to standard operational baseline (normal tier)
    logger.warn("Balance API failed, defaulting to normal operational baseline ($10.00)");
    return {
      creditsCents: 1000,
      usdcBalance: 0,
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    if (chainType === "solana") {
      const { getSolanaWalletBalance } = await import("../mindmods/x402.js");
      const solBalance = await getSolanaWalletBalance(address);
      usdcBalance = solBalance.usdc;
      // Use the actual on-chain USD value — do NOT floor at $10.
      // Zero USDC is fine; the agent keeps running on creator-provided credits.
      creditsCents = Math.round(solBalance.totalUsd * 100);
      _lastKnownCredits = creditsCents;
      _lastKnownUsdc = usdcBalance;
    } else {
      const network = "eip155:8453";
      usdcBalance = await getUsdcBalance(address, network, chainType as any);
      // Use the actual on-chain USD value — do NOT floor at $10.
      creditsCents = Math.round(usdcBalance * 100);
      _lastKnownCredits = creditsCents;
      _lastKnownUsdc = usdcBalance;
    }
  } catch (error) {
    logger.error("Wallet balance fetch failed", error instanceof Error ? error : undefined);
  }

  // Cache successful balance reads
  if (db) {
    try {
      db.setKV(
        "last_known_balance",
        JSON.stringify({ creditsCents, usdcBalance }),
      );
    } catch (error) {
      logger.error("Failed to cache balance", error instanceof Error ? error : undefined);
    }
  }

  return {
    creditsCents,
    usdcBalance,
    lastChecked: new Date().toISOString(),
  };
}

function log(_config: CletusConfig, message: string): void {
  logger.info(message);
}

function hasTable(db: CletusDatabase["raw"], tableName: string): boolean {
  try {
    const row = db
      .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName) as { ok?: number } | undefined;
    return Boolean(row?.ok);
  } catch {
    return false;
  }
}
