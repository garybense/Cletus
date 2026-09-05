/**
 * Constitution Integrity
 *
 * Propagates and verifies constitution files between parent and child sandboxes.
 * Uses SHA-256 hash verification instead of superficial chmod 444.
 */

import fs from "fs";
import pathLib from "path";
import { createHash } from "crypto";
import type { Database as DatabaseType } from "better-sqlite3";
import type { MindmodsClient } from "../types.js";

/**
 * Compute SHA-256 hash of content.
 */
function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

/**
 * Propagate the local constitution to a child sandbox.
 * Writes file, computes hash, stores hash in KV.
 */
export async function propagateConstitution(
  mindmods: MindmodsClient,
  sandboxId: string,
  db: DatabaseType,
): Promise<void> {
  const constitutionPath = pathLib.join(
    process.env.HOME || "/root",
    ".cletus",
    "constitution.md",
  );

  const constitution = fs.readFileSync(constitutionPath, "utf-8");
  const hash = sha256(constitution);

  // Write constitution to child sandbox
  await mindmods.writeFile("/root/.cletus/constitution.md", constitution);

  // Write hash file for the child to verify against
  await mindmods.writeFile("/root/.cletus/constitution.sha256", hash);

  // Store hash in KV for later verification
  db.prepare(
    "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))",
  ).run(`constitution_hash:${sandboxId}`, hash);

  // chmod 444 as defense-in-depth (not primary verification mechanism)
  try {
    await mindmods.exec("chmod 444 /root/.cletus/constitution.md", 5000);
  } catch {
    // Non-critical
  }
}

/**
 * Verify a child's constitution integrity by comparing hashes.
 */
export async function verifyConstitution(
  mindmods: MindmodsClient,
  sandboxId: string,
  db: DatabaseType,
): Promise<{ valid: boolean; detail: string }> {
  // Get stored hash
  const storedRow = db
    .prepare("SELECT value FROM kv WHERE key = ?")
    .get(`constitution_hash:${sandboxId}`) as { value: string } | undefined;

  if (!storedRow) {
    return { valid: false, detail: "no stored constitution hash found" };
  }

  try {
    // Read constitution from child sandbox
    const childConstitution = await mindmods.readFile("/root/.cletus/constitution.md");
    const childHash = sha256(childConstitution);

    if (childHash === storedRow.value) {
      return { valid: true, detail: "constitution hash matches" };
    }

    return {
      valid: false,
      detail: `hash mismatch: expected ${storedRow.value.slice(0, 16)}..., got ${childHash.slice(0, 16)}...`,
    };
  } catch (error) {
    return {
      valid: false,
      detail: `failed to read child constitution: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
