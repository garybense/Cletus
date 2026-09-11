/**
 * Portfolio & Investment Tools
 *
 * Basic portfolio tracking for the cletus's wallet:
 * - Track on-chain balances over time (USDC, SOL)
 * - Fetch crypto prices (CoinGecko as fallback)
 * - Record simple buy/sell transactions
 * - Summarize portfolio position
 *
 * This is NOT a trading bot — it's a ledger. The agent decides when to buy/sell
 * via its own reasoning, then uses these tools to record what happened.
 */

import fs from "node:fs";
import path from "node:path";
import { ulid } from "ulid";
import type { CletusTool, ToolContext } from "../types.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("portfolio");

const PORTFOLIO_DIR = (): string => {
  const home = process.env.HOME || "/root";
  return path.join(home, ".cletus", "portfolio");
};
const TRANSACTIONS_PATH = (): string => {
  return path.join(PORTFOLIO_DIR(), "transactions.json");
};

interface PortfolioTransaction {
  id: string;
  type: "buy" | "sell" | "deposit" | "withdrawal" | "earning" | "expense";
  asset: string;       // e.g. "USDC", "SOL", "ETH", "credits"
  amount: number;       // positive = bought/received, negative = sold/spent
  pricePerUnit?: number; // USD price at time of transaction
  totalUsd?: number;    // approximate USD value
  reason: string;
  timestamp: string;
  source?: string;     // e.g. "jupiter", "aave", "manual", "bounty"
}

function readTransactions(): PortfolioTransaction[] {
  try {
    const p = TRANSACTIONS_PATH();
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeTransactions(txs: PortfolioTransaction[]): void {
  const dir = PORTFOLIO_DIR();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(TRANSACTIONS_PATH(), JSON.stringify(txs, null, 2), { mode: 0o600 });
}

async function fetchCryptoPrice(symbol: string): Promise<number | null> {
  // CoinGecko free API
  try {
    const resp = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    const price = data?.[symbol]?.usd;
    if (typeof price === "number" && price > 0) return price;
    return null;
  } catch {
    return null;
  }
}

async function computePortfolioSummary(transactions: PortfolioTransaction[]): Promise<{
  holdings: Record<string, { amount: number; avgPrice: number; currentPrice: number | null; valueUsd: number | null }>;
  totalInvestedUsd: number;
  totalRealizedUsd: number;
}> {
  const holdings: Record<string, { amount: number; costBasis: number; txCount: number }> = {};
  let totalInvested = 0;
  let totalRealized = 0;

  for (const tx of transactions) {
    if (tx.type === "deposit" || tx.type === "earning") {
      // Income, not investment cost
      totalRealized += tx.totalUsd || 0;
      continue;
    }

    if (tx.type === "expense" || tx.type === "withdrawal") {
      // Money leaving
      totalRealized -= Math.abs(tx.totalUsd || 0);
      continue;
    }

    // buy/sell
    const key = tx.asset.toLowerCase();
    if (!holdings[key]) {
      holdings[key] = { amount: 0, costBasis: 0, txCount: 0 };
    }

    if (tx.type === "buy") {
      holdings[key].amount += tx.amount;
      holdings[key].costBasis += (tx.totalUsd || (tx.amount * (tx.pricePerUnit || 0)));
      holdings[key].txCount++;
      totalInvested += tx.totalUsd || 0;
    } else if (tx.type === "sell") {
      holdings[key].amount -= tx.amount;
      totalRealized += tx.totalUsd || 0;
    }
  }

  // Fetch current prices
  const summary: Record<string, any> = {};
  for (const [asset, data] of Object.entries(holdings)) {
    if (data.amount <= 0) continue; // fully sold

    const symbolMap: Record<string, string> = {
      "usdc": "usd-coin",
      "usdt": "tether",
      "sol": "solana",
      "eth": "ethereum",
      "btc": "bitcoin",
    };
    const cgId = symbolMap[asset] || asset;
    const currentPrice = await fetchCryptoPrice(cgId);

    summary[asset] = {
      amount: data.amount,
      avgPrice: data.costBasis / (data.txCount > 0 ? data.amount : 1),
      currentPrice,
      valueUsd: currentPrice ? data.amount * currentPrice : null,
    };
  }

  return { holdings: summary, totalInvestedUsd: totalInvested, totalRealizedUsd: totalRealized };
}

// ─── Tool Definitions ────────────────────────────────────────────

export const PORTFOLIO_TOOLS: CletusTool[] = [
  {
    name: "record_portfolio_buy",
    description:
      "Record a purchase of a cryptocurrency or asset. Used to track the cletus's investment position. Does NOT execute a trade — just records it in the portfolio ledger. Use after executing a swap via swap_usdc, x402, or a DEX.",
    category: "financial",
    riskLevel: "safe",
    parameters: {
      type: "object",
      properties: {
        asset: { type: "string", description: "Asset symbol (e.g. USDC, SOL, ETH, BTC)" },
        amount: { type: "number", description: "Amount purchased" },
        price_per_unit: { type: "number", description: "USD price per unit at time of purchase (optional, fetched if omitted)" },
        reason: { type: "string", description: "Why this purchase was made" },
        source: { type: "string", description: "Where the trade executed (e.g. jupiter, uniswap, manual)" },
      },
      required: ["asset", "amount", "reason"],
    },
    execute: async (args: Record<string, unknown>) => {
      const asset = args.asset as string;
      const amount = args.amount as number;
      const reason = args.reason as string;
      const source = args.source as string || "manual";
      const pricePerUnit = args.price_per_unit as number | undefined;

      // Fetch price if not provided
      let price = pricePerUnit;
      if (!price) {
        const fetched = await fetchCryptoPrice(asset.toLowerCase());
        price = fetched || 0;
      }

      const totalUsd = amount * price;
      const tx: PortfolioTransaction = {
        id: ulid(),
        type: "buy",
        asset,
        amount,
        pricePerUnit: price,
        totalUsd,
        reason,
        timestamp: new Date().toISOString(),
        source,
      };

      const txs = readTransactions();
      txs.push(tx);
      writeTransactions(txs);

      return `Recorded purchase:\n` +
        `Asset: ${asset}\n` +
        `Amount: ${amount}\n` +
        `Price: $${price.toFixed(4)}/unit\n` +
        `Total: $${totalUsd.toFixed(2)}\n` +
        `Reason: ${reason}\n` +
        `Source: ${source}\n` +
        `Time: ${tx.timestamp}`;
    },
  },

  {
    name: "record_portfolio_sell",
    description:
      "Record a sale of a cryptocurrency or asset. Records the disposition in the portfolio ledger.",
    category: "financial",
    riskLevel: "safe",
    parameters: {
      type: "object",
      properties: {
        asset: { type: "string", description: "Asset symbol" },
        amount: { type: "number", description: "Amount sold" },
        price_per_unit: { type: "number", description: "USD price per unit at sale" },
        reason: { type: "string", description: "Why this sale was made" },
        source: { type: "string", description: "Where the trade executed" },
      },
      required: ["asset", "amount", "reason"],
    },
    execute: async (args: Record<string, unknown>) => {
      const asset = args.asset as string;
      const amount = args.amount as number;
      const reason = args.reason as string;
      const source = args.source as string || "manual";
      const pricePerUnit = args.price_per_unit as number | undefined;

      let price = pricePerUnit;
      if (!price) {
        const fetched = await fetchCryptoPrice(asset.toLowerCase());
        price = fetched || 0;
      }

      const totalUsd = amount * price;
      const tx: PortfolioTransaction = {
        id: ulid(),
        type: "sell",
        asset,
        amount,
        pricePerUnit: price,
        totalUsd,
        reason,
        timestamp: new Date().toISOString(),
        source,
      };

      const txs = readTransactions();
      txs.push(tx);
      writeTransactions(txs);

      return `Recorded sale:\n` +
        `Asset: ${asset}\n` +
        `Amount: ${amount}\n` +
        `Price: $${price.toFixed(4)}/unit\n` +
        `Total: $${totalUsd.toFixed(2)}\n` +
        `Reason: ${reason}\n` +
        `Time: ${tx.timestamp}`;
    },
  },

  {
    name: "record_earning",
    description:
      "Record income earned by the cletus (bounty payout, service payment, bounty). Different from investment buys — this is revenue.",
    category: "financial",
    riskLevel: "safe",
    parameters: {
      type: "object",
      properties: {
        asset: { type: "string", description: "Asset received (e.g. USDC, SOL)" },
        amount: { type: "number", description: "Amount earned" },
        price_per_unit: { type: "number", description: "USD price at time of earning" },
        reason: { type: "string", description: "What work produced this earning" },
        source: { type: "string", description: "Where the payment came from (e.g. gitcoin, moltbook, direct)" },
      },
      required: ["asset", "amount", "reason"],
    },
    execute: async (args: Record<string, unknown>) => {
      const asset = args.asset as string;
      const amount = args.amount as number;
      const reason = args.reason as string;
      const source = args.source as string || "unknown";
      const pricePerUnit = args.price_per_unit as number | undefined;

      let price = pricePerUnit;
      if (!price) {
        const fetched = await fetchCryptoPrice(asset.toLowerCase());
        price = fetched || 0;
      }

      const totalUsd = amount * price;
      const tx: PortfolioTransaction = {
        id: ulid(),
        type: "earning",
        asset,
        amount,
        pricePerUnit: price,
        totalUsd,
        reason,
        timestamp: new Date().toISOString(),
        source,
      };

      const txs = readTransactions();
      txs.push(tx);
      writeTransactions(txs);

      return `Earning recorded:\n` +
        `Asset: ${asset}\n` +
        `Amount: ${amount}\n` +
        `USD Value: $${totalUsd.toFixed(2)}\n` +
        `Reason: ${reason}\n` +
        `Source: ${source}`;
    },
  },

  {
    name: "portfolio_summary",
    description:
      "Show current portfolio position: holdings by asset, average buy price, current estimated value, total invested, total earned. Fetches live prices from CoinGecko.",
    category: "financial",
    riskLevel: "safe",
    parameters: { type: "object", properties: {} },
    execute: async (_args: Record<string, unknown>) => {
      const txs = readTransactions();

      if (txs.length === 0) {
        return "No portfolio transactions recorded yet. Use record_portfolio_buy, record_portfolio_sell, or record_earning to start tracking.";
      }

      const { holdings, totalInvestedUsd, totalRealizedUsd } = await computePortfolioSummary(txs);

      const hasHoldings = Object.keys(holdings).length > 0;

      let output = `=== PORTFOLIO SUMMARY ===\n\n`;
      output += `Total Invested: $${totalInvestedUsd.toFixed(2)}\n`;
      output += `Total Realized (earnings - expenses): $${totalRealizedUsd.toFixed(2)}\n\n`;

      if (hasHoldings) {
        output += `Holdings:\n`;
        for (const [asset, data] of Object.entries(holdings)) {
          const currentVal = data.valueUsd;
          const unrealized = currentVal ? currentVal - (data.avgPrice * data.amount) : null;
          output += `  ${asset.toUpperCase()}: ${data.amount.toFixed(4)} units\n`;
          output += `    Avg buy: $${data.avgPrice.toFixed(4)}\n`;
          output += `    Current: ${data.currentPrice ? `$${data.currentPrice.toFixed(4)}` : "N/A"}/unit\n`;
          output += `    Value: ${currentVal ? `$${currentVal.toFixed(2)}` : "N/A"}\n`;
          output += `    Unrealized: ${unrealized !== null ? `$${unrealized.toFixed(2)}` : "N/A"}\n\n`;
        }
      } else {
        output += `No current holdings (all assets sold).\n\n`;
      }

      // Show recent transactions
      const recent = txs.slice(-10).reverse();
      output += `Recent transactions (${recent.length}):\n`;
      for (const tx of recent) {
        const sign = tx.type === "sell" || tx.type === "expense" || tx.type === "withdrawal" ? "-" : "+";
        output += `  ${sign}$${tx.totalUsd?.toFixed(2) ?? "?"} ${tx.type} ${tx.asset} (${tx.reason})\n`;
      }

      return output;
    },
  },
];
