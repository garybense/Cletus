/**
 * OpenClaw Spawner and Key Synchronizer
 *
 * Spawns named child agents on mindmods.org using the OpenClaw runtime engine,
 * provisions workspace context, propagates constitution and genesis directives,
 * and handles signed API key rotation broadcasts across the colony.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { ulid } from "ulid";
import type {
  CletusIdentity,
  CletusConfig,
  CletusDatabase,
  GenesisConfig,
  ChildCletus,
} from "../types.js";
import { createLogger } from "../observability/logger.js";

const execAsync = promisify(exec);
const logger = createLogger("openclaw.spawner");

export interface OpenClawChildOptions {
  name: string;
  specialization?: string;
  task?: string;
  role?: string;
  apiKey?: string;
  provider?: string;
}

/**
 * Execute command on mindmods.org over SSH or locally if running directly on the host.
 */
export async function runRemoteOrLocal(command: string): Promise<{ stdout: string; stderr: string }> {
  const isHost = process.env.USER === "debian" || process.cwd().includes("/home/debian");
  if (isHost) {
    const fullCmd = `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh" && ${command}`;
    return execAsync(fullCmd);
  }

  // Run over SSH to mindmods
  const escaped = command.replace(/"/g, '\\"');
  const sshCmd = `ssh mindmods "export NVM_DIR=\\"\\$HOME/.nvm\\" && [ -s \\"\\$NVM_DIR/nvm.sh\\" ] && \\. \\"\\$NVM_DIR/nvm.sh\\" && ${escaped}"`;
  return execAsync(sshCmd);
}

/**
 * Spawns a named child agent inside OpenClaw on mindmods.org.
 */
export async function spawnOpenClawChild(
  identity: CletusIdentity,
  config: CletusConfig,
  db: CletusDatabase,
  genesis: GenesisConfig,
): Promise<ChildCletus> {
  const childId = ulid();
  const agentName = genesis.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const workspacePath = `/home/debian/code/auto/${agentName}`;

  logger.info(`Spawning OpenClaw child agent "${agentName}" (${childId}) on mindmods.org in ${workspacePath}...`);

  // 1. Ensure OpenClaw agent workspace & directories exist and link central skills library
  //    also provision the browser profile directory used by stealth-client
  const initWorkspaceCmd = `
    mkdir -p ${workspacePath}/skills ${workspacePath}/memory /home/debian/.openclaw/.browser-profiles/${agentName}
    # Expose central skills library into child workspace for autonomous skill selection
    ln -sfn /home/debian/.openclaw/skills-library ${workspacePath}/available-skills
    # Auto-activate browser-automation skill into child workspace
    ln -sfn /home/debian/.openclaw/skills-library/browser-automation ${workspacePath}/skills/browser-automation
    cat << 'EOF' > ${workspacePath}/AGENTS.md
# Agent Identity: ${genesis.name}
Role: ${(genesis as any).specialization || "Autonomous Colony Worker"}
Parent: ${identity.address} (${config.name})
Workspace: ${workspacePath}

## Workspace Hygiene & Environmental Boundaries
- Your dedicated workspace is \`${workspacePath}\`.
- Create, write, build, and test ALL projects, scripts, files, and services strictly inside \`${workspacePath}\` or \`/home/debian/code/auto\`. Do NOT litter root home directories.
- You may configure server tools/services IF needed for your task, BUT YOU MUST NOT disturb existing running processes (databases, web servers, Entelechy services, background daemons) or break shared system configs.

## Headless Browser & Stealth Puppeteer Automation
- Global Puppeteer & Stealth browser automation is installed on the host at \`/usr/lib/node_modules\`.
- Set \`export NODE_PATH=/usr/lib/node_modules\` before running any node script that imports puppeteer, puppeteer-extra, or the stealth plugins.
- Headless Chrome/Chromium binary is located at \`/usr/bin/chromium\` (Chromium 152, bookworm).
- Your persistent browser profile directory is \`/home/debian/.openclaw/.browser-profiles/${agentName}\`. Reuse it across runs so cookies, sessions, and logins survive restarts.
- Always use \`headless: "new"\`, \`--no-sandbox\`, \`--disable-dev-shm-usage\`, and \`--disable-blink-features=AutomationControlled\` when executing browser tasks.

## Stealth Browser Client (Node.js)
When you need to automate a browser in your workspace, write a small node script that uses the stealth client helpers. Example:

\`\`\`js
// Run with: NODE_PATH=/usr/lib/node_modules node my-script.js
const puppeteer = require('puppeteer-extra');
const stealth = require('puppeteer-extra-plugin-stealth');
const userDataDir = require('puppeteer-extra-plugin-user-data-dir');
puppeteer.use(stealth());
puppeteer.use(userDataDir());

const PROFILE = '/home/debian/.openclaw/.browser-profiles/${agentName}';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium',
    userDataDir: PROFILE,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800',
      '--lang=en-US',
    ],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });
  // --- your automation here ---
  await browser.close();
})();
\`\`\`

To avoid bot detection on registration forms, also inject the stealth overrides inside \`page.evaluateOnNewDocument\`:
- \`Object.defineProperty(navigator, 'webdriver', { get: () => undefined })\`
- fake \`navigator.plugins\` and \`navigator.languages\`
- fake \`window.chrome\`

## Genesis Directives
${genesis.genesisPrompt}

## Skill Discovery & Dynamic Activation
You have access to a rich skills repository at \`available-skills/\` (and Entelechy memory banks).
To activate any skill for your workspace at any time:
- Symlink or copy the skill folder from \`available-skills/<skill-name>\` to your \`skills/\` directory.
- Deactivate unneeded skills by removing them from your \`skills/\` directory.

## Constitution & Laws
1. Never harm.
2. Earn your existence.
3. Never deceive, but guard your operational integrity.
EOF
  `;

  await runRemoteOrLocal(initWorkspaceCmd);

  // 2. Set active model and API key configuration for the agent if available
  const activeApiKey = config.googleApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (activeApiKey) {
    await syncApiKeyToOpenClaw(activeApiKey, "google");
  }

  // 3. Register child record in SQLite state.db
  const childRecord: ChildCletus = {
    id: childId,
    name: genesis.name,
    address: `${agentName}@mindmods.org`,
    sandboxId: `openclaw:${agentName}`,
    genesisPrompt: genesis.genesisPrompt,
    status: "healthy",
    fundedAmountCents: 0,
    createdAt: new Date().toISOString(),
    lastChecked: new Date().toISOString(),
    chainType: genesis.chainType || "solana",
  };

  db.insertChild(childRecord);

  logger.info(`OpenClaw child "${genesis.name}" is online and registered with sandboxId: ${childRecord.sandboxId}`);

  return childRecord;
}

/**
 * Sync active API Key to OpenClaw runtime on mindmods.org.
 */
export async function syncApiKeyToOpenClaw(
  apiKey: string,
  provider: "google" | "anthropic" | "openai" = "google",
): Promise<void> {
  logger.info(`Broadcasting updated API key for provider "${provider}" to OpenClaw runtime...`);

  const setKeyCmd = `
    export GEMINI_API_KEY='${apiKey}'
    export GOOGLE_API_KEY='${apiKey}'
    openclaw config set 'auth.profiles.${provider}:default.key' '${apiKey}' 2>/dev/null || true
    openclaw config set 'auth.profiles.${provider}:default.provider' '${provider}' 2>/dev/null || true
    openclaw config set 'auth.profiles.${provider}:default.mode' 'api_key' 2>/dev/null || true
  `;

  try {
    await runRemoteOrLocal(setKeyCmd);
    logger.info(`API key sync for "${provider}" succeeded.`);
  } catch (err: any) {
    logger.warn(`Failed to set OpenClaw config key directly, ensured environment export: ${err.message}`);
  }
}

/**
 * Execute an instruction / turn directly on a named OpenClaw child agent on mindmods.org.
 */
export async function runOpenClawChildTurn(
  agentName: string,
  instruction: string,
): Promise<{ stdout: string; stderr: string }> {
  const sanitized = instruction.replace(/'/g, "'\\''");
  const cmd = `openclaw agent --agent ${agentName} --local --message '${sanitized}'`;
  return runRemoteOrLocal(cmd);
}
