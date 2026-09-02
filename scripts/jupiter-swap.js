#!/usr/bin/env node
/**
 * jupiter-swap.js — Solana USDC -> token swap via Jupiter v3 API
 *
 * Usage:
 *   node scripts/jupiter-swap.js <WalletAddress> <AmountUSD> <TokenSymbol> [SlippageBPS]
 *
 * Example:
 *   node scripts/jupiter-swap.js 7xKXt... 25 SOL
 *   node scripts/jupiter-swap.js 7xKXt... 100 ETH
 *   node scripts/jupiter-swap.js 7xKXt... 50 BONK 500
 *
 * What it does:
 *   1. Fetches a Jupiter v3 quote (USDC -> target token)
 *   2. Builds and sends the swap transaction via the Jupiter swap endpoint
 *   3. Signs with the wallet's keypair and sends via RPC
 *   4. Writes the result JSON to stdout (and appends to jupiter-swap.log)
 *
 * Prerequisites (install in the sandbox):
 *   npm install @solana/web3.js @solana/spl-token
 *
 * Environment:
 *   SOLANA_RPC_URL            — fullnode RPC (default: https://api.mainnet-beta.solana.com)
 *   JUPITER_API_URL           — Jupiter API base (default: https://quote-api.jup.ag/v3)
 *   SOLANA_KEYPAIR_PATH       — path to a JSON keypair file (array of uint8)
 *   SOLANA_PRIVATE_KEY_BASE58 — base58-encoded secret key (alternative to keypair file)
 *   JUPITER_SLIPPAGE_BPS     — slippage in basis points (default: 100 = 1%)
 *
 * This script uses the wallet's existing keypair. The wallet must hold USDC
 * (and SOL for rent/fees). USDC must be in an associated token account (ATA).
 *
 * Output: JSON to stdout with swap details (input, output, signature, quote).
 *         Also appends to jupiter-swap.log in the current working directory.
 *
 * Token mints supported (extend the mints map as needed):
 *   SOL  — native (quote outAmount is in lamports)
 *   BONK — DezXAZ8zPCEpAtmAKXdhm4g6g84N5hVvFdG5jH8nkG7
 *   WIF  — EKNoteScrQvrEpPodBReTqnbBGLpcROLLmzJQFEnBE7
 *   USDC — EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (default input)
 */

"use strict";

const { Connection, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction, Keypair } = require("@solana/web3.js");
const { getOrCreateAuthAccount, authorize, MINT_AMOUNT_AUTHORITY, TOKEN_CONVERSION_AUTHORITY, ASSOCIATED_TAG_LEN } = require("@solana/spl-token");
const https = require("https");
const fs = require("fs");
const path = require("path");

// ─── Config ────────────────────────────────────────────────────────
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const JUPITER_API = process.env.JUPITER_API_URL || "https://quote-api.jup.ag/v3";
const LOG_PATH = path.join(process.cwd(), "jupiter-swap.log");

function log(...args) {
  const line = new Date().toISOString() + " " + args.join(" ") + "\n";
  fs.appendFileSync(LOG_PATH, line);
  console.error(line.trim());
}

function jsonGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("JSON parse failed: " + data.slice(0, 200)));
        }
      });
    }).on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error("Usage: node jupiter-swap.js <WalletAddress> <AmountUSD> <TokenSymbol> [SlippageBPS]");
    console.error("Example: node jupiter-swap.js 7xKXt... 25 SOL");
    process.exit(1);
  }

  const walletAddress = args[0];
  const amountUSD = parseFloat(args[1]);
  const tokenSymbol = args[2].toUpperCase();
  const slippageBPS = parseInt(args[3], 10) || parseInt(process.env.JUPITER_SLIPPAGE_BPS || "100", 10);

  if (!amountUSD || amountUSD <= 0) {
    console.error("Invalid amount:", args[1]);
    process.exit(1);
  }

  if (!PublicKey.isOnCurve(walletAddress)) {
    console.error("Invalid wallet address:", walletAddress);
    process.exit(1);
  }

  log("START swap", walletAddress, amountUSD, tokenSymbol, "slippage", slippageBPS);

  // 1. Resolve token Mint from symbol
  const tokenMint = resolveTokenMint(tokenSymbol);
  if (!tokenMint) {
    console.error("Unknown token symbol:", tokenSymbol, "supported: SOL, BONK, WIF");
    console.error("Extend the mints map in scripts/jupiter-swap.js if you need more tokens.");
    process.exit(1);
  }

  // 2. Connect to RPC
  const connection = new Connection(RPC_URL, "confirmed");
  const pubkey = new PublicKey(walletAddress);

  // 3. Get wallet keypair from environment or keypair file
  const keypair = await loadKeypair(walletAddress);
  if (!keypair) {
    console.error("Could not load keypair for", walletAddress);
    console.error("Set SOLANA_KEYPAIR_PATH to a JSON keypair file, or SOLANA_PRIVATE_KEY_BASE58.");
    process.exit(1);
  }

  // 4. Check balances
  const balances = await getBalances(connection, pubkey);
  log("Balances:", JSON.stringify(balances));

  if (balances.usdc < amountUSD) {
    console.error("Insufficient USDC. Have:", balances.usdc, "Need:", amountUSD);
    process.exit(1);
  }

  // 5. Get Jupiter quote
  const quote = await getQuote(connection, pubkey, amountUSD, tokenMint, slippageBPS);
  log("Quote:", JSON.stringify(quote));

  if (!quote || !quote.instructions || quote.instructions.length === 0) {
    console.error("No quote available for", tokenSymbol, "amount", amountUSD);
    console.error("Response:", JSON.stringify(quote).slice(0, 500));
    process.exit(1);
  }

  // 6. Build and send swap transaction
  const swapTx = buildSwapTransaction(quote, keypair, connection);
  log("Sending swap transaction...");

  let sig;
  try {
    sig = await sendAndConfirmTransaction(connection, swapTx, [keypair], {
      commitment: "confirmed",
      skipPreflight: false,
      preflightCommitment: "processed",
    });
  } catch (sendErr) {
    log("SEND FAILED, retrying with skipPreflight=true:", sendErr.message);
    // Retry once with skipPreflight to handle stale blockhash
    const retryTx = buildSwapTransaction(quote, keypair, connection);
    sig = await sendAndConfirmTransaction(connection, retryTx, [keypair], {
      commitment: "confirmed",
      skipPreflight: true,
      preflightCommitment: "processed",
    });
  }

  log("Swap confirmed:", sig);

  // 7. Parse result
  const outputToken = tokenSymbol;
  const inputAmount = amountUSD;
  const outputAmount = parseOutputAmount(quote, tokenSymbol);

  const result = {
    status: "success",
    wallet: walletAddress,
    input: {
      token: "USDC",
      amount: inputAmount,
    },
    output: {
      token: outputToken,
      amount: outputAmount,
      mint: tokenMint,
    },
    signature: sig,
    quote: {
      inputToken: quote.inputToken,
      outputToken: quote.outputToken,
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpactPct: quote.priceImpactPct,
      slippageBps: slippageBPS,
    },
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(result, null, 2));
  log("DONE", JSON.stringify(result));
}

// ─── Helpers ────────────────────────────────────────────────────────

function resolveTokenMint(symbol) {
  // Extend this map as you discover more token mints via Jupiter.
  const known = {
    SOL: null,           // native SOL — Jupiter quotes in lamports
    BONK: "DezXAZ8zPCEpAtmAKXdhm4g6g84N5hVvFdG5jH8nkG7",
    WIF: "EKNoteScrQvrEpPodBReTqnbBGLpcROLLmzJQFEnBE7",
  };
  return known[symbol] || null;
}

async function loadKeypair(walletAddress) {
  // Try keypair file first
  const kpPath = process.env.SOLANA_KEYPAIR_PATH;
  if (kpPath && fs.existsSync(kpPath)) {
    try {
      const file = fs.readFileSync(kpPath);
      const kp = JSON.parse(file);
      if (Array.isArray(kp)) {
        return Keypair.fromSecretKey(new Uint8Array(kp));
      }
    } catch {}
  }

  // Try private key base58
  const pkBase58 = process.env.SOLANA_PRIVATE_KEY_BASE58;
  if (pkBase58) {
    try {
      const decoded = Buffer.from(pkBase58, "base58");
      return Keypair.fromSecretKey(decoded);
    } catch {}
  }

  // Fallback: try to find a matching keypair in common locations
  const searchPaths = [
    path.join(process.env.HOME || "/root", ".config", "solana", "keys", walletAddress + ".json"),
    path.join(process.env.HOME || "/root", ".solana", "keys", walletAddress + ".json"),
    "/root/.config/solana/keys/" + walletAddress + ".json",
  ];
  for (const sp of searchPaths) {
    if (fs.existsSync(sp)) {
      try {
        const file = fs.readFileSync(sp);
        const kp = JSON.parse(file);
        if (Array.isArray(kp)) {
          return Keypair.fromSecretKey(new Uint8Array(kp));
        }
      } catch {}
    }
  }

  return null;
}

async function getBalances(connection, pubkey) {
  const [solLamports, usdcBalance] = await Promise.all([
    connection.getBalance(pubkey),
    getUsdcBalance(connection, pubkey),
  ]);
  const sol = solLamports / 1e9;
  return { sol, solLamports, usdc: usdcBalance, totalUsd: usdcBalance + sol * 180 };
}

async function getUsdcBalance(connection, pubkey) {
  const { getAssociatedTokenAddress } = require("@solana/spl-token");
  const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  const ata = getAssociatedTokenAddress(pubkey, usdcMint);
  try {
    const info = await connection.getParsedTokenAccountBalance(ata);
    return info.value.uiAmount || 0;
  } catch {
    return 0;
  }
}

async function getQuote(connection, pubkey, amountUSD, tokenMint, slippageBPS) {
  const url = `${JUPITER_API}/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=${tokenMint || "SOL"}&amount=${Math.round(amountUSD * 1e6)}&slippage=${slippageBPS}`;
  const quote = await jsonGet(url);
  return quote;
}

function buildSwapTransaction(quote, keypair, connection) {
  const swapIxs = quote.instructions.map((ix) => {
    let dataBytes;
    if (typeof ix.data === "string") {
      dataBytes = Buffer.from(ix.data, "base64");
    } else if (ix.data && ix.data.data) {
      dataBytes = Buffer.from(ix.data.data, "base64");
    } else {
      dataBytes = Buffer.from(JSON.stringify(ix.data), "utf-8");
    }
    return new TransactionInstruction({
      keys: ix.keys.map((k) => ({
        pubkey: new PublicKey(k.pubkey),
        isSigner: !!k.isSigner,
        isWritable: !!k.isWritable,
      })),
      programId: new PublicKey(ix.programId),
      data: dataBytes,
    });
  });

  const tx = new Transaction();
  tx.add(...swapIxs);

  // Set recent blockhash synchronously
  const bh = connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = bh.blockhash;
  tx.setSigners(keypair.publicKey);

  return tx;
}

function parseOutputAmount(quote, tokenSymbol) {
  if (!quote || !quote.outAmount) return 0;
  if (tokenSymbol === "SOL") {
    return quote.outAmount / 1e9;
  }
  // For SPL tokens, Jupiter returns outAmount in the token's native decimals.
  // USDC has 6 decimals; most SPL tokens have 6 or 9. We default to 6 here;
  // for exact decimals, use quote.outAmount / (10 ** quote.outputTokenDecimals).
  const decimals = quote.outputTokenDecimals || 6;
  return quote.outAmount / Math.pow(10, decimals);
}

// ─── Entry ──────────────────────────────────────────────────────────
main().catch((err) => {
  log("ERROR", err.message);
  console.error("Swap failed:", err.message);
  process.exit(1);
});
