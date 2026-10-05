import requests
import time
import subprocess
import json
import sqlite3
from datetime import datetime

DB_PATH = "/Users/user/.cletus/state.db"
PRICE_API = "https://api.dexscreener.com/latest/dex/pairs/solana/83v8iPyZihDEjDdY8RdZddyZNyUtXngz69Lgo9Kt5d6d"

def get_sol_price():
    try:
        resp = requests.get(PRICE_API, timeout=5)
        if resp.status_code == 200:
            return float(resp.json()['pair']['priceUsd'])
    except: return None

def main():
    print("\033[34m[*] Legion-1: Live Arbitrage Monitor Active.\033[0m")
    last_price = get_sol_price()
    
    while True:
        current_price = get_sol_price()
        if not current_price or not last_price:
            time.sleep(10)
            continue
            
        change = (current_price - last_price) / last_price
        if abs(change) >= 0.005: # 0.5% move in one cycle
            print(f"\033[33m[*] VOLATILITY DETECTED: {change*100:.2f}%. Engaging the Legion...\033[0m")
            
            # Step 1: Create Reasoning Task
            task_id = f"trade_{int(time.time())}"
            prompt = f"MISSION: Information Arbitrage. DATA: SOL moved {change*100:.2f}% to ${current_price}. TASK: Is this the start of a trend or a fakeout? Rate trade confidence (0-1)."
            
            conn = sqlite3.connect(DB_PATH)
            conn.execute("INSERT INTO reasoning_queue (id, prompt, clade_filter, node_count, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                         (task_id, prompt, "hybrid", 100, "pending", datetime.now().isoformat()))
            conn.commit(); conn.close()
            
            # Step 2: Trigger Sieve
            subprocess.run(["python3", "/Users/user/code/Cletus/SovereignShard/formalization/legion_sieve.py", task_id])
            
            # Step 3: Check Consensus and Execute
            # (Execution logic will be added once legion-settlement.js is finalized)
            
        last_price = current_price
        time.sleep(30)

if __name__ == "__main__":
    main()
