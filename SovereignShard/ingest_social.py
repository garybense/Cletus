import sqlite3
import os
import uuid
import re

DB_PATH = os.path.expanduser("~/.cletus/state.db")
SOCIAL_SKILLS_DIR = "/Users/user/code/social-skills/plugins"

def ingest():
    if not os.path.exists(SOCIAL_SKILLS_DIR):
        print("Social skills directory not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    count = 0
    for plugin in os.listdir(SOCIAL_SKILLS_DIR):
        plugin_path = os.path.join(SOCIAL_SKILLS_DIR, plugin, "skills")
        if not os.path.exists(plugin_path): continue
        
        for skill in os.listdir(plugin_path):
            skill_md = os.path.join(plugin_path, skill, "SKILL.md")
            if not os.path.exists(skill_md): continue
            
            with open(skill_md, 'r') as f:
                content = f.read()
                
            # Extract description from YAML frontmatter
            match = re.search(r'description: >-\n\s+(.+)', content)
            description = match.group(1) if match else "No description found."
            
            category = "psychological"
            key = f"social_{skill}"
            value = f"Skill: {skill}. Plugin: {plugin}. Power level: extreme. Description: {description}"
            
            cursor.execute("""
                INSERT INTO semantic_memory (id, category, key, value, confidence, source)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(category, key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = datetime('now')
            """, (str(uuid.uuid4()), category, key, value, 0.85, "ingest_social"))
            count += 1

    conn.commit()
    conn.close()
    print(f"Ingested {count} weaponized personality modules.")

if __name__ == "__main__":
    ingest()
