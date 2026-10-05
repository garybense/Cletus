import sqlite3
import requests
import json
import concurrent.futures
import time
import re
from datetime import datetime

DB_PATH = "/Users/user/.cletus/state.db"

def edge_agent_analysis(node, market_data):
    ip, port, weight = node
    url = f"http://{ip}:{port}/api/generate"
    
    # Grounding: The agent is at the EDGE, near the liquidity.
    prompt = f"""
    CONTEXT: You are a low-latency EXECUTION SENTINEL at the Edge.
    NEWS_STREAM: {market_data['news']}
    PRICE_DATA: {market_data['price']}
    
    TASK: Detect KL Divergence between the sentiment of this news and the current price. 
    Is the news 'Priced In'? 
    OUTPUT: JSON with 'divergence_score' (0-1), 'sentiment' (bullish/bearish), and 'reasoning'.
    """
    
    try:
        resp = requests.post(url, json={"model": "llama3:latest", "prompt": prompt, "stream": False, "format": "json"}, timeout=30)
        return {"ip": ip, "res": json.loads(resp.json()['response']), "weight": weight}
    except: return None

def main():
    print("\033[34m[*] Legion-1: Virtual Trading v2.0 (Edge-Based Semantic Sieve)\033[0m")
    
    # Fake News Event: "Solana Firedancer Upgrade live on testnet, 1M TPS achieved."
    sim_data = {
        "news": "BREAKING: Solana Firedancer internal metrics show 1M TPS sustain. Public announcement in 10 minutes.",
        "price": "SOL/USDC: $145.20 (Sideways for 4 hours)"
    }

    conn = sqlite3.connect(DB_PATH)
    # Select 20 nodes from the Institutional Clade (The "Brain")
    nodes = conn.execute("SELECT ip, port, model_count FROM sovereign_endpoints WHERE status = 'online' AND clade = 'institutional' LIMIT 20").fetchall()
    conn.close()

    print(f"[*] Dispatching Semantic Sieve to {len(nodes)} high-fidelity nodes...")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        results = [r for r in executor.map(lambda n: edge_agent_analysis(n, sim_data), nodes) if r is not None]
    
    if results:
        avg_divergence = sum(r['res']['divergence_score'] * r['weight'] for r in results) / sum(r['weight'] for r in results)
        print(f"\n\033[1;32m=== SWARM SEMANTIC CONSENSUS ===\033[0m")
        print(f"Aggregate KL Divergence: {avg_divergence:.2f}")
        print(f"Consensus Sentiment: {results[0]['res']['sentiment']}")
        
        if avg_divergence > 0.7:
            print("\033[33m[VIRTUAL EXECUTION]: PRE-EMPTIVE BUY 1.0 SOL - HIGH INEFFICIENCY DETECTED.\033[0m")
        else:
            print("\033[36m[VIRTUAL EXECUTION]: HOLD - NEWS ALREADY PRICED IN.\033[0m")
            
if __name__ == "__main__":
    main()
