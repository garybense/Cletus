import sqlite3
import requests
import json
import concurrent.futures
import time
import re
from datetime import datetime

DB_PATH = "/Users/user/.cletus/state.db"

def probe_node(node, prompt):
    ip, port, weight = node
    weight = weight if weight is not None else 1
    url = f"http://{ip}:{port}/api/generate"
    try:
        resp = requests.post(url, json={
            "model": "llama3:latest",
            "prompt": prompt,
            "stream": False
        }, timeout=30)
        if resp.status_code == 200:
            raw_text = resp.json().get('response', '')
            rating = 0.8 if "buy" in raw_text.lower() or "bullish" in raw_text.lower() else 0.2 if "sell" in raw_text.lower() or "bearish" in raw_text.lower() else 0.5
            return {"ip": ip, "rating": rating, "weight": weight}
    except: pass
    return None

def main():
    print("\033[34m[*] Legion-1: Virtual Trading Session v5.1 (50-Node Speculative Wave)\033[0m")
    prompt = "MISSION: Information Arbitrage. NEWS: 'Tesla rumored to accept SOL for payment.' TASK: Rate trade risk (0=sell, 1=buy). Respond with 'BUY', 'SELL', or 'HOLD'."

    conn = sqlite3.connect(DB_PATH)
    nodes = conn.execute("SELECT ip, port, model_count FROM sovereign_endpoints WHERE status = 'online' AND is_gateway = 1 ORDER BY RANDOM() LIMIT 50").fetchall()
    conn.close()

    print(f"[*] Dispatching Wave to {len(nodes)} active gateways...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        results = [r for r in executor.map(lambda n: probe_node(n, prompt), nodes) if r is not None]
    
    if results:
        total_w = sum(r["weight"] for r in results)
        consensus = sum(r["rating"] * r["weight"] for r in results) / total_w
        print(f"\n\033[1;32m=== SWARM CONSENSUS: {consensus:.2f} ===\033[0m")
        print(f"Confidence: {len(results)}/50 active responses.")
        sentiment = "BULLISH" if consensus > 0.6 else "BEARISH" if consensus < 0.4 else "NEUTRAL"
        print(f"Synthesized Sentiment: \033[33m{sentiment}\033[0m")
    else:
        print("[!] Swarm non-responsive.")

if __name__ == "__main__":
    main()
