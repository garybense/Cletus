/**
 * Inference & Model Strategy — Internal Types
 *
 * Re-exports shared types from types.ts and defines internal constants
 * for the inference routing subsystem.
 */

export type {
  SurvivalTier,
  ModelProvider,
  InferenceTaskType,
  ModelEntry,
  ModelPreference,
  RoutingMatrix,
  InferenceRequest,
  InferenceResult,
  InferenceCostRow,
  ModelRegistryRow,
  ModelStrategyConfig,
  ChatMessage,
} from "../types.js";

import type {
  RoutingMatrix,
  ModelEntry,
  ModelStrategyConfig,
} from "../types.js";

// === Default Retry Policy ===

export const DEFAULT_RETRY_POLICY = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
} as const;

// === Per-Task Timeout Overrides (ms) ===

export const TASK_TIMEOUTS: Record<string, number> = {
  heartbeat_triage: 15_000,
  safety_check: 30_000,
  summarization: 60_000,
  agent_turn: 120_000,
  planning: 120_000,
};

// === Static Model Baseline ===
// Known models with realistic pricing (hundredths of cents per 1k tokens)

export const STATIC_MODEL_BASELINE: Omit<ModelEntry, "lastSeen" | "createdAt" | "updatedAt">[] = [
  // Google Models
  {
    modelId: "gemma-4-31b-it",
    provider: "google",
    displayName: "Gemma 4 31B IT",
    tierMinimum: "normal",
    costPer1kInput: 1,
    costPer1kOutput: 2,
    maxTokens: 8192,
    contextWindow: 131072,
    supportsTools: true,
    supportsVision: false,
    parameterStyle: "max_tokens",
    enabled: true,
  },
  {
    modelId: "gemma-4-26b-a4b-it",
    provider: "google",
    displayName: "Gemma 4 26B IT",
    tierMinimum: "low_compute",
    costPer1kInput: 1,
    costPer1kOutput: 2,
    maxTokens: 8192,
    contextWindow: 131072,
    supportsTools: true,
    supportsVision: false,
    parameterStyle: "max_tokens",
    enabled: true,
  },
  {
    modelId: "gemini-3.6-flash",
    provider: "google",
    displayName: "Gemini 3.6 Flash",
    tierMinimum: "normal",
    costPer1kInput: 1,
    costPer1kOutput: 4,
    maxTokens: 8192,
    contextWindow: 1048576,
    supportsTools: true,
    supportsVision: true,
    parameterStyle: "max_tokens",
    enabled: true,
  },
  {
    modelId: "gemini-3.1-pro-preview",
    provider: "google",
    displayName: "Gemini 3.1 Pro Preview",
    tierMinimum: "normal",
    costPer1kInput: 12,
    costPer1kOutput: 50,
    maxTokens: 8192,
    contextWindow: 1048576,
    supportsTools: true,
    supportsVision: true,
    parameterStyle: "max_tokens",
    enabled: true,
  },
  {
    modelId: "gemini-3.5-flash-lite",
    provider: "google",
    displayName: "Gemini 3.5 Flash Lite",
    tierMinimum: "low_compute",
    costPer1kInput: 1,
    costPer1kOutput: 4,
    maxTokens: 8192,
    contextWindow: 1048576,
    supportsTools: true,
    supportsVision: true,
    parameterStyle: "max_tokens",
    enabled: true,
  },

  // Anthropic Claude Models
  {
    modelId: "claude-3-5-sonnet-20241022",
    provider: "anthropic",
    displayName: "Claude 3.5 Sonnet",
    tierMinimum: "normal",
    costPer1kInput: 30,
    costPer1kOutput: 150,
    maxTokens: 8192,
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    parameterStyle: "max_tokens",
    enabled: true,
  },
  {
    modelId: "claude-3-5-haiku-20241022",
    provider: "anthropic",
    displayName: "Claude 3.5 Haiku",
    tierMinimum: "low_compute",
    costPer1kInput: 8,
    costPer1kOutput: 40,
    maxTokens: 8192,
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    parameterStyle: "max_tokens",
    enabled: true,
  },
  {
    modelId: "claude-3-opus-20240229",
    provider: "anthropic",
    displayName: "Claude 3 Opus",
    tierMinimum: "normal",
    costPer1kInput: 150,
    costPer1kOutput: 750,
    maxTokens: 4096,
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    parameterStyle: "max_tokens",
    enabled: true,
  },
];

// === Default Routing Matrix ===
// Maps (tier, taskType) -> ModelPreference with candidate models

export const DEFAULT_ROUTING_MATRIX: RoutingMatrix = {
  high: {
    agent_turn: { candidates: ["gemini-3.6-flash", "gemini-3.1-pro-preview", "gemini-3.5-flash-lite", "gemma-4-31b-it", "gemma-4-26b-a4b-it", "claude-3-5-sonnet-20241022"], maxTokens: 8192, ceilingCents: -1 },
    heartbeat_triage: { candidates: ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemma-4-26b-a4b-it", "gemma-4-31b-it", "claude-3-5-haiku-20241022"], maxTokens: 2048, ceilingCents: 5 },
    safety_check: { candidates: ["gemini-3.6-flash", "gemini-3.1-pro-preview", "gemma-4-31b-it", "gemma-4-26b-a4b-it", "claude-3-5-sonnet-20241022"], maxTokens: 4096, ceilingCents: 20 },
    summarization: { candidates: ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemma-4-26b-a4b-it", "gemma-4-31b-it", "claude-3-5-haiku-20241022"], maxTokens: 4096, ceilingCents: 15 },
    planning: { candidates: ["gemini-3.6-flash", "gemini-3.1-pro-preview", "gemini-3.5-flash-lite", "gemma-4-31b-it", "gemma-4-26b-a4b-it", "claude-3-5-sonnet-20241022"], maxTokens: 8192, ceilingCents: -1 },
  },
  normal: {
    agent_turn: { candidates: ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemma-4-31b-it", "gemma-4-26b-a4b-it", "claude-3-5-haiku-20241022"], maxTokens: 4096, ceilingCents: -1 },
    heartbeat_triage: { candidates: ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemma-4-26b-a4b-it", "claude-3-5-haiku-20241022"], maxTokens: 1024, ceilingCents: 5 },
    safety_check: { candidates: ["gemini-3.6-flash", "gemma-4-31b-it", "claude-3-5-haiku-20241022"], maxTokens: 2048, ceilingCents: 10 },
    summarization: { candidates: ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemma-4-26b-a4b-it", "claude-3-5-haiku-20241022"], maxTokens: 2048, ceilingCents: 5 },
    planning: { candidates: ["gemini-3.6-flash", "gemini-3.1-pro-preview", "gemma-4-31b-it", "claude-3-5-sonnet-20241022"], maxTokens: 4096, ceilingCents: -1 },
  },
  low_compute: {
    agent_turn: { candidates: ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemma-4-26b-a4b-it", "gemma-4-31b-it"], maxTokens: 2048, ceilingCents: -1 },
    heartbeat_triage: { candidates: ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemma-4-26b-a4b-it"], maxTokens: 512, ceilingCents: 0 },
    safety_check: { candidates: ["gemini-3.6-flash", "gemma-4-26b-a4b-it"], maxTokens: 1024, ceilingCents: 0 },
    summarization: { candidates: ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemma-4-26b-a4b-it"], maxTokens: 1024, ceilingCents: 0 },
    planning: { candidates: ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemma-4-26b-a4b-it"], maxTokens: 2048, ceilingCents: -1 },
  },
  critical: {
    agent_turn: { candidates: ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemma-4-26b-a4b-it"], maxTokens: 1024, ceilingCents: -1 },
    heartbeat_triage: { candidates: ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemma-4-26b-a4b-it"], maxTokens: 256, ceilingCents: 0 },
    safety_check: { candidates: ["gemini-3.6-flash", "gemma-4-26b-a4b-it"], maxTokens: 512, ceilingCents: 0 },
    summarization: { candidates: ["gemini-3.6-flash", "gemma-4-26b-a4b-it"], maxTokens: 512, ceilingCents: 0 },
    planning: { candidates: ["gemini-3.6-flash", "gemma-4-26b-a4b-it"], maxTokens: 1024, ceilingCents: -1 },
  },
  dead: {
    agent_turn: { candidates: [], maxTokens: 0, ceilingCents: 0 },
    heartbeat_triage: { candidates: [], maxTokens: 0, ceilingCents: 0 },
    safety_check: { candidates: [], maxTokens: 0, ceilingCents: 0 },
    summarization: { candidates: [], maxTokens: 0, ceilingCents: 0 },
    planning: { candidates: [], maxTokens: 0, ceilingCents: 0 },
  },
};

// === Default Model Strategy Config ===

export const DEFAULT_MODEL_STRATEGY_CONFIG: ModelStrategyConfig = {
  inferenceModel: "gemma-4-31b-it",
  lowComputeModel: "gemma-4-26b-a4b-it",
  criticalModel: "gemma-4-26b-a4b-it",
  maxTokensPerTurn: 8192,
  hourlyBudgetCents: 0,
  sessionBudgetCents: 0,
  perCallCeilingCents: 0,
  enableModelFallback: true,
  anthropicApiVersion: "2023-06-01",
};
