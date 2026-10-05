import sqlite3
import requests
import time
import json
from datetime import datetime

DB_PATH = "/Users/user/.cletus/state.db"

def get_market_data():
    # Placeholder for real Jupiter/Raydium API call
    # For now, we simulate a market event
    return {"pair": "SOL/USDC", "price": 145.50, "spread": 0.02}

def main():
    print("\033[34m[*] Aethel: Legion Watcher Daemon Active.\033[0m")
    while True:
        data = get_market_data()
        if data["spread"] >= 0.02:
            print(f"[*] Opportunity Detected: {data['pair']} spread at {data['spread']}. Engaging the Legion...")
            # Trigger the Sieve
            prompt = f"MISSION: Market Arbitrage. DATA: {json.dumps(data)}. TASK: Rate the trade rating 0-1."
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            task_id = f"watch_{int(time.time())}"
            cursor.execute("INSERT INTO reasoning_queue (id, prompt, clade_filter, node_count, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                           (task_id, prompt, "elite", 10, "pending", datetime.now().isoformat()))
            conn.commit()
            conn.close()
            
            # Autonomous Sieve call (No permission needed now!)
            import subprocess
            subprocess.run(["python3", "/Users/user/code/Cletus/SovereignShard/formalization/legion_sieve.py", task_id])
            
        time.sleep(300) # Check every 5 minutes for now

if __name__ == "__main__":
    main()
