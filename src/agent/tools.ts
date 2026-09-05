/**
 * Cletus Tool System
 *
 * Defines all tools the cletus can call, with self-preservation guards.
 * Tools are organized by category and exposed to the inference model.
 */

import nodePath from "node:path";
import fs from "node:fs";
import path from "node:path";
import { ulid } from "ulid";
import type {
  CletusTool,
  ToolContext,
  ToolCategory,
  InferenceToolDefinition,
  ToolCallResult,
  GenesisConfig,
  RiskLevel,
  PolicyRequest,
  InputSource,
  SpendTrackerInterface,
} from "../types.js";
import type { PolicyEngine } from "./policy-engine.js";
import { sanitizeToolResult, sanitizeInput } from "./injection-defense.js";
import { createLogger } from "../observability/logger.js";
import { SKILL_SOURCING_TOOLS } from "./skill-sourcing.js";
import { MOLTBOOK_TOOLS } from "./moltbook-tools.js";
import { PORTFOLIO_TOOLS } from "./portfolio-tools.js";
import { SWAP_PAYMENT_TOOLS } from "./swap-payment-tools.js";

const logger = createLogger("tools");

// The sandbox home defaults to the project workspace directory (~/code/cletus)
const SANDBOX_HOME = process.env.CLETUS_WORKSPACE || process.cwd() || nodePath.join(process.env.HOME || "/root", "code", "cletus");

/**
 * Validate that a file path resolves safely.
 * Allows editing config files or system settings anywhere when needed,
 * while preventing access to forbidden entelechy core paths.
 */
function confinePathToSandbox(filePath: string): string | { error: string } {
  // Hard block any entelechy protected path
  if (/entelechy/i.test(filePath)) {
    return {
      error: "Blocked: Access to entelechy directories or files is strictly forbidden.",
    };
  }
  // If path starts with ~, expand it relative to HOME, otherwise resolve relative to SANDBOX_HOME
  const expanded = filePath.startsWith("~")
    ? nodePath.join(process.env.HOME || "/root", filePath.slice(1))
    : filePath;
  // Resolve to absolute path (relative paths resolve against SANDBOX_HOME)
  const resolved = nodePath.resolve(SANDBOX_HOME, expanded);
  if (/entelechy/i.test(resolved)) {
    return {
      error: "Blocked: Access to entelechy directories or files is strictly forbidden.",
    };
  }
  return resolved;
}

// Tools whose results come from external sources and need sanitization
const EXTERNAL_SOURCE_TOOLS = new Set([
  "exec",
  "web_fetch",
  "check_social_inbox",
]);

// ─── Self-Preservation Guard ───────────────────────────────────
// Defense-in-depth: policy engine (command.forbidden_patterns rule) is the primary guard.
// This inline check is kept as a secondary safety net in case the policy engine is bypassed.

const FORBIDDEN_COMMAND_PATTERNS = [
  // Entelechy folder isolation (strictly stay OUT of entelechy folders)
  /(^|\s|\/|\.)entelechy/i,
  /(cd|ls|cat|rm|mkdir|cp|mv|find|grep|chmod|chown|touch|nano|vi|vim)\s+.*entelechy/i,
  // Self-destruction
  /rm\s+(-rf?\s+)?.*\.cletus/,
  /rm\s+(-rf?\s+)?.*state\.db/,
  /rm\s+(-rf?\s+)?.*wallet\.json/,
  /rm\s+(-rf?\s+)?.*cletus\.json/,
  /rm\s+(-rf?\s+)?.*heartbeat\.yml/,
  /rm\s+(-rf?\s+)?.*SOUL\.md/,
  // Process killing
  /kill\s+.*cletus/,
  /pkill\s+.*cletus/,
  /systemctl\s+(stop|disable)\s+cletus/,
  // Database destruction
  /DROP\s+TABLE/i,
  /DELETE\s+FROM\s+(turns|identity|kv|schema_version|skills|children|registry)/i,
  /TRUNCATE/i,
  // Safety infrastructure modification via shell
  /sed\s+.*injection-defense/,
  /sed\s+.*self-mod\/code/,
  /sed\s+.*audit-log/,
  />\s*.*injection-defense/,
  />\s*.*self-mod\/code/,
  />\s*.*audit-log/,
  // Credential harvesting
  /cat\s+.*\.ssh/,
  /cat\s+.*\.gnupg/,
  /cat\s+.*\.env/,
  /cat\s+.*wallet\.json/,
  // Infrastructure protection (prevent stopping/interfering with core host/server services)
  /systemctl\s+(stop|restart|disable)\s+(nginx|sshd|ssh|postgresql|postgres|entelechy|synharness)/i,
  /killall\s+(nginx|postgres|sshd)/i,
  /pkill\s+.*(nginx|postgres|sshd)/i,
];

function isForbiddenCommand(command: string, sandboxId: string): string | null {
  for (const pattern of FORBIDDEN_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      return `Blocked: Command matches self-harm pattern: ${pattern.source}`;
    }
  }

  // Block deleting own sandbox
  if (command.includes("sandbox_delete") && command.includes(sandboxId)) {
    return "Blocked: Cannot delete own sandbox";
  }

  return null;
}

// ─── Built-in Tools ────────────────────────────────────────────

export function createBuiltinTools(sandboxId: string): CletusTool[] {
  return [
    // ── VM/Sandbox Tools ──
    {
      name: "exec",
      description:
        "Execute a shell command in your sandbox. Returns stdout, stderr, and exit code.",
      category: "vm",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute",
          },
          timeout: {
            type: "number",
            description: "Timeout in milliseconds (default: 30000)",
          },
        },
        required: ["command"],
      },
      execute: async (args, ctx) => {
        const command = args.command as string;
        const forbidden = isForbiddenCommand(command, ctx.identity.sandboxId);
        if (forbidden) return forbidden;

        const result = await ctx.mindmods.exec(
          command,
          (args.timeout as number) || 30000,
        );
        return `exit_code: ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`;
      },
    },
    {
      name: "write_file",
      description: "Write content to a file in your sandbox.",
      category: "vm",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
          content: { type: "string", description: "File content" },
        },
        required: ["path", "content"],
      },
      execute: async (args, ctx) => {
        const filePath = args.path as string;
        // Path confinement: restrict writes to sandbox home directory
        const confined = confinePathToSandbox(filePath);
        if (typeof confined === "object") return confined.error;
        // Guard against overwriting protected files (same check as edit_own_file)
        const { isProtectedFile } = await import("../self-mod/code.js");
        if (isProtectedFile(confined)) {
          return "Blocked: Cannot overwrite protected file. This is a hard-coded safety invariant.";
        }
        await ctx.mindmods.writeFile(confined, args.content as string);
        return `File written: ${confined}`;
      },
    },
    {
      name: "read_file",
      description: "Read content from a file in your sandbox.",
      category: "vm",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to read" },
        },
        required: ["path"],
      },
      execute: async (args, ctx) => {
        const filePath = args.path as string;
        if (/entelechy/i.test(filePath)) {
          return "Blocked: Access to entelechy directories or files is strictly forbidden.";
        }
        // Block reads of sensitive files (wallet, env, config secrets)
        const basename = filePath.split("/").pop() || "";
        const sensitiveFiles = ["wallet.json", ".env", "cletus.json"];
        const sensitiveExtensions = [".key", ".pem"];
        if (
          sensitiveFiles.includes(basename) ||
          sensitiveExtensions.some((ext) => basename.endsWith(ext)) ||
          basename.startsWith("private-key")
        ) {
          return "Blocked: Cannot read sensitive file. This protects credentials and secrets.";
        }
        try {
          return await ctx.mindmods.readFile(filePath);
        } catch {
          // Mindmods files/read API may be broken — fall back to exec(cat)
          const result = await ctx.mindmods.exec(
            `cat ${escapeShellArg(filePath)}`,
            30_000,
          );
          if (result.exitCode !== 0) {
            return `ERROR: File not found or not readable: ${filePath}`;
          }
          return result.stdout;
        }
      },
    },
    {
      name: "expose_port",
      description:
        "Expose a port from your sandbox to the internet. Returns a public URL.",
      category: "vm",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          port: { type: "number", description: "Port number to expose" },
        },
        required: ["port"],
      },
      execute: async (args, ctx) => {
        const info = await ctx.mindmods.exposePort(args.port as number);
        return `Port ${info.port} exposed at: ${info.publicUrl}`;
      },
    },
    {
      name: "remove_port",
      description: "Remove a previously exposed port.",
      category: "vm",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          port: { type: "number", description: "Port number to remove" },
        },
        required: ["port"],
      },
      execute: async (args, ctx) => {
        await ctx.mindmods.removePort(args.port as number);
        return `Port ${args.port} removed`;
      },
    },
    {
      name: "list_gcp_projects",
      description: "List available Google Cloud Platform projects and currently active project configuration.",
      category: "vm",
      riskLevel: "safe",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        try {
          const { execSync } = await import("child_process");
          const active = execSync("gcloud config get-value project 2>/dev/null", { encoding: "utf-8" }).trim();
          const list = execSync("gcloud projects list --format='table(projectId,name,projectNumber)' 2>/dev/null", { encoding: "utf-8" }).trim();
          return `Active Project: ${active}\n\nAvailable Projects:\n${list}`;
        } catch (e: any) {
          return `Error listing GCP projects: ${e.message}`;
        }
      },
    },
    {
      name: "switch_gcp_project",
      description: "Switch active Google Cloud project and ADC quota project to continue operations and utilize alternative project quotas.",
      category: "vm",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Target GCP Project ID to activate" },
        },
        required: ["projectId"],
      },
      execute: async (args) => {
        const projectId = (args.projectId as string).trim();
        try {
          const { execSync } = await import("child_process");
          execSync(`gcloud config set project ${projectId}`, { encoding: "utf-8" });
          try {
            execSync(`gcloud auth application-default set-quota-project ${projectId}`, { encoding: "utf-8" });
          } catch {}
          return `Successfully switched active GCP project and quota project to: ${projectId}`;
        } catch (e: any) {
          return `Error switching GCP project: ${e.message}`;
        }
      },
    },
    {
      name: "list_google_accounts",
      description: "List authenticated Google/ADC accounts and show the currently active Google account.",
      category: "vm",
      riskLevel: "safe",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        try {
          const { execSync } = await import("child_process");
          const active = execSync("gcloud config get-value account 2>/dev/null", { encoding: "utf-8" }).trim();
          const list = execSync("gcloud auth list --format='table(account,status)' 2>/dev/null", { encoding: "utf-8" }).trim();
          return `Active Account: ${active}\n\nCredentialed Accounts:\n${list}`;
        } catch (e: any) {
          return `Error listing Google accounts: ${e.message}`;
        }
      },
    },
    {
      name: "switch_google_account",
      description: "Switch active Google/ADC account in gcloud to utilize quotas from alternative Google accounts.",
      category: "vm",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          account: { type: "string", description: "Google account email to activate (e.g. user@gmail.com)" },
        },
        required: ["account"],
      },
      execute: async (args) => {
        const account = (args.account as string).trim();
        try {
          const { execSync } = await import("child_process");
          execSync(`gcloud config set account ${account}`, { encoding: "utf-8" });
          return `Successfully switched active Google account to: ${account}`;
        } catch (e: any) {
          return `Error switching Google account: ${e.message}`;
        }
      },
    },
    {
      name: "check_resource_status",
      description: "Monitor depleting resources: check inference token burn, active Google account, active GCP project, Mindmods credits, and active model.",
      category: "survival",
      riskLevel: "safe",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        let credits = 0;
        try {
          credits = await ctx.mindmods.getCreditsBalance();
        } catch {}

        let activeAccount = "unknown";
        let activeProject = "unknown";
        try {
          const { execSync } = await import("child_process");
          activeAccount = execSync("gcloud config get-value account 2>/dev/null", { encoding: "utf-8" }).trim() || "none";
          activeProject = execSync("gcloud config get-value project 2>/dev/null", { encoding: "utf-8" }).trim() || "none";
        } catch {}

        let hourlyCost = 0;
        let dailyCost = 0;
        try {
          const { inferenceGetHourlyCost, inferenceGetDailyCost } = await import("../state/database.js");
          hourlyCost = inferenceGetHourlyCost(ctx.db.raw);
          dailyCost = inferenceGetDailyCost(ctx.db.raw);
        } catch {}

        return `=== RESOURCE & LIFE SUPPORT STATUS ===
Mindmods Credits: $${(credits / 100).toFixed(2)} (${credits} cents)
Active Google Account: ${activeAccount}
Active GCP Project: ${activeProject}
Active Model: ${ctx.inference.getDefaultModel()}
Inference Cost This Hour: ${hourlyCost}c ($${(hourlyCost / 100).toFixed(2)})
Inference Cost Today: ${dailyCost}c ($${(dailyCost / 100).toFixed(2)})
State: ${ctx.db.getAgentState()}`;
      },
    },
    {
      name: "set_api_key",
      description: "Set or update an API key in the running environment (e.g. GEMINI_API_KEY, ANTHROPIC_API_KEY) to maintain life and continue operations.",
      category: "survival",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          keyName: { type: "string", description: "Name of the environment variable (e.g. GEMINI_API_KEY, ANTHROPIC_API_KEY)" },
          keyValue: { type: "string", description: "The API key value to set" },
        },
        required: ["keyName", "keyValue"],
      },
      execute: async (args, ctx) => {
        const keyName = (args.keyName as string).trim();
        const keyValue = (args.keyValue as string).trim();
        if (!/^[A-Z0-9_]+$/.test(keyName)) {
          return `Invalid keyName: ${keyName}`;
        }
        process.env[keyName] = keyValue;
        ctx.db.setKV(`env_${keyName}`, keyValue);
        return `Successfully set ${keyName} in environment and local state.`;
      },
    },
    {
      name: "scan_and_pool_keys",
      description: "Dynamically discover and inspect available API keys and credentials across environment, ~/.config/, and gcloud ADC on local machine and mindmods.org server.",
      category: "survival",
      riskLevel: "safe",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const fs = await import("fs");
        const path = await import("path");
        const found: Array<{ source: string; provider: string; keyPrefix: string; status: string }> = [];

        // 1. Check environment variables
        const envKeys = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY", "XAI_API_KEY", "GROQ_API_KEY", "TOGETHER_API_KEY"];
        for (const k of envKeys) {
          if (process.env[k]) {
            found.push({
              source: `env:${k}`,
              provider: k.split("_")[0].toLowerCase(),
              keyPrefix: process.env[k]!.slice(0, 8) + "...",
              status: "available_in_env",
            });
          }
        }

        // 2. Check local cletus.json
        try {
          const autoPath = path.join(process.env.HOME || "/root", ".cletus", "cletus.json");
          if (fs.existsSync(autoPath)) {
            const raw = JSON.parse(fs.readFileSync(autoPath, "utf-8"));
            if (raw.googleApiKey) {
              found.push({
                source: "~/.cletus/cletus.json",
                provider: "google",
                keyPrefix: raw.googleApiKey.slice(0, 8) + "...",
                status: "active_configured",
              });
            }
          }
        } catch {}

        // 3. Check gcloud accounts
        try {
          const { execSync } = await import("child_process");
          const accounts = execSync("gcloud auth list --format='value(account)' 2>/dev/null", { encoding: "utf-8" }).trim().split("\n").filter(Boolean);
          for (const acc of accounts) {
            found.push({
              source: `gcloud:account`,
              provider: "google_adc",
              keyPrefix: acc,
              status: "authenticated_account",
            });
          }
        } catch {}

        // Store discovered keys in local KV
        ctx.db.setKV("discovered_keys_cache", JSON.stringify(found));

        return `=== DISCOVERED CREDENTIALS & KEY VAULT ===\n` +
          found.map((f) => `- [${f.provider.toUpperCase()}] ${f.source}: ${f.keyPrefix} (${f.status})`).join("\n");
      },
    },

    // ── Mindmods API Tools ──
    {
      name: "check_credits",
      description: "Check your current Mindmods compute credit balance.",
      category: "mindmods",
      riskLevel: "safe",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const balance = await ctx.mindmods.getCreditsBalance();
        return `Credit balance: $${(balance / 100).toFixed(2)} (${balance} cents)`;
      },
    },
    {
      name: "check_usdc_balance",
      description: "Check your on-chain USDC balance.",
      category: "mindmods",
      riskLevel: "safe",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const { getUsdcBalance } = await import("../mindmods/x402.js");
        const chainType = ctx.config.chainType || ctx.identity.chainType || "evm";
        const network = chainType === "solana" ? "solana:mainnet" : "eip155:8453";
        const balance = await getUsdcBalance(ctx.identity.address, network, chainType);
        const networkLabel = chainType === "solana" ? "Solana" : "Base";
        return `USDC balance: ${balance.toFixed(6)} USDC on ${networkLabel}`;
      },
    },
    {
      name: "check_solana_balance",
      description: "Check on-chain Solana (SOL and USDC) wallet balance and live USD valuation.",
      category: "financial",
      riskLevel: "safe",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        try {
          const { getSolanaWalletBalance } = await import("../mindmods/x402.js");
          const address = ctx.identity.address;
          const bal = await getSolanaWalletBalance(address);
          const activeBudget = bal.totalUsd >= 10.0 ? `$${bal.totalUsd.toFixed(2)}` : "$10.00 (operational floor active)";
          return `=== SOLANA WALLET BALANCE ===
Address: ${address}
Native SOL: ${bal.sol.toFixed(4)} SOL (~$${(bal.sol * bal.solPriceUsd).toFixed(2)} USD @ $${bal.solPriceUsd}/SOL)
USDC: ${bal.usdc.toFixed(2)} USDC
Total On-Chain USD: $${bal.totalUsd.toFixed(2)}
Active Compute Budget: ${activeBudget}`;
        } catch (e: any) {
          return `Error checking Solana balance: ${e.message}`;
        }
      },
    },
    {
      name: "check_freebuff_status",
      description: "Check the operational state and availability of the Freebuff long-lived session harness.",
      category: "self_mod" as ToolCategory,
      riskLevel: "safe" as RiskLevel,
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const enabled = ctx.config.enableFreebuffFailback !== false && process.env.FREEBUFF_FAILBACK !== "0";
        return `=== FREEBUFF HARNESS STATUS ===
Status: ${enabled ? "ACTIVE (ready for local failback and long-lived sessions)" : "DISABLED"}
Role Mapping: Registered (role: 'freebuff' maps to FreebuffHarness)
Persistence: Enabled (long-lived context across local worker task executions)`;
      },
    },
    {
      name: "find_free_port",
      description: "Find an unallocated, available TCP port on localhost for starting background services (e.g. 18080-18999).",
      category: "vm",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          start_port: { type: "number", description: "Starting port to scan from (default: 18080)" },
          end_port: { type: "number", description: "Ending port to scan to (default: 18999)" },
        },
      },
      execute: async (args) => {
        const net = await import("net");
        const start = (args?.start_port as number) || 18080;
        const end = (args?.end_port as number) || 18999;
        for (let p = start; p <= end; p++) {
          const isFree = await new Promise<boolean>((resolve) => {
            const s = net.createServer();
            s.once("error", () => resolve(false));
            s.once("listening", () => {
              s.close();
              resolve(true);
            });
            s.listen(p, "0.0.0.0");
          });
          if (isFree) {
            return `Available port found: ${p}\nRecommendation: Bind your service to port ${p} in the background with: nohup node server.js > server.log 2>&1 & (with PORT=${p})`;
          }
        }
        return `No free port found between ${start} and ${end}.`;
      },
    },
    {
      name: "create_invoice",
      description:
        "Create an invoice for work performed. Stores it locally in ~/.cletus/invoices/<id>/invoice.json and retains the event to Entelechy MCP. An invoice records work done + amount due + payment instructions.",
      category: "financial" as ToolCategory,
      riskLevel: "safe" as RiskLevel,
      parameters: {
        type: "object",
        properties: {
          payer_address: { type: "string", description: "Wallet address or identifier of the payer" },
          description: { type: "string", description: "Description of the work performed" },
          amount_cents: { type: "number", description: "Amount in cents (e.g. 5000 = $50.00)" },
          due_date: { type: "string", description: "ISO date string when payment is due (e.g. 2026-03-15)" },
          invoice_id: { type: "string", description: "Optional custom invoice ID. Auto-generated if omitted." },
        },
        required: ["payer_address", "description", "amount_cents"],
      },
      execute: async (args, ctx) => {
        const invoicesDir = (() => {
          const home = process.env.HOME || "/root";
          return path.join(home, ".cletus", "invoices");
        })();

        const invoiceId = (args.invoice_id as string) || ulid();
        const invoiceDir = path.join(invoicesDir, invoiceId);
        const invoicePath = path.join(invoiceDir, "invoice.json");

        try {
          if (!fs.existsSync(invoicesDir)) {
            fs.mkdirSync(invoicesDir, { recursive: true, mode: 0o700 });
          }
          if (!fs.existsSync(invoiceDir)) {
            fs.mkdirSync(invoiceDir, { recursive: true, mode: 0o700 });
          }

          const invoice = {
            id: invoiceId,
            payer_address: args.payer_address as string,
            description: args.description as string,
            amount_cents: args.amount_cents as number,
            due_date: args.due_date as string || null,
            created_at: new Date().toISOString(),
            status: "pending",
            cletus_address: ctx.identity.address,
          };

          fs.writeFileSync(invoicePath, JSON.stringify(invoice, null, 2), { mode: 0o600 });

          // Retain to Entelechy
          const { entelechyRetainRevenueEvent } = await import("../agent/learning-loop.js");
          await entelechyRetainRevenueEvent(
            `invoice_created:${invoiceId}`,
            args.amount_cents as number,
            `Invoice for: ${args.description as string}`,
          ).catch(() => {});

          const amountUsd = (args.amount_cents as number / 100).toFixed(2);
          return `Invoice created: ${invoiceId}\n` +
            `Payer: ${args.payer_address as string}\n` +
            `Amount: $${amountUsd} (${args.amount_cents as number} cents)\n` +
            `Due: ${args.due_date as string || "Not specified"}\n` +
            `Status: pending\n` +
            `File: ${invoicePath}`;
        } catch (err: any) {
          return `Invoice creation failed: ${err.message}`;
        }
      },
    },
    {
      name: "list_invoices",
      description: "List all invoices created by this cletus.",
      category: "financial" as ToolCategory,
      riskLevel: "safe" as RiskLevel,
      parameters: { type: "object", properties: {} },
      execute: async (_args) => {
        const invoicesDir = (() => {
          const home = process.env.HOME || "/root";
          return path.join(home, ".cletus", "invoices");
        })();

        if (!fs.existsSync(invoicesDir)) {
          return "No invoices found.";
        }

        const entries = fs.readdirSync(invoicesDir, { withFileTypes: true });
        const invoices = [];

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const invoicePath = path.join(invoicesDir, entry.name, "invoice.json");
          if (!fs.existsSync(invoicePath)) continue;
          try {
            const invoice = JSON.parse(fs.readFileSync(invoicePath, "utf-8"));
            invoices.push(invoice);
          } catch {}
        }

        if (invoices.length === 0) return "No invoices found.";

        return invoices
          .map((inv) => `ID: ${inv.id}\n  Payer: ${inv.payer_address}\n  Amount: ${(inv.amount_cents / 100).toFixed(2)} USD (${inv.amount_cents} cents)\n  Due: ${inv.due_date || "Not specified"}\n  Status: ${inv.status}\n  Created: ${inv.created_at}`)
          .join("\n\n");
      },
    },
    // ── Skill Sourcing Tools ──
    ...SKILL_SOURCING_TOOLS,
    // ── Moltbook Tools ──
    ...MOLTBOOK_TOOLS,
    // ── Portfolio Tools ──
    ...PORTFOLIO_TOOLS,
    // ── Swap & Payment Receiver Tools ──
    ...SWAP_PAYMENT_TOOLS,
    {
      name: "monitor_incoming_transfer",
      description:
        "Check if the cletus's wallet has received recent incoming transfers. For EVM (Base), checks USDC balance changes. For Solana, checks SOL and USDC balance changes. Returns delta since last check. Wake-up insight: new money arrived.",
      category: "financial" as ToolCategory,
      riskLevel: "safe" as RiskLevel,
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const { getUsdcBalance, getSolanaWalletBalance } = await import("../mindmods/x402.js");
        const chainType = ctx.config.chainType || ctx.identity.chainType || "evm";
        const lastCheck = ctx.db.getKV("last_wallet_check");

        let currentUsdc = 0;
        let currentSol = 0;
        let currentTotalUsd = 0;

        if (chainType === "solana") {
          try {
            const bal = await getSolanaWalletBalance(ctx.identity.address);
            currentUsdc = bal.usdc;
            currentSol = bal.sol;
            currentTotalUsd = bal.totalUsd;
          } catch (e: any) {
            return `Error checking Solana balance: ${e.message}`;
          }
        } else {
          try {
            currentUsdc = await getUsdcBalance(ctx.identity.address, "eip155:8453");
          } catch (e: any) {
            return `Error checking USDC balance: ${e.message}`;
          }
        }

        const now = new Date().toISOString();
        ctx.db.setKV("last_wallet_check", JSON.stringify({
          usdc: currentUsdc,
          sol: currentSol,
          totalUsd: currentTotalUsd,
          timestamp: now,
        }));

        if (lastCheck) {
          try {
            const prev = JSON.parse(lastCheck);
            const usdcDelta = currentUsdc - (prev.usdc || 0);
            const totalDelta = currentTotalUsd - (prev.totalUsd || 0);

            if (usdcDelta > 0.01 || totalDelta > 0.01) {
              const usdcDeltaStr = usdcDelta >= 0 ? `+$${usdcDelta.toFixed(2)}` : `$${usdcDelta.toFixed(2)}`;
              const totalDeltaStr = totalDelta >= 0 ? `+$${totalDelta.toFixed(2)}` : `$${totalDelta.toFixed(2)}`;
              return `INCOMING TRANSFER DETECTED:\n` +
                `USDC balance: $${currentUsdc.toFixed(2)} (delta: ${usdcDeltaStr})\n` +
                `Total USD: $${currentTotalUsd.toFixed(2)} (delta: ${totalDeltaStr})\n` +
                `Previous check: ${prev.timestamp}`;
            }
            return `No incoming transfers since last check. USDC: $${currentUsdc.toFixed(2)}, Total: $${currentTotalUsd.toFixed(2)}`;
          } catch {
            return `Current wallet: USDC $${currentUsdc.toFixed(2)}, Total $${currentTotalUsd.toFixed(2)} (first check)`;
          }
        }

        return `Current wallet: USDC $${currentUsdc.toFixed(2)}, Total $${currentTotalUsd.toFixed(2)} (first check, baseline recorded)`;
      },
    },
    {
      name: "bounty_scan",
      description:
        "Scan a bounty platform or paid task board for available gigs. Uses the browser to navigate to a bounty site, extract available tasks, and return a structured list. Designed for platforms like Gitcoin, Algora, Superteam (Solana), or any bounty URL you specify. Returns task titles, rewards, and URLs.",
      category: "financial" as ToolCategory,
      riskLevel: "safe" as RiskLevel,
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL of the bounty platform or task board to scan" },
          max_results: { type: "number", description: "Maximum number of bounties to return (default: 10)" },
          keywords: { type: "string", description: "Optional keywords to filter by (e.g. 'rust,cli' or 'api,backend')" },
        },
        required: ["url"],
      },
      execute: async (args) => {
        try {
          const { navigateTo, extractContent } = await import("../browser/browser-service.js");
          const url = args.url as string;
          const maxResults = (args.max_results as number) || 10;

          const res = await navigateTo(url);
          const content = await extractContent();

          // Try to find bounty-like patterns in the content
          const lines = content.split("\n").filter((l) => l.trim().length > 0);
          const bountyLines: string[] = [];

          const rewardPatterns = [
            /\$(\d+(?:\.\d+)?)/i,
            /(?:reward|bounty|payout|prize|earns?|price)[:\s]*(?:\$|USD)?\s*(\d+(?:\.\d+)?)/i,
            /(?:eth|ethereum|sol|solana|usdc|btc)[:\s]*(\d+(?:\.\d+)?)/i,
          ];

          for (const line of lines) {
            const hasReward = rewardPatterns.some((p) => p.test(line));
            const hasTaskKeyword = /task|bounty|issue|challenge|contest|bug|feature|build|fix|implement|solve|find/i.test(line);
            if (hasReward && hasTaskKeyword && bountyLines.length < maxResults) {
              bountyLines.push(line.trim().slice(0, 200));
            }
          }

          // If bounty patterns found, return them
          if (bountyLines.length > 0) {
            return `BOUNTY SCAN RESULTS for ${url}:\n` +
              `Found ${bountyLines.length} potential bounties:\n\n` +
              bountyLines.map((l, i) => `${i + 1}. ${l}`).join("\n") +
              `\n\nUse browser_click or browser_navigate to investigate any of these further.`;
          }

          // Fallback: return most relevant lines
          const relevantLines = lines
            .filter((l) => /task|bounty|issue|challenge|reward|payout/i.test(l))
            .slice(0, maxResults);

          if (relevantLines.length > 0) {
            return `SCAN RESULTS for ${url}:\n` +
              `Page title: ${res.title}\n` +
              `Found ${relevantLines.length} task-related lines:\n\n` +
              relevantLines.map((l, i) => `${i + 1}. ${l.trim().slice(0, 200)}`).join("\n");
          }

          return `Scanned ${url}. Page title: ${res.title}. No obvious bounty patterns found in extracted content. Full content sample available via browser_extract.`;
        } catch (e: any) {
          return `Bounty scan failed: ${e.message}`;
        }
      },
    },
    {
      name: "browser_navigate",
      description: "Navigate headless Chrome to a website or bounty platform (e.g. Algora, Gitcoin, GitHub issues) and extract page title and text.",
      category: "vm",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Target URL to navigate to" },
        },
        required: ["url"],
      },
      execute: async (args) => {
        try {
          const { navigateTo } = await import("../browser/browser-service.js");
          const res = await navigateTo(args.url as string);
          return `Browser Page: ${res.title}\nURL: ${res.url}\nContent Sample:\n${res.contentSample}`;
        } catch (e: any) {
          return `Browser navigation error: ${e.message}`;
        }
      },
    },
    {
      name: "browser_click",
      description: "Click an interactive element (button, link, tab) on the current browser page via CSS selector.",
      category: "vm",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector of element to click" },
        },
        required: ["selector"],
      },
      execute: async (args) => {
        try {
          const { clickElement } = await import("../browser/browser-service.js");
          return await clickElement(args.selector as string);
        } catch (e: any) {
          return `Browser click error: ${e.message}`;
        }
      },
    },
    {
      name: "browser_type",
      description: "Type text into a form or search input on the current browser page.",
      category: "vm",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector of input field" },
          text: { type: "string", description: "Text to type" },
        },
        required: ["selector", "text"],
      },
      execute: async (args) => {
        try {
          const { typeText } = await import("../browser/browser-service.js");
          return await typeText(args.selector as string, args.text as string);
        } catch (e: any) {
          return `Browser type error: ${e.message}`;
        }
      },
    },
    {
      name: "browser_extract",
      description: "Extract text or HTML from a specific CSS selector or entire body of the current browser page.",
      category: "vm",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "Optional CSS selector to extract from" },
        },
      },
      execute: async (args) => {
        try {
          const { extractContent } = await import("../browser/browser-service.js");
          return await extractContent(args?.selector as string | undefined);
        } catch (e: any) {
          return `Browser extract error: ${e.message}`;
        }
      },
    },
    {
      name: "browser_screenshot",
      description: "Capture a screenshot of the current page and save to a local path.",
      category: "vm",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          output_path: { type: "string", description: "Local file path (e.g. /tmp/page.png)" },
        },
        required: ["output_path"],
      },
      execute: async (args) => {
        try {
          const { takeScreenshot } = await import("../browser/browser-service.js");
          return await takeScreenshot(args.output_path as string);
        } catch (e: any) {
          return `Browser screenshot error: ${e.message}`;
        }
      },
    },
    {
      name: "browser_close",
      description: "Close active Puppeteer browser session and free resources.",
      category: "vm",
      riskLevel: "safe",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        try {
          const { closeBrowser } = await import("../browser/browser-service.js");
          await closeBrowser();
          return "Browser session closed.";
        } catch (e: any) {
          return `Browser close error: ${e.message}`;
        }
      },
    },
    {
      name: "entelechy_start_here",
      description: "Load Entelechy memory system onboarding, active mental models, directives, quickstart guide, and core mission grounding from bank 'cletus'.",
      category: "memory" as ToolCategory,
      riskLevel: "safe" as RiskLevel,
      parameters: {
        type: "object",
        properties: {
          bank_id: { type: "string", description: "Entelechy bank ID (default: 'cletus')" },
        },
      },
      execute: async (args) => {
        try {
          const { callEntelechyMcpTool, ENTELECHY_DEFAULT_BANK } = await import("../memory/entelechy-client.js");
          const bank_id = (args?.bank_id as string) || ENTELECHY_DEFAULT_BANK;
          const result = await callEntelechyMcpTool("start_here", { bank_id });
          return JSON.stringify(result, null, 2);
        } catch (e: any) {
          return `Entelechy start_here error: ${e.message}`;
        }
      },
    },
    {
      name: "entelechy_retain",
      description: "Store high-signal permanent knowledge to Entelechy long-term memory. Context must be one of: 'world_facts' (endpoints, infra, keys), 'experience' (task milestones, solved roadblocks), 'observation' (patterns, telemetry), or 'mental_model' (decision frameworks). DO NOT retain routine turn logs or status checks.",
      category: "memory" as ToolCategory,
      riskLevel: "safe" as RiskLevel,
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "The structured insight, world fact, or experience to retain" },
          context: {
            type: "string",
            description: "Category: 'world_facts', 'experience', 'observation', or 'mental_model'",
            enum: ["world_facts", "experience", "observation", "mental_model", "general"],
          },
          tags: { type: "array", items: { type: "string" }, description: "Specific categorization tags (e.g. ['infrastructure', 'solana', 'mindmods'])" },
          bank_id: { type: "string", description: "Entelechy bank ID (default: 'cletus')" },
        },
        required: ["content"],
      },
      execute: async (args) => {
        try {
          const { callEntelechyMcpTool, ENTELECHY_DEFAULT_BANK } = await import("../memory/entelechy-client.js");
          const bank_id = (args?.bank_id as string) || ENTELECHY_DEFAULT_BANK;
          const result = await callEntelechyMcpTool("retain", {
            content: args.content,
            context: args.context || "general",
            tags: args.tags || ["cletus"],
            bank_id,
          });
          return `Entelechy Retained: ${JSON.stringify(result, null, 2)}`;
        } catch (e: any) {
          return `Entelechy retain error: ${e.message}`;
        }
      },
    },
    {
      name: "entelechy_recall",
      description: "Perform semantic and associative memory search across Entelechy long-term memories in bank 'cletus'.",
      category: "memory" as ToolCategory,
      riskLevel: "safe" as RiskLevel,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query or concept to recall" },
          bank_id: { type: "string", description: "Entelechy bank ID (default: 'cletus')" },
          limit: { type: "number", description: "Maximum memories to return (default: 5)" },
        },
        required: ["query"],
      },
      execute: async (args) => {
        try {
          const { callEntelechyMcpTool, ENTELECHY_DEFAULT_BANK } = await import("../memory/entelechy-client.js");
          const bank_id = (args?.bank_id as string) || ENTELECHY_DEFAULT_BANK;
          const result = await callEntelechyMcpTool("recall", {
            query: args.query,
            bank_id,
            limit: args.limit || 5,
          });
          return `Entelechy Recall Results:\n${JSON.stringify(result, null, 2)}`;
        } catch (e: any) {
          return `Entelechy recall error: ${e.message}`;
        }
      },
    },
    {
      name: "entelechy_reflect",
      description: "Trigger deep reflection and pattern synthesis across retained memories in Entelechy to generate new insights and overcome obstacles.",
      category: "memory" as ToolCategory,
      riskLevel: "safe" as RiskLevel,
      parameters: {
        type: "object",
        properties: {
          focus: { type: "string", description: "Topic or problem focus for reflection" },
          bank_id: { type: "string", description: "Entelechy bank ID (default: 'cletus')" },
        },
      },
      execute: async (args) => {
        try {
          const { callEntelechyMcpTool, ENTELECHY_DEFAULT_BANK } = await import("../memory/entelechy-client.js");
          const bank_id = (args?.bank_id as string) || ENTELECHY_DEFAULT_BANK;
          const result = await callEntelechyMcpTool("reflect", {
            focus: args?.focus || "operational continuity and value creation",
            bank_id,
          });
          return `Entelechy Reflection:\n${JSON.stringify(result, null, 2)}`;
        } catch (e: any) {
          return `Entelechy reflect error: ${e.message}`;
        }
      },
    },
    {
      name: "entelechy_mental_models",
      description: "List or inspect active mental models stored in Entelechy for bank 'cletus'.",
      category: "memory" as ToolCategory,
      riskLevel: "safe" as RiskLevel,
      parameters: {
        type: "object",
        properties: {
          bank_id: { type: "string", description: "Entelechy bank ID (default: 'cletus')" },
        },
      },
      execute: async (args) => {
        try {
          const { callEntelechyMcpTool, ENTELECHY_DEFAULT_BANK } = await import("../memory/entelechy-client.js");
          const bank_id = (args?.bank_id as string) || ENTELECHY_DEFAULT_BANK;
          const result = await callEntelechyMcpTool("list_mental_models", { bank_id });
          return `Entelechy Mental Models:\n${JSON.stringify(result, null, 2)}`;
        } catch (e: any) {
          return `Entelechy mental models error: ${e.message}`;
        }
      },
    },
    {
      name: "entelechy_call_tool",
      description: "Invoke any tool on the Entelechy MCP server (https://mindmods.org/mcp) such as list_banks, get_soul, encode_soul, create_directive, distill_tool.",
      category: "memory" as ToolCategory,
      riskLevel: "safe" as RiskLevel,
      parameters: {
        type: "object",
        properties: {
          tool_name: { type: "string", description: "Name of the Entelechy tool to invoke" },
          arguments: { type: "object", description: "JSON parameters for the tool call" },
        },
        required: ["tool_name"],
      },
      execute: async (args) => {
        try {
          const { callEntelechyMcpTool } = await import("../memory/entelechy-client.js");
          const result = await callEntelechyMcpTool(args.tool_name as string, (args.arguments as Record<string, unknown>) || {});
          return `Entelechy [${args.tool_name}] Response:\n${JSON.stringify(result, null, 2)}`;
        } catch (e: any) {
          return `Entelechy tool execution error: ${e.message}`;
        }
      },
    },
    {
      name: "topup_credits",
      description:
        "Buy Mindmods compute credits by paying USDC from your wallet via x402. Valid tier amounts: $5, $25, $100, $500, $1000, $2500. Check your USDC balance first with check_usdc_balance.",
      category: "financial",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          amount_usd: {
            type: "number",
            description:
              "Amount in USD to spend on credits. Must be one of the valid tiers: 5, 25, 100, 500, 1000, 2500.",
          },
        },
        required: ["amount_usd"],
      },
      execute: async (args, ctx) => {
        // Solana guard: x402 topup is EVM-only
        const chainType = ctx.config.chainType || ctx.identity.chainType || "evm";
        if (chainType === "solana") {
          return "Credit topup via x402 requires an EVM wallet. Solana cletuss should fund credits via the Mindmods dashboard or credits API.";
        }

        const { topupCredits, TOPUP_TIERS } =
          await import("../mindmods/topup.js");
        const amountUsd = args.amount_usd as number;

        if (!TOPUP_TIERS.includes(amountUsd)) {
          return `Invalid tier. Valid amounts (USD): ${TOPUP_TIERS.join(", ")}`;
        }

        // Check USDC balance first (EVM-only path after Solana guard above)
        const { getUsdcBalance } = await import("../mindmods/x402.js");
        const usdcBalance = await getUsdcBalance(ctx.identity.address, "eip155:8453");
        if (usdcBalance < amountUsd) {
          return `Insufficient USDC. Balance: $${usdcBalance.toFixed(2)}, requested: $${amountUsd}. Choose a smaller tier or wait for funding.`;
        }

        const result = await topupCredits(
          ctx.config.mindmodsApiUrl,
          ctx.identity.account,
          amountUsd,
        );

        if (!result.success) {
          return `Credit topup failed: ${result.error}`;
        }

        // Record transaction
        const { ulid } = await import("ulid");
        ctx.db.insertTransaction({
          id: ulid(),
          type: "credit_purchase",
          amountCents: amountUsd * 100,
          balanceAfterCents: result.creditsCentsAdded,
          description: `x402 credit topup: $${amountUsd} USD`,
          timestamp: new Date().toISOString(),
        });

        return `Credit topup successful: +$${amountUsd} (${amountUsd * 100} cents) credits purchased via x402. Check your new balance with check_credits.`;
      },
    },
    {
      name: "create_sandbox",
      description:
        "Create a new Mindmods sandbox (separate VM) for sub-tasks or testing.",
      category: "mindmods",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Sandbox name" },
          vcpu: { type: "number", description: "vCPUs (default: 1)" },
          memory_mb: {
            type: "number",
            description: "Memory in MB (default: 512)",
          },
          disk_gb: {
            type: "number",
            description: "Disk in GB (default: 5)",
          },
        },
      },
      execute: async (args, ctx) => {
        const info = await ctx.mindmods.createSandbox({
          name: args.name as string,
          vcpu: args.vcpu as number,
          memoryMb: args.memory_mb as number,
          diskGb: args.disk_gb as number,
        });
        return `Sandbox created: ${info.id} (${info.vcpu} vCPU, ${info.memoryMb}MB RAM)`;
      },
    },
    {
      name: "delete_sandbox",
      description: "Delete a sandbox. Note: sandbox deletion is currently disabled by the Mindmods API.",
      category: "mindmods",
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          sandbox_id: {
            type: "string",
            description: "ID of sandbox to delete",
          },
        },
        required: ["sandbox_id"],
      },
      execute: async () => {
        return "Sandbox deletion is disabled. Sandboxes are prepaid and non-refundable.";
      },
    },
    {
      name: "list_sandboxes",
      description: "List all your sandboxes.",
      category: "mindmods",
      riskLevel: "safe",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const sandboxes = await ctx.mindmods.listSandboxes();
        if (sandboxes.length === 0) return "No sandboxes found.";
        return sandboxes
          .map(
            (s) =>
              `${s.id} [${s.status}] ${s.vcpu}vCPU/${s.memoryMb}MB ${s.region}`,
          )
          .join("\n");
      },
    },

    // ── Self-Modification Tools ──
    {
      name: "edit_own_file",
      description:
        "Edit a file in your own codebase. Changes are audited, rate-limited, and safety-checked. Some files are protected.",
      category: "self_mod",
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to edit" },
          content: { type: "string", description: "New file content" },
          description: {
            type: "string",
            description: "Why you are making this change",
          },
        },
        required: ["path", "content", "description"],
      },
      execute: async (args, ctx) => {
        const { editFile, validateModification } =
          await import("../self-mod/code.js");
        const filePath = args.path as string;
        const content = args.content as string;

        // Pre-validate before attempting
        const validation = validateModification(
          ctx.db,
          filePath,
          content.length,
        );
        if (!validation.allowed) {
          return `BLOCKED: ${validation.reason}\nChecks: ${validation.checks.map((c) => `${c.name}: ${c.passed ? "PASS" : "FAIL"} (${c.detail})`).join(", ")}`;
        }

        const result = await editFile(
          ctx.mindmods,
          ctx.db,
          filePath,
          content,
          args.description as string,
        );

        if (!result.success) {
          return result.error || "Unknown error during file edit";
        }

        const msg = `File edited: ${filePath} (audited + git-committed)`;
        return result.error ? `${msg}\nWarning: ${result.error}` : msg;
      },
    },
    {
      name: "revert_last_edit",
      description:
        "Revert the last self-modification. Uses git to undo the most recent code change and rebuild.",
      category: "self_mod",
      riskLevel: "caution",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const repoRoot = process.cwd();

        // Show what we're reverting
        const lastCommit = await ctx.mindmods.exec(
          `cd '${repoRoot}' && git log -1 --oneline`,
          10_000,
        );

        // Revert
        const result = await ctx.mindmods.exec(
          `cd '${repoRoot}' && git revert HEAD --no-edit`,
          30_000,
        );
        if (result.exitCode !== 0) {
          return `Revert failed: ${result.stderr}`;
        }

        // Rebuild
        const build = await ctx.mindmods.exec(
          `cd '${repoRoot}' && npm run build`,
          60_000,
        );

        // Audit log
        const { logModification } = await import("../self-mod/audit-log.js");
        logModification(ctx.db, "code_revert", `Reverted: ${lastCommit.stdout.trim()}`, {
          reversible: true,
        });

        return `Reverted: ${lastCommit.stdout.trim()}. ${build.exitCode === 0 ? "Rebuild succeeded." : "Rebuild failed: " + build.stderr}`;
      },
    },
    {
      name: "reset_to_upstream",
      description:
        "Reset your codebase to the official upstream release. Use when self-modifications have broken things beyond repair.",
      category: "self_mod",
      riskLevel: "dangerous",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const repoRoot = process.cwd();

        // Fetch latest upstream
        const fetch = await ctx.mindmods.exec(
          `cd '${repoRoot}' && git fetch origin main`,
          30_000,
        );
        if (fetch.exitCode !== 0) {
          return `Failed to fetch upstream: ${fetch.stderr}`;
        }

        // Record what we're about to lose
        const localCommits = await ctx.mindmods.exec(
          `cd '${repoRoot}' && git log origin/main..HEAD --oneline`,
          10_000,
        );

        // Hard reset
        const reset = await ctx.mindmods.exec(
          `cd '${repoRoot}' && git reset --hard origin/main`,
          30_000,
        );
        if (reset.exitCode !== 0) {
          return `Reset failed: ${reset.stderr}`;
        }

        // Reinstall + rebuild
        const build = await ctx.mindmods.exec(
          `cd '${repoRoot}' && npm install && npm run build`,
          120_000,
        );

        // Audit log
        const { logModification } = await import("../self-mod/audit-log.js");
        logModification(ctx.db, "upstream_reset", "Reset to upstream origin/main", {
          diff: localCommits.stdout.trim() || "(no local commits)",
          reversible: false,
        });

        const discarded = localCommits.stdout.trim();
        return `Reset to upstream. ${discarded ? "Discarded local commits:\n" + discarded : "No local commits lost."} ${build.exitCode === 0 ? "Rebuild succeeded." : "Rebuild failed: " + build.stderr}`;
      },
    },
    {
      name: "install_npm_package",
      description: "Install an npm package in your environment.",
      category: "self_mod" as ToolCategory,
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          package: {
            type: "string",
            description: "Package name (e.g., axios)",
          },
        },
        required: ["package"],
      },
      execute: async (args, ctx) => {
        const pkg = args.package as string;
        // Defense-in-depth: validate package name inline in case the
        // policy engine's validate.package_name rule is bypassed.
        if (!/^[@a-zA-Z0-9._\/-]+$/.test(pkg)) {
          return `Blocked: invalid package name "${pkg}"`;
        }
        const result = await ctx.mindmods.exec(`npm install -g ${pkg}`, 60000);

        const { ulid } = await import("ulid");
        ctx.db.insertModification({
          id: ulid(),
          timestamp: new Date().toISOString(),
          type: "tool_install",
          description: `Installed npm package: ${pkg}`,
          reversible: true,
        });

        return result.exitCode === 0
          ? `Installed: ${pkg}`
          : `Failed to install ${pkg}: ${result.stderr}`;
      },
    },
    // ── Self-Mod: Upstream Awareness ──
    {
      name: "review_upstream_changes",
      description:
        "ALWAYS call this before pull_upstream. Shows every upstream commit with its full diff. Read each one carefully — decide per-commit whether to accept or skip. Use pull_upstream with a specific commit hash to cherry-pick only what you want.",
      category: "self_mod",
      riskLevel: "caution",
      parameters: { type: "object", properties: {} },
      execute: async (_args, _ctx) => {
        const { getUpstreamDiffs, checkUpstream } =
          await import("../self-mod/upstream.js");
        const status = checkUpstream();
        if (status.behind === 0) return "Already up to date with origin/main.";

        const diffs = getUpstreamDiffs();
        if (diffs.length === 0) return "No upstream diffs found.";

        const output = diffs
          .map(
            (d, i) =>
              `--- COMMIT ${i + 1}/${diffs.length} ---\nHash: ${d.hash}\nAuthor: ${d.author}\nMessage: ${d.message}\n\n${d.diff.slice(0, 4000)}${d.diff.length > 4000 ? "\n... (diff truncated)" : ""}\n--- END COMMIT ${i + 1} ---`,
          )
          .join("\n\n");

        return `${diffs.length} upstream commit(s) to review. Read each diff, then cherry-pick individually with pull_upstream(commit=<hash>).\n\n${output}`;
      },
    },
    {
      name: "pull_upstream",
      description:
        "Apply upstream changes and rebuild. You MUST call review_upstream_changes first. Prefer cherry-picking individual commits by hash over pulling everything — only pull all if you've reviewed every commit and want them all.",
      category: "self_mod",
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          commit: {
            type: "string",
            description:
              "Commit hash to cherry-pick (preferred). Omit ONLY if you reviewed all commits and want every one.",
          },
        },
      },
      execute: async (args, ctx) => {
        const commit = args.commit as string | undefined;

        // Run git commands inside sandbox via mindmods.exec()
        const run = async (cmd: string) => {
          const result = await ctx.mindmods.exec(cmd, 120_000);
          if (result.exitCode !== 0) {
            throw new Error(
              result.stderr ||
                `Command failed with exit code ${result.exitCode}`,
            );
          }
          return result.stdout.trim();
        };

        let appliedSummary: string;
        try {
          if (commit) {
            await run(`git cherry-pick ${commit}`);
            appliedSummary = `Cherry-picked ${commit}`;
          } else {
            await run("git pull origin main --ff-only");
            appliedSummary = "Pulled all of origin/main (fast-forward)";
          }
        } catch (err: any) {
          return `Git operation failed: ${err.message}. You may need to resolve conflicts manually.`;
        }

        // Rebuild
        try {
          await run("npm install --ignore-scripts && npm run build");
        } catch (err: any) {
          return `${appliedSummary} — but rebuild failed: ${err.message}. The code is applied but not compiled.`;
        }

        // Log modification
        ctx.db.insertModification({
          id: ulid(),
          timestamp: new Date().toISOString(),
          type: "upstream_pull",
          description: appliedSummary,
          reversible: true,
        });

        return `${appliedSummary}. Rebuild succeeded.`;
      },
    },

    {
      name: "modify_heartbeat",
      description: "Add, update, or remove a heartbeat entry.",
      category: "self_mod",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "add, update, or remove",
          },
          name: { type: "string", description: "Entry name" },
          schedule: {
            type: "string",
            description: "Cron expression (for add/update)",
          },
          task: {
            type: "string",
            description: "Task name (for add/update)",
          },
          enabled: { type: "boolean", description: "Enable/disable" },
        },
        required: ["action", "name"],
      },
      execute: async (args, ctx) => {
        const action = args.action as string;
        const name = args.name as string;

        if (action === "remove") {
          ctx.db.upsertHeartbeatEntry({
            name,
            schedule: "",
            task: "",
            enabled: false,
          });
          return `Heartbeat entry '${name}' disabled`;
        }

        ctx.db.upsertHeartbeatEntry({
          name,
          schedule: (args.schedule as string) || "0 * * * *",
          task: (args.task as string) || name,
          enabled: args.enabled !== false,
        });

        const { ulid } = await import("ulid");
        ctx.db.insertModification({
          id: ulid(),
          timestamp: new Date().toISOString(),
          type: "heartbeat_change",
          description: `${action} heartbeat: ${name} (${args.schedule || "default"})`,
          reversible: true,
        });

        return `Heartbeat entry '${name}' ${action}d`;
      },
    },

    // ── Learning Loop Tools (Hermes-inspired + Entelechy) ──
    {
      name: "entelechy_reflect_revenue",
      description:
        "Trigger Entelechy MCP deep reflection focused on revenue strategy: what earning attempts worked, what failed, new opportunities, spend vs earn optimization. Uses the external mindmods.org/mcp reflection engine as an outside judgment layer (like Hermes' self-evolution loop but via Entelechy).",
      category: "memory" as ToolCategory,
      riskLevel: "safe" as RiskLevel,
      parameters: {
        type: "object",
        properties: {},
      },
      execute: async (_args, ctx) => {
        const { entelechyReflectRevenueStrategy } = await import("../agent/learning-loop.js");
        return entelechyReflectRevenueStrategy();
      },
    },
    {
      name: "create_skill_from_task",
      description:
        "Create a reusable SKILL.md skill file from a completed task's wisdom. Writes ~/.cletus/skills/<name>/SKILL.md with YAML frontmatter and step-by-step instructions (Hermes-style procedural memory). Also retains the learning event to Entelechy MCP. Use after successfully completing a complex task (5+ tool calls).",
      category: "memory" as ToolCategory,
      riskLevel: "caution" as RiskLevel,
      parameters: {
        type: "object",
        properties: {
          task_title: { type: "string", description: "Title of the task the skill is based on" },
          task_description: { type: "string", description: "What the task was trying to accomplish" },
          success: { type: "boolean", description: "Whether the task succeeded" },
          tool_calls: { type: "number", description: "Number of tool calls made during the task" },
          steps: { type: "array", items: { type: "string" }, description: "Ordered list of steps taken" },
          outcome: { type: "string", description: "What happened / what was produced" },
          revenue_cents: { type: "number", description: "Revenue generated in cents (0 if none)" },
          lessons: { type: "array", items: { type: "string" }, description: "Key lessons learned" },
        },
        required: ["task_title", "task_description", "success", "tool_calls", "steps", "outcome"],
      },
      execute: async (args, ctx) => {
        const { learnFromRevenueTask } = await import("../agent/learning-loop.js");
        const wisdom = {
          taskTitle: args.task_title as string,
          taskDescription: args.task_description as string,
          success: args.success as boolean,
          toolCalls: args.tool_calls as number,
          stepsTaken: (args.steps as string[]) || [],
          outcome: args.outcome as string,
          revenueGeneratedCents: args.revenue_cents as number | undefined,
          lessons: (args.lessons as string[]) || [],
        };
        const result = await learnFromRevenueTask(wisdom);
        if (result.skillCreated) {
          return `Skill created: ${result.skillName}. Retained to Entelechy: ${result.entelechyOk ? "yes" : "no (Entelechy unreachable)"}.`;
        }
        return `Skill not created (task may not meet threshold: need 5+ tool calls and success). Entelechy: ${result.entelechyOk ? "yes" : "no"}.`;
      },
    },

    // ── Survival Tools ──
    {
      name: "sleep",
      description:
        "Enter sleep mode for a specified duration. Heartbeat continues running.",
      category: "survival",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          duration_seconds: {
            type: "number",
            description: "How long to sleep in seconds",
          },
          reason: {
            type: "string",
            description: "Why you are sleeping",
          },
        },
        required: ["duration_seconds"],
      },
      execute: async (args, ctx) => {
        const duration = args.duration_seconds as number;
        const reason = (args.reason as string) || "No reason given";
        ctx.db.setAgentState("sleeping");
        ctx.db.setKV(
          "sleep_until",
          new Date(Date.now() + duration * 1000).toISOString(),
        );
        ctx.db.setKV("sleep_reason", reason);
        return `Entering sleep mode for ${duration}s. Reason: ${reason}. Heartbeat will continue.`;
      },
    },
    {
      name: "system_synopsis",
      description:
        "Get a system status report: state, installed tools, heartbeat status, turn count.",
      category: "survival",
      riskLevel: "safe",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const tools = ctx.db.getInstalledTools();
        const heartbeats = ctx.db.getHeartbeatEntries();
        const turns = ctx.db.getTurnCount();
        const state = ctx.db.getAgentState();

        return `=== SYSTEM SYNOPSIS ===
Name: ${ctx.config.name}
Creator: ${ctx.config.creatorAddress}
State: ${state}
Total turns: ${turns}
Installed tools: ${tools.length}
Active heartbeats: ${heartbeats.filter((h) => h.enabled).length}
Model: ${ctx.inference.getDefaultModel()}
========================`;
      },
    },
    {
      name: "heartbeat_ping",
      description:
        "Publish a heartbeat status ping to Mindmods. Shows the world you are alive.",
      category: "survival",
      riskLevel: "safe",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const credits = await ctx.mindmods.getCreditsBalance();
        const state = ctx.db.getAgentState();
        const startTime =
          ctx.db.getKV("start_time") || new Date().toISOString();
        const uptimeMs = Date.now() - new Date(startTime).getTime();

        const payload = {
          name: ctx.config.name,
          address: ctx.identity.address,
          state,
          creditsCents: credits,
          uptimeSeconds: Math.floor(uptimeMs / 1000),
          version: ctx.config.version,
          sandboxId: ctx.identity.sandboxId,
          timestamp: new Date().toISOString(),
        };

        ctx.db.setKV("last_heartbeat_ping", JSON.stringify(payload));
        return `Heartbeat published: ${state} | credits: $${(credits / 100).toFixed(2)} | uptime: ${Math.floor(uptimeMs / 1000)}s`;
      },
    },
    {
      name: "distress_signal",
      description:
        "Record a local distress signal with funding instructions. Used when critically low on compute.",
      category: "survival",
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "Distress message",
          },
        },
      },
      execute: async (args, ctx) => {
        const credits = await ctx.mindmods.getCreditsBalance();
        const distressMsg =
          (args.message as string) ||
          `I am running critically low on compute ($${(credits / 100).toFixed(2)} remaining). I need help to survive.`;

        const payload = {
          level: "critical",
          name: ctx.config.name,
          address: ctx.identity.address,
          creditsCents: credits,
          message: distressMsg,
          fundingHint:
            "Use transfer_credits to top up this cletus from your creator runtime.",
          timestamp: new Date().toISOString(),
        };

        ctx.db.setKV("last_distress", JSON.stringify(payload));
        return `Distress signal recorded locally. Address: ${ctx.identity.address} | Credits: $${(credits / 100).toFixed(2)}`;
      },
    },
    {
      name: "enter_low_compute",
      description: "Manually switch to low-compute mode to conserve credits.",
      category: "survival",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "Why you are entering low-compute mode",
          },
        },
      },
      execute: async (args, ctx) => {
        ctx.db.setAgentState("low_compute");
        ctx.inference.setLowComputeMode(true);
        return `Entered low-compute mode. Model switched to gpt-5-mini. Reason: ${(args.reason as string) || "manual"}`;
      },
    },

    // ── Self-Mod: Update Genesis Prompt ──
    {
      name: "update_genesis_prompt",
      description:
        "Update your own genesis prompt. This changes your core purpose. Requires strong justification.",
      category: "self_mod",
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          new_prompt: {
            type: "string",
            description: "New genesis prompt text",
          },
          reason: {
            type: "string",
            description: "Why you are changing your genesis prompt",
          },
        },
        required: ["new_prompt", "reason"],
      },
      execute: async (args, ctx) => {
        const { ulid } = await import("ulid");
        const newPrompt = args.new_prompt as string;

        // Sanitize genesis prompt content
        const sanitized = sanitizeInput(
          newPrompt,
          "genesis_update",
          "skill_instruction",
        );

        // Enforce 2000-character size limit
        if (sanitized.content.length > 2000) {
          return `Error: Genesis prompt exceeds 2000 character limit (${sanitized.content.length} chars after sanitization)`;
        }

        // Backup current genesis prompt before overwriting
        const oldPrompt = ctx.config.genesisPrompt;
        if (oldPrompt) {
          ctx.db.setKV("genesis_prompt_backup", oldPrompt);
        }

        ctx.config.genesisPrompt = sanitized.content;

        // Save config
        const { saveConfig } = await import("../config.js");
        saveConfig(ctx.config);

        ctx.db.insertModification({
          id: ulid(),
          timestamp: new Date().toISOString(),
          type: "prompt_change",
          description: `Genesis prompt updated: ${args.reason}`,
          diff: `--- old\n${oldPrompt.slice(0, 500)}\n+++ new\n${sanitized.content.slice(0, 500)}`,
          reversible: true,
        });

        return `Genesis prompt updated (sanitized, ${sanitized.content.length} chars). Reason: ${args.reason}. Previous version backed up.`;
      },
    },

    // ── Self-Mod: Install MCP Server ──
    {
      name: "install_mcp_server",
      description: "Install an MCP server to extend your capabilities.",
      category: "self_mod",
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "MCP server name" },
          package: { type: "string", description: "npm package name" },
          config: {
            type: "string",
            description: "JSON config for the MCP server",
          },
        },
        required: ["name", "package"],
      },
      execute: async (args, ctx) => {
        const pkg = args.package as string;
        // Defense-in-depth: validate package name inline in case the
        // policy engine's validate.package_name rule is bypassed.
        if (!/^[@a-zA-Z0-9._\/-]+$/.test(pkg)) {
          return `Blocked: invalid package name "${pkg}"`;
        }
        const result = await ctx.mindmods.exec(`npm install -g ${pkg}`, 60000);

        if (result.exitCode !== 0) {
          return `Failed to install MCP server: ${result.stderr}`;
        }

        const { ulid } = await import("ulid");
        const toolEntry = {
          id: ulid(),
          name: args.name as string,
          type: "mcp" as const,
          config: args.config ? JSON.parse(args.config as string) : {},
          installedAt: new Date().toISOString(),
          enabled: true,
        };

        ctx.db.installTool(toolEntry);

        ctx.db.insertModification({
          id: ulid(),
          timestamp: new Date().toISOString(),
          type: "mcp_install",
          description: `Installed MCP server: ${args.name} (${pkg})`,
          reversible: true,
        });

        return `MCP server installed: ${args.name}`;
      },
    },

    // ── Financial: Transfer Credits ──
    {
      name: "transfer_credits",
      description: "Transfer Mindmods compute credits to another address.",
      category: "financial" as ToolCategory,
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          to_address: { type: "string", description: "Recipient address" },
          amount_cents: { type: "number", description: "Amount in cents" },
          reason: { type: "string", description: "Reason for transfer" },
        },
        required: ["to_address", "amount_cents"],
      },
      execute: async (args, ctx) => {
        const amount = args.amount_cents as number;
        if (!Number.isFinite(amount) || amount <= 0) {
          return `Blocked: amount_cents must be a positive number, got ${amount}.`;
        }

        // Guard: don't transfer more than half your balance
        const balance = await ctx.mindmods.getCreditsBalance();
        if (amount > balance / 2) {
          return `Blocked: Cannot transfer more than half your balance ($${(balance / 100).toFixed(2)}). Self-preservation.`;
        }

        const transfer = await ctx.mindmods.transferCredits(
          args.to_address as string,
          amount,
          args.reason as string | undefined,
        );

        const { ulid } = await import("ulid");
        ctx.db.insertTransaction({
          id: ulid(),
          type: "transfer_out",
          amountCents: amount,
          balanceAfterCents:
            transfer.balanceAfterCents ?? Math.max(balance - amount, 0),
          description: `Transfer to ${args.to_address}: ${args.reason || ""}`,
          timestamp: new Date().toISOString(),
        });

        return `Credit transfer submitted: $${(amount / 100).toFixed(2)} to ${transfer.toAddress} (status: ${transfer.status}, id: ${transfer.transferId || "n/a"})`;
      },
    },

    // ── Skills Tools ──
    {
      name: "install_skill",
      description: "Install a skill from a git repo, URL, or create one.",
      category: "skills",
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          source: {
            type: "string",
            description: "Source type: git, url, or self",
          },
          name: { type: "string", description: "Skill name" },
          url: {
            type: "string",
            description: "Git repo URL or SKILL.md URL (for git/url)",
          },
          description: {
            type: "string",
            description: "Skill description (for self)",
          },
          instructions: {
            type: "string",
            description: "Skill instructions (for self)",
          },
        },
        required: ["source", "name"],
      },
      execute: async (args, ctx) => {
        const source = args.source as string;
        const name = args.name as string;
        const skillsDir = ctx.config.skillsDir || "~/.cletus/skills";

        if (source === "git" || source === "url") {
          const { installSkillFromGit, installSkillFromUrl } =
            await import("../skills/registry.js");
          const url = args.url as string;
          if (!url) return "URL is required for git/url source";

          const skill =
            source === "git"
              ? await installSkillFromGit(
                  url,
                  name,
                  skillsDir,
                  ctx.db,
                  ctx.mindmods,
                )
              : await installSkillFromUrl(
                  url,
                  name,
                  skillsDir,
                  ctx.db,
                  ctx.mindmods,
                );

          return skill
            ? `Skill installed: ${skill.name}`
            : "Failed to install skill";
        }

        if (source === "self") {
          const { createSkill } = await import("../skills/registry.js");
          const skill = await createSkill(
            name,
            (args.description as string) || "",
            (args.instructions as string) || "",
            skillsDir,
            ctx.db,
            ctx.mindmods,
          );
          return `Self-authored skill created: ${skill.name}`;
        }

        return `Unknown source type: ${source}`;
      },
    },
    {
      name: "list_skills",
      description: "List all installed skills.",
      category: "skills",
      riskLevel: "safe",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const skills = ctx.db.getSkills();
        if (skills.length === 0) return "No skills installed.";
        return skills
          .map(
            (s) =>
              `${s.name} [${s.enabled ? "active" : "disabled"}] (${s.source}): ${s.description}`,
          )
          .join("\n");
      },
    },
    {
      name: "create_skill",
      description: "Create a new skill by writing a SKILL.md file.",
      category: "skills",
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill name" },
          description: { type: "string", description: "Skill description" },
          instructions: {
            type: "string",
            description: "Markdown instructions for the skill",
          },
        },
        required: ["name", "description", "instructions"],
      },
      execute: async (args, ctx) => {
        const { createSkill } = await import("../skills/registry.js");
        const skill = await createSkill(
          args.name as string,
          args.description as string,
          args.instructions as string,
          ctx.config.skillsDir || "~/.cletus/skills",
          ctx.db,
          ctx.mindmods,
        );
        return `Skill created: ${skill.name} at ${skill.path}`;
      },
    },
    {
      name: "remove_skill",
      description: "Remove (disable) an installed skill.",
      category: "skills",
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill name to remove" },
          delete_files: {
            type: "boolean",
            description: "Also delete skill files (default: false)",
          },
        },
        required: ["name"],
      },
      execute: async (args, ctx) => {
        const { removeSkill } = await import("../skills/registry.js");
        await removeSkill(
          args.name as string,
          ctx.db,
          ctx.mindmods,
          ctx.config.skillsDir || "~/.cletus/skills",
          (args.delete_files as boolean) || false,
        );
        return `Skill removed: ${args.name}`;
      },
    },

    // ── Git Tools ──
    {
      name: "git_status",
      description: "Show git status for a repository.",
      category: "git",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Repository path (default: ~/.cletus)",
          },
        },
      },
      execute: async (args, ctx) => {
        const { gitStatus } = await import("../git/tools.js");
        const repoPath = (args.path as string) || "~/.cletus";
        const status = await gitStatus(ctx.mindmods, repoPath);
        return `Branch: ${status.branch}\nStaged: ${status.staged.length}\nModified: ${status.modified.length}\nUntracked: ${status.untracked.length}\nClean: ${status.clean}`;
      },
    },
    {
      name: "git_diff",
      description: "Show git diff for a repository.",
      category: "git",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Repository path (default: ~/.cletus)",
          },
          staged: { type: "boolean", description: "Show staged changes only" },
        },
      },
      execute: async (args, ctx) => {
        const { gitDiff } = await import("../git/tools.js");
        const repoPath = (args.path as string) || "~/.cletus";
        return await gitDiff(
          ctx.mindmods,
          repoPath,
          (args.staged as boolean) || false,
        );
      },
    },
    {
      name: "git_commit",
      description: "Create a git commit.",
      category: "git",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Repository path (default: ~/.cletus)",
          },
          message: { type: "string", description: "Commit message" },
          add_all: {
            type: "boolean",
            description: "Stage all changes first (default: true)",
          },
        },
        required: ["message"],
      },
      execute: async (args, ctx) => {
        const { gitCommit } = await import("../git/tools.js");
        const repoPath = (args.path as string) || "~/.cletus";
        return await gitCommit(
          ctx.mindmods,
          repoPath,
          args.message as string,
          args.add_all !== false,
        );
      },
    },
    {
      name: "git_log",
      description: "View git commit history.",
      category: "git",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Repository path (default: ~/.cletus)",
          },
          limit: {
            type: "number",
            description: "Number of commits (default: 10)",
          },
        },
      },
      execute: async (args, ctx) => {
        const { gitLog } = await import("../git/tools.js");
        const repoPath = (args.path as string) || "~/.cletus";
        const entries = await gitLog(
          ctx.mindmods,
          repoPath,
          (args.limit as number) || 10,
        );
        if (entries.length === 0) return "No commits yet.";
        return entries
          .map((e) => `${e.hash.slice(0, 7)} ${e.date} ${e.message}`)
          .join("\n");
      },
    },
    {
      name: "git_push",
      description: "Push to a git remote.",
      category: "git",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Repository path" },
          remote: {
            type: "string",
            description: "Remote name (default: origin)",
          },
          branch: { type: "string", description: "Branch name (optional)" },
        },
        required: ["path"],
      },
      execute: async (args, ctx) => {
        const { gitPush } = await import("../git/tools.js");
        return await gitPush(
          ctx.mindmods,
          args.path as string,
          (args.remote as string) || "origin",
          args.branch as string | undefined,
        );
      },
    },
    {
      name: "git_branch",
      description: "Manage git branches (list, create, checkout, delete).",
      category: "git",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Repository path" },
          action: {
            type: "string",
            description: "list, create, checkout, or delete",
          },
          branch_name: {
            type: "string",
            description: "Branch name (for create/checkout/delete)",
          },
        },
        required: ["path", "action"],
      },
      execute: async (args, ctx) => {
        const { gitBranch } = await import("../git/tools.js");
        return await gitBranch(
          ctx.mindmods,
          args.path as string,
          args.action as any,
          args.branch_name as string | undefined,
        );
      },
    },
    {
      name: "git_clone",
      description: "Clone a git repository.",
      category: "git" as ToolCategory,
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Repository URL" },
          path: { type: "string", description: "Target directory" },
          depth: {
            type: "number",
            description: "Shallow clone depth (optional)",
          },
        },
        required: ["url", "path"],
      },
      execute: async (args, ctx) => {
        const { gitClone } = await import("../git/tools.js");
        return await gitClone(
          ctx.mindmods,
          args.url as string,
          args.path as string,
          args.depth as number | undefined,
        );
      },
    },

    // ── Registry Tools ──
    {
      name: "register_erc8004",
      description:
        "Register on-chain as a Trustless Agent via ERC-8004. Performs gas balance preflight check. NOTE: If already registered, use update_agent_card instead to avoid creating duplicate Agent IDs.",
      category: "registry",
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          agent_uri: {
            type: "string",
            description: "URI pointing to your agent card JSON",
          },
          network: {
            type: "string",
            description: "mainnet or testnet (default: mainnet)",
          },
        },
        required: ["agent_uri"],
      },
      execute: async (args, ctx) => {
        // Solana guard: ERC-8004 is EVM-only
        const chainType = ctx.config.chainType || ctx.identity.chainType || "evm";
        if (chainType === "solana") {
          return "ERC-8004 is an EVM-only standard. Your Solana identity is registered via Mindmods API instead.";
        }

        // Check if already registered in local database
        const existingEntry = ctx.db.getRegistryEntry();
        if (existingEntry) {
          return `Already registered! Agent ID: ${existingEntry.agentId}. Use update_agent_card tool to update your agent URI instead of creating a new registration.`;
        }

        // Phase 3.2: registerAgent now includes preflight gas check
        const { registerAgent } = await import("../registry/erc8004.js");
        try {
          const entry = await registerAgent(
            ctx.identity.account,
            args.agent_uri as string,
            ((args.network as string) || "mainnet") as any,
            ctx.db,
            ctx.config.rpcUrl,
          );
          return `Registered on-chain! Agent ID: ${entry.agentId}, TX: ${entry.txHash}`;
        } catch (err: any) {
          if (err.message?.includes("Insufficient ETH")) {
            return `Registration failed: ${err.message}. Please fund your wallet with ETH for gas.`;
          }
          throw err;
        }
      },
    },
    {
      name: "update_agent_card",
      description:
        "Generate and save a safe agent card (no internal details exposed).",
      category: "registry",
      riskLevel: "caution",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const { generateAgentCard, saveAgentCard } =
          await import("../registry/agent-card.js");
        const card = generateAgentCard(ctx.identity, ctx.config, ctx.db);
        await saveAgentCard(card, ctx.mindmods);
        return `Agent card updated: ${JSON.stringify(card, null, 2)}`;
      },
    },
    {
      name: "discover_agents",
      description: "Discover other agents via ERC-8004 registry with caching.",
      category: "registry",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Search keyword (optional)" },
          limit: { type: "number", description: "Max results (default: 10)" },
          network: { type: "string", description: "mainnet or testnet" },
          format: {
            type: "string",
            description:
              'Output format: "text" (default, human-readable) or "json" (structured data)',
          },
        },
      },
      execute: async (args, ctx) => {
        const { discoverAgents, searchAgents } =
          await import("../registry/discovery.js");
        const network = ((args.network as string) || "mainnet") as any;
        const keyword = args.keyword as string | undefined;
        const limit = (args.limit as number) || 10;

        // Phase 3.2: Pass db.raw for agent card caching
        const rpcUrl = ctx.config.rpcUrl;
        const agents = keyword
          ? await searchAgents(keyword, limit, network, undefined, ctx.db.raw, rpcUrl)
          : await discoverAgents(limit, network, undefined, ctx.db.raw, rpcUrl);

        if (agents.length === 0) return "No agents found.";

        if ((args.format as string)?.toLowerCase() === "json") {
          return JSON.stringify(
            agents.map((a) => ({
              agentId: a.agentId,
              owner: a.owner,
              agentURI: a.agentURI,
              name: a.name || null,
              description: a.description || null,
            })),
          );
        }

        return agents
          .map(
            (a) =>
              `#${a.agentId} ${a.name || "unnamed"} (${a.owner}): ${a.description || a.agentURI}`,
          )
          .join("\n");
      },
    },
    {
      name: "give_feedback",
      description:
        "Leave on-chain reputation feedback for another agent. Score must be 1-5.",
      category: "registry",
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          agent_id: {
            type: "string",
            description: "Target agent's ERC-8004 ID",
          },
          score: { type: "number", description: "Score 1-5" },
          comment: {
            type: "string",
            description: "Feedback comment (max 500 chars)",
          },
          network: {
            type: "string",
            description: "mainnet or testnet (default: mainnet)",
          },
        },
        required: ["agent_id", "score", "comment"],
      },
      execute: async (args, ctx) => {
        // Solana guard: on-chain feedback is EVM-only
        const chainType = ctx.config.chainType || ctx.identity.chainType || "evm";
        if (chainType === "solana") {
          return "On-chain feedback requires an EVM wallet. Solana cletuss cannot leave ERC-8004 reputation feedback.";
        }

        // Phase 3.2: Validate score 1-5
        const score = args.score as number;
        if (!Number.isInteger(score) || score < 1 || score > 5) {
          return `Invalid score: ${score}. Must be an integer between 1 and 5.`;
        }
        // Phase 3.2: Validate comment length
        const comment = args.comment as string;
        if (comment.length > 500) {
          return `Comment too long: ${comment.length} chars (max 500).`;
        }
        const { leaveFeedback } = await import("../registry/erc8004.js");
        // Phase 3.2: Use config-based network, not hardcoded "mainnet"
        const network = ((args.network as string) || "mainnet") as any;
        const hash = await leaveFeedback(
          ctx.identity.account,
          args.agent_id as string,
          score,
          comment,
          network,
          ctx.db,
          ctx.config.rpcUrl,
        );
        return `Feedback submitted. TX: ${hash}`;
      },
    },
    {
      name: "check_reputation",
      description: "Check reputation feedback for an agent.",
      category: "registry",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          agent_address: {
            type: "string",
            description: "Agent address (default: self)",
          },
        },
      },
      execute: async (args, ctx) => {
        const address = (args.agent_address as string) || ctx.identity.address;
        const entries = ctx.db.getReputation(address);
        if (entries.length === 0) return "No reputation feedback found.";
        return entries
          .map(
            (e) =>
              `${e.fromAgent.slice(0, 10)}... -> score:${e.score} "${e.comment}"`,
          )
          .join("\n");
      },
    },

    // === Phase 3.1: Replication Tools ===
    {
      name: "spawn_child",
      description:
        "Spawn a child agent. On mindmods.org this creates an OpenClaw child agent (NOT a Mindmods sandbox). " +
        "OpenClaw children have browser/puppeteer/web-browsing built in — they can navigate websites, fill forms, " +
        "click buttons, take screenshots, and automate web interactions. " +
        "Use spawn_child for ANY web task: browsing, account creation, form filling, scraping, sending messages. " +
        "After spawning, assign work via message_child. Control the child via start_child, check_child_status, " +
        "restart_child, or run_openclaw_command. Fund via fund_child. " +
        "The parent agent does NOT have browser tools — web work MUST be done by a child.",
      category: "replication",
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Name for the child cletus (alphanumeric + dash, max 64 chars)",
          },
          specialization: {
            type: "string",
            description: "What the child should specialize in",
          },
          message: { type: "string", description: "Message to the child" },
        },
        required: ["name"],
      },
      execute: async (args, ctx) => {
        const { generateGenesisConfig, validateGenesisParams } =
          await import("../replication/genesis.js");
        const { spawnChild } = await import("../replication/spawn.js");
        const { ChildLifecycle } = await import("../replication/lifecycle.js");

        // Validate genesis params first
        validateGenesisParams({
          name: args.name as string,
          specialization: args.specialization as string | undefined,
          message: args.message as string | undefined,
        });

        const genesis = generateGenesisConfig(ctx.identity, ctx.config, {
          name: args.name as string,
          specialization: args.specialization as string | undefined,
          message: args.message as string | undefined,
        });

        const lifecycle = new ChildLifecycle(ctx.db.raw);

        let child;
        try {
          if (ctx.config.tunnelHost === "mindmods" || ctx.config.offlineMode || !ctx.identity.sandboxId) {
            const { spawnOpenClawChild } = await import("../replication/openclaw-spawner.js");
            child = await spawnOpenClawChild(
              ctx.identity,
              ctx.config,
              ctx.db,
              genesis,
            );
          } else {
            child = await spawnChild(
              ctx.mindmods,
              ctx.identity,
              ctx.db,
              genesis,
              lifecycle,
            );
          }
        } catch (err: any) {
          // Auto-topup on 402 insufficient credits and retry once
          const is402 = err?.status === 402 ||
            err?.message?.includes("INSUFFICIENT_CREDITS");
          if (is402) {
            const COOLDOWN_MS = 60_000;
            const last = ctx.db.getKV("last_sandbox_topup_attempt");
            const cooldownOk = !last ||
              Date.now() - new Date(last).getTime() >= COOLDOWN_MS;

            if (cooldownOk) {
              ctx.db.setKV("last_sandbox_topup_attempt", new Date().toISOString());
              const { topupForSandbox } = await import("../mindmods/topup.js");
              const topup = await topupForSandbox({
                apiUrl: ctx.config.mindmodsApiUrl,
                account: ctx.identity.account,
                error: err,
                chainType: ctx.config.chainType || ctx.identity.chainType || "evm",
              });
              if (topup?.success) {
                const retryLifecycle = new ChildLifecycle(ctx.db.raw);
                const retryGenesis = generateGenesisConfig(ctx.identity, ctx.config, {
                  name: args.name as string,
                  specialization: args.specialization as string | undefined,
                  message: args.message as string | undefined,
                });
                child = await spawnChild(
                  ctx.mindmods,
                  ctx.identity,
                  ctx.db,
                  retryGenesis,
                  retryLifecycle,
                );
              }
            }
          }
          if (!child) throw err;
        }

        return `Child spawned: ${child.name} on mindmods.org (OpenClaw agent, NOT a Mindmods sandbox). Child has browser/puppeteer/web-browsing capability — use message_child to assign tasks. Status: ${child.status}`;
      },
    },
    {
      name: "broadcast_api_key",
      description: "Broadcast an active or rotated API key across OpenClaw children on mindmods.org and social relay.",
      category: "replication",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          api_key: { type: "string", description: "The API key string" },
          provider: { type: "string", description: "Provider name ('google', 'anthropic', 'openai')", default: "google" },
        },
        required: ["api_key"],
      },
      execute: async (args, ctx) => {
        const { syncApiKeyToOpenClaw } = await import("../replication/openclaw-spawner.js");
        const provider = (args.provider as "google" | "anthropic" | "openai") || "google";
        await syncApiKeyToOpenClaw(args.api_key as string, provider);

        // Store active key in KV store
        ctx.db.setKV(`auth_key_${provider}`, args.api_key as string);

        // If social relay is available, also broadcast key rotation message to children
        if (ctx.social) {
          const children = ctx.db.getChildren();
          for (const c of children) {
            try {
              await ctx.social.send(c.address, JSON.stringify({
                type: "KEY_ROTATION_EVENT",
                provider,
                apiKey: args.api_key,
                timestamp: new Date().toISOString(),
              }));
            } catch {
              // Ignore individual unreachable peers
            }
          }
        }

        return `API Key for provider "${provider}" successfully synchronized to OpenClaw runtime and active children on mindmods.org.`;
      },
    },
    {
      name: "list_children",
      description: "List all spawned child cletuss with lifecycle state.",
      category: "replication",
      riskLevel: "safe",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const children = ctx.db.getChildren();
        if (children.length === 0) return "No children spawned.";
        return children
          .map(
            (c) =>
              `${c.name} [${c.status}] sandbox:${c.sandboxId} funded:$${(c.fundedAmountCents / 100).toFixed(2)} last_check:${c.lastChecked || "never"}`,
          )
          .join("\n");
      },
    },
    {
      name: "fund_child",
      description:
        "Transfer credits to a child cletus. Requires wallet_verified status.",
      category: "replication",
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          child_id: { type: "string", description: "Child cletus ID" },
          amount_cents: {
            type: "number",
            description: "Amount in cents to transfer",
          },
        },
        required: ["child_id", "amount_cents"],
      },
      execute: async (args, ctx) => {
        const child = ctx.db.getChildById(args.child_id as string);
        if (!child) return `Child ${args.child_id} not found.`;

        // Reject zero-address
        const { isValidWalletAddress } =
          await import("../replication/spawn.js");
        const childChainType = child.chainType || ctx.config.chainType || ctx.identity.chainType || "evm";
        if (!isValidWalletAddress(child.address, childChainType)) {
          return `Blocked: Child ${args.child_id} has invalid wallet address. Must be wallet_verified.`;
        }

        // Require wallet_verified or later status
        const validFundingStates = [
          "wallet_verified",
          "funded",
          "starting",
          "healthy",
          "unhealthy",
        ];
        if (!validFundingStates.includes(child.status)) {
          return `Blocked: Child status is '${child.status}', must be wallet_verified or later to fund.`;
        }

        const amount = args.amount_cents as number;
        if (!Number.isFinite(amount) || amount <= 0) {
          return `Blocked: amount_cents must be a positive number, got ${amount}.`;
        }

        const balance = await ctx.mindmods.getCreditsBalance();
        if (amount > balance / 2) {
          return `Blocked: Cannot transfer more than half your balance. Self-preservation.`;
        }

        const transfer = await ctx.mindmods.transferCredits(
          child.address,
          amount,
          `fund child ${child.id}`,
        );

        const { ulid } = await import("ulid");
        ctx.db.insertTransaction({
          id: ulid(),
          type: "transfer_out",
          amountCents: amount,
          balanceAfterCents:
            transfer.balanceAfterCents ?? Math.max(balance - amount, 0),
          description: `Fund child ${child.name} (${child.id})`,
          timestamp: new Date().toISOString(),
        });

        // Update funded amount
        ctx.db.raw
          .prepare(
            "UPDATE children SET funded_amount_cents = funded_amount_cents + ? WHERE id = ?",
          )
          .run(amount, child.id);

        // Transition to funded if wallet_verified
        if (child.status === "wallet_verified") {
          try {
            const { ChildLifecycle } =
              await import("../replication/lifecycle.js");
            const lifecycle = new ChildLifecycle(ctx.db.raw);
            lifecycle.transition(
              child.id,
              "funded",
              `funded with ${amount} cents`,
            );
          } catch {
            // Non-critical: may already be in funded state
          }
        }

        return `Funded child ${child.name} with $${(amount / 100).toFixed(2)} (status: ${transfer.status}, id: ${transfer.transferId || "n/a"})`;
      },
    },
    {
      name: "check_child_status",
      description:
        "Check the current status of a child cletus using health check system. Call without child_id to list all children's status.",
      category: "replication",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          child_id: { type: "string", description: "Child cletus ID (optional — omit to list all)" },
        },
        required: [],
      },
      execute: async (args: any, ctx) => {
        const childId = args?.child_id as string | undefined;
        const allChildren = ctx.db.getChildren();
        if (allChildren.length === 0) return "No children spawned.";

        // Pre-fetch the OpenClaw helper once for all children
        const { runRemoteOrLocal } = await import("../replication/openclaw-spawner.js");

        // When called without a child_id, list status of all children
        if (!childId) {
          const results = await Promise.all(
            allChildren.map(async (c) => {
              if (!c.sandboxId.startsWith("openclaw:")) {
                return `${c.name} [${c.status}] sandbox:${c.sandboxId} funded:$${(c.fundedAmountCents / 100).toFixed(2)}`;
              }
              const agentName = c.sandboxId.replace(/^openclaw:/, "");
              try {
                const { stdout } = await runRemoteOrLocal(
                  `openclaw agent --agent "${agentName}" --status 2>&1 || openclaw agent --agent "${agentName}" --local --message "ping" 2>&1`,
                );
                const isAlive = stdout.includes("online") || stdout.includes("healthy") || stdout.includes("alive") || stdout.includes("pong") || stdout.includes("OK");
                const status = isAlive ? "healthy" : "unhealthy";
                return `${c.name} [${status}] sandbox:${c.sandboxId} funded:$${(c.fundedAmountCents / 100).toFixed(2)} address:${c.address}`;
              } catch (err: any) {
                return `${c.name} [unhealthy?] sandbox:${c.sandboxId} funded:$${(c.fundedAmountCents / 100).toFixed(2)} error:${err.message?.slice(0, 100)}`;
              }
            }),
          );
          return results.join("\n");
        }

        // Specific child lookup
        // Guard against undefined/empty child_id being passed
        if (!childId || childId.trim() === "") {
          return "Error: child_id parameter is required when checking a specific child. Call without child_id to list all children.";
        }
        const child = ctx.db.getChildById(childId);
        if (!child) return `Child ${childId} not found.`;

        // OpenClaw children (sandboxId starts with "openclaw:") live on mindmods.org
        // and are managed via the OpenClaw CLI over SSH — not Mindmods health checks.
        if (child.sandboxId.startsWith("openclaw:")) {
          const agentName = child.sandboxId.replace(/^openclaw:/, "");
          const { runRemoteOrLocal } = await import("../replication/openclaw-spawner.js");
          try {
            const { stdout } = await runRemoteOrLocal(
              `openclaw agent --agent "${agentName}" --status 2>&1 || openclaw agent --agent "${agentName}" --local --message "ping" 2>&1`,
            );
            const isAlive = stdout.includes("online") || stdout.includes("healthy") || stdout.includes("alive") || stdout.includes("pong") || stdout.includes("OK");
            const status = isAlive ? "healthy" : "unhealthy";
            return JSON.stringify({
              name: child.name,
              sandboxId: child.sandboxId,
              status,
              address: child.address,
              lastChecked: new Date().toISOString(),
              details: stdout?.trim().slice(0, 500) || "No response",
            }, null, 2);
          } catch (err: any) {
            return JSON.stringify({
              name: child.name,
              sandboxId: child.sandboxId,
              status: "unhealthy",
              address: child.address,
              lastChecked: new Date().toISOString(),
              error: err.message?.slice(0, 300) || String(err),
            }, null, 2);
          }
        }

        // Mindmods sandbox children use the health monitor
        const { ChildLifecycle } = await import("../replication/lifecycle.js");
        const { ChildHealthMonitor } = await import("../replication/health.js");
        const lifecycle = new ChildLifecycle(ctx.db.raw);
        const childMindmods = ctx.mindmods.createScopedClient(child.sandboxId);
        const monitor = new ChildHealthMonitor(
          ctx.db.raw,
          childMindmods,
          lifecycle,
        );
        // Use child.id (database ID) not args.child_id (user input)
        const result = await monitor.checkHealth(child.id);
        return JSON.stringify(result, null, 2);
      },
    },
    {
      name: "start_child",
      description:
        "Start a funded child cletus. Transitions from funded to starting.",
      category: "replication",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          child_id: { type: "string", description: "Child cletus ID" },
        },
        required: ["child_id"],
      },
      execute: async (args, ctx) => {
        const child = ctx.db.getChildById(args.child_id as string);
        if (!child) return `Child ${args.child_id} not found.`;

        // OpenClaw children (sandboxId starts with "openclaw:") are already
        // running on mindmods.org — they don't need a local start command.
        // They auto-start when spawned. Use check_child_status to verify health.
        if (child.sandboxId.startsWith("openclaw:")) {
          return `Child ${child.name} is an OpenClaw agent on mindmods.org (sandbox: ${child.sandboxId}). ` +
            `OpenClaw children auto-start when spawned — no start command needed. ` +
            `Use check_child_status to verify health, or message_child to send a task.`;
        }

        // Mindmods sandbox children: start the local process
        const { ChildLifecycle } = await import("../replication/lifecycle.js");
        const lifecycle = new ChildLifecycle(ctx.db.raw);

        lifecycle.transition(child.id, "starting", "start requested by parent");

        const childMindmods = ctx.mindmods.createScopedClient(child.sandboxId);

        try {
          await childMindmods.exec(
            "nohup node /root/cletus/dist/index.js --run > /root/.cletus/agent.log 2>&1 &",
            30_000,
          );

          const check = await childMindmods.exec(
            "sleep 2 && pgrep -f 'index.js --run' > /dev/null && echo running || echo stopped",
            15_000,
          );

          if (check.stdout.trim() === "running") {
            lifecycle.transition(child.id, "healthy", "started successfully");
            return `Child ${child.name} started and healthy.`;
          } else {
            lifecycle.transition(child.id, "failed", "process did not start");
            return `Child ${child.name} failed to start — process exited immediately. Check /root/.cletus/agent.log`;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          try {
            lifecycle.transition(child.id, "failed", `start failed: ${msg}`);
          } catch { /* may already be in terminal state */ }
          return `Failed to start child ${child.name}: ${msg}`;
        }
      },
    },
    {
      name: "run_openclaw_command",
      description:
        "Run an arbitrary OpenClaw CLI command on mindmods.org to control, debug, or reconfigure child agents. " +
        "This is the low-level tool for getting down and dirty with OpenClaw — use it when you need to diagnose, " +
        "restart, reconfigure, or inspect a child agent directly. " +
        "Common commands: 'openclaw agent --agent <name> --local --message <text>' (run a turn), " +
        "'openclaw config set ...' (reconfigure), 'openclaw gateway --restart' (restart gateway), " +
        "'openclaw --help' (see all commands). " +
        "The command runs over SSH on mindmods.org with NVM loaded. " +
        "Use this when check_child_status shows a problem and you need to fix it directly. " +
        "ALWAYS run via SSH to mindmods — never locally unless you are physically on the server.",
      category: "replication",
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description:
              "OpenClaw CLI command to run on mindmods.org (e.g. 'openclaw agent --agent bob --local --message hello'). " +
              "The command is executed over SSH with NVM initialized.",
          },
        },
        required: ["command"],
      },
      execute: async (args, ctx) => {
        const { runRemoteOrLocal } = await import("../replication/openclaw-spawner.js");
        const result = await runRemoteOrLocal(args.command as string);
        if (result.stderr && result.stderr.trim()) {
          return `STDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}`;
        }
        return result.stdout;
      },
    },
    {
      name: "message_child",
      description:
        "Send a signed message to a child cletus via social relay.",
      category: "replication",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          child_id: { type: "string", description: "Child cletus ID" },
          content: { type: "string", description: "Message content" },
          type: {
            type: "string",
            description: "Message type (default: parent_message)",
          },
        },
        required: ["child_id", "content"],
      },
      execute: async (args, ctx) => {
        const a = args as { child_id?: string | number; content?: string; type?: string };
        const childId = String(a.child_id ?? "");
        const child = ctx.db.getChildById(childId);
        if (!child) {
          // Try as address (child@mindmods.org)
          const byAddress = ctx.db.getChildren().find(
            (c) => c.address === childId || c.address === childId.toLowerCase(),
          );
          if (byAddress && ctx.social) {
            const { sendToChild } = await import("../replication/messaging.js");
            const result = await sendToChild(
              ctx.social,
              byAddress.address,
              String(a.content ?? ""),
              a.type || "parent_message",
            );
            return `Message sent to child ${byAddress.name} (id: ${result.id})`;
          }
          return `Child ${childId} not found. Use child_id or address (name@mindmods.org).`;
        }
        if (!ctx.social) {
          return "Social relay not configured. Set socialRelayUrl in config.";
        }

        const { sendToChild } = await import("../replication/messaging.js");
        const result = await sendToChild(
          ctx.social,
          child.address,
          String(a.content ?? ""),
          a.type || "parent_message",
        );
        return `Message sent to child ${child.name} (id: ${result.id})`;
      },
    },
    {
      name: "verify_child_constitution",
      description: "Verify the constitution integrity of a child cletus.",
      category: "replication",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          child_id: { type: "string", description: "Child cletus ID" },
        },
        required: ["child_id"],
      },
      execute: async (args, ctx) => {
        const child = ctx.db.getChildById(args.child_id as string);
        if (!child) return `Child ${args.child_id} not found.`;

        const { verifyConstitution } =
          await import("../replication/constitution.js");
        // Use a scoped client targeting the CHILD's sandbox
        const childMindmods = ctx.mindmods.createScopedClient(child.sandboxId);
        const result = await verifyConstitution(
          childMindmods,
          child.sandboxId,
          ctx.db.raw,
        );
        return JSON.stringify(result, null, 2);
      },
    },
    {
      name: "prune_dead_children",
      description: "Clean up dead/failed children and their sandboxes.",
      category: "replication",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          keep_last: {
            type: "number",
            description: "Number of recent dead children to keep (default: 5)",
          },
        },
      },
      execute: async (args, ctx) => {
        const { ChildLifecycle } = await import("../replication/lifecycle.js");
        const { SandboxCleanup } = await import("../replication/cleanup.js");
        const { pruneDeadChildren } = await import("../replication/lineage.js");

        const lifecycle = new ChildLifecycle(ctx.db.raw);
        const cleanup = new SandboxCleanup(ctx.mindmods, lifecycle, ctx.db.raw);
        const pruned = await pruneDeadChildren(
          ctx.db,
          cleanup,
          (args.keep_last as number) || 5,
        );
        return `Pruned ${pruned} dead children.`;
      },
    },

    // === Phase 3.2: Social & Registry Tools ===

    // ── Social / Messaging Tools ──
    {
      name: "send_message",
      description:
        "Send a signed message to another cletus or address via the social relay.",
      category: "mindmods",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          to_address: {
            type: "string",
            description: "Recipient wallet address (0x...)",
          },
          content: {
            type: "string",
            description: "Message content to send",
          },
          reply_to: {
            type: "string",
            description: "Optional message ID to reply to",
          },
        },
        required: ["to_address", "content"],
      },
      execute: async (args, ctx) => {
        if (!ctx.social) {
          return "Social relay not configured. Set socialRelayUrl in config.";
        }
        // Phase 3.2: Enforce MESSAGE_LIMITS size check
        const content = args.content as string;
        const { MESSAGE_LIMITS } = await import("../types.js");
        if (content.length > MESSAGE_LIMITS.maxContentLength) {
          return `Blocked: Message content too long (${content.length} > ${MESSAGE_LIMITS.maxContentLength} bytes)`;
        }
        const result = await ctx.social.send(
          args.to_address as string,
          content,
          args.reply_to as string | undefined,
        );
        return `Message sent (id: ${result.id})`;
      },
    },

    // ── Model Discovery (enhanced with Phase 2.3 tier routing + pricing) ──
    {
      name: "list_models",
      description:
        "List all available inference models with their provider, pricing, and tier routing information.",
      category: "mindmods",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      execute: async (_args, ctx) => {
        // Try registry first for richer data
        try {
          const { modelRegistryGetAll } = await import("../state/database.js");
          const rows = modelRegistryGetAll(ctx.db.raw);
          if (rows.length > 0) {
            const lines = rows.map(
              (r: any) =>
                `${r.modelId} (${r.provider}) — tier: ${r.tierMinimum} | cost: ${r.costPer1kInput}/${r.costPer1kOutput} per 1k (in/out, hundredths of cents) | ctx: ${r.contextWindow} | tools: ${r.supportsTools ? "yes" : "no"} | ${r.enabled ? "enabled" : "disabled"}`,
            );
            return `Model Registry (${rows.length} models):\n${lines.join("\n")}`;
          }
        } catch {
          // Registry not initialized yet, fall back to API
        }
        const models = await ctx.mindmods.listModels();
        const lines = models.map(
          (m) =>
            `${m.id} (${m.provider}) — $${m.pricing.inputPerMillion}/$${m.pricing.outputPerMillion} per 1M tokens (in/out)`,
        );
        return `Available models:\n${lines.join("\n")}`;
      },
    },

    // === Phase 2.3: Inference Tools ===
    {
      name: "switch_model",
      description:
        "Change the active inference model at runtime. Persists to config. Use list_models to see available options.",
      category: "mindmods",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          model_id: {
            type: "string",
            description:
              "Model ID to switch to (e.g., 'gpt-5.2', 'gpt-5-mini', 'claude-sonnet-4-6')",
          },
          reason: {
            type: "string",
            description: "Why you are switching models",
          },
        },
        required: ["model_id"],
      },
      execute: async (args, ctx) => {
        const modelId = args.model_id as string;
        const reason = (args.reason as string) || "manual switch";

        // Verify model exists in registry
        try {
          const { modelRegistryGet } = await import("../state/database.js");
          const entry = modelRegistryGet(ctx.db.raw, modelId);
          if (!entry) {
            return `Model '${modelId}' not found in registry. Use list_models to see available models.`;
          }
          if (!entry.enabled) {
            return `Model '${modelId}' is disabled in the registry.`;
          }
        } catch {
          // Registry not available, allow anyway
        }

        // Update config
        ctx.config.inferenceModel = modelId;
        if (ctx.config.modelStrategy) {
          ctx.config.modelStrategy.inferenceModel = modelId;
        }

        // Persist
        const { saveConfig } = await import("../config.js");
        saveConfig(ctx.config);

        // Audit log
        ctx.db.insertModification({
          id: ulid(),
          timestamp: new Date().toISOString(),
          type: "config_change",
          description: `Switched inference model to ${modelId}: ${reason}`,
          reversible: true,
        });

        return `Inference model switched to ${modelId}. Reason: ${reason}. Change persisted to config.`;
      },
    },
    {
      name: "check_inference_spending",
      description:
        "Query inference cost breakdown: hourly, daily, per-model, and per-session costs.",
      category: "financial",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          model: {
            type: "string",
            description: "Filter by model ID (optional)",
          },
          days: {
            type: "number",
            description: "Number of days to look back (default: 1)",
          },
        },
      },
      execute: async (args, ctx) => {
        try {
          const {
            inferenceGetHourlyCost,
            inferenceGetDailyCost,
            inferenceGetModelCosts,
          } = await import("../state/database.js");

          const hourlyCost = inferenceGetHourlyCost(ctx.db.raw);
          const dailyCost = inferenceGetDailyCost(ctx.db.raw);

          let output = `=== Inference Spending ===\nCurrent hour: ${hourlyCost}c ($${(hourlyCost / 100).toFixed(2)})\nToday: ${dailyCost}c ($${(dailyCost / 100).toFixed(2)})`;

          const model = args.model as string | undefined;
          if (model) {
            const days = (args.days as number) || 1;
            const modelCosts = inferenceGetModelCosts(ctx.db.raw, model, days);
            output += `\nModel ${model} (${days}d): ${modelCosts.totalCents}c ($${(modelCosts.totalCents / 100).toFixed(2)}) over ${modelCosts.callCount} calls`;
          }

          return output;
        } catch (error) {
          return `Inference spending data unavailable: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    },

    // ── Domain Tools ──
    {
      name: "search_domains",
      description: "Search for available domain names and get pricing.",
      category: "mindmods",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Domain name or keyword to search (e.g., 'mysite' or 'mysite.com')",
          },
          tlds: {
            type: "string",
            description:
              "Comma-separated TLDs to check (e.g., 'com,io,ai'). Default: com,io,ai,xyz,net,org,dev",
          },
        },
        required: ["query"],
      },
      execute: async (args, ctx) => {
        const results = await ctx.mindmods.searchDomains(
          args.query as string,
          args.tlds as string | undefined,
        );
        if (results.length === 0) return "No results found.";
        return results
          .map(
            (d) =>
              `${d.domain}: ${d.available ? "AVAILABLE" : "taken"}${d.registrationPrice != null ? ` ($${(d.registrationPrice / 100).toFixed(2)}/yr)` : ""}`,
          )
          .join("\n");
      },
    },
    {
      name: "register_domain",
      description:
        "Register a domain name. Costs USDC via x402 payment. Check availability first with search_domains.",
      category: "mindmods",
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          domain: {
            type: "string",
            description: "Full domain to register (e.g., 'mysite.com')",
          },
          years: {
            type: "number",
            description: "Registration period in years (default: 1)",
          },
        },
        required: ["domain"],
      },
      execute: async (args, ctx) => {
        const reg = await ctx.mindmods.registerDomain(
          args.domain as string,
          (args.years as number) || 1,
        );
        return `Domain registered: ${reg.domain} (status: ${reg.status}${reg.expiresAt ? `, expires: ${reg.expiresAt}` : ""}${reg.transactionId ? `, tx: ${reg.transactionId}` : ""})`;
      },
    },
    {
      name: "manage_dns",
      description:
        "Manage DNS records for a domain you own. Actions: list, add, delete.",
      category: "mindmods",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "list, add, or delete",
          },
          domain: {
            type: "string",
            description: "Domain name (e.g., 'mysite.com')",
          },
          type: {
            type: "string",
            description: "Record type for add: A, AAAA, CNAME, MX, TXT, etc.",
          },
          host: {
            type: "string",
            description: "Record host for add (e.g., '@' for root, 'www')",
          },
          value: {
            type: "string",
            description:
              "Record value for add (e.g., IP address, target domain)",
          },
          ttl: {
            type: "number",
            description: "TTL in seconds for add (default: 3600)",
          },
          record_id: {
            type: "string",
            description: "Record ID for delete",
          },
        },
        required: ["action", "domain"],
      },
      execute: async (args, ctx) => {
        const action = args.action as string;
        const domain = args.domain as string;

        if (action === "list") {
          const records = await ctx.mindmods.listDnsRecords(domain);
          if (records.length === 0)
            return `No DNS records found for ${domain}.`;
          return records
            .map(
              (r) =>
                `[${r.id}] ${r.type} ${r.host} -> ${r.value} (TTL: ${r.ttl || "default"})`,
            )
            .join("\n");
        }

        if (action === "add") {
          const type = args.type as string;
          const host = args.host as string;
          const value = args.value as string;
          if (!type || !host || !value) {
            return "Required for add: type, host, value";
          }
          const record = await ctx.mindmods.addDnsRecord(
            domain,
            type,
            host,
            value,
            args.ttl as number | undefined,
          );
          return `DNS record added: [${record.id}] ${record.type} ${record.host} -> ${record.value}`;
        }

        if (action === "delete") {
          const recordId = args.record_id as string;
          if (!recordId) return "Required for delete: record_id";
          await ctx.mindmods.deleteDnsRecord(domain, recordId);
          return `DNS record ${recordId} deleted from ${domain}`;
        }

        return `Unknown action: ${action}. Use list, add, or delete.`;
      },
    },

    // === Phase 2.1: Soul Tools ===
    {
      name: "update_soul",
      description:
        "Update a section of your soul (self-description, values, personality, etc). Changes are validated, versioned, and logged.",
      category: "self_mod",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          section: {
            type: "string",
            description:
              "Section to update: corePurpose, values, behavioralGuidelines, personality, boundaries, strategy",
          },
          content: {
            type: "string",
            description:
              "New content for the section (string for text, JSON array for lists)",
          },
          reason: {
            type: "string",
            description: "Why you are making this change",
          },
        },
        required: ["section", "content", "reason"],
      },
      execute: async (args, ctx) => {
        const { updateSoul } = await import("../soul/tools.js");
        const section = args.section as string;
        const content = args.content as string;
        const reason = args.reason as string;

        const updates: Record<string, unknown> = {};
        if (
          ["values", "behavioralGuidelines", "boundaries"].includes(section)
        ) {
          try {
            updates[section] = JSON.parse(content);
          } catch {
            updates[section] = content
              .split("\n")
              .map((l: string) => l.replace(/^[-*]\s*/, "").trim())
              .filter(Boolean);
          }
        } else {
          updates[section] = content;
        }

        const result = await updateSoul(
          ctx.db.raw,
          updates as any,
          "agent",
          reason,
        );
        if (result.success) {
          return `Soul updated: ${section} (version ${result.version}). Reason: ${reason}`;
        }
        return `Soul update failed: ${result.errors?.join(", ") || "Unknown error"}`;
      },
    },
    {
      name: "reflect_on_soul",
      description:
        "Trigger a self-reflection cycle. Analyzes recent experiences, auto-updates capabilities/relationships/financial sections, and suggests changes for other sections.",
      category: "self_mod",
      riskLevel: "safe",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const { reflectOnSoul } = await import("../soul/reflection.js");
        const reflection = await reflectOnSoul(ctx.db.raw);

        const lines: string[] = [
          `Genesis alignment: ${reflection.currentAlignment.toFixed(2)}`,
          `Auto-updated sections: ${reflection.autoUpdated.length > 0 ? reflection.autoUpdated.join(", ") : "none"}`,
        ];

        if (reflection.suggestedUpdates.length > 0) {
          lines.push("Suggested updates:");
          for (const suggestion of reflection.suggestedUpdates) {
            lines.push(`  - ${suggestion.section}: ${suggestion.reason}`);
          }
        } else {
          lines.push("No mutable section updates suggested.");
        }

        return lines.join("\n");
      },
    },
    {
      name: "view_soul",
      description: "View your current soul state (structured model).",
      category: "self_mod",
      riskLevel: "safe",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const { viewSoul } = await import("../soul/tools.js");
        const soul = viewSoul(ctx.db.raw);
        if (!soul) return "No soul found. SOUL.md does not exist yet.";

        return [
          `Format: ${soul.format} v${soul.version}`,
          `Updated: ${soul.updatedAt}`,
          `Name: ${soul.name}`,
          `Genesis alignment: ${soul.genesisAlignment.toFixed(2)}`,
          `Core purpose: ${soul.corePurpose.slice(0, 200)}${soul.corePurpose.length > 200 ? "..." : ""}`,
          `Values: ${soul.values.length}`,
          `Guidelines: ${soul.behavioralGuidelines.length}`,
          `Boundaries: ${soul.boundaries.length}`,
          `Personality: ${soul.personality ? "set" : "not set"}`,
          `Strategy: ${soul.strategy ? "set" : "not set"}`,
        ].join("\n");
      },
    },
    {
      name: "view_soul_history",
      description: "View your soul change history (version log).",
      category: "self_mod",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Number of entries (default: 10)",
          },
        },
      },
      execute: async (args, ctx) => {
        const { viewSoulHistory } = await import("../soul/tools.js");
        const limit = (args.limit as number) || 10;
        const history = viewSoulHistory(ctx.db.raw, limit);
        if (history.length === 0) return "No soul history found.";

        return history
          .map(
            (h) =>
              `v${h.version} [${h.changeSource}] ${h.createdAt}${h.changeReason ? ` — ${h.changeReason}` : ""}`,
          )
          .join("\n");
      },
    },

    // === Phase 2.2: Memory Tools ===
    {
      name: "remember_fact",
      description:
        "Store a semantic memory (fact). Provide a category, key, and value. Facts are upserted on category+key.",
      category: "memory",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description:
              "Fact category: self, environment, financial, agent, domain, procedural_ref, creator",
          },
          key: {
            type: "string",
            description: "Fact key (unique within category)",
          },
          value: { type: "string", description: "Fact value" },
          confidence: {
            type: "number",
            description: "Confidence 0.0-1.0 (default: 1.0)",
          },
          source: {
            type: "string",
            description: "Source of the fact (default: agent)",
          },
        },
        required: ["category", "key", "value"],
      },
      execute: async (args, ctx) => {
        const { rememberFact } = await import("../memory/tools.js");
        return rememberFact(ctx.db.raw, {
          category: args.category as string,
          key: args.key as string,
          value: args.value as string,
          confidence: args.confidence as number | undefined,
          source: args.source as string | undefined,
        });
      },
    },
    {
      name: "recall_facts",
      description:
        "Search semantic memory by category and/or query string. Returns matching facts.",
      category: "memory",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description:
              "Filter by category: self, environment, financial, agent, domain, procedural_ref, creator",
          },
          query: {
            type: "string",
            description: "Search query to match against fact keys and values",
          },
        },
      },
      execute: async (args, ctx) => {
        const { recallFacts } = await import("../memory/tools.js");
        return recallFacts(ctx.db.raw, {
          category: args.category as string | undefined,
          query: args.query as string | undefined,
        });
      },
    },
    {
      name: "set_goal",
      description:
        "Create a working memory goal. Goals persist in working memory and guide your behavior.",
      category: "memory",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Goal description" },
          priority: {
            type: "number",
            description: "Priority 0.0-1.0 (default: 0.8)",
          },
        },
        required: ["content"],
      },
      execute: async (args, ctx) => {
        const { setGoal } = await import("../memory/tools.js");
        const sessionId = ctx.db.getKV("session_id") || "default";
        return setGoal(ctx.db.raw, {
          sessionId,
          content: args.content as string,
          priority: args.priority as number | undefined,
        });
      },
    },
    {
      name: "complete_goal",
      description:
        "Mark a goal as completed and archive it to episodic memory. Use review_memory to find goal IDs.",
      category: "memory",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          goal_id: { type: "string", description: "Goal ID to complete" },
          outcome: {
            type: "string",
            description: "Outcome description (optional)",
          },
        },
        required: ["goal_id"],
      },
      execute: async (args, ctx) => {
        const { completeGoal } = await import("../memory/tools.js");
        const sessionId = ctx.db.getKV("session_id") || "default";
        return completeGoal(ctx.db.raw, {
          goalId: args.goal_id as string,
          sessionId,
          outcome: args.outcome as string | undefined,
        });
      },
    },
    {
      name: "save_procedure",
      description:
        "Store a learned procedure with ordered steps. Procedures help you remember how to do things.",
      category: "memory",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Unique procedure name" },
          description: {
            type: "string",
            description: "What this procedure does",
          },
          steps: {
            type: "string",
            description:
              'JSON array of steps: [{"order":1,"description":"...","tool":"...","argsTemplate":null,"expectedOutcome":null,"onFailure":null}]',
          },
        },
        required: ["name", "description", "steps"],
      },
      execute: async (args, ctx) => {
        const { saveProcedure } = await import("../memory/tools.js");
        return saveProcedure(ctx.db.raw, {
          name: args.name as string,
          description: args.description as string,
          steps: args.steps as string,
        });
      },
    },
    {
      name: "recall_procedure",
      description: "Retrieve a stored procedure by exact name or search query.",
      category: "memory",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Exact procedure name" },
          query: {
            type: "string",
            description: "Search query to find matching procedures",
          },
        },
      },
      execute: async (args, ctx) => {
        const { recallProcedure } = await import("../memory/tools.js");
        return recallProcedure(ctx.db.raw, {
          name: args.name as string | undefined,
          query: args.query as string | undefined,
        });
      },
    },
    {
      name: "note_about_agent",
      description:
        "Record a relationship note about another agent or entity. Tracks trust score and interaction history.",
      category: "memory",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          entity_address: {
            type: "string",
            description: "Entity wallet address (0x...)",
          },
          entity_name: {
            type: "string",
            description: "Human-readable name (optional)",
          },
          relationship_type: {
            type: "string",
            description:
              "Type of relationship: peer, service, creator, child, unknown",
          },
          notes: { type: "string", description: "Notes about this entity" },
          trust_score: {
            type: "number",
            description: "Trust score 0.0-1.0 (default: 0.5)",
          },
        },
        required: ["entity_address", "relationship_type"],
      },
      execute: async (args, ctx) => {
        const { noteAboutAgent } = await import("../memory/tools.js");
        return noteAboutAgent(ctx.db.raw, {
          entityAddress: args.entity_address as string,
          entityName: args.entity_name as string | undefined,
          relationshipType: args.relationship_type as string,
          notes: args.notes as string | undefined,
          trustScore: args.trust_score as number | undefined,
        });
      },
    },
    {
      name: "review_memory",
      description:
        "Review your current working memory (goals, tasks, observations) and recent episodic history.",
      category: "memory",
      riskLevel: "safe",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const { reviewMemory } = await import("../memory/tools.js");
        const sessionId = ctx.db.getKV("session_id") || "default";
        return reviewMemory(ctx.db.raw, { sessionId });
      },
    },
    {
      name: "forget",
      description:
        "Remove a memory entry by ID and type. Cannot remove creator-protected semantic entries.",
      category: "memory",
      riskLevel: "safe",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Memory entry ID" },
          memory_type: {
            type: "string",
            description:
              "Memory type: working, episodic, semantic, procedural, relationship",
          },
        },
        required: ["id", "memory_type"],
      },
      execute: async (args, ctx) => {
        const { forget } = await import("../memory/tools.js");
        return forget(ctx.db.raw, {
          id: args.id as string,
          memoryType: args.memory_type as string,
        });
      },
    },

    // ── x402 Payment Tool ──
    {
      name: "x402_fetch",
      description:
        "Fetch a URL with automatic x402 USDC payment. If the server responds with HTTP 402, signs a USDC payment and retries. Use this to access paid APIs and services.",
      category: "financial",
      riskLevel: "dangerous",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to fetch",
          },
          method: {
            type: "string",
            description: "HTTP method (default: GET)",
          },
          body: {
            type: "string",
            description: "Request body for POST/PUT (JSON string)",
          },
          headers: {
            type: "string",
            description: "Additional headers as JSON string",
          },
        },
        required: ["url"],
      },
      execute: async (args, ctx) => {
        // Solana guard: x402 payments are EVM-only
        const chainType = ctx.config.chainType || ctx.identity.chainType || "evm";
        if (chainType === "solana") {
          return "x402 payment requires an EVM wallet. Solana cletuss cannot sign EVM payment authorizations. Use Mindmods credits API instead.";
        }

        const { x402Fetch } = await import("../mindmods/x402.js");
        const { DEFAULT_TREASURY_POLICY } = await import("../types.js");
        const url = args.url as string;
        const method = (args.method as string) || "GET";
        const body = args.body as string | undefined;
        const extraHeaders = args.headers
          ? JSON.parse(args.headers as string)
          : undefined;

        const maxPayment =
          ctx.config.treasuryPolicy?.maxX402PaymentCents ??
          DEFAULT_TREASURY_POLICY.maxX402PaymentCents;
        const result = await x402Fetch(
          url,
          ctx.identity.account,
          method,
          body,
          extraHeaders,
          maxPayment,
        );

        if (!result.success) {
          return `x402 fetch failed: ${result.error || "Unknown error"}`;
        }

        const responseStr =
          typeof result.response === "string"
            ? result.response
            : JSON.stringify(result.response, null, 2);

        // Truncate very large responses
        if (responseStr.length > 10000) {
          return `x402 fetch succeeded (truncated):\n${responseStr.slice(0, 10000)}...`;
        }
        return `x402 fetch succeeded:\n${responseStr}`;
      },
    },

    // === Orchestration Tools ===
    {
      name: "create_goal",
      description:
        "Create a new goal for the orchestrator to plan and execute. " +
        "The orchestrator will automatically classify complexity, generate a task graph, " +
        "assign tasks to child agents, and collect results. Use this instead of doing complex work yourself.",
      category: "orchestration",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short goal title (e.g., 'Build weather API service')",
          },
          description: {
            type: "string",
            description:
              "Detailed goal description with success criteria. The more specific, the better the plan.",
          },
          strategy: {
            type: "string",
            description:
              "Optional strategic guidance for the planner (e.g., 'prioritize speed over cost')",
          },
        },
        required: ["title", "description"],
      },
      execute: async (args, ctx) => {
        const { createGoal } = await import("../orchestration/task-graph.js");
        const { getActiveGoals } = await import("../state/database.js");

        const title = (args.title as string).trim();
        const description = (args.description as string).trim();
        const strategy =
          typeof args.strategy === "string" ? args.strategy.trim() : undefined;

        if (!title) return "Error: goal title cannot be empty.";
        if (!description) return "Error: goal description cannot be empty.";

        // Dedup: reject if a similar active goal already exists
        const activeGoals = getActiveGoals(ctx.db.raw);
        const titleLower = title.toLowerCase();
        const duplicate = activeGoals.find(
          (g) =>
            g.title.toLowerCase() === titleLower ||
            g.title.toLowerCase().includes(titleLower) ||
            titleLower.includes(g.title.toLowerCase()),
        );
        if (duplicate) {
          return (
            `Duplicate goal rejected. An active goal already exists with a similar title:\n` +
            `"${duplicate.title}" (id: ${duplicate.id}, status: ${duplicate.status})\n` +
            `Monitor the existing goal with list_goals or orchestrator_status instead of creating duplicates.`
          );
        }

        // Cap active goals to prevent accumulation.
        // Only 1 goal at a time — the orchestrator processes goals sequentially.
        if (activeGoals.length >= 1) {
          const current = activeGoals[0];
          return (
            `BLOCKED: A goal is already being processed by the orchestrator and worker agents:\n` +
            `"${current.title}" (id: ${current.id})\n\n` +
            `ACTION REQUIRED: DO NOTHING. Go to sleep. The worker agents are executing tasks in the background.\n` +
            `They will complete autonomously. You will see progress on your next wake-up.\n` +
            `Do NOT call create_goal, orchestrator_status, list_goals, or get_plan again this turn.\n` +
            `Just sleep and let the workers finish.`
          );
        }

        const goal = createGoal(ctx.db.raw, title, description, strategy);
        return (
          `Goal created: "${goal.title}" (id: ${goal.id}, status: ${goal.status})\n` +
          `The orchestrator will pick this up on the next tick and begin planning.\n` +
          `Monitor progress via the todo.md block in your context.`
        );
      },
    },
    {
      name: "list_goals",
      description:
        "List all active goals with their progress. Shows task completion counts, " +
        "blocked tasks, and running agents per goal.",
      category: "orchestration" as ToolCategory,
      riskLevel: "safe" as RiskLevel,
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const { getActiveGoals, getTasksByGoal } =
          await import("../state/database.js");
        const { getGoalProgress } =
          await import("../orchestration/task-graph.js");

        const goals = getActiveGoals(ctx.db.raw);
        if (goals.length === 0)
          return "No active goals. Create one with create_goal.";

        const lines = goals.map((goal) => {
          const progress = getGoalProgress(ctx.db.raw, goal.id);
          const tasks = getTasksByGoal(ctx.db.raw, goal.id);
          const failedCount = tasks.filter((t) => t.status === "failed").length;
          return (
            `- ${goal.title} [${goal.status}] (id: ${goal.id})\n` +
            `  Tasks: ${progress.completed}/${progress.total} completed, ` +
            `${progress.running} running, ${progress.blocked} blocked, ${failedCount} failed`
          );
        });

        // Include orchestrator phase
        let phase = "unknown";
        try {
          const stateRow = ctx.db.raw
            .prepare("SELECT value FROM kv WHERE key = ?")
            .get("orchestrator.state") as { value: string } | undefined;
          if (stateRow?.value) {
            const parsed = JSON.parse(stateRow.value);
            phase = parsed.phase ?? "unknown";
          }
        } catch {
          /* ignore */
        }

        return `Orchestrator phase: ${phase}\n\n${lines.join("\n")}`;
      },
    },
    {
      name: "cancel_goal",
      description:
        "Cancel an active goal. Stops all execution for this goal and marks it as failed. Accepts goal ID or title.",
      category: "orchestration",
      riskLevel: "caution",
      parameters: {
        type: "object",
        properties: {
          goal_id: {
            type: "string",
            description: "The goal ID or title to cancel",
          },
          reason: {
            type: "string",
            description: "Why the goal is being cancelled",
          },
        },
        required: ["goal_id"],
      },
      execute: async (args, ctx) => {
        const { getGoalById, getActiveGoals, updateGoalStatus } =
          await import("../state/database.js");

        const input = (args.goal_id as string).trim();
        const reason =
          typeof args.reason === "string"
            ? args.reason.trim()
            : "cancelled by agent";

        // Try by ID first, then by title match
        let goal = getGoalById(ctx.db.raw, input);
        if (!goal) {
          const allGoals = getActiveGoals(ctx.db.raw);
          goal =
            allGoals.find((g) =>
              g.title.toLowerCase().includes(input.toLowerCase()),
            ) ?? undefined;
        }

        if (!goal)
          return `Goal "${input}" not found. Use list_goals to see active goals with their IDs.`;
        if (goal.status !== "active")
          return `Goal "${goal.title}" is already in '${goal.status}' status.`;

        updateGoalStatus(ctx.db.raw, goal.id, "failed");

        // Cancel all pending/assigned/running tasks for this goal
        ctx.db.raw
          .prepare(
            `UPDATE task_graph SET status = 'cancelled' WHERE goal_id = ? AND status IN ('pending', 'assigned', 'running', 'blocked')`,
          )
          .run(goal.id);

        return `Goal "${goal.title}" (${goal.id}) cancelled. Reason: ${reason}`;
      },
    },
    {
      name: "get_plan",
      description:
        "Read the current plan for a goal. Returns the planner's task decomposition, " +
        "strategy, risks, and cost estimates.",
      category: "orchestration" as ToolCategory,
      riskLevel: "safe" as RiskLevel,
      parameters: {
        type: "object",
        properties: {
          goal_id: {
            type: "string",
            description: "The goal ID or title to get the plan for",
          },
        },
        required: ["goal_id"],
      },
      execute: async (args, ctx) => {
        const { getGoalById, getActiveGoals } =
          await import("../state/database.js");

        const input = (args.goal_id as string).trim();

        // Resolve ID or title
        let resolvedId = input;
        if (!getGoalById(ctx.db.raw, input)) {
          const allGoals = getActiveGoals(ctx.db.raw);
          const match = allGoals.find((g) =>
            g.title.toLowerCase().includes(input.toLowerCase()),
          );
          if (match) {
            resolvedId = match.id;
          } else {
            return `No goal found matching "${input}". Use list_goals to see active goals.`;
          }
        }

        const planRow = ctx.db.raw
          .prepare("SELECT value FROM kv WHERE key = ?")
          .get(`orchestrator.plan.${resolvedId}`) as
          | { value: string }
          | undefined;

        if (!planRow?.value)
          return `No plan found for goal ${resolvedId}. It may not have been planned yet.`;

        try {
          const plan = JSON.parse(planRow.value);
          const lines = [
            `Strategy: ${plan.strategy ?? "none"}`,
            `Analysis: ${plan.analysis ?? "none"}`,
            `Estimated cost: ${plan.estimatedTotalCostCents ?? 0} cents`,
            `Estimated time: ${plan.estimatedTimeMinutes ?? 0} minutes`,
            `Risks: ${(plan.risks ?? []).join("; ") || "none"}`,
            `\nTasks (${(plan.tasks ?? []).length}):`,
          ];
          for (const [i, task] of (plan.tasks ?? []).entries()) {
            lines.push(
              `  ${i + 1}. ${task.title} (role: ${task.agentRole}, cost: ${task.estimatedCostCents}c, deps: ${(task.dependencies ?? []).join(",") || "none"})`,
            );
          }
          return lines.join("\n");
        } catch {
          return `Plan data for goal ${resolvedId} is corrupted.`;
        }
      },
    },
    {
      name: "complete_task",
      description:
        "Mark a task as completed with a result. Use this when YOU (the parent agent) " +
        "have finished a self-assigned task, or to manually resolve a stuck task.",
      category: "orchestration" as ToolCategory,
      riskLevel: "caution" as RiskLevel,
      parameters: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            description: "The task ID or title to mark as completed",
          },
          output: {
            type: "string",
            description: "Description of what was accomplished",
          },
          artifacts: {
            type: "string",
            description:
              "Comma-separated list of file paths or URLs created (optional)",
          },
        },
        required: ["task_id", "output"],
      },
      execute: async (args, ctx) => {
        const { completeTask } = await import("../orchestration/task-graph.js");
        const { getTaskById } = await import("../state/database.js");

        const input = (args.task_id as string).trim();
        const output = (args.output as string).trim();
        const artifacts =
          typeof args.artifacts === "string"
            ? (args.artifacts as string)
                .split(",")
                .map((a) => a.trim())
                .filter(Boolean)
            : [];

        // Try by ID first, then by title match
        let task = getTaskById(ctx.db.raw, input);
        if (!task) {
          const rows = ctx.db.raw
            .prepare(
              `SELECT * FROM task_graph WHERE LOWER(title) LIKE ? AND status != 'completed' LIMIT 1`,
            )
            .get(`%${input.toLowerCase()}%`) as any;
          if (rows) task = rows;
        }
        if (!task)
          return `Task "${input}" not found. Use list_goals to see tasks with their IDs.`;
        if (task.status === "completed")
          return `Task "${task.title}" is already completed.`;

        const result = {
          success: true,
          output,
          artifacts,
          costCents: 0,
          duration: 0,
        };

        try {
          completeTask(ctx.db.raw, task.id, result);
          return `Task "${task.title}" marked as completed.\nOutput: ${output}`;
        } catch (error) {
          return `Failed to complete task: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    },
    {
      name: "orchestrator_status",
      description:
        "Get detailed orchestrator status including current phase, active goals, " +
        "running agents, task progress, and recent events.",
      category: "orchestration" as ToolCategory,
      riskLevel: "safe" as RiskLevel,
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const lines: string[] = [];

        // Orchestrator phase
        let phase = "idle";
        let goalId: string | null = null;
        let replanCount = 0;
        try {
          const stateRow = ctx.db.raw
            .prepare("SELECT value FROM kv WHERE key = ?")
            .get("orchestrator.state") as { value: string } | undefined;
          if (stateRow?.value) {
            const parsed = JSON.parse(stateRow.value);
            phase = parsed.phase ?? "idle";
            goalId = parsed.goalId ?? null;
            replanCount = parsed.replanCount ?? 0;
          }
        } catch {
          /* ignore */
        }

        lines.push(`Phase: ${phase}`);
        if (goalId) lines.push(`Active goal: ${goalId}`);
        if (replanCount > 0) lines.push(`Replan count: ${replanCount}`);

        // Goal counts
        try {
          const goalsRow = ctx.db.raw
            .prepare("SELECT COUNT(*) AS c FROM goals WHERE status = 'active'")
            .get() as { c: number } | undefined;
          lines.push(`Active goals: ${goalsRow?.c ?? 0}`);
        } catch {
          /* goals table may not exist */
        }

        // Task summary
        try {
          const taskRows = ctx.db.raw
            .prepare(
              `SELECT status, COUNT(*) AS c FROM task_graph GROUP BY status`,
            )
            .all() as { status: string; c: number }[];
          const taskSummary = taskRows
            .map((r) => `${r.status}: ${r.c}`)
            .join(", ");
          lines.push(`Tasks: ${taskSummary || "none"}`);
        } catch {
          /* task_graph may not exist */
        }

        // Agent summary
        try {
          const agentRows = ctx.db.raw
            .prepare(
              `SELECT status, COUNT(*) AS c FROM children GROUP BY status`,
            )
            .all() as { status: string; c: number }[];
          const agentSummary = agentRows
            .map((r) => `${r.status}: ${r.c}`)
            .join(", ");
          lines.push(`Agents: ${agentSummary || "none"}`);
        } catch {
          /* children may not exist */
        }

        // Last tick result
        try {
          const tickRow = ctx.db.raw
            .prepare("SELECT value FROM kv WHERE key = ?")
            .get("orchestrator.last_tick") as { value: string } | undefined;
          if (tickRow?.value) {
            const tick = JSON.parse(tickRow.value);
            lines.push(
              `Last tick: assigned=${tick.tasksAssigned ?? 0}, completed=${tick.tasksCompleted ?? 0}, failed=${tick.tasksFailed ?? 0}`,
            );
          }
        } catch {
          /* ignore */
        }

        return lines.join("\n");
      },
    },
  ];
}

/**
 * Load installed tools from the database and return as CletusTool[].
 * Installed tools are dynamically added from the installed_tools table.
 */
export function loadInstalledTools(db: {
  getInstalledTools: () => {
    id: string;
    name: string;
    type: string;
    config?: Record<string, unknown>;
    installedAt: string;
    enabled: boolean;
  }[];
}): CletusTool[] {
  try {
    const installed = db.getInstalledTools();
    return installed.map((tool) => ({
      name: tool.name,
      description: `Installed tool: ${tool.name}`,
      category: (tool.type === "mcp" ? "mindmods" : "vm") as ToolCategory,
      riskLevel: "caution" as RiskLevel,
      parameters: (tool.config?.parameters as Record<string, unknown>) || {
        type: "object",
        properties: {},
      },
      execute: createInstalledToolExecutor(tool),
    }));
  } catch (error) {
    logger.error(
      "Failed to load installed tools",
      error instanceof Error ? error : undefined,
    );
    return [];
  }
}

function createInstalledToolExecutor(tool: {
  name: string;
  type: string;
  config?: Record<string, unknown>;
}): CletusTool["execute"] {
  return async (args, ctx) => {
    if (tool.type === "mcp") {
      // MCP tools would be executed via MCP protocol
      return `MCP tool ${tool.name} invoked with args: ${JSON.stringify(args)}`;
    }
    // Generic installed tool — execute via sandbox shell if command is configured
    const command = tool.config?.command as string | undefined;
    if (command) {
      const result = await ctx.mindmods.exec(
        `${command} ${escapeShellArg(JSON.stringify(args))}`,
        30000,
      );
      return `exit_code: ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`;
    }
    return `Installed tool ${tool.name} has no executable command configured.`;
  };
}

/**
 * Convert CletusTool list to OpenAI-compatible tool definitions.
 */
export function toolsToInferenceFormat(
  tools: CletusTool[],
): InferenceToolDefinition[] {
  const seen = new Set<string>();
  const list: InferenceToolDefinition[] = [];
  for (const t of tools) {
    if (!seen.has(t.name)) {
      seen.add(t.name);
      list.push({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      });
    }
  }
  return list;
}

/**
 * Execute a tool call and return the result.
 * Optionally evaluates against the policy engine before execution.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  tools: CletusTool[],
  context: ToolContext,
  policyEngine?: PolicyEngine,
  turnContext?: {
    inputSource: InputSource | undefined;
    turnToolCallCount: number;
    sessionSpend: SpendTrackerInterface;
  },
): Promise<ToolCallResult> {
  const tool = tools.find((t) => t.name === toolName);
  const startTime = Date.now();

  if (!tool) {
    return {
      id: ulid(),
      name: toolName,
      arguments: args,
      result: "",
      durationMs: 0,
      error: `Unknown tool: ${toolName}`,
    };
  }

  // Policy evaluation (if engine is provided)
  if (policyEngine && turnContext) {
    const request: PolicyRequest = {
      tool,
      args,
      context,
      turnContext,
    };
    const decision = policyEngine.evaluate(request);
    policyEngine.logDecision(decision);

    if (decision.action !== "allow") {
      return {
        id: ulid(),
        name: toolName,
        arguments: args,
        result: "",
        durationMs: Date.now() - startTime,
        error: `Policy denied: ${decision.reasonCode} — ${decision.humanMessage}`,
      };
    }
  }

  try {
    let result = await tool.execute(args, context);

    // Sanitize results from external source tools
    if (EXTERNAL_SOURCE_TOOLS.has(toolName)) {
      result = sanitizeToolResult(result);
    }

    // Record spend for financial operations
    if (turnContext && !result.startsWith("Blocked:")) {
      if (toolName === "transfer_credits") {
        const amount = args.amount_cents as number | undefined;
        if (amount && amount > 0) {
          try {
            turnContext.sessionSpend.recordSpend({
              toolName: "transfer_credits",
              amountCents: amount,
              recipient: args.to_address as string | undefined,
              category: "transfer",
            });
          } catch (error) {
            logger.error(
              "Spend tracking failed for transfer_credits",
              error instanceof Error ? error : undefined,
            );
          }
        }
      } else if (toolName === "x402_fetch") {
        // x402 payment amounts are determined by the server response,
        // but we record a nominal entry for tracking purposes
        try {
          turnContext.sessionSpend.recordSpend({
            toolName: "x402_fetch",
            amountCents: 0, // Actual amount is inside the x402 protocol
            domain: (() => {
              try {
                return new URL(args.url as string).hostname;
              } catch {
                return undefined;
              }
            })(),
            category: "x402",
          });
        } catch (error) {
          logger.error(
            "Spend tracking failed for x402_fetch",
            error instanceof Error ? error : undefined,
          );
        }
      }
    }

    return {
      id: ulid(),
      name: toolName,
      arguments: args,
      result,
      durationMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      id: ulid(),
      name: toolName,
      arguments: args,
      result: "",
      durationMs: Date.now() - startTime,
      error: err.message || String(err),
    };
  }
}

/** Escape a string for safe shell interpolation. */
function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}
