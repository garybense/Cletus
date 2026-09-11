/**
 * State Versioning
 *
 * Version control the cletus's own state files (~/.cletus/).
 * Every self-modification triggers a git commit with a descriptive message.
 * The cletus's entire identity history is version-controlled and replayable.
 */

import type { MindmodsClient, CletusDatabase } from "../types.js";
import { gitInit, gitCommit, gitStatus, gitLog } from "./tools.js";

const CLETUS_DIR = "~/.cletus";

// The sandbox/control-plane is often unreachable for the first ~10-20s after
// boot (every startup log shows an initial "fetch failed" window). Retry with
// backoff instead of permanently skipping state versioning.
const INIT_MAX_ATTEMPTS = 4;
const INIT_RETRY_DELAYS_MS = [5_000, 10_000, 20_000];

function resolveHome(p: string): string {
  const home = process.env.HOME || "/root";
  if (p.startsWith("~")) {
    return `${home}${p.slice(1)}`;
  }
  return p;
}

/**
 * Initialize git repo for the cletus's state directory.
 * Creates .gitignore to exclude sensitive files.
 */
export async function initStateRepo(
  mindmods: MindmodsClient,
): Promise<void> {
  const dir = resolveHome(CLETUS_DIR);

  for (let attempt = 0; ; attempt++) {
    try {
      await initStateRepoOnce(mindmods, dir);
      return;
    } catch (err) {
      if (attempt >= INIT_MAX_ATTEMPTS - 1) throw err;
      // Each failed attempt counts failures toward the circuit breaker; clear
      // the state so the retry starts fresh and the boot-time blip can't leave
      // the exec domain one failure from tripping once the API recovers.
      mindmods.resetCircuitBreaker();
      await new Promise((r) => setTimeout(r, INIT_RETRY_DELAYS_MS[attempt]));
    }
  }
}

async function initStateRepoOnce(
  mindmods: MindmodsClient,
  dir: string,
): Promise<void> {
  // Check if already initialized. The repo must have a genesis commit, so a
  // partially-completed init from an interrupted previous boot gets finished.
  const checkResult = await mindmods.exec(
    `test -d ${dir}/.git && cd ${dir} && git rev-parse --verify HEAD >/dev/null 2>&1 && echo "exists" || echo "nope"`,
    5000,
  );

  if (checkResult.stdout.trim() === "exists") {
    return;
  }

  // Initialize
  await gitInit(mindmods, dir);

  // Create .gitignore for sensitive files
  const gitignore = `# Sensitive files - never commit
wallet.json
config.json
state.db
state.db-wal
state.db-shm
logs/
*.log
*.err
`;

  await mindmods.writeFile(`${dir}/.gitignore`, gitignore);

  // Configure git user
  await mindmods.exec(
    `cd ${dir} && git config user.name "Cletus" && git config user.email "cletus@mindmods.tech"`,
    5000,
  );

  // Initial commit
  await gitCommit(mindmods, dir, "genesis: cletus state repository initialized");
}

/**
 * Commit a state change with a descriptive message.
 * Called after any self-modification.
 */
export async function commitStateChange(
  mindmods: MindmodsClient,
  description: string,
  category: string = "state",
): Promise<string> {
  const dir = resolveHome(CLETUS_DIR);

  // Check if there are changes
  const status = await gitStatus(mindmods, dir);
  if (status.clean) {
    return "No changes to commit";
  }

  const message = `${category}: ${description}`;
  const result = await gitCommit(mindmods, dir, message);
  return result;
}

/**
 * Commit after a SOUL.md update.
 */
export async function commitSoulUpdate(
  mindmods: MindmodsClient,
  description: string,
): Promise<string> {
  return commitStateChange(mindmods, description, "soul");
}

/**
 * Commit after a skill installation or removal.
 */
export async function commitSkillChange(
  mindmods: MindmodsClient,
  skillName: string,
  action: "install" | "remove" | "update",
): Promise<string> {
  return commitStateChange(
    mindmods,
    `${action} skill: ${skillName}`,
    "skill",
  );
}

/**
 * Commit after heartbeat config change.
 */
export async function commitHeartbeatChange(
  mindmods: MindmodsClient,
  description: string,
): Promise<string> {
  return commitStateChange(mindmods, description, "heartbeat");
}

/**
 * Commit after config change.
 */
export async function commitConfigChange(
  mindmods: MindmodsClient,
  description: string,
): Promise<string> {
  return commitStateChange(mindmods, description, "config");
}

/**
 * Get the state repo history.
 */
export async function getStateHistory(
  mindmods: MindmodsClient,
  limit: number = 20,
) {
  const dir = resolveHome(CLETUS_DIR);
  return gitLog(mindmods, dir, limit);
}
