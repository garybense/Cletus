import Database from 'better-sqlite3';
import * as schema from '../src/state/schema.js';

const dbPath = process.env.CLETUS_DB || 'state.db';
console.log(`Initializing database: ${dbPath}`);

// Destructure needed exports
const { CREATE_TABLES, SCHEMA_VERSION } = schema;

const db = new Database(dbPath);

try {
  // Create base tables
  db.exec(CREATE_TABLES);
  console.log('  ✓ Base tables');
  
  // Run migrations with duplicate handling
  const migrations = [
    [schema.MIGRATION_V2, 'V2: Skills/Children/Registry'],
    [schema.MIGRATION_V3, 'V3: Inbox messages'],
    [schema.MIGRATION_V4, 'V4: Policy & spend tracking'],
    [schema.MIGRATION_V4_ALTER, 'V4a: Inbox to_address'],
    [schema.MIGRATION_V4_ALTER2, 'V4b: Inbox raw_content'],
    [schema.MIGRATION_V4_ALTER_INBOX_STATUS, 'V4c: Inbox status'],
    [schema.MIGRATION_V5, 'V5: Soul & Memory'],
    [schema.MIGRATION_V6, 'V6: Inference costs'],
    [schema.MIGRATION_V7, 'V7: Replication lifecycle'],
    [schema.MIGRATION_V8, 'V8: Metric snapshots'],
    [schema.MIGRATION_V9, 'V9: Goals & tasks'],
    [schema.MIGRATION_V9_ALTER_CHILDREN_ROLE, 'V9a: Children role column'],
    [schema.MIGRATION_V10, 'V10: Knowledge store'],
    [schema.MIGRATION_V11, 'V11: Children chain_type'],
    [schema.MIGRATION_V12, 'V12: Turns reasoning'],
  ];
  
  for (const [migration, name] of migrations) {
    try {
      db.exec(migration);
      console.log(`  ✓ ${name}`);
    } catch (err: any) {
      if (err.message.includes('duplicate')) {
        console.log(`  ⊘ ${name} (already applied)`);
      } else {
        throw err;
      }
    }
  }

  // Set schema version
  db.exec(`INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (${SCHEMA_VERSION}, datetime('now'))`);

  console.log(`\nDatabase initialized with schema version ${SCHEMA_VERSION}`);
  
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('Tables:', tables.map(t => t.name).join(', '));
  
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
