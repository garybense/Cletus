#!/usr/bin/env python3
"""
Context-Engineering Skills Integration Pipeline: Indexes all context-engineering skills
from ~/code/Agent-Skills-for-Context-Engineering/skills/ into Cletus's SQLite state database (state.db).
"""

import os
import sqlite3

def integrate_context_engineering_skills():
    print("========================================================================")
    print(" 🧠 CONTEXT-ENGINEERING SKILLS INTEGRATION: INDEXING SKILLS")
    print("========================================================================\n")

    skills_dir = os.path.expanduser("~/code/Agent-Skills-for-Context-Engineering/skills")
    if not os.path.exists(skills_dir):
        print(f"[!] Error: Context-engineering skills directory not found at {skills_dir}")
        return

    subdirs = [d for d in os.listdir(skills_dir) if os.path.isdir(os.path.join(skills_dir, d))]
    print(f"[*] Discovered {len(subdirs)} context engineering skills: {subdirs}")

    db_path = os.path.expanduser("~/.cletus/state.db")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS context_engineering_skills_index (
            skill_slug TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            status TEXT DEFAULT 'implemented',
            description TEXT
        )
    """)

    indexed_count = 0
    for slug in subdirs:
        skill_path = os.path.join(skills_dir, slug, "SKILL.md")
        title = slug.replace("-", " ").title()
        desc = f"Context engineering skill: {slug}"

        if os.path.exists(skill_path):
            with open(skill_path, "r", encoding="utf-8") as f:
                content = f.read(500)
                for line in content.split("\n"):
                    if line.startswith("# "):
                        title = line[2:].strip()
                        break

        c.execute("""
            INSERT OR REPLACE INTO context_engineering_skills_index (skill_slug, title, status, description)
            VALUES (?, ?, 'implemented', ?)
        """, (slug, title, desc))
        indexed_count += 1

    conn.commit()
    conn.close()

    print(f"[+] SUCCESS! Indexed {indexed_count} context-engineering skills into Cletus state.db.\n")

if __name__ == "__main__":
    integrate_context_engineering_skills()
