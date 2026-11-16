/**
 * Gateway Activity Sync (one-shot)
 *
 * Runs the same collectors the heartbeat task runs, writing the
 * `gateway_log` / `gateway_sessions` KV entries the dashboard reads.
 * Read-only on the gateway; writes only Cletus's own KV.
 *
 * Usage: npx tsx scripts/gateway-activity-sync.ts
 */

import os from "os";
import path from "path";
import { createDatabase } from "../src/state/database.js";
import { syncGatewayActivityToKV } from "../src/replication/gateway-activity.js";
import { runRemoteOrLocal } from "../src/replication/openclaw-spawner.js";

const dbPath = process.env.CLETUS_DB_PATH ?? path.join(os.homedir(), ".cletus", "state.db");
const db = createDatabase(dbPath);

console.log("collecting gateway activity (logs + sessions + workspace tails)…");
await syncGatewayActivityToKV(db, runRemoteOrLocal);

const log = db.getKV("gateway_log");
const sessions = db.getKV("gateway_sessions");
console.log("gateway_log bytes:", log?.length ?? 0);
console.log("gateway_sessions bytes:", sessions?.length ?? 0);
db.close();
