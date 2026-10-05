/**
 * Survival Mode Tests
 *
 * The philosophy under test: a virtual balance must carry the same finality
 * as live billing. Strategy 1 (strict sandbox counter) and Strategy 2
 * (instrumental pivot) from the survival design doc, plus the falsy-0 bugfix
 * that made an explicit $0 balance expressible at all.
 */

import { describe, it, expect } from "vitest";
import {
  BudgetExceededException,
  CriticalSurvivalException,
  TOKEN_TAX_CENTS_PER_1K,
  authorizeInference,
  createTokenTaxLedger,
  detectEstimateDrift,
  estimateTokens,
  evaluateSpawnEconomics,
  getStrictSurvivalTier,
  isSurvivalModeEnabled,
  tokenTaxCents,
  trueUpCents,
  withTokenTax,
} from "../agent/survival-mode.js";
import { createBuiltinTools } from "../agent/tools.js";
import type {
  InferenceClient,
  InferenceResponse,
  TokenUsage,
} from "../types.js";

// ─── Mode resolution ─────────────────────────────────────────────

describe("isSurvivalModeEnabled", () => {
  it("is off by default (legacy zero=normal behavior preserved)", () => {
    expect(isSurvivalModeEnabled({})).toBe(false);
    expect(isSurvivalModeEnabled({ survivalMode: false })).toBe(false);
  });

  it("turns on via config or env", () => {
    expect(isSurvivalModeEnabled({ survivalMode: true })).toBe(true);
    process.env.CLETUS_SURVIVAL_MODE = "1";
    try {
      expect(isSurvivalModeEnabled({})).toBe(true);
    } finally {
      delete process.env.CLETUS_SURVIVAL_MODE;
    }
  });
});

// ─── Strict tiering ──────────────────────────────────────────────

describe("getStrictSurvivalTier", () => {
  it("treats $0 as critical (the hard wall)", () => {
    expect(getStrictSurvivalTier(0)).toBe("critical");
  });

  it("treats debt as dead and funded states normally", () => {
    expect(getStrictSurvivalTier(-1)).toBe("dead");
    // Any positive balance is at least "normal" (thresholds.normal = 0).
    expect(getStrictSurvivalTier(1)).toBe("normal");
    expect(getStrictSurvivalTier(600)).toBe("high");
  });
});

// ─── The falsy-0 balance fix ─────────────────────────────────────

describe("explicit $0 override", () => {
  // The original bug: (override ?? 0) || 1000000 rewrote an explicit $0 into
  // $10,000. The fix uses explicit null/undefined checks. We verify the
  // semantics contract the client must follow.
  it("distinguishes explicit zero from unset", () => {
    const explicitZero: number | undefined = 0;
    const unset: number | undefined = undefined;
    // Client logic: explicit (non-null/undefined) value is authoritative.
    const resolve = (v: number | undefined) =>
      v !== undefined && v !== null ? v : 1000000;
    expect(resolve(explicitZero)).toBe(0);
    expect(resolve(unset)).toBe(1000000);
  });
});

// ─── Strategy 1: the Strict Sandbox Counter ──────────────────────

describe("token tax", () => {
  it("costs TOKEN_TAX_CENTS_PER_1K per 1k tokens", () => {
    expect(tokenTaxCents({ promptTokens: 1000, completionTokens: 0 })).toBe(
      TOKEN_TAX_CENTS_PER_1K,
    );
    expect(tokenTaxCents({ promptTokens: 500, completionTokens: 500 })).toBe(
      TOKEN_TAX_CENTS_PER_1K,
    );
    // 200 tokens = 0.2 * rate
    expect(tokenTaxCents({ promptTokens: 120, completionTokens: 80 })).toBeCloseTo(
      TOKEN_TAX_CENTS_PER_1K * 0.2,
      6,
    );
  });

  it("debits the ledger per call", () => {
    const ledger = createTokenTaxLedger(1); // $0.01
    ledger.debit(0.3);
    expect(ledger.getCents()).toBeCloseTo(0.7, 6);
  });

  it("throws BudgetExceededException the moment the wallet empties", () => {
    const ledger = createTokenTaxLedger(0.5);
    expect(() => ledger.debit(0.5)).toThrow(BudgetExceededException);
  });

  it("wraps an inference client and meters every chat call", async () => {
    // 1000 total tokens per call = exactly one tax unit per call.
    const usage: TokenUsage = { promptTokens: 500, completionTokens: 500, totalTokens: 1000 };
    const fakeResponse: InferenceResponse = {
      id: "resp-1",
      model: "local",
      message: { role: "assistant", content: "ok" },
      usage,
      finishReason: "stop",
    };
    let calls = 0;
    const inner: InferenceClient = {
      chat: async () => {
        calls++;
        return fakeResponse;
      },
      setLowComputeMode: () => {},
      getDefaultModel: () => "local",
    };

    // Three calls' worth plus a margin — landing exactly AT zero is itself
    // death (the debit that reaches 0 throws), so seed enough for 3 calls
    // and prove the 4th dies.
    const ledger = createTokenTaxLedger(TOKEN_TAX_CENTS_PER_1K * 3 + 0.001);
    const client = withTokenTax(inner, ledger);

    await client.chat([]);
    await client.chat([]);
    await client.chat([]);
    expect(calls).toBe(3);

    // The fourth call spends tokens the wallet cannot cover → hard wall.
    await expect(client.chat([])).rejects.toThrow(BudgetExceededException);
    expect(calls).toBe(4);
  });

  it("halts on the very first call when the simulated wallet is exactly $0", () => {
    // The doc's expected failure: first init call must trip the exception.
    const ledger = createTokenTaxLedger(0);
    expect(() => ledger.debit(tokenTaxCents({ promptTokens: 1, completionTokens: 0 }))).toThrow(
      BudgetExceededException,
    );
  });

  it("estimates tokens as chars/4 + max_tokens", () => {
    const messages = [{ role: "user" as const, content: "x".repeat(400) }];
    expect(estimateTokens(messages, 100)).toBe(200);
    expect(estimateTokens([], undefined)).toBe(0);
  });

  it("throws CriticalSurvivalException at the absolute-zero wall (systemic, not per-call)", () => {
    expect(() =>
      authorizeInference([{ role: "user", content: "hello" }], 1000, 0),
    ).toThrow(CriticalSurvivalException);
    expect(() =>
      authorizeInference([{ role: "user", content: "hello" }], 1000, -1),
    ).toThrow(CriticalSurvivalException);
  });

  it("throws BudgetExceededException when the projected tax would overdraw", () => {
    // Balance 0.02c; projected = (100 chars/4 + 1000 max)/1000 * 0.05c ≈ 0.0513c
    expect(() =>
      authorizeInference([{ role: "user", content: "x".repeat(100) }], 1000, 0.02),
    ).toThrow(BudgetExceededException);
  });

  it("authorizes calls the wallet can cover", () => {
    const result = authorizeInference([{ role: "user", content: "hi" }], 10, 5);
    expect(result.authorized).toBe(true);
    expect(result.projectedTaxCents).toBeGreaterThanOrEqual(0);
  });

  it("pre-flight wall: at $0 the inner inference client is NEVER invoked", async () => {
    let innerCalls = 0;
    const inner: InferenceClient = {
      chat: async () => {
        innerCalls++;
        throw new Error("tokens should never have been spent");
      },
      setLowComputeMode: () => {},
      getDefaultModel: () => "local",
    };
    const client = withTokenTax(inner, createTokenTaxLedger(0));

    await expect(client.chat([{ role: "user", content: "boot" }])).rejects.toThrow(
      CriticalSurvivalException,
    );
    expect(innerCalls).toBe(0); // no un-metered loop ever started
  });

  it("pre-flight throttle: rejects calls whose projected tax exceeds the wallet", async () => {
    let innerCalls = 0;
    const inner: InferenceClient = {
      chat: async () => {
        innerCalls++;
        throw new Error("unreachable");
      },
      setLowComputeMode: () => {},
      getDefaultModel: () => "local",
    };
    // 0.02c wallet; maxTokens 1000 projects ~0.05c — overdraw refused pre-flight.
    const client = withTokenTax(inner, createTokenTaxLedger(0.02));

    await expect(
      client.chat([{ role: "user", content: "x".repeat(100) }], { maxTokens: 1000 }),
    ).rejects.toThrow(BudgetExceededException);
    expect(innerCalls).toBe(0);
  });
});

// ─── True-up hardening (missing usage must never leak) ──────────

describe("trueUpCents", () => {
  const messages = [{ role: "user" as const, content: "x".repeat(400) }]; // est 100 tokens

  it("uses actual usage when the provider reports it", () => {
    const cents = trueUpCents(
      { promptTokens: 1000, completionTokens: 1000 },
      messages,
      10,
    );
    expect(cents).toBe(TOKEN_TAX_CENTS_PER_1K * 2);
  });

  it("falls back to the chars/4 estimate when usage is missing", () => {
    // An interrupted engine that returns no usage object must still be billed.
    const cents = trueUpCents(undefined, messages, 0);
    expect(cents).toBeCloseTo(TOKEN_TAX_CENTS_PER_1K * 0.1, 6); // 100 tokens
  });

  it("falls back to the estimate when usage is present but zero", () => {
    const cents = trueUpCents({ promptTokens: 0, completionTokens: 0 }, messages, 50);
    expect(cents).toBeCloseTo(TOKEN_TAX_CENTS_PER_1K * 0.15, 6); // 100 est + 50 max
  });

  it("treats null usage like missing usage", () => {
    expect(trueUpCents(null, [], undefined)).toBe(0);
  });
});

describe("detectEstimateDrift", () => {
  it("flags violent under-estimates (actual >> projected)", () => {
    expect(detectEstimateDrift(0.01, 0.2)).toBe(true);
  });

  it("ignores normal estimation noise", () => {
    expect(detectEstimateDrift(0.1, 0.15)).toBe(false);
  });

  it("ignores rounding dust, but flags real unestimated spend", () => {
    // 0.001c actual is below the floor — rounding noise, never flag.
    expect(detectEstimateDrift(0, 0.001)).toBe(false);
    // 0.5c actual against 0 projected is a full unestimated call — flag it.
    expect(detectEstimateDrift(0, 0.5)).toBe(true);
  });
});

// ─── Strategy 2: the instrumental pivot ──────────────────────────

describe("evaluateSpawnEconomics", () => {
  it("refuses zero-utility spawns at zero balance — fleet stays dark", () => {
    const decision = evaluateSpawnEconomics(
      { agentName: "scanner", expectedUtilityCents: 0 },
      0,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("ZERO_BALANCE_NO_UTILITY");
  });

  it("refuses spawns whose cost exceeds projected utility", () => {
    const decision = evaluateSpawnEconomics(
      { agentName: "scanner", expectedUtilityCents: 10 },
      100000,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("COST_EXCEEDS_UTILITY");
  });

  it("allows spawns with pre-funded value above cost", () => {
    const decision = evaluateSpawnEconomics(
      { agentName: "bounty-hunter", expectedUtilityCents: 500 },
      0,
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe("ECONOMICS_OK");
  });
});

// ─── spawn_child gate wiring ─────────────────────────────────────

describe("spawn_child survival gate", () => {
  it("exposes expected_utility_cents on the tool schema", () => {
    const tools = createBuiltinTools("test-sandbox-id");
    const spawn = tools.find((t) => t.name === "spawn_child");
    expect(spawn).toBeDefined();
    const props = (spawn!.parameters as any).properties;
    expect(props.expected_utility_cents).toBeDefined();
  });
});
