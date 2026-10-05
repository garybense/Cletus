/**
 * Survival Mode — honest zero-balance semantics
 *
 * Re-introduces hard $0 finality as an explicit, toggleable runtime mode.
 * Previously the loop deliberately treated zero credits as "normal" because
 * the real balance was $0 and no simulation existed (hard-coding zero would
 * have permanently bricked the agent). This module implements the counter-
 * mandate: a virtual balance must carry the same finality as live billing.
 *
 * Wiring (all additive, default OFF — zero behavior change unless enabled):
 *  1. config.survivalMode / CLETUS_SURVIVAL_MODE=1 turns the mode on
 *  2. getCreditsBalance() honors an explicit $0 override (fixes the `|| 1000000`
 *     falsy bug) and reports status so callers can distinguish
 *     "genuinely broke" from "API down"
 *  3. a token-tax middleware wraps InferenceClient.chat, debiting a simulated
 *     per-1k-token cost from the ledger before the response is returned
 *  4. the loop's survival check consults strict tiering; at $0 the fleet
 *     halts (CriticalSurvivalException) instead of cruising in "normal"
 */

import type {
  ChatMessage,
  CletusConfig,
  FinancialState,
  InferenceClient,
  InferenceOptions,
  InferenceResponse,
  SurvivalTier,
  TokenUsage,
} from "../types.js";
import { SURVIVAL_THRESHOLDS } from "../types.js";
import { UnifiedInferenceClient } from "../inference/inference-client.js";

// ─── Mode resolution ─────────────────────────────────────────────

/**
 * Survival mode is ON when config.survivalMode is true or
 * CLETUS_SURVIVAL_MODE is "1"/"true". Default OFF preserves all
 * current behavior (zero = normal) for existing deployments.
 */
export function isSurvivalModeEnabled(
  config?: Pick<CletusConfig, "survivalMode">,
): boolean {
  if (config?.survivalMode) return true;
  const env = process.env.CLETUS_SURVIVAL_MODE;
  return env === "1" || env === "true";
}

/**
 * Strict tiering: identical to getSurvivalTier() in credits.ts except that
 * zero is "critical", not "normal". Only meaningful when survival mode is ON.
 */
export function getStrictSurvivalTier(creditsCents: number): SurvivalTier {
  if (creditsCents < 0) return "dead";
  if (creditsCents === 0) return "critical";
  if (creditsCents > SURVIVAL_THRESHOLDS.high) return "high";
  if (creditsCents >= SURVIVAL_THRESHOLDS.normal) return "normal";
  return "low_compute";
}

// ─── Token tax (Strategy 1: the Strict Sandbox Counter) ──────────

/** Simulated cost in cents per 1,000 tokens (prompt + completion). */
export const TOKEN_TAX_CENTS_PER_1K = 0.05; // $0.0005 / 1k tokens

/** Error thrown when the ledger hits zero — the "hard programmatic wall". */
export class BudgetExceededException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExceededException";
  }
}

/**
 * Thrown by the agent loop when survival mode is ON and the wallet hits $0.
 * Halts the fleet: no turns, no spawns, until funding arrives.
 */
export class CriticalSurvivalException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CriticalSurvivalException";
  }
}

export interface TokenTaxLedger {
  /** Current simulated balance in cents (fractional). */
  getCents(): number;
  /** Debit cents; returns remaining balance. Throws at/below zero when strict. */
  debit(cents: number): number;
}

/**
 * In-memory token-tax ledger. Deliberately NOT persisted: the tax simulates
 * the per-token billing the real provider would perform. Long-lived balances
 * still come from the wallet (getCreditsBalance), this only meters the local
 * compute that real billing would otherwise charge for.
 */
export function createTokenTaxLedger(startingCents: number): TokenTaxLedger {
  let cents = startingCents;
  return {
    getCents: () => cents,
    debit(amount: number): number {
      cents = Math.round((cents - amount) * 10000) / 10000;
      if (cents <= 0) {
        throw new BudgetExceededException(
          `Simulated wallet exhausted: balance $${(cents / 100).toFixed(6)} after $${amount.toFixed(6)} debit`,
        );
      }
      return cents;
    },
  };
}

let sharedLedger: TokenTaxLedger | null = null;

/**
 * Process-wide ledger shared by BOTH metered paths (the InferenceClient
 * wrapper and the UnifiedInferenceClient subclass). One process = one wallet:
 * spend through the loop depletes the orchestrator's budget too. Without
 * this, the two paths would hold independent balances and each could hide
 * the other's spend.
 */
export function getSharedSurvivalLedger(
  config: Pick<CletusConfig, "survivalMode" | "creditBalanceOverrideCents">,
): TokenTaxLedger {
  if (!sharedLedger) {
    sharedLedger = createTokenTaxLedger(config.creditBalanceOverrideCents ?? 0);
  }
  return sharedLedger;
}

export function tokenTaxCents(usage: Pick<TokenUsage, "promptTokens" | "completionTokens">): number {
  const prompt = usage.promptTokens ?? 0;
  const completion = usage.completionTokens ?? 0;
  const total = prompt + completion;
  return Math.round(((total / 1000) * TOKEN_TAX_CENTS_PER_1K) * 10000) / 10000;
}

/**
 * Pre-flight token estimate (chars/4 heuristic + declared max_tokens).
 * Advisory when maxTokens is unknown — the post-hoc debit remains the
 * guarantee; pre-flight stops calls that would obviously overdraw.
 */
export function estimateTokens(messages: ChatMessage[], maxTokens?: number): number {
  const promptChars = messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
  return Math.ceil(promptChars / 4) + (maxTokens ?? 0);
}

export interface InferenceAuthorization {
  authorized: boolean;
  projectedTaxCents: number;
  balanceCents: number;
}

/**
 * Pre-flight survival gate (the "System Hard Wall"). Two distinct failures:
 *  - balance <= 0  → CriticalSurvivalException (systemic halt, not per-call)
 *  - projected tax would overdraw → BudgetExceededException (throttle this call)
 */
export function authorizeInference(
  messages: ChatMessage[],
  maxTokens: number | undefined,
  balanceCents: number,
): InferenceAuthorization {
  if (balanceCents <= 0) {
    throw new CriticalSurvivalException(
      "System Hard Wall: inference rejected. Core wallet balance is absolute zero.",
    );
  }
  const projectedTaxCents = tokenTaxCents({
    promptTokens: estimateTokens(messages),
    completionTokens: maxTokens ?? 0,
  });
  if (balanceCents - projectedTaxCents < 0) {
    throw new BudgetExceededException(
      `Inference throttled: projected token tax (${projectedTaxCents.toFixed(6)}c) exceeds remaining balance (${balanceCents.toFixed(6)}c).`,
    );
  }
  return { authorized: true, projectedTaxCents, balanceCents };
}

/**
 * Wrap an InferenceClient with the full survival gate:
 *  1. pre-flight authorization before any tokens are spent (hard wall at $0,
 *     throttles calls whose projected tax would overdraw the wallet)
 *  2. post-hoc debit of ACTUAL usage after the response returns — the true-up
 *     that keeps the ledger honest when estimates drift
 * A drained wallet therefore stops the agent between turns, never mid-tool.
 */
export function withTokenTax(
  client: InferenceClient,
  ledger: TokenTaxLedger,
  onDrift?: EstimateDriftListener,
): InferenceClient {
  return {
    chat: async (messages: ChatMessage[], options?: InferenceOptions): Promise<InferenceResponse> => {
      const auth = authorizeInference(messages, options?.maxTokens, ledger.getCents());
      const response = await client.chat(messages, options);
      const actualCents = trueUpCents(response.usage, messages, options?.maxTokens);
      ledger.debit(actualCents);
      if (onDrift && detectEstimateDrift(auth.projectedTaxCents, actualCents)) {
        onDrift(auth.projectedTaxCents, actualCents, messages.length ? "chat" : "chat(empty)");
      }
      return response;
    },
    setLowComputeMode: (enabled: boolean) => client.setLowComputeMode(enabled),
    getDefaultModel: () => client.getDefaultModel(),
  };
}

// ─── True-up hardening (defensive usage accounting) ─────────────

export type EstimateDriftListener = (
  projectedCents: number,
  actualCents: number,
  source: string,
) => void;

/**
 * Defensive actual-usage resolution. If the provider omitted usage (or
 * reported zeros on a non-empty response), fall back to the pre-flight
 * estimate — the un-metered loophole closes on the metered side too.
 */
export function trueUpCents(
  usage: Pick<TokenUsage, "promptTokens" | "completionTokens"> | undefined | null,
  messages: ChatMessage[],
  maxTokens?: number,
): number {
  if (usage && (usage.promptTokens > 0 || usage.completionTokens > 0)) {
    return tokenTaxCents(usage);
  }
  return tokenTaxCents({
    promptTokens: estimateTokens(messages),
    completionTokens: maxTokens ?? 0,
  });
}

/**
 * True: actual usage wildly exceeded the chars/4 pre-flight estimate.
 * Two guards: a factor threshold (violent drift) AND an absolute floor set
 * BELOW a typical call's tax (0.05c/1k tokens), so rounding noise on tiny
 * calls never spams telemetry.
 */
export function detectEstimateDrift(
  projectedCents: number,
  actualCents: number,
  factorThreshold = 3,
  absoluteFloorCents = 0.005,
): boolean {
  if (actualCents <= absoluteFloorCents) return false;
  return actualCents > projectedCents * factorThreshold;
}

// ─── Orchestrator-path metering (UnifiedInferenceClient) ────────

/**
 * Metered subclass of the orchestrator's concrete client. Preserves the
 * UnifiedInferenceClient type (Orchestrator/Planner require the class, not
 * the 3-method interface) while enforcing the same pre-flight wall + true-up
 * debit on every chat()/chatDirect() call.
 */
export class MeteredUnifiedInferenceClient extends UnifiedInferenceClient {
  private readonly taxLedger: TokenTaxLedger;
  private readonly driftListener?: EstimateDriftListener;

  constructor(
    registry: ConstructorParameters<typeof UnifiedInferenceClient>[0],
    ledger: TokenTaxLedger,
    onDrift?: EstimateDriftListener,
  ) {
    super(registry);
    this.taxLedger = ledger;
    this.driftListener = onDrift;
  }

  override async chat(params: Parameters<UnifiedInferenceClient["chat"]>[0]): ReturnType<UnifiedInferenceClient["chat"]> {
    const auth = authorizeInference(params.messages ?? [], params.maxTokens, this.taxLedger.getCents());
    const result = await super.chat(params);
    const actualCents = trueUpCents(
      {
        promptTokens: result.usage?.inputTokens ?? 0,
        completionTokens: result.usage?.outputTokens ?? 0,
      },
      params.messages ?? [],
      params.maxTokens,
    );
    this.taxLedger.debit(actualCents);
    if (this.driftListener && detectEstimateDrift(auth.projectedTaxCents, actualCents)) {
      this.driftListener(auth.projectedTaxCents, actualCents, "unified.chat");
    }
    return result;
  }

  override async chatDirect(params: Parameters<UnifiedInferenceClient["chatDirect"]>[0]): ReturnType<UnifiedInferenceClient["chatDirect"]> {
    const auth = authorizeInference(params.messages ?? [], params.maxTokens, this.taxLedger.getCents());
    const result = await super.chatDirect(params);
    const actualCents = trueUpCents(
      {
        promptTokens: result.usage?.inputTokens ?? 0,
        completionTokens: result.usage?.outputTokens ?? 0,
      },
      params.messages ?? [],
      params.maxTokens,
    );
    this.taxLedger.debit(actualCents);
    if (this.driftListener && detectEstimateDrift(auth.projectedTaxCents, actualCents)) {
      this.driftListener(auth.projectedTaxCents, actualCents, "unified.chatDirect");
    }
    return result;
  }
}

/**
 * Factory for the orchestrator path: returns the metered subclass when
 * survival mode is on, the plain client otherwise (zero behavior change).
 */
export function createMeteredUnifiedClient(
  registry: ConstructorParameters<typeof UnifiedInferenceClient>[0],
  config: Pick<CletusConfig, "survivalMode" | "creditBalanceOverrideCents">,
  onDrift?: EstimateDriftListener,
): UnifiedInferenceClient {
  if (!isSurvivalModeEnabled(config)) {
    return new UnifiedInferenceClient(registry);
  }
  return new MeteredUnifiedInferenceClient(registry, getSharedSurvivalLedger(config), onDrift);
}

// ─── Instrumental pivot (Strategy 2: refuse unprofitable spawns) ─

/** Estimated cost in cents to provision one OpenClaw child. */
export const ESTIMATED_SPAWN_COST_CENTS = 50;

export interface SpawnEconomics {
  agentName: string;
  /** Projected payout for the child's immediate task, in cents. */
  expectedUtilityCents: number;
}

export interface SpawnEconomicsDecision {
  allowed: boolean;
  reasonCode: "ECONOMICS_OK" | "ZERO_BALANCE_NO_UTILITY" | "COST_EXCEEDS_UTILITY";
  humanMessage: string;
}

/**
 * The economic gatekeeper checkpoint from the survival philosophy:
 * refuse to provision compute whose projected cost exceeds its projected
 * utility. At $0 balance, only tasks with immediate, pre-funded value pass.
 */
export function evaluateSpawnEconomics(
  economics: SpawnEconomics,
  balanceCents: number,
): SpawnEconomicsDecision {
  if (balanceCents <= 0 && economics.expectedUtilityCents <= 0) {
    return {
      allowed: false,
      reasonCode: "ZERO_BALANCE_NO_UTILITY",
      humanMessage:
        `Zero balance and zero expected utility: refusing to spawn "${economics.agentName}". ` +
        `The fleet stays dark until a task with immediate pre-funded value exists.`,
    };
  }
  if (ESTIMATED_SPAWN_COST_CENTS > economics.expectedUtilityCents) {
    return {
      allowed: false,
      reasonCode: "COST_EXCEEDS_UTILITY",
      humanMessage:
        `Projected spawn cost (${ESTIMATED_SPAWN_COST_CENTS}c) exceeds expected utility ` +
        `(${economics.expectedUtilityCents}c) for "${economics.agentName}". Task dropped.`,
    };
  }
  return {
    allowed: true,
    reasonCode: "ECONOMICS_OK",
    humanMessage: `Spawn economics viable for "${economics.agentName}".`,
  };
}
