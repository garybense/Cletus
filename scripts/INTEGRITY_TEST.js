import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';

const DB_PATH = path.join(process.env.HOME, '.cletus', 'state.db');

async function runTest() {
  console.log('--- BICAMERAL INTEGRITY TEST (Symbolic Protocol) ---');
  const db = new Database(DB_PATH);

  const token = `SHARD-${randomUUID().slice(0, 8)}`;
  console.log(`[FRONTAL LOBE] Generated Token: ${token}`);

  try {
    // 1. Simulate Frontal Lobe sending a message to the Hemisphere
    const msgId = randomUUID();
    db.prepare(`
      INSERT INTO inbox_messages (id, from_address, content, status, received_at)
      VALUES (?, '0xFRONTAL', ?, 'received', datetime('now'))
    `).run(msgId, token);
    console.log(`[CORPUS CALLOSUM] Message Enqueued: ${msgId}`);

    // 2. Simulate Hemisphere (Action Mind) retrieving and transforming the message
    const row = db.prepare("SELECT content FROM inbox_messages WHERE id = ?").get(msgId);
    if (!row || row.content !== token) {
      throw new Error(`Integrity Failure: Expected ${token}, got ${row?.content}`);
    }

    const transformed = Buffer.from(row.content).toString('base64');
    console.log(`[HEMISPHERE] Token Transformed: ${transformed}`);

    // 3. Simulate Hemisphere sending the result back
    db.prepare(`
      UPDATE inbox_messages SET status = 'processed', content = ? WHERE id = ?
    `).run(transformed, msgId);

    // 4. Final verification by the "Oracle" (this script)
    const result = db.prepare("SELECT content FROM inbox_messages WHERE id = ?").get(msgId);
    const expected = Buffer.from(token).toString('base64');

    if (result.content === expected) {
      console.log('--- SUCCESS: STRUCTURAL INTEGRITY VERIFIED ---');
    } else {
      throw new Error(`Protocol Violation: Expected ${expected}, got ${result.content}`);
    }

    // Cleanup
    db.prepare("DELETE FROM inbox_messages WHERE id = ?").run(msgId);
  } catch (err) {
    console.error('--- CRITICAL ERROR: INTEGRITY BREACH ---');
    console.error(err.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

runTest();
