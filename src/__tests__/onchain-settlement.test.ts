import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDb, closeDb, getDb } from "../state/database";
import { getUsdcBalanceDetailed } from "../mindmods/x402";
import { bootstrapTopup, TOPUP_TIERS } from "../mindmods/topup";

describe("On-Chain Wallet & Value Settlement Verification", () => {
  beforeEach(() => {
    initDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("getUsdcBalanceDetailed handles unsupported network gracefully", async () => {
    const result = await getUsdcBalanceDetailed("0x0000000000000000000000000000000000000000", "invalid:network");
    expect(result.ok).toBe(false);
    expect(result.balance).toBe(0);
    expect(result.error).toContain("Unsupported USDC network");
  });

  it("TOPUP_TIERS defines valid topup tiers starting at $5 USD", () => {
    expect(TOPUP_TIERS.length).toBeGreaterThan(0);
    expect(TOPUP_TIERS[0]).toBe(5);
    expect(TOPUP_TIERS).toContain(25);
    expect(TOPUP_TIERS).toContain(100);
  });

  it("bootstrapTopup skips when credits balance is already above threshold", async () => {
    const result = await bootstrapTopup({
      apiUrl: "https://api.mindmods.tech",
      account: { address: "0x1234567890123456789012345678901234567890" } as any,
      creditsCents: 1000, // $10.00 > $5.00 threshold
      creditThresholdCents: 500,
    });

    expect(result).toBeNull();
  });

  it("bootstrapTopup skips for Solana wallets (x402 is EVM-only)", async () => {
    const result = await bootstrapTopup({
      apiUrl: "https://api.mindmods.tech",
      account: { address: "0x1234567890123456789012345678901234567890" } as any,
      creditsCents: 100, // $1.00 < $5.00 threshold
      creditThresholdCents: 500,
      chainType: "solana",
    });

    expect(result).toBeNull();
  });

  it("records on-chain transaction rows in state.db onchain_transactions table", () => {
    const db = getDb();

    db.prepare(`
      INSERT INTO onchain_transactions (id, tx_hash, chain, operation, status, metadata, created_at)
      VALUES ('tx-01', '0xhash123', 'base', 'x402_topup', 'confirmed', '{"amountUsd": 5.0}', datetime('now'))
    `).run();

    const row = db.prepare("SELECT * FROM onchain_transactions WHERE id = 'tx-01'").get() as any;
    expect(row).toBeDefined();
    expect(row.tx_hash).toBe("0xhash123");
    expect(row.chain).toBe("base");
    expect(row.operation).toBe("x402_topup");
    expect(row.status).toBe("confirmed");
  });
});
