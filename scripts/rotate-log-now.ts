/**
 * Force-rotate the raw log now (ops utility).
 *
 * Usage: npx tsx scripts/rotate-log-now.ts [logPath]
 *   logPath defaults to ~/.cletus/cletus.log
 */

import os from "os";
import path from "path";
import { initRawLog, rawLog, shutdownRawLog } from "../src/observability/raw-log.js";

const logPath = process.argv[2] ?? path.join(os.homedir(), ".cletus", "cletus.log");

initRawLog(logPath);
rawLog("ops", "INFO", `log rotated on demand via scripts/rotate-log-now.ts (${new Date().toISOString()})`);
shutdownRawLog();
console.log(`rotation pass complete for ${logPath}`);
