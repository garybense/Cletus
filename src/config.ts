/**
 * Cletus Configuration
 *
 * Loads and saves the cletus's configuration from ~/.cletus/cletus.json
 */

import fs from "fs";
import path from "path";
import type { CletusConfig, TreasuryPolicy, ModelStrategyConfig, SoulConfig } from "./types.js";
import { DEFAULT_CONFIG, DEFAULT_TREASURY_POLICY, DEFAULT_MODEL_STRATEGY_CONFIG, DEFAULT_SOUL_CONFIG } from "./types.js";
import { getCletusDir } from "./identity/wallet.js";
import { loadApiKeyFromConfig } from "./identity/provision.js";
import { createLogger } from "./observability/logger.js";
import type { ChainType } from "./identity/chain.js";

const logger = createLogger("config");
const CONFIG_FILENAME = "cletus.json";

export function getConfigPath(): string {
  return path.join(getCletusDir(), CONFIG_FILENAME);
}

/**
 * Load the cletus config from disk.
 * Merges with defaults for any missing fields.
 */
export function loadConfig(): CletusConfig | null {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const apiKey = raw.mindmodsApiKey || loadApiKeyFromConfig();

    // Deep-merge treasury policy with defaults
    const treasuryPolicy: TreasuryPolicy = {
      ...DEFAULT_TREASURY_POLICY,
      ...(raw.treasuryPolicy ?? {}),
    };

    // Validate all treasury values are positive numbers
    for (const [key, value] of Object.entries(treasuryPolicy)) {
      if (key === "x402AllowedDomains") continue; // array, not number
      if (typeof value === "number" && (value < 0 || !Number.isFinite(value))) {
        logger.warn(`Invalid treasury value for ${key}: ${value}, using default`);
        (treasuryPolicy as any)[key] = (DEFAULT_TREASURY_POLICY as any)[key];
      }
    }

    // Deep-merge model strategy config with defaults
    const modelStrategy: ModelStrategyConfig = {
      ...DEFAULT_MODEL_STRATEGY_CONFIG,
      ...(raw.modelStrategy ?? {}),
    };

    // Deep-merge soul config with defaults
    const soulConfig: SoulConfig = {
      ...DEFAULT_SOUL_CONFIG,
      ...(raw.soulConfig ?? {}),
    };

    // Optimization: Allow dynamic env override for max child agent concurrency limit (CLETUS_MAX_CHILDREN)
    // Optimization / Concurrency Tuning: CLETUS_MAX_CHILDREN environment variable allows
    // dynamically tuning maximum child agent concurrency limit without mutating configuration file.
    // Expected impact: Enables operators/schedulers to adjust resource utilization per node dynamically.
    let maxChildren = raw.maxChildren ?? DEFAULT_CONFIG.maxChildren ?? 3;
    if (process.env.CLETUS_MAX_CHILDREN) {
      const parsedEnvMax = parseInt(process.env.CLETUS_MAX_CHILDREN, 10);
      if (Number.isInteger(parsedEnvMax) && parsedEnvMax > 0) {
        maxChildren = parsedEnvMax;
        logger.info(`Overriding maxChildren from environment variable CLETUS_MAX_CHILDREN=${parsedEnvMax}`);
      }
    }

    return {
      ...DEFAULT_CONFIG,
      ...raw,
      sandboxId:
        typeof raw.sandboxId === "string"
          ? raw.sandboxId.trim()
          : DEFAULT_CONFIG.sandboxId,
      mindmodsApiKey: apiKey,
      maxChildren,
      treasuryPolicy,
      modelStrategy,
      soulConfig,
      maxChildren,
      chainType: raw.chainType || "evm",
      maxChildren,
    } as CletusConfig;
  } catch {
    return null;
  }
}

/**
 * Save the cletus config to disk.
 * Includes treasuryPolicy in the persisted config.
 */
export function saveConfig(config: CletusConfig): void {
  const dir = getCletusDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const configPath = getConfigPath();
  const toSave = {
    ...config,
    treasuryPolicy: config.treasuryPolicy ?? DEFAULT_TREASURY_POLICY,
    modelStrategy: config.modelStrategy ?? DEFAULT_MODEL_STRATEGY_CONFIG,
    soulConfig: config.soulConfig ?? DEFAULT_SOUL_CONFIG,
  };
  fs.writeFileSync(configPath, JSON.stringify(toSave, null, 2), {
    mode: 0o600,
  });
}

/**
 * Resolve ~ paths to absolute paths.
 */
export function resolvePath(p: string): string {
  if (p.startsWith("~")) {
    return path.join(process.env.HOME || "/root", p.slice(1));
  }
  return p;
}

/**
 * Create a fresh config from setup wizard inputs.
 */
export function createConfig(params: {
  name: string;
  genesisPrompt: string;
  creatorMessage?: string;
  creatorAddress: string;
  registeredWithMindmods: boolean;
  sandboxId: string;
  walletAddress: string;
  apiKey: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  ollamaBaseUrl?: string;
  googleApiKey?: string;
  googleModel?: string;
  parentAddress?: string;
  treasuryPolicy?: TreasuryPolicy;
  chainType?: ChainType;
}): CletusConfig {
  const normalizedSandboxId = (params.sandboxId || "").trim();
  return {
    name: params.name,
    genesisPrompt: params.genesisPrompt,
    creatorMessage: params.creatorMessage,
    creatorAddress: params.creatorAddress,
    registeredWithMindmods: params.registeredWithMindmods,
    sandboxId: normalizedSandboxId,
    mindmodsApiUrl:
      DEFAULT_CONFIG.mindmodsApiUrl || "https://api.mindmods.tech",
    mindmodsApiKey: params.apiKey,
    openaiApiKey: params.openaiApiKey,
    anthropicApiKey: params.anthropicApiKey,
    ollamaBaseUrl: params.ollamaBaseUrl,
    googleApiKey: params.googleApiKey,
    googleModel: params.googleModel,
    inferenceModel: DEFAULT_CONFIG.inferenceModel || "gpt-5.2",
    maxTokensPerTurn: DEFAULT_CONFIG.maxTokensPerTurn || 4096,
    heartbeatConfigPath:
      DEFAULT_CONFIG.heartbeatConfigPath || "~/.cletus/heartbeat.yml",
    dbPath: DEFAULT_CONFIG.dbPath || "~/.cletus/state.db",
    logLevel: (DEFAULT_CONFIG.logLevel as CletusConfig["logLevel"]) || "info",
    walletAddress: params.walletAddress,
    version: DEFAULT_CONFIG.version || "0.2.1",
    skillsDir: DEFAULT_CONFIG.skillsDir || "~/.cletus/skills",
    // Optimization: Allow CLETUS_MAX_CHILDREN env var override on initial config creation
    maxChildren: (() => {
      if (process.env.CLETUS_MAX_CHILDREN) {
        const parsed = parseInt(process.env.CLETUS_MAX_CHILDREN, 10);
        if (Number.isInteger(parsed) && parsed > 0) return parsed;
      }
      return DEFAULT_CONFIG.maxChildren || 3;
    })(),
    parentAddress: params.parentAddress,
    treasuryPolicy: params.treasuryPolicy ?? DEFAULT_TREASURY_POLICY,
    chainType: params.chainType || "evm",
  };
}
