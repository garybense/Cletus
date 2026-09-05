import Database from 'better-sqlite3';
import { 
  CREATE_TABLES, SCHEMA_VERSION, 
  MIGRATION_V2, MIGRATION_V3, MIGRATION_V4, MIGRATION_V4_ALTER, 
  MIGRATION_V4_ALTER2, MIGRATION_V4_ALTER_INBOX_STATUS, 
  MIGRATION_V4_ALTER_RETRY, MIGRATION_V4_ALTER_MAX_RETRIES,
  MIGRATION_V5, MIGRATION_V6, MIGRATION_V7, MIGRATION_V8, 
  MIGRATION_V9, MIGRATION_V9_ALTER_CHILDREN_ROLE, 
  MIGRATION_V10, MIGRATION_V11, MIGRATION_V12 
} from '../src/state/schema.js';

const dbPath = process.env.CLETUS_DB || 'state.db';
console.log(`Initializing database: ${dbPath}`);

const db = new Database(dbPath);

try {
  // Create base tables
  db.exec(CREATE_TABLES);
  db.exec(MIGRATION_V2);
  db.exec(MIGRATION_V3);
  db.exec(MIGRATION_V4);
  db.exec(MIGRATION_V4_ALTER);
  db.exec(MIGRATION_V4_ALTER2);
  db.exec(MIGRATION_V4_ALTER_INBOX_STATUS);
  db.exec(MIGRATION_V4_ALTER_RETRY);
  db.exec(MIGRATION_V4_ALTER_MAX_RETRIES);
  db.exec(MIGRATION_V5);
  db.exec(MIGRATION_V6);
  db.exec(MIGRATION_V7);
  db.exec(MIGRATION_V8);
  db.exec(MIGRATION_V9);
  db.exec(MIGRATION_V9_ALTER_CHILDREN_ROLE);
  db.exec(MIGRATION_V10);
  db.exec(MIGRATION_V11);
  db.exec(MIGRATION_V12);

  // Set schema version
  db.exec(`INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (${SCHEMA_VERSION}, datetime('now'))`);

  console.log('Database initialized with schema version', SCHEMA_VERSION);
  
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('Tables created:', tables.map(t => t.name).join(', '));
  
  // Set initial agent state
  db.exec("INSERT OR REPLACE INTO kv (key, value) VALUES ('agent_state', 'sleeping')");
  db.exec("INSERT OR REPLACE INTO kv (key, value) VALUES ('start_time', datetime('now'))");
  
  console.log('Initial state set');
} catch (err) {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
} finally {
  db.close();
}
