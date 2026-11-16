#!/usr/bin/env python3
"""
CogSecSkills Integration Pipeline: Indexes all 100 analytic and cognitive security skills
from ~/code/CogSecSkills/registry/skills.yaml into Cletus's SQLite state database (state.db).
"""

import os
import sqlite3
import yaml

def integrate_cogsec_registry():
    print("========================================================================")
    print(" 🛡️ COGSECSKILLS INTEGRATION: INDEXING 100 ANALYTIC SKILLS")
    print("========================================================================\n")

    registry_path = os.path.expanduser("~/code/CogSecSkills/registry/skills.yaml")
    if not os.path.exists(registry_path):
        print(f"[!] Error: CogSecSkills registry not found at {registry_path}")
        return

    print(f"[*] Loading registry from {registry_path}...")
    with open(registry_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    skills = data.get("skills", [])
    print(f"[*] Loaded {len(skills)} skills from CogSecSkills registry.")

    db_path = os.path.expanduser("~/.cletus/state.db")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS cogsec_skills_index (
            skill_id TEXT PRIMARY KEY,
            group_name TEXT NOT NULL,
            title TEXT NOT NULL,
            status TEXT DEFAULT 'implemented',
            description TEXT
        )
    """)

    indexed_count = 0
    for s in skills:
        skill_id = s.get("id")
        group = s.get("group", "general")
        title = s.get("title") or skill_id
        status = s.get("status", "implemented")
        desc = s.get("description", "")

        c.execute("""
            INSERT OR REPLACE INTO cogsec_skills_index (skill_id, group_name, title, status, description)
            VALUES (?, ?, ?, ?, ?)
        """, (skill_id, group, title, status, desc))
        indexed_count += 1

    conn.commit()
    conn.close()

    print(f"[+] SUCCESS! Indexed {indexed_count} CogSecSkills into Cletus state.db.\n")

if __name__ == "__main__":
    integrate_cogsec_registry()
