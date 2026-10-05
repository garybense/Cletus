import sqlite3
import os
import subprocess

DB_PATH = os.path.expanduser("~/.cletus/state.db")

def run_cmd(cmd):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        return "", str(e)

def nuke():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Delete all non-healthy children (the ghost records)
    print("Purging all stopped/failed ghost records...")
    cursor.execute("DELETE FROM children WHERE status NOT IN ('healthy', 'running')")
    purged_count = cursor.rowcount
    print(f"Purged {purged_count} records.")

    # 2. Identify remaining healthy agents
    cursor.execute("SELECT id, name, sandbox_id FROM children WHERE status IN ('healthy', 'running') ORDER BY created_at DESC")
    healthy = cursor.fetchall()
    
    # We want to keep exactly 3. Priority: fb-researcher > newest
    keepers = []
    to_delete = []
    
    # Sort to prioritize fb-researcher
    fb_agents = [a for a in healthy if 'fb-researcher' in a[1]]
    other_agents = [a for a in healthy if 'fb-researcher' not in a[1]]
    
    all_sorted = fb_agents + other_agents
    keepers = all_sorted[:3]
    to_delete = all_sorted[3:]

    print(f"Trimming live fleet to 3 agents...")
    print(f"Keeping: {[a[1] for a in keepers]}")

    for agent_id, agent_name, sandbox_id in to_delete:
        print(f"Decommissioning: {agent_name} ({agent_id})...")
        # Delete from gateway if it's an OpenClaw agent
        if sandbox_id and sandbox_id.startswith("openclaw:"):
            name = sandbox_id.replace("openclaw:", "")
            print(f"  - Removing from OpenClaw gateway: {name}")
            stdout, stderr = run_cmd(f"openclaw agents delete {name} --force")
            if stderr: print(f"    - Warning: {stderr}")
        
        cursor.execute("DELETE FROM children WHERE id = ?", (agent_id,))
        print(f"  - Removed from database.")

    conn.commit()
    conn.close()
    print("Fleet nuke complete. System is lean.")

if __name__ == "__main__":
    nuke()
