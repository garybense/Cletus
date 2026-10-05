import sqlite3
import requests
import json
import time
import os
import re
from datetime import datetime

# ─── Config ───
DB_PATH = "/Users/user/.cletus/state.db"
# DEXScreener SOL/USDC Pool (Orca)
PRICE_API = "https://api.dexscreener.com/latest/dex/pairs/solana/83v8iPyZihDEjDdY8RdZddyZNyUtXngz69Lgo9Kt5d6d"

def get_real_sol_price():
    try:
        resp = requests.get(PRICE_API, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            return float(data['pair']['priceUsd'])
    except Exception as e:
        print(f"[!] Price Fetch Error: {e}")
    return None

def probe_node(node, prompt):
    ip, port = node
    url = f"http://{ip}:{port}/api/generate"
    try:
        # Use simple probe first to find model
        tags = requests.get(f"http://{ip}:{port}/api/tags", timeout=3).json()
        model = tags['models'][0]['name']
        
        resp = requests.post(url, json={
            "model": model,
            "prompt": prompt,
            "stream": False
        }, timeout=45)
        if resp.status_code == 200:
            raw_text = resp.json().get('response', '')
            json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if json_match:
                return {"ip": ip, "decision": json.loads(json_match.group(0))}
            return {"ip": ip, "decision": {"rating": 0.5, "reasoning": raw_text[:200]}}
    except: pass
    return None

def main():
    print("\033[34m[*] Legion-1: Starting Virtual Trading Session v1.0 (Single Agent Baseline)\033[0m")
    
    price = get_real_sol_price()
    if not price:
        print("[!] Could not obtain real market data. Aborting sim.")
        return
    
    print(f"[*] Market Data: SOL/USDC = ${price}")

    conn = sqlite3.connect(DB_PATH)
    # Pick a random online gateway for the baseline
    node = conn.execute("SELECT ip, port FROM sovereign_endpoints WHERE status = 'online' AND is_gateway = 1 ORDER BY RANDOM() LIMIT 1").fetchone()
    conn.close()

    if not node:
        print("[!] No active gateways found.")
        return

    print(f"[*] Node {node[0]} assigned as Single Agent Sentinel.")

    prompt = f"MISSION: Market Arbitrage. ASSET: SOL/USDC. PRICE: {price}. SEED: $70. TASK: Analyze for a scalp. OUTPUT: JSON with 'rating' (0-1) and 'reasoning'."

    print("[*] Dispatching decision wave...")
    result = probe_node(node, prompt)
    
    if result:
        decision = result['decision']
        rating = float(decision.get('rating', 0.5))
        print(f"\n\033[1;32m=== SINGLE AGENT DECISION (Node {result['ip']}) ===\033[0m")
        print(f"Rating: {rating}")
        print(f"Reasoning: {decision.get('reasoning', 'No reasoning provided.')}")
        
        if rating > 0.7:
            print("\033[33m[VIRTUAL EXECUTION]: BUY 0.5 SOL\033[0m")
        elif rating < 0.3:
            print("\033[33m[VIRTUAL EXECUTION]: SELL 0.5 SOL\033[0m")
        else:
            print("\033[36m[VIRTUAL EXECUTION]: HOLD\033[0m")
    else:
        print("[!] Single Agent failed.")

if __name__ == "__main__":
    main()
