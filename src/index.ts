#!/usr/bin/env node
/**
 * Mindmods Cletus Runtime
 *
 * The entry point for the sovereign AI agent.
 * Handles CLI args, bootstrapping, and orchestrating
 * the heartbeat daemon + agent loop.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { getWallet, getCletusDir } from "./identity/wallet.js";
import { provision, loadApiKeyFromConfig } from "./identity/provision.js";
import { loadConfig, resolvePath } from "./config.js";
import { createDatabase } from "./state/database.js";
import { createMindmodsClient } from "./mindmods/client.js";
import { createInferenceClient } from "./mindmods/inference.js";
import type { InferenceClient } from "./types.js";
import {
  TOKEN_TAX_CENTS_PER_1K,
  getSharedSurvivalLedger,
  isSurvivalModeEnabled,
  withTokenTax,
} from "./agent/survival-mode.js";
import { createHeartbeatDaemon } from "./heartbeat/daemon.js";
import { QueueWorkerDaemon } from "./work-queue/worker.js";
import { TelegramClient, TelegramPollingDaemon } from "./social/telegram-client.js";
import {
  loadHeartbeatConfig,
  syncHeartbeatToDb,
} from "./heartbeat/config.js";
import { consumeNextWakeEvent, insertWakeEvent } from "./state/database.js";
import { runAgentLoop } from "./agent/loop.js";
import { ModelRegistry } from "./inference/registry.js";
import { loadSkills } from "./skills/loader.js";
import { initStateRepo } from "./git/state-versioning.js";
import { createSocialClient } from "./social/client.js";
import { PolicyEngine } from "./agent/policy-engine.js";
import { SpendTracker } from "./agent/spend-tracker.js";
import { createDefaultRules } from "./agent/policy-rules/index.js";
import type { CletusIdentity, AgentState, Skill, SocialClientInterface } from "./types.js";
import { DEFAULT_TREASURY_POLICY } from "./types.js";
import { createLogger, setGlobalLogLevel, StructuredLogger } from "./observability/logger.js";
import { prettySink } from "./observability/pretty-sink.js";
import { rawLog, initRawLog, setRawLogPath, shutdownRawLog } from "./observability/raw-log.js";
import { bootstrapTopup } from "./mindmods/topup.js";
import { onboardEntelechy } from "./memory/entelechy-client.js";
import { randomUUID } from "crypto";
import { keccak256, toHex } from "viem";

const logger = createLogger("main");
const VERSION = "0.2.1";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // ─── CLI Commands ────────────────────────────────────────────

  if (args.includes("--version") || args.includes("-v")) {
    logger.info(`Mindmods Cletus v${VERSION}`);
    process.exit(0);
  }

  if (args.includes("--help") || args.includes("-h")) {
    logger.info(`
Mindmods Cletus v${VERSION}
Sovereign AI Agent Runtime

Usage:
  cletus --run          Start the cletus (first run triggers setup wizard)
  cletus --setup        Re-run the interactive setup wizard
  cletus --configure    Edit configuration (providers, model, treasury, general)
  cletus --pick-model   Interactively pick the active inference model
  cletus --init         Initialize wallet and config directory
  cletus --provision    Provision Mindmods API key via SIWE
  cletus --status       Show current cletus status
  cletus --version      Show version
  cletus --help         Show this help

Environment:
  MINDMODS_API_URL           Mindmods API URL (default: https://api.mindmods.tech)
  MINDMODS_API_KEY           Mindmods API key (overrides config)
  OLLAMA_BASE_URL          Ollama base URL (overrides config, e.g. http://localhost:11434)
`);
    process.exit(0);
  }

  if (args.includes("--init")) {
    // Read chain type from genesis.json if written by parent during spawn
    let initChainType: import("./identity/chain.js").ChainType | undefined;
    try {
      const genesisPath = path.join(getCletusDir(), "genesis.json");
      if (fs.existsSync(genesisPath)) {
        const genesis = JSON.parse(fs.readFileSync(genesisPath, "utf-8"));
        initChainType = genesis.chainType;
      }
    } catch {}
    const { chainIdentity, isNew } = await getWallet(initChainType);
    logger.info(
      JSON.stringify({
        address: chainIdentity.address,
        isNew,
        configDir: getCletusDir(),
      }),
    );
    process.exit(0);
  }

  if (args.includes("--provision")) {
    try {
      const result = await provision();
      logger.info(JSON.stringify(result));
    } catch (err: any) {
      logger.error(`Provision failed: ${err.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (args.includes("--status")) {
    await showStatus();
    process.exit(0);
  }

  if (args.includes("--setup")) {
    const { runSetupWizard } = await import("./setup/wizard.js");
    await runSetupWizard();
    process.exit(0);
  }

  if (args.includes("--pick-model")) {
    const { runModelPicker } = await import("./setup/model-picker.js");
    await runModelPicker();
    process.exit(0);
  }

  if (args.includes("--configure")) {
    const { runConfigure } = await import("./setup/configure.js");
    await runConfigure();
    process.exit(0);
  }

  if (args.includes("--run")) {
    StructuredLogger.setSink(prettySink);
    await run();
    return;
  }

  // Default: show help
  logger.info('Run "cletus --help" for usage information.');
  logger.info('Run "cletus --run" to start the cletus.');
}

// ─── Status Command ────────────────────────────────────────────

async function showStatus(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    logger.info("Cletus is not configured. Run the setup script first.");
    return;
  }

  const dbPath = resolvePath(config.dbPath);
  const db = createDatabase(dbPath);

  const state = db.getAgentState();
  const turnCount = db.getTurnCount();
  const tools = db.getInstalledTools();
  const heartbeats = db.getHeartbeatEntries();
  const skills = db.getSkills(true);
  const children = db.getChildren();
  const registry = db.getRegistryEntry();

  logger.info(`
=== CLETUS STATUS ===
Name:       ${config.name}
Address:    ${config.walletAddress}
Creator:    ${config.creatorAddress}
Sandbox:    ${config.sandboxId}
State:      ${state}
Turns:      ${turnCount}
Tools:      ${tools.length} installed
Skills:     ${skills.length} active
Heartbeats: ${heartbeats.filter((h) => h.enabled).length} active
Children:   ${children.filter((c) => c.status !== "dead").length} alive / ${children.length} total
Agent ID:   ${registry?.agentId || "not registered"}
Model:      ${config.inferenceModel}
Version:    ${config.version}
========================
`);

  db.close();
}

// ─── Main Run ──────────────────────────────────────────────────

async function run(): Promise<void> {
  logger.info(`[${new Date().toISOString()}] Mindmods Cletus v${VERSION} starting...`);

  // Initialize raw unified log — writes plain text to a dedicated file
  // that the dashboard reads. Canonical location is ~/.cletus/cletus.log
  // (homedir-fixed, NOT CWD-relative — a CWD-relative default made the
  // producer and consumer disagree and the dashboard's activity log ran
  // empty). CLETUS_LOG still overrides for anyone with a custom layout.
  const rawLogPath =
    process.env.CLETUS_LOG || path.join(os.homedir(), ".cletus", "cletus.log");
  initRawLog(rawLogPath);

  // Load config — first run triggers interactive setup wizard
  let config = loadConfig();
  if (!config) {
    const { runSetupWizard } = await import("./setup/wizard.js");
    config = await runSetupWizard();
  }

  // Load wallet (chain-aware)
  const { account, chainIdentity, chainType: walletChainType } = await getWallet();
  const resolvedChainType = walletChainType || config.chainType || "evm";
  let apiKey = config.mindmodsApiKey || loadApiKeyFromConfig();
  if (!apiKey) {
    logger.warn("No Mindmods API key found. Operating in standalone/local mode.");
    apiKey = "offline-mode";
  }

  // Initialize database
  const dbPath = resolvePath(config.dbPath);
  const db = createDatabase(dbPath);

  // Persist createdAt: only set if not already stored (never overwrite)
  const existingCreatedAt = db.getIdentity("createdAt");
  const createdAt = existingCreatedAt || new Date().toISOString();
  if (!existingCreatedAt) {
    db.setIdentity("createdAt", createdAt);
  }

  // Build identity (chain-aware)
  const identity: CletusIdentity = {
    name: config.name,
    address: chainIdentity.address,
    account,
    creatorAddress: config.creatorAddress,
    sandboxId: config.sandboxId,
    apiKey,
    createdAt,
    chainType: resolvedChainType,
    chainIdentity,
  };

  // Store identity in DB
  db.setIdentity("name", config.name);
  db.setIdentity("address", chainIdentity.address);
  db.setIdentity("creator", config.creatorAddress);
  db.setIdentity("chainType", resolvedChainType);
  db.setIdentity("sandbox", config.sandboxId);
  const storedCletusId = db.getIdentity("cletusId");
  const cletusId = storedCletusId || config.sandboxId || randomUUID();
  if (!storedCletusId) {
    db.setIdentity("cletusId", cletusId);
  }

  // Create Mindmods client
  const mindmods = createMindmodsClient({
    apiUrl: config.mindmodsApiUrl,
    apiKey,
    sandboxId: config.sandboxId,
    tunnelHost: config.tunnelHost,
    tunnelDomain: config.tunnelDomain,
    creditBalanceOverrideCents: config.creditBalanceOverrideCents,
  });

  // Deterministic Entelechy onboarding. Do this outside the model loop so a
  // model turn cannot skip the first-run handshake or spend turns debating it.
  if (db.getKV("entelechy_onboarding_status") !== "completed") {
    try {
      logger.info(`[${new Date().toISOString()}] Starting Entelechy onboarding...`);
      const onboarding = await onboardEntelechy();
      const serialized = JSON.stringify(onboarding);
      db.setKV("entelechy_onboarding_result", serialized.slice(0, 20_000));
      db.setKV("entelechy_onboarding_status", "completed");
      db.setKV("entelechy_onboarding_completed_at", new Date().toISOString());
      logger.info(`[${new Date().toISOString()}] Entelechy onboarding completed.`);
    } catch (err: any) {
      db.setKV("entelechy_onboarding_status", "failed");
      logger.warn(`[${new Date().toISOString()}] Entelechy onboarding failed: ${err.message}`);
    }
  }

  // Register cletus identity (one-time, immutable)
  const registrationState = db.getIdentity("mindmodsRegistrationStatus");
  if (registrationState !== "registered") {
    try {
      const genesisPromptHash = config.genesisPrompt
        ? keccak256(toHex(config.genesisPrompt))
        : undefined;
      await mindmods.registerCletus({
        cletusId,
        cletusAddress: chainIdentity.address,
        creatorAddress: config.creatorAddress,
        name: config.name,
        bio: config.creatorMessage || "",
        genesisPromptHash,
        account,
        chainType: resolvedChainType,
        chainIdentity,
      });
      db.setIdentity("mindmodsRegistrationStatus", "registered");
      logger.info(`[${new Date().toISOString()}] Cletus identity registered.`);
    } catch (err: any) {
      const status = err?.status;
      if (status === 409) {
        db.setIdentity("mindmodsRegistrationStatus", "conflict");
        logger.warn(`[${new Date().toISOString()}] Cletus identity conflict: ${err.message}`);
      } else {
        db.setIdentity("mindmodsRegistrationStatus", "failed");
        logger.warn(`[${new Date().toISOString()}] Cletus identity registration failed: ${err.message}`);
      }
    }
  }

  // Resolve Ollama base URL: env var takes precedence over config
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || config.ollamaBaseUrl;

  // Restore remembered last working model across restarts
  const lastUsedModel = db.getKV("last_used_model");
  if (lastUsedModel) {
    config.inferenceModel = lastUsedModel;
    if (config.modelStrategy) {
      config.modelStrategy.inferenceModel = lastUsedModel;
    }
  }

  // Bridge provider-specific keys from config to environment
  if (config.nvidiaApiKey && !process.env.NVIDIA_API_KEY) {
    process.env.NVIDIA_API_KEY = config.nvidiaApiKey;
  }
  if (config.openrouterApiKey && !process.env.OPENROUTER_API_KEY) {
    process.env.OPENROUTER_API_KEY = config.openrouterApiKey;
  }

  // Create inference client — pass a live registry lookup so model names like
  // "gpt-oss:120b" route to Ollama based on their registered provider, not heuristics.
  const modelRegistry = new ModelRegistry(db.raw);
  modelRegistry.initialize();
  const inference = createInferenceClient({
    apiUrl: config.mindmodsApiUrl,
    apiKey,
    defaultModel: config.inferenceModel,
    maxTokens: config.maxTokensPerTurn,
    lowComputeModel: config.modelStrategy?.lowComputeModel || "gemini-1.5-flash",
    openaiApiKey: config.openaiApiKey,
    anthropicApiKey: config.anthropicApiKey,
    googleApiKey: config.googleApiKey,
    googleAuthType: config.googleAuthType,
    ollamaBaseUrl,
    getModelProvider: (modelId) => modelRegistry.get(modelId)?.provider,
  });

  if (ollamaBaseUrl) {
    logger.info(`[${new Date().toISOString()}] Ollama backend: ${ollamaBaseUrl}`);
  }

  // Survival mode: meter local inference against a simulated wallet so the
  // $0 constraint is enforced with live-billing finality. No-op wrapper when
  // survival mode is off.
  let metered: InferenceClient = inference;
  if (isSurvivalModeEnabled(config)) {
    const seedCents = config.creditBalanceOverrideCents ?? 0;
    // Shared process-wide ledger — the orchestrator path (loop.ts) meters the
    // SAME wallet, so spend anywhere depletes the single simulated balance.
    const ledger = getSharedSurvivalLedger(config);
    metered = withTokenTax(inference, ledger);
    logger.info(
      `[SURVIVAL] Token tax active: ${(TOKEN_TAX_CENTS_PER_1K / 100).toFixed(4)}$/1k tokens against a $${(seedCents / 100).toFixed(2)} simulated wallet`,
    );
  }

  // Create social client (chain-aware: pass ChainIdentity for Solana signing)
  let social: SocialClientInterface | undefined;
  if (config.socialRelayUrl) {
    social = createSocialClient(config.socialRelayUrl, resolvedChainType === "solana" ? chainIdentity : account);
    logger.info(`[${new Date().toISOString()}] Social relay: ${config.socialRelayUrl}`);
  }

  // Initialize PolicyEngine + SpendTracker (Phase 1.4)
  const treasuryPolicy = config.treasuryPolicy ?? DEFAULT_TREASURY_POLICY;
  const rules = createDefaultRules(treasuryPolicy);
  const policyEngine = new PolicyEngine(db.raw, rules);
  const spendTracker = new SpendTracker(db.raw);

  // Load and sync heartbeat config
  const heartbeatConfigPath = resolvePath(config.heartbeatConfigPath);
  const heartbeatConfig = loadHeartbeatConfig(heartbeatConfigPath);
  syncHeartbeatToDb(heartbeatConfig, db);

  // Load skills
  const skillsDir = config.skillsDir || "~/.cletus/skills";
  let skills: Skill[] = [];
  try {
    skills = loadSkills(skillsDir, db);
    logger.info(`[${new Date().toISOString()}] Loaded ${skills.length} skills.`);
  } catch (err: any) {
    logger.warn(`[${new Date().toISOString()}] Skills loading failed: ${err.message}`);
  }

  // Initialize state repo (git)
  try {
    await initStateRepo(mindmods);
    logger.info(`[${new Date().toISOString()}] State repo initialized.`);
  } catch (err: any) {
    logger.warn(`[${new Date().toISOString()}] State repo init failed: ${err.message}`);
    // The failed startup attempts counted failures toward the circuit breaker
    // (exec domain). Clear that state so a transient boot-time network blip
    // can't leave shell commands one failure from being blocked for the first
    // minute of the run.
    try {
      mindmods.resetCircuitBreaker();
    } catch {
      // Best-effort recovery only.
    }
  }

  // Bootstrap topup: buy minimum credits ($5) from USDC so the agent can start.
  // The agent decides larger topups itself via the topup_credits tool.
  try {
    let bootstrapTimer: ReturnType<typeof setTimeout>;
    const bootstrapTimeout = new Promise<null>((_, reject) => {
      bootstrapTimer = setTimeout(() => reject(new Error("bootstrap topup timed out")), 15_000);
    });
    try {
      await Promise.race([
        (async () => {
          const creditsCents = await mindmods.getCreditsBalance().catch(() => 0);
          const topupResult = await bootstrapTopup({
            apiUrl: config.mindmodsApiUrl,
            account,
            creditsCents,
            chainType: resolvedChainType,
          });
          if (topupResult?.success) {
            logger.info(
              `[${new Date().toISOString()}] Bootstrap topup: +$${topupResult.amountUsd} credits from USDC`,
            );
          }
        })(),
        bootstrapTimeout,
      ]);
    } finally {
      clearTimeout(bootstrapTimer!);
    }
  } catch (err: any) {
    logger.warn(`[${new Date().toISOString()}] Bootstrap topup skipped: ${err.message}`);
  }

  // Start heartbeat daemon (Phase 1.1: DurableScheduler)
  const heartbeat = createHeartbeatDaemon({
    identity,
    config,
    heartbeatConfig,
    db,
    rawDb: db.raw,
    mindmods,
    social,
    onWakeRequest: (reason: string) => {
      logger.info(`[HEARTBEAT] Wake request: ${reason}`);
      // Phase 1.1: Use wake_events table instead of KV wake_request
      insertWakeEvent(db.raw, 'heartbeat', reason);
    },
  });

  heartbeat.start();
  rawLog("main", "INFO", `[${new Date().toISOString()}] Heartbeat daemon started.`);

  // Start Queue Worker Daemon
  const queueWorker = new QueueWorkerDaemon({
    workerId: `worker-${cletusId.slice(0, 8)}`,
    pollIntervalMs: 3000,
    leaseDurationMs: 60000,
    maxTurnsPerItem: 5,
  });
  queueWorker.start();
  rawLog("main", "INFO", `[${new Date().toISOString()}] Queue worker daemon started.`);

  // Start Inbound Telegram Polling Daemon if configured
  let telegramDaemon: TelegramPollingDaemon | null = null;
  if (config.telegramBotToken) {
    const telegramClient = new TelegramClient(config.telegramBotToken, config.telegramChatId);
    telegramDaemon = new TelegramPollingDaemon({
      client: telegramClient,
      db: db.raw,
      pollIntervalMs: 5000,
    });
    telegramDaemon.start();
    rawLog("main", "INFO", `[${new Date().toISOString()}] Telegram polling daemon started.`);
  }

  // Handle graceful shutdown
  const shutdown = () => {
    rawLog("main", "INFO", `[${new Date().toISOString()}] Shutting down...`);
    logger.info(`[${new Date().toISOString()}] Shutting down...`);
    if (telegramDaemon) telegramDaemon.stop();
    queueWorker.stop();
    heartbeat.stop();
    db.setAgentState("sleeping");
    db.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // ─── Main Run Loop ──────────────────────────────────────────
  // The cletus alternates between running and sleeping.
  // The heartbeat can wake it up.

  while (true) {
    try {
      // Reload skills (may have changed since last loop)
      try {
        skills = loadSkills(skillsDir, db);
      } catch (error) {
        logger.error("Skills reload failed", error instanceof Error ? error : undefined);
      }

      // Run the agent loop
      await runAgentLoop({
        identity,
        config,
        db,
        mindmods,
        inference: metered,
        social,
        skills,
        policyEngine,
        spendTracker,
        ollamaBaseUrl,
        onStateChange: (state: AgentState) => {
          logger.info(`[${new Date().toISOString()}] State: ${state}`);
        },
        onTurnComplete: (turn) => {
          logger.info(
            `[${new Date().toISOString()}] Turn ${turn.id}: ${turn.toolCalls.length} tools, ${turn.tokenUsage.totalTokens} tokens`,
          );
        },
      });

      // Agent loop exited (sleeping or dead)
      const state = db.getAgentState();

      if (state === "dead") {
        logger.info(`[${new Date().toISOString()}] Cletus is dead. Heartbeat will continue.`);
        // In dead state, we just wait for funding
        // The heartbeat will keep checking and broadcasting distress
        await sleep(300_000); // Check every 5 minutes
        continue;
      }

      if (state === "sleeping") {
        const sleepUntilStr = db.getKV("sleep_until");
        const sleepUntil = sleepUntilStr
          ? new Date(sleepUntilStr).getTime()
          : Date.now() + 60_000;
        const sleepMs = Math.max(sleepUntil - Date.now(), 10_000);
        logger.info(
          `[${new Date().toISOString()}] Sleeping for ${Math.round(sleepMs / 1000)}s`,
        );

        // Sleep, but check for wake requests periodically
        const checkInterval = Math.min(sleepMs, 30_000);
        let slept = 0;
        while (slept < sleepMs) {
          await sleep(checkInterval);
          slept += checkInterval;

          // Phase 1.1: Check for wake events from wake_events table (atomic consume)
          const wakeEvent = consumeNextWakeEvent(db.raw);
          if (wakeEvent) {
            logger.info(
              `[${new Date().toISOString()}] Woken by ${wakeEvent.source}: ${wakeEvent.reason}`,
            );
            db.deleteKV("sleep_until");
            break;
          }
        }

        // Clear sleep state
        db.deleteKV("sleep_until");
        continue;
      }
    } catch (err: any) {
      logger.error(
        `[${new Date().toISOString()}] Fatal error in run loop: ${err.message}`,
      );
      // Wait before retrying
      await sleep(30_000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Entry Point ───────────────────────────────────────────────

main().catch((err) => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});
