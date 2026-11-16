import Database from "better-sqlite3";
import path from "path";
import os from "os";

async function main() {
  const dbPath = path.join(os.homedir(), ".cletus", "state.db");
  const db = new Database(dbPath);

  const logs = db.prepare("SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 30").all();
  console.log(`Found ${logs.length} recent log entries in system_logs:`);
  for (const log of logs.reverse()) {
    console.log(`[${log.timestamp}] [${log.level}] [${log.module}] ${log.message}`);
  }
}

main().catch(console.error);
