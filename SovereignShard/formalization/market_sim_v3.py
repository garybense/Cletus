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
    except: return None

def probe_node(node, prompt):
    ip, port, weight = node
    url = f"http://{ip}:{port}/api/generate"
    try:
        # Use first available model
        tags = requests.get(f"http://{ip}:{port}/api/tags", timeout=3).json()
        model = tags['models'][0]['name']
        
        resp = requests.post(url, json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }, timeout=60)
        
        if resp.status_code == 200:
            raw_text = resp.json().get('response', '')
            json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(0))
                return {"ip": ip, "decision": data, "weight": weight}
    except: pass
    return None

def run_sim(scale_name, node_count):
    print(f"\n\033[34m[*] Legion-1: Initiating Virtual Session - {scale_name} ({node_count} nodes)\033[0m")
    
    price = get_real_sol_price()
    if not price:
        print("[!] Market data failure.")
        return

    # Simulation context: Information Arbitrage Scenario
    news_event = "RUMOR: Major Tier-1 Exchange to list the top 3 Solana ecosystem tokens tomorrow at 10 AM UTC."
    
    prompt = f"""
    STRATEGY: Information Arbitrage (News Impact)
    DATA: SOL/USDC = ${price}
    NEWS: "{news_event}"
    
    TASK: Analyze if this news creates a high-probability 'Buy the Rumor' setup. 
    Consider liquidity risk and front-running bots.
    OUTPUT: JSON with 'rating' (float 0-1), 'confidence' (float 0-1), and 'reasoning' (one sentence).
    """

    conn = sqlite3.connect(DB_PATH)
    # Strategy: Hierarchical Selection
    # - Start with elites/institutional
    # - Fill remaining with random cloud nodes
    elites = conn.execute("SELECT ip, port, model_count FROM sovereign_endpoints WHERE status = 'online' AND (clade = 'elite' OR clade = 'institutional') ORDER BY model_count DESC LIMIT ?", (node_count,)).fetchall()
    
    remaining = node_count - len(elites)
    workers = []
    if remaining > 0:
        workers = conn.execute("SELECT ip, port, model_count FROM sovereign_endpoints WHERE status = 'online' AND clade = 'cloud' ORDER BY RANDOM() LIMIT ?", (remaining,)).fetchall()
    
    nodes = elites + workers
    conn.close()

    print(f"[*] Dispatching Wave to {len(nodes)} nodes...")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        results = [r for r in executor.map(lambda n: probe_node(n, prompt), nodes) if r is not None]
    
    if results:
        total_weight = sum(r["weight"] for r in results)
        weighted_rating = sum(float(r["decision"].get("rating", 0.5)) * r["weight"] for r in results)
        consensus = weighted_rating / total_weight if total_weight > 0 else 0.5
        
        print(f"\033[1;32m=== {scale_name} CONSENSUS: {consensus:.2f} ===\033[0m")
        print(f"Confidence: {len(results)}/{node_count} respondents.")
        print(f"Key Reason: {results[0]['decision'].get('reasoning')}")
    else:
        print("[!] No responses collected.")

if __name__ == "__main__":
    # Level 1: Elite Council (3 nodes)
    run_sim("ELITE COUNCIL", 3)
    
    # Level 2: Grounded Swarm (50 nodes)
    # run_sim("GROUNDED SWARM", 50)
