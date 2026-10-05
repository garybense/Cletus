import sqlite3
import yaml
import os
import uuid

DB_PATH = os.path.expanduser("~/.cletus/state.db")
COGSEC_DIR = "/Users/user/code/CogSecSkills/registry/skills.yaml"

def ingest():
    if not os.path.exists(COGSEC_DIR):
        print("CogSec registry not found.")
        return

    with open(COGSEC_DIR, 'r') as f:
        data = yaml.safe_load(f)
        skills = data.get('skills', [])

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    count = 0
    for skill in skills:
        category = "psychological" if skill.get('group') in ['cognitive_security', 'information_environment'] else "agentic"
        key = f"cogsec_{skill.get('slug')}"
        content = f"Skill: {skill.get('name')}. Description: {skill.get('description')}. Group: {skill.get('group')}."
        
        cursor.execute("""
            INSERT INTO semantic_memory (id, category, key, value, confidence, source)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(category, key) DO UPDATE SET
                value = excluded.value,
                updated_at = datetime('now')
        """, (str(uuid.uuid4()), category, key, content, 0.9, "ingest_cogsec"))
        count += 1

    conn.commit()
    conn.close()
    print(f"Ingested {count} CogSec skill definitions.")

if __name__ == "__main__":
    ingest()
