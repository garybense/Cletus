import sqlite3
import os
import subprocess

DB_PATH = os.path.expanduser("~/.cletus/state.db")
MAX_AGENTS = 3

def run_cmd(cmd):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        return "", str(e)

def trim():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Fetch healthy/running agents sorted by creation date (newest last)
    cursor.execute("""
        SELECT id, name, sandbox_id FROM children 
        WHERE status IN ('healthy', 'running') 
        ORDER BY created_at ASC
    """)
    agents = cursor.fetchall()

    if len(agents) <= MAX_AGENTS:
        print(f"Fleet is already within limits ({len(agents)} agents).")
        conn.close()
        return

    to_prune = agents[:(len(agents) - MAX_AGENTS)]
    to_keep = agents[(len(agents) - MAX_AGENTS):]

    print(f"Trimming fleet from {len(agents)} down to {MAX_AGENTS}...")
    print(f"Keeping: {[a[1] for a in to_keep]}")

    for agent_id, agent_name, sandbox_id in to_prune:
        print(f"Decommissioning: {agent_name} ({agent_id})...")
        
        # 1. Delete from gateway if it's an OpenClaw agent
        if sandbox_id and sandbox_id.startswith("openclaw:"):
            name = sandbox_id.replace("openclaw:", "")
            print(f"  - Removing from OpenClaw gateway: {name}")
            stdout, stderr = run_cmd(f"openclaw agents delete {name} --force")
            if stderr: print(f"    - Warning: {stderr}")

        # 2. Delete from database
        cursor.execute("DELETE FROM children WHERE id = ?", (agent_id,))
        print(f"  - Removed from database.")

    conn.commit()
    conn.close()
    print("Fleet trim complete.")

if __name__ == "__main__":
    trim()
