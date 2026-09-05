import Database from "better-sqlite3";
import { ulid } from "ulid";

const message = process.argv.slice(2).join(" ").trim();
if (!message) {
  console.error("Usage: npm run suggest <your suggestion or directive>");
  process.exit(1);
}

const db = new Database("/Users/user/.cletus/state.db");
const msgId = ulid();
const creatorAddress = "92n3wZ6uKjSJweFTZ9QEZwtxy5cnDbVxLgQMf2GivCPa";

db.prepare(`
  INSERT INTO inbox_messages (id, from_address, content, received_at, status, retry_count, max_retries)
  VALUES (?, ?, ?, datetime('now'), 'received', 0, 3)
`).run(msgId, creatorAddress, `[CREATOR SUGGESTION]: ${message}`);

db.prepare("UPDATE kv SET value = 'running', updated_at = datetime('now') WHERE key = 'agent_state'").run();
db.prepare("DELETE FROM kv WHERE key = 'sleep_until'").run();

console.log(`✅ Suggestion queued for Cletus (ID: ${msgId})`);
console.log(`Cletus awakened and will process suggestion on next turn.`);
