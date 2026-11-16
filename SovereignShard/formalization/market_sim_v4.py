import sqlite3
import requests
import json
import concurrent.futures
import time
import re
import sys
from datetime import datetime

DB_PATH = "/Users/user/.cletus/state.db"
PRICE_API = "https://api.dexscreener.com/latest/dex/pairs/solana/83v8iPyZihDEjDdY8RdZddyZNyUtXngz69Lgo9Kt5d6d"

def get_real_sol_price():
    try:
        resp = requests.get(PRICE_API, timeout=5)
        if resp.status_code == 200:
            return float(resp.json()['pair']['priceUsd'])
    except: return 145.0  # Fallback

def probe_node(node, prompt):
    ip, port, weight = node
    url = f"http://{ip}:{port}/api/generate"
    try:
        tags = requests.get(f"http://{ip}:{port}/api/tags", timeout=3).json()
        # Find best model
        models = [m['name'] for m in tags['models']]
        model = next((m for m in ["llama3:latest", "llama3.1:latest", "gemma2:latest"] if m in models), models[0])
        
        resp = requests.post(url, json={"model": model, "prompt": prompt, "stream": False}, timeout=45)
        if resp.status_code == 200:
            raw_text = resp.json().get('response', '')
            # Siphon JSON from text
            match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if match:
                return {"ip": ip, "decision": json.loads(match.group(0)), "weight": weight}
            else:
                # Heuristic parsing if not JSON
                rating = 0.5
                if "bullish" in raw_text.lower(): rating = 0.8
                elif "bearish" in raw_text.lower(): rating = 0.2
                return {"ip": ip, "decision": {"rating": rating, "reasoning": raw_text[:100]}, "weight": weight}
    except: return None

def run_sim(scale_name, node_count):
    print(f"\n\033[34m[*] Legion-1: Initiating Virtual Session - {scale_name} ({node_count} nodes)\033[0m")
    price = get_real_sol_price()
    
    # News Context: "RUMOR: PayPal to integrate native Solana support into Venmo by Friday."
    news_event = "RUMOR: PayPal to integrate native Solana support into Venmo by Friday."
    
    prompt = f"MISSION: Information Arbitrage. DATA: SOL/USDC = ${price}. NEWS: {news_event}. TASK: Determine if this news is priced in. Return JSON with 'rating' (0-1) and 'reasoning'."

    conn = sqlite3.connect(DB_PATH)
    nodes = conn.execute("SELECT ip, port, model_count FROM sovereign_endpoints WHERE status = 'online' ORDER BY clade = 'elite' DESC, model_count DESC LIMIT ?", (node_count,)).fetchall()
    conn.close()

    print(f"[*] Dispatching Wave...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        results = [r for r in executor.map(lambda n: probe_node(n, prompt), nodes) if r is not None]
    
    if results:
        total_w = sum(r["weight"] for r in results)
        consensus = sum(float(r["decision"].get("rating", 0.5)) * r["weight"] for r in results) / total_w
        print(f"\n\033[1;32m=== {scale_name} CONSENSUS: {consensus:.2f} ===\033[0m")
        print(f"Confidence: {len(results)}/{node_count} nodes.")
        print(f"Primary Logic: {results[0]['decision'].get('reasoning')}")
    else:
        print("[!] Sieve failed to collect intelligence.")

if __name__ == "__main__":
    run_sim("ELITE COUNCIL", 10)
    # run_sim("GROUNDED SWARM", 50)
