/**
 * Fleet Census CLI (read-only)
 *
 * Reconciles the children registry against the live OpenClaw gateway and host
 * workspaces, then prints a ranked destroy-candidate report. Performs NO
 * writes — the actual destroy flow goes through destroy_child + policy engine.
 *
 * Usage: npx tsx scripts/fleet-census.ts
 */

import Database from "better-sqlite3";
import os from "node:os";
import path from "node:path";
import { homedir } from "node:os";
import { gatherFleetCensus, type RegistryChild } from "../src/replication/fleet-census.js";
import { createDefaultCensusIO } from "../src/replication/fleet-census-io.js";

const dbPath = process.env.CLETUS_DB_PATH ?? path.join(homedir(), ".cletus", "state.db");
const raw = new Database(dbPath, { readonly: true });

const rows = raw
  .prepare(`SELECT id, name, status, sandbox_id, created_at FROM children ORDER BY created_at`)
  .all() as Array<{ id: string; name: string; status: string; sandbox_id: string | null; created_at: string }>;

const registry: RegistryChild[] = rows.map((r) => ({
  id: r.id,
  name: r.name,
  status: r.status,
  sandboxId: r.sandbox_id,
  createdAt: r.created_at,
}));

const io = createDefaultCensusIO();
const census = await gatherFleetCensus(registry, io);

console.log("=== Fleet Census ===");
console.log(`registry rows:     ${census.summary.registered}`);
console.log(`gateway agents:    ${census.summary.gatewayAgents}`);
console.log(`host workspaces:   ${census.summary.workspaces}`);
console.log(`confirmed:         ${census.summary.confirmed}`);
console.log(`workspace_only:    ${census.summary.workspaceOnly}`);
console.log(`phantom:           ${census.summary.phantom}`);
console.log(`duplicate names:   ${census.summary.duplicates}`);
console.log("");

console.log(`=== Destroy candidates (${census.candidates.length}) — ranked ===`);
const top = census.candidates.slice(0, 15);
for (const c of top) {
  console.log(`#${c.rank} [${c.reconcile}] ${c.name} (${c.id})`);
  for (const r of c.reasons) console.log(`    - ${r}`);
}
if (census.candidates.length > top.length) {
  console.log(`… and ${census.candidates.length - top.length} more`);
}

console.log("");
console.log("Registry status breakdown:");
const byStatus = new Map<string, number>();
for (const child of census.children) byStatus.set(child.status, (byStatus.get(child.status) ?? 0) + 1);
for (const [status, n] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${status}: ${n}`);
}

raw.close();
