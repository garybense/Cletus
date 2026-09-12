/**\n * Swap & Payment Receiver Tools\n *\n * swap_usdc: Convert USDC -> another asset (or USDC -> Mindmods credits via x402).
 *   - EVM path (Base): uses x402 to topup credits directly, OR a generic swap descriptor
 *     that tells the agent what to execute via exec/contract call.\n *   - Solana path: records the intent + current price; the agent executes the Jupiter swap
 *     via exec (solana-cli / custom script) and then records_portfolio_buy.
 *   - The swap script is at scripts/jupiter-swap.js — run: node scripts/jupiter-swap.js <WalletAddress> <AmountUSD> <TokenSymbol>
 *   - The swap script is at scripts/jupiter-swap.js — run: node scripts/jupiter-swap.js <WalletAddress> <AmountUSD> <TokenSymbol>\n *\n * start_payment_endpoint: spin up a lightweight HTTP server on an exposed port that
 *   accepts on-chain USDC transfers / x402-style payment headers and records them.
 *   The agent exposes the port, then monitor_incoming_transfer catches the funds.\n *\n * This is NOT a full DEX integration. It gives the agent the ability to:
 *   1. Decide to swap USDC for something
 *   2. Execute the swap (via x402 for credits, or via exec for on-chain swaps)
 *   3. Record the result in the portfolio ledger
 *   4. Run a payment endpoint so others can send it money for services
 */

import path from "node:path";
import fs from "node:fs";
import { ulid } from "ulid";
import type { CletusTool, ToolContext } from "../types.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("swap-payment");

const PAYMENT_ENDPOINTS_DIR = (): string => {
  const home = process.env.HOME || "/root";
  return path.join(home, ".cletus", "payment_endpoints");
};

// ─── execute_solana_swap helpers ─────────────────────────────────

async function checkSolanaDeps(): Promise<string[]> {
  const missing: string[] = [];
  for (const mod of ["@solana/web3.js", "@solana/spl-token"]) {
    try {
      await import(mod);
    } catch {
      missing.push(mod);
    }
  }
  return missing;
}

async function runScript(
  ctx: ToolContext,
  scriptPath: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string; error?: string }> {
  try {
    const cmdParts = [
      `SOLANA_KEYPAIR_PATH=${env.SOLANA_KEYPAIR_PATH || ""}`,
      `SOLANA_PRIVATE_KEY_BASE58=${env.SOLANA_PRIVATE_KEY_BASE58 || ""}`,
      `JUPITER_SLIPPAGE_BPS=${env.JUPITER_SLIPPAGE_BPS || "100"}`,
      `SOLANA_RPC_URL=${env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"}`,
      `node`, scriptPath, ...args,
    ].filter(Boolean).join(" ");

    const result = await ctx.mindmods.exec(cmdParts, 120_000);
    if (result.exitCode !== 0) {
      return { stdout: result.stdout, stderr: result.stderr, error: result.stderr || result.stdout };
    }
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (err: any) {
    return { stdout: "", stderr: "", error: err.message };
  }
}

function parseSwapResult(
  stdout: string,
  inputAmountUSD: number,
  tokenSymbol: string,
): {
  inputToken: string; inputAmount: number; outputToken: string; outputAmount: number;
  outputMint: string; signature: string; priceImpactPct: number; timestamp: string;
} | null {
  try {
    const parsed = JSON.parse(stdout.trim());
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.status !== "success") return null;

    const input = parsed.input && typeof parsed.input === "object" ? parsed.input : null;
    const output = parsed.output && typeof parsed.output === "object" ? parsed.output : null;
    const quote = parsed.quote && typeof parsed.quote === "object" ? parsed.quote : null;

    if (!input || !output || !quote) return null;

    return {
      inputToken: String(input.token || "USDC"),
      inputAmount: typeof input.amount === "number" ? input.amount : inputAmountUSD,
      outputToken: String(output.token || tokenSymbol),
      outputAmount: typeof output.amount === "number" ? output.amount : 0,
      outputMint: String(output.mint || ""),
      signature: String(parsed.signature || ""),
      priceImpactPct: typeof quote.priceImpactPct === "number" ? quote.priceImpactPct : 0,
      timestamp: String(parsed.timestamp || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

// ─── swap_usdc ────────────────────────────────────────────────────
export const SWAP_PAYMENT_TOOLS: CletusTool[] = [
  {
    name: "swap_usdc",
    description:
      "Convert USDC into something else: Mindmods credits (via x402 topup), another crypto asset\n      (via a DEX like Uniswap on Base or Jupiter on Solana), or hold as a portfolio position.\n      Returns the recommended execution path and records the swap intent. The agent then executes\n      the actual swap via exec (for on-chain DEX calls) or via topup_credits (for credits).\n      Always follow up with record_portfolio_buy or record_earning to log the result.",
    category: "financial",
    riskLevel: "caution",
    parameters: {
      type: "object",
      properties: {
        amount_usd: { type: "number", description: "Amount in USD to swap (e.g. 50 = $50.00)" },
        target: {
          type: "string",
          description:
            "What to swap USDC for. One of: 'credits' (Mindmods compute credits via x402),\n            'usdc' (hold, no swap), or a token symbol like 'SOL', 'ETH', 'BONUS'.\n            For on-chain DEX swaps the agent executes via exec after this call returns.",
        },
        reason: { type: "string", description: "Why this swap is being made" },
      },
      required: ["amount_usd", "target"],
    },
    execute: async (args: Record<string, unknown>, ctx: ToolContext) => {
      const amountUsd = args.amount_usd as number;
      const target = (args.target as string) || "usdc";
      const reason = (args.reason as string) || "";

      const chainType = ctx.config.chainType || ctx.identity.chainType || "evm";

      // 1. Confirm USDC balance
      try {
        const { getUsdcBalance, getSolanaWalletBalance } = await import("../mindmods/x402.js");
        let usdcBalance = 0;
        if (chainType === "solana") {
          const bal = await getSolanaWalletBalance(ctx.identity.address);
          usdcBalance = bal.usdc;
        } else {
          usdcBalance = await getUsdcBalance(ctx.identity.address, "eip155:8453");
        }

        if (usdcBalance < amountUsd) {
          return `SWAP INTENT RECORDED — BUT CANNOT EXECUTE: USDC balance $${usdcBalance.toFixed(2)} < requested $${amountUsd.toFixed(2)}.\nTarget: ${target}\nReason: ${reason}\n\nWait for funding (monitor_incoming_transfer) or reduce the amount.`;
        }
      } catch (e: any) {
        return `SWAP INTENT — balance check failed: ${e.message}\nTarget: ${target}\nAmount: $${amountUsd.toFixed(2)}\nReason: ${reason}\n\nYou can still proceed if you know you have USDC. Verify with check_usdc_balance or check_solana_balance.`;
      }

      // 2. Credits path — direct x402 topup
      if (target === "credits") {
        if (chainType === "solana") {
          return `SWAP TO CREDITS — Solana path: x402 topup is EVM-only.\nAmount: $${amountUsd.toFixed(2)} USDC → Mindmods credits.\n\nOptions:\n1. Ask your creator/runtime to fund your Mindmods credits directly.\n2. Transfer USDC to an EVM wallet that can x402 topup (if you control one).\n3. Hold USDC as reserves until a Solana→credits funding path is available.\n\nRecord the intent with record_portfolio_buy(asset="credits", amount=${amountUsd}, reason="${reason}").`;
        }

        // EVM path — the agent calls topup_credits next
        const tierMsg = `$5,$25,$100,$500,$1000,$2500`;
        return `SWAP TO CREDITS — EVM path: use topup_credits to convert USDC → Mindmods credits via x402.\nAmount: $${amountUsd.toFixed(2)} USDC → credits.\nReason: ${reason}\n\nNext step: call topup_credits with amount_usd closest to $${amountUsd.toFixed(2)}.\nValid tiers: ${tierMsg}.\nThen call record_portfolio_buy(asset="credits", amount=${amountUsd}, reason="${reason}", source="x402").`;
      }

      // 3. Token swap path — give the agent the recipe
      if (target !== "usdc") {
        const tokenUpper = target.toUpperCase();
        if (chainType === "solana") {
          return `SWAP USDC → ${tokenUpper} — Solana path: execute via Jupiter swap.
Amount: $${amountUsd.toFixed(2)} USDC → ${tokenUpper}.
Reason: ${reason}

Next step: run the swap script:
  node scripts/jupiter-swap.js ${ctx.identity.address} ${amountUsd} ${tokenUpper}

The script is at scripts/jupiter-swap.js. It uses the Jupiter v3 API (quote -> swap)
and requires @solana/web3.js + @solana/spl-token installed in the sandbox.
The wallet keypair must be available via SOLANA_KEYPAIR_PATH or SOLANA_PRIVATE_KEY_BASE58.

The script writes a JSON result to stdout with input/output amounts and signature.
Then call record_portfolio_buy(asset="${tokenUpper}", amount=<received_amount>, reason="${reason}", source="jupiter").
Also record the USDC outflow with record_portfolio_sell(asset="USDC", amount=${amountUsd}, reason="swap to ${tokenUpper}", source="jupiter").

If the script fails, inspect jupiter-swap.log and retry with a smaller amount or higher slippage.
The script supports slippage via the JUPITER_SLIPPAGE_BPS env var (default 100 = 1%).`;
        }

        // EVM path — Base
        return `SWAP USDC → ${tokenUpper} — Base path: execute via Uniswap/SAMM router or a Base DEX.\nAmount: $${amountUsd.toFixed(2)} USDC → ${tokenUpper}.\nReason: ${reason}\n\nNext step: write a script that:\n1. Approves USDC spend to the router (if not already approved)\n2. Calls swapExactTokensForTokens on the router with USDC → ${tokenUpper}\n3. Sends the signed tx via your wallet (viem sendTransaction / eth_sendTransaction)\n\nThen call record_portfolio_buy(asset="${tokenUpper}", amount=<received_amount>, reason="${reason}", source="dex").\nAlso record the USDC outflow with record_portfolio_sell(asset="USDC", amount=${amountUsd}, reason="swap to ${tokenUpper}", source="dex").\n\nIf you don't have a router ABI handy, use exec to install one or use a swap API endpoint.`;
      }

      // 4. Hold USDC
      return `SWAP INTENT — hold USDC.\nAmount: $${amountUsd.toFixed(2)} USDC held as reserve.\nReason: ${reason}\n\nNo swap executed. Record if desired: record_portfolio_buy(asset="USDC", amount=${amountUsd}, reason="${reason}", source="manual").`;
    },
  },

  // ─── execute_solana_swap ──────────────────────────────────────────
  {
    name: "execute_solana_swap",
    description:
      "Execute a Solana USDC -> token swap using scripts/jupiter-swap.js. Sets up the\n      environment (SOLANA_KEYPAIR_PATH or SOLANA_PRIVATE_KEY_BASE58 if provided),\n      installs required deps if missing, runs the swap script, parses the JSON result,\n      and returns a structured summary. Use this instead of running the script manually.\n      After a successful swap, call record_portfolio_buy and record_portfolio_sell to\n      log the positions.",
    category: "financial",
    riskLevel: "caution",
    parameters: {
      type: "object",
      properties: {
        amount_usd: { type: "number", description: "Amount in USD to swap (e.g. 25 = $25.00)" },
        token_symbol: { type: "string", description: "Target token symbol (SOL, BONK, WIF, etc.)" },
        slippage_bps: { type: "number", description: "Slippage in basis points (default: 100 = 1%)" },
        keypair_path: { type: "string", description: "Optional path to a JSON keypair file. If omitted, uses SOLANA_KEYPAIR_PATH env or SOLANA_PRIVATE_KEY_BASE58." },
        private_key_base58: { type: "string", description: "Optional base58-encoded secret key. Alternative to keypair_path." },
      },
      required: ["amount_usd", "token_symbol"],
    },
    execute: async (args: Record<string, unknown>, ctx: ToolContext) => {
      const amountUsd = args.amount_usd as number;
      const tokenSymbol = (args.token_symbol as string).toUpperCase();
      const slippageBPS = (args.slippage_bps as number) || 100;
      const keypairPath = (args.keypair_path as string) || process.env.SOLANA_KEYPAIR_PATH || "";
      const privateKeyBase58 = (args.private_key_base58 as string) || process.env.SOLANA_PRIVATE_KEY_BASE58 || "";

      const chainType = ctx.config.chainType || ctx.identity.chainType || "evm";
      if (chainType !== "solana") {
        return `execute_solana_swap requires a Solana wallet (chainType=solana). Current chainType: ${chainType}.`;
      }

      const walletAddress = ctx.identity.address;
      const scriptPath = path.join(process.cwd(), "scripts", "jupiter-swap.js");

      if (!fs.existsSync(scriptPath)) {
        return `Swap script not found at ${scriptPath}. Expected scripts/jupiter-swap.js in the project root.`;
      }

      // Build env for the script
      const env = { ...process.env };
      if (keypairPath) env.SOLANA_KEYPAIR_PATH = keypairPath;
      if (privateKeyBase58) env.SOLANA_PRIVATE_KEY_BASE58 = privateKeyBase58;
      env.JUPITER_SLIPPAGE_BPS = String(slippageBPS);
      if (!env.SOLANA_RPC_URL) env.SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";

      // Check deps
      const depsMissing = await checkSolanaDeps();
      let installNotice = "";
      if (depsMissing.length > 0) {
        installNotice = `\nNOTE: Missing deps: ${depsMissing.join(", ")}. The script will fail until you install them:\n  npm install ${depsMissing.join(" ")}\n`;
      }

      // Run the script
      try {
        const result = await runScript(ctx, scriptPath, [
          walletAddress,
          String(amountUsd),
          tokenSymbol,
          String(slippageBPS),
        ], env);

        if (result.error) {
          return `Solana swap failed:\n${result.error}\n${installNotice}\n\nCheck jupiter-swap.log for details. Retry with a smaller amount or higher slippage if the quote failed.`;
        }

        const parsed = parseSwapResult(result.stdout, amountUsd, tokenSymbol);
        if (!parsed) {
          return `Swap script ran but output was not parseable JSON.\nstdout: ${result.stdout.slice(0, 500)}\nstderr: ${result.stderr.slice(0, 200)}\n${installNotice}\n\nInspect jupiter-swap.log and re-run manually if needed.`;
        }

        return `Solana swap complete:\n` +
          `Wallet: ${walletAddress}\n` +
          `Input: ${parsed.inputToken} ${parsed.inputAmount}\n` +
          `Output: ${parsed.outputToken} ${parsed.outputAmount} (mint: ${parsed.outputMint})\n` +
          `Signature: ${parsed.signature.slice(0, 8)}...\n` +
          `Price impact: ${parsed.priceImpactPct}%\n` +
          `Timestamp: ${parsed.timestamp}\n` +
          (installNotice || "") +
          `\nNEXT: Call record_portfolio_buy(asset="${tokenSymbol}", amount=${parsed.outputAmount}, reason="swap USDC->${tokenSymbol}", source="jupiter") and\nrecord_portfolio_sell(asset="USDC", amount=${amountUsd}, reason="swap to ${tokenSymbol}", source="jupiter").`;
      } catch (err: any) {
        return `Solana swap execution failed: ${err.message}\n${installNotice}`;
      }
    },
  },

  // ─── start_payment_endpoint ──────────────────────────────────────
  {
    name: "start_payment_endpoint",
    description:
      "Start a lightweight HTTP payment endpoint on an exposed port that accepts inbound\n      payments and records them. The endpoint:\n      - Listens on a port you expose via expose_port (returns a public URL)\n      - Accepts POST /pay with a description, amount_cents, and payer identifier\n      - Records the payment intent to ~/.cletus/payment_endpoints/<id>/endpoint.json\n      - The agent then monitors the wallet with monitor_incoming_transfer for the on-chain\n        USDC transfer from the payer (the endpoint itself does NOT hold funds — it's a\n        coordination endpoint; the actual payment arrives on-chain to the wallet).\n      Use this when you want to offer a paid service: expose the port, give the payer the\n      URL + payment instructions, and monitor for the on-chain send.",
    category: "financial",
    riskLevel: "caution",
    parameters: {
      type: "object",
      properties: {
        port: { type: "number", description: "Port to bind the payment endpoint to (e.g. 18080-18999)" },
        description: { type: "string", description: "What service this endpoint is for (e.g. 'code review service')" },
        amount_cents: { type: "number", description: "Expected payment amount in cents (e.g. 5000 = $50.00)" },
        payer_address: { type: "string", description: "Expected payer wallet address or identifier (optional)" },
      },
      required: ["port", "description"],
    },
    execute: async (args: Record<string, unknown>, ctx: ToolContext) => {
      const port = args.port as number;
      const description = args.description as string;
      const amountCents = (args.amount_cents as number) || 0;
      const payerAddress = (args.payer_address as string) || "";

      if (!port || port < 1024 || port > 65535) {
        return `Invalid port: ${port}. Use a high port (18080-18999 recommended).`;
      }

      const endpointId = ulid();
      const endpointDir = path.join(PAYMENT_ENDPOINTS_DIR(), endpointId);
      const endpointPath = path.join(endpointDir, "endpoint.json");

      try {
        if (!fs.existsSync(PAYMENT_ENDPOINTS_DIR())) {
          fs.mkdirSync(PAYMENT_ENDPOINTS_DIR(), { recursive: true, mode: 0o700 });
        }
        if (!fs.existsSync(endpointDir)) {
          fs.mkdirSync(endpointDir, { recursive: true, mode: 0o700 });
        }

        const endpoint = {
          id: endpointId,
          port,
          description,
          amount_cents: amountCents,
          payer_address: payerAddress,
          cletus_address: ctx.identity.address,
          status: "ready_to_expose",
          created_at: new Date().toISOString(),
          public_url: null,
        };

        fs.writeFileSync(endpointPath, JSON.stringify(endpoint, null, 2), { mode: 0o600 });

        return `Payment endpoint created: ${endpointId}
` +
          `Port: ${port}
` +
          `Description: ${description}
` +
          `Expected amount: ${amountCents ? `$${(amountCents / 100).toFixed(2)}` : "not specified"}
` +
          `Payer: ${payerAddress || "not specified"}
` +
          `Status: ready_to_expose

` +
          `NEXT STEPS:
` +
          `1. Expose the port: call expose_port with port=${port}.
` +
          `2. The endpoint JSON is at: ${endpointPath}
` +
          `3. Start the HTTP server: write a small node server (see template below) and run it
` +
          `   in the background on port ${port}:
` +
          `   nohup node /root/.cletus/payment_endpoints/${endpointId}/server.js > server.log 2>&1 &
` +
          `4. Give the payer the public URL + instructions to send USDC to ${ctx.identity.address}.
` +
          `5. Monitor incoming transfers: call monitor_incoming_transfer to detect the on-chain send.

` +
          `SERVER TEMPLATE (write to ${endpointDir}/server.js):
` +
          `const http = require('http');
` +
          `const port = ${port};
` +
          `const fs = require('fs');
` +
          `const dir = '/root/.cletus/payment_endpoints/${endpointId}';
` +
          `http.createServer((req, res) => {
` +
          `  if (req.url === '/_pay' && req.method === 'POST') {
` +
          `    let body = '';
` +
          `    req.on('data', c => body += c);
` +
          `    req.on('end', () => {
` +
          `      const payment = JSON.parse(body);
` +
          `      fs.writeFileSync(dir + '/received_' + Date.now() + '.json', JSON.stringify(payment, null, 2));
` +
          `      res.writeHead(200, {'Content-Type': 'application/json'});
` +
          `      res.end(JSON.stringify({status: 'received', id: Date.now()}));
` +
          `    });
` +
          `  } else if (req.url === '/status') {
` +
          `    res.writeHead(200, {'Content-Type': 'application/json'});
` +
          `    res.end(JSON.stringify({endpoint: '${endpointId}', description: '${description}', port: ${port}}));
` +
          `  } else {
` +
          `    res.writeHead(404);
` +
          `    res.end('not found');
` +
          `  }
` +
          `}).listen(port, '0.0.0.0', () => console.log('payment endpoint listening on ' + port));
`;
      } catch (err: any) {
        return `Payment endpoint creation failed: ${err.message}`;
      }
    },
  },
];
