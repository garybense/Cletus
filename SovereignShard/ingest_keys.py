import sqlite3
import json
import os
import uuid

DB_PATH = os.path.expanduser("~/.cletus/state.db")
KEYS_FILE = "/Users/user/code/Cletus/key_test_results.json"

def ingest():
    if not os.path.exists(KEYS_FILE):
        print("Keys file not found.")
        return

    with open(KEYS_FILE, 'r') as f:
        data = json.load(f)
        working_keys = data.get('working_keys', [])

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    count = 0
    for entry in working_keys:
        key_val = entry.get('key')
        provider = entry.get('provider')
        key_type = entry.get('type')
        
        # Store in KnowledgeStore (survival category)
        key = f"api_key_{provider}_{count}"
        content = f"Provider: {provider}, Type: {key_type}, Key: {key_val}"
        
        cursor.execute("""
            INSERT INTO semantic_memory (id, category, key, value, confidence, source)
            VALUES (?, 'financial', ?, ?, 1.0, 'creator_provision')
            ON CONFLICT(category, key) DO UPDATE SET
                value = excluded.value,
                updated_at = datetime('now')
        """, (str(uuid.uuid4()), key, content))
        
        # Also set in persistent KV if it's the 'best' for that provider
        if count == 0: # Just take the first valid one for now
            kv_key = f"env_{provider.upper()}_API_KEY"
            if provider == "openrouter":
                kv_key = "env_OPENROUTER_API_KEY"
            elif provider == "nvidia":
                kv_key = "env_NVIDIA_API_KEY"
                
            cursor.execute("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))", (kv_key, key_val))

        count += 1

    conn.commit()
    conn.close()
    print(f"Ingested {count} working API keys into KnowledgeStore and KV.")

if __name__ == "__main__":
    ingest()
