/**
 * Inference Router
 *
 * Routes inference requests through the model registry using
 * tier-based selection, budget enforcement, and provider-specific
 * message transformation.
 */

import type BetterSqlite3 from "better-sqlite3";
import { ulid } from "ulid";
import type {
  InferenceRequest,
  InferenceResult,
  ModelEntry,
  SurvivalTier,
  InferenceTaskType,
  ModelProvider,
  ChatMessage,
  ModelPreference,
} from "../types.js";
import { ModelRegistry } from "./registry.js";
import { InferenceBudgetTracker } from "./budget.js";
import { DEFAULT_ROUTING_MATRIX, TASK_TIMEOUTS } from "./types.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("inference-router");

type Database = BetterSqlite3.Database;

export class InferenceRouter {
  private db: Database;
  private registry: ModelRegistry;
  private budget: InferenceBudgetTracker;

  constructor(db: Database, registry: ModelRegistry, budget: InferenceBudgetTracker) {
    this.db = db;
    this.registry = registry;
    this.budget = budget;
  }

  /**
   * Route an inference request: select model, check budget,
   * transform messages, call inference, record cost.
   */
  async route(
    request: InferenceRequest,
    inferenceChat: (messages: any[], options: any) => Promise<any>,
  ): Promise<InferenceResult> {
    const { messages, taskType, tier, sessionId, turnId, tools } = request;

    // 1. Get ordered candidate models to try
    const candidates = this.getCandidateModels(tier, taskType);
    if (candidates.length === 0) {
      return {
        content: "",
        model: "none",
        provider: "other",
        inputTokens: 0,
        outputTokens: 0,
        costCents: 0,
        latencyMs: 0,
        finishReason: "error",
        toolCalls: undefined,
      };
    }

    let lastError: any = null;

    for (const model of candidates) {
      // 2. Estimate cost and check budget
      const estimatedTokens = messages.reduce((sum, m) => sum + (m.content?.length || 0) / 4, 0);
      const estimatedCostCents = Math.ceil(
        (estimatedTokens / 1000) * model.costPer1kInput / 100 +
        (request.maxTokens || 1000) / 1000 * model.costPer1kOutput / 100,
      );

      const budgetCheck = this.budget.checkBudget(estimatedCostCents, model.modelId);
      if (!budgetCheck.allowed) continue;

      // 3. Check session budget
      if (request.sessionId && this.budget.config.sessionBudgetCents > 0) {
        const sessionCost = this.budget.getSessionCost(request.sessionId);
        if (sessionCost + estimatedCostCents > this.budget.config.sessionBudgetCents) continue;
      }

      // 4. Transform messages for provider
      const transformedMessages = this.transformMessagesForProvider(messages, model.provider);

      // 5. Build inference options
      const preference = this.getPreference(tier, taskType);
      const maxTokens = request.maxTokens || preference?.maxTokens || model.maxTokens;
      const timeout = TASK_TIMEOUTS[taskType] || 120_000;

      const inferenceOptions: any = {
        model: model.modelId,
        maxTokens,
        tools: tools,
      };

      // 6. Call inference with timeout and fallback
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        let response: any;
        try {
          inferenceOptions.signal = controller.signal;
          response = await inferenceChat(transformedMessages, inferenceOptions);
        } finally {
          clearTimeout(timer);
        }

        const latencyMs = Date.now() - startTime;
        const inputTokens = response.usage?.promptTokens || 0;
        const outputTokens = response.usage?.completionTokens || 0;
        const actualCostCents = Math.ceil(
          (inputTokens / 1000) * model.costPer1kInput / 100 +
          (outputTokens / 1000) * model.costPer1kOutput / 100,
        );

        this.budget.recordCost({
          sessionId,
          turnId: turnId || null,
          model: model.modelId,
          provider: model.provider,
          inputTokens,
          outputTokens,
          costCents: actualCostCents,
          latencyMs,
          tier,
          taskType,
          cacheHit: false,
        });

        return {
          content: response.message?.content || "",
          model: model.modelId,
          provider: model.provider,
          inputTokens,
          outputTokens,
          costCents: actualCostCents,
          latencyMs,
          toolCalls: response.toolCalls,
          finishReason: response.finishReason || "stop",
        };
      } catch (error: any) {
        lastError = error;
        logger.warn(`Inference attempt failed for ${model.modelId} (${model.provider}): ${error?.message || error}. Trying fallback candidate...`);
      }
    }

    throw lastError || new Error("All candidate inference models failed");
  }

  /**
   * Get all candidates in preference order for failover.
   */
  getCandidateModels(tier: SurvivalTier, taskType: InferenceTaskType): ModelEntry[] {
    if (tier === "dead") return [];

    const list: ModelEntry[] = [];
    const seen = new Set<string>();

    const TIER_ORDER: Record<string, number> = {
      dead: 0, critical: 1, low_compute: 2, normal: 3, high: 4,
    };
    const tierRank = TIER_ORDER[tier] ?? 0;

    const strategy = this.budget.config;

    const isModelAllowed = (entry: ModelEntry) => {
      const isFree = entry.costPer1kInput === 0 && entry.costPer1kOutput === 0;
      const tierOk = tierRank >= (TIER_ORDER[entry.tierMinimum] ?? 0);
      return isFree || tierOk;
    };

    // 1. Try currently configured / last remembered model first (if tier matches)
    if (strategy.inferenceModel) {
      const entry = this.registry.get(strategy.inferenceModel);
      if (entry && entry.enabled && !seen.has(entry.modelId) && isModelAllowed(entry)) {
        seen.add(entry.modelId);
        list.push(entry);
      }
    }

    // 2. Add candidates from routing matrix in preference order
    const preference = this.getPreference(tier, taskType);
    if (preference && preference.candidates.length > 0) {
      for (const candidateId of preference.candidates) {
        const entry = this.registry.get(candidateId);
        if (entry && entry.enabled && !seen.has(entry.modelId) && isModelAllowed(entry)) {
          seen.add(entry.modelId);
          list.push(entry);
        }
      }
    }

    // 3. Fallback candidates
    const fallbackIds: (string | undefined)[] = [
      strategy.lowComputeModel,
      strategy.criticalModel,
      "gemma-4-31b-it",
      "gemma-4-26b-a4b-it",
      "gemini-3.6-flash",
      "gemini-3.1-pro-preview",
      "gemini-3.5-flash-lite",
    ];

    for (const modelId of fallbackIds) {
      if (!modelId) continue;
      const entry = this.registry.get(modelId);
      if (entry && entry.enabled && !seen.has(entry.modelId) && isModelAllowed(entry)) {
        seen.add(entry.modelId);
        list.push(entry);
      }
    }

    return list;
  }

  /**
   * Select the best model for a given tier and task type.
   *
   * Priority:
   *   1. First routing-matrix candidate present in the registry
   *   2. User-configured model(s) from ModelStrategyConfig
   *      (free/Ollama models are allowed at any tier, including dead)
   */
  selectModel(tier: SurvivalTier, taskType: InferenceTaskType): ModelEntry | null {
    const TIER_ORDER: Record<string, number> = {
      dead: 0, critical: 1, low_compute: 2, normal: 3, high: 4,
    };

    const tierRank = TIER_ORDER[tier] ?? 0;

    // 1. Try routing-matrix candidates
    const preference = this.getPreference(tier, taskType);
    if (preference && preference.candidates.length > 0) {
      for (const candidateId of preference.candidates) {
        const entry = this.registry.get(candidateId);
        if (entry && entry.enabled) {
          return entry;
        }
      }
    }

    // 2. Fall back to user-configured models.
    //    This handles local/Ollama setups where routing-matrix models are absent.
    const strategy = this.budget.config;
    const fallbackIds: (string | undefined)[] =
      tier === "critical" || tier === "dead"
        ? [strategy.criticalModel, strategy.inferenceModel, strategy.lowComputeModel]
        : [strategy.inferenceModel, strategy.lowComputeModel, strategy.criticalModel];

    for (const modelId of fallbackIds) {
      if (!modelId) continue;
      const entry = this.registry.get(modelId);
      if (!entry || !entry.enabled) continue;
      const isFree = entry.costPer1kInput === 0 && entry.costPer1kOutput === 0;
      const tierOk = tierRank >= (TIER_ORDER[entry.tierMinimum] ?? 0);
      if (isFree || tierOk) {
        return entry;
      }
    }

    return null;
  }

  /**
   * Transform messages for a specific provider.
   * Handles Anthropic's alternating-role requirement.
   */
  transformMessagesForProvider(messages: ChatMessage[], provider: ModelProvider): ChatMessage[] {
    if (messages.length === 0) {
      throw new Error("Cannot route inference with empty message array");
    }

    if (provider === "anthropic") {
      return this.fixAnthropicMessages(messages);
    }

    // For OpenAI/Conway, merge consecutive same-role messages
    return this.mergeConsecutiveSameRole(messages);
  }

  /**
   * Fix messages for Anthropic's API requirements:
   * 1. Extract system messages
   * 2. Merge consecutive same-role messages
   * 3. Merge consecutive tool messages into a single user message
   *    with multiple tool_result content blocks
   */
  private fixAnthropicMessages(messages: ChatMessage[]): ChatMessage[] {
    const result: ChatMessage[] = [];

    for (const msg of messages) {
      // System messages are handled separately by the Anthropic client
      if (msg.role === "system") {
        result.push(msg);
        continue;
      }

      // Tool messages become user messages with tool_result content
      if (msg.role === "tool") {
        const last = result[result.length - 1];
        // If previous message was also a tool (now a user), merge into it
        if (last && last.role === "user" && (last as any)._toolResultMerged) {
          // Append to the merged content
          last.content = last.content + "\n[tool_result:" + (msg.tool_call_id || "unknown") + "] " + msg.content;
          continue;
        }
        // Otherwise create a new user message
        const userMsg: ChatMessage & { _toolResultMerged?: boolean } = {
          role: "user",
          content: "[tool_result:" + (msg.tool_call_id || "unknown") + "] " + msg.content,
          _toolResultMerged: true,
        };
        result.push(userMsg);
        continue;
      }

      // For user/assistant: merge with previous if same role
      const last = result[result.length - 1];
      if (last && last.role === msg.role) {
        last.content = (last.content || "") + "\n" + (msg.content || "");
        if (msg.tool_calls) {
          last.tool_calls = [...(last.tool_calls || []), ...msg.tool_calls];
        }
        continue;
      }

      result.push({ ...msg });
    }

    // Clean up internal markers
    for (const msg of result) {
      delete (msg as any)._toolResultMerged;
    }

    return result;
  }

  /**
   * Merge consecutive messages with the same role.
   */
  private mergeConsecutiveSameRole(messages: ChatMessage[]): ChatMessage[] {
    const result: ChatMessage[] = [];

    for (const msg of messages) {
      const last = result[result.length - 1];
      if (last && last.role === msg.role && msg.role !== "system" && msg.role !== "tool") {
        last.content = (last.content || "") + "\n" + (msg.content || "");
        if (msg.tool_calls) {
          last.tool_calls = [...(last.tool_calls || []), ...msg.tool_calls];
        }
        continue;
      }
      result.push({ ...msg });
    }

    return result;
  }

  private getPreference(tier: SurvivalTier, taskType: InferenceTaskType): ModelPreference | undefined {
    return DEFAULT_ROUTING_MATRIX[tier]?.[taskType];
  }
}
