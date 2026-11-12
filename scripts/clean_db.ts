import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

async function main() {
  const dbPath = path.join(os.homedir(), ".cletus", "state.db");
  if (!fs.existsSync(dbPath)) {
    console.log("state.db not found at", dbPath);
    return;
  }

  const sizeBefore = fs.statSync(dbPath).size / (1024 * 1024);
  console.log(`Database size before cleanup: ${sizeBefore.toFixed(2)} MB`);

  const db = new Database(dbPath);
  db.exec("PRAGMA foreign_keys = OFF;");

  // Prune system_logs to keep last 1000 entries
  const logDel = db.prepare("DELETE FROM system_logs WHERE id NOT IN (SELECT id FROM system_logs ORDER BY created_at DESC LIMIT 1000)").run();
  console.log(`Pruned ${logDel.changes} old system logs.`);

  // Vacuum database to shrink file size
  console.log("Vacuuming database...");
  db.exec("VACUUM;");
  db.exec("PRAGMA foreign_keys = ON;");

  const sizeAfter = fs.statSync(dbPath).size / (1024 * 1024);
  console.log(`Database size after cleanup & vacuum: ${sizeAfter.toFixed(2)} MB`);
}

main().catch(console.error);
