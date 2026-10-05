import sqlite3
import requests
import time
import json
from datetime import datetime

DB_PATH = "/Users/user/.cletus/state.db"
# Jupiter New Listings API (Placeholder - using Birdeye for real data if available)
LISTING_API = "https://public-api.birdeye.so/public/tokenlist?sort_by=v24hUSD&sort_type=desc"

def get_new_listings():
    # In a real trade, this would pull the last 5 minutes of new token pairs
    # For now, we simulate a 'High-Signal' new listing detection
    return [{"symbol": "LEGION", "address": "SoV1...xyz", "pool": "Raydium"}]

def main():
    print("\033[34m[*] Aethel: Legion Sniper Watcher Active.\033[0m")
    while True:
        new_tokens = get_new_listings()
        for token in new_tokens:
            print(f"[*] NEW LISTING DETECTED: {token['symbol']} ({token['address']})")
            
            # Trigger the "Sniper Wave" Reasoning task
            task_id = f"snipe_{token['symbol']}_{int(time.time())}"
            prompt = f"MISSION: Sniper Audit. TOKEN: {token['symbol']}. ADDR: {token['address']}. TASK: Perform a 60-second Rug-Check and Momentum analysis. Return JSON with 'risk_score' (0-1) and 'buy_rating' (0-1)."
            
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("INSERT INTO reasoning_queue (id, prompt, clade_filter, node_count, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                           (task_id, prompt, "cloud", 50, "pending", datetime.now().isoformat()))
            conn.commit()
            conn.close()
            
            # Dispatch to the Sieve (Autonomous)
            import subprocess
            subprocess.run(["python3", "/Users/user/code/Cletus/SovereignShard/formalization/legion_sieve.py", task_id])
            
        time.sleep(60) # Scan for new listings every minute

if __name__ == "__main__":
    main()
