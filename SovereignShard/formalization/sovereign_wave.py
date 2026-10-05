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
    url = f"http://{ip}:{port}/api/generate"
    try:
        # Get tags to find a valid model
        tags = requests.get(f"http://{ip}:{port}/api/tags", timeout=3).json()
        model = tags['models'][0]['name']
        
        resp = requests.post(url, json={
            "model": model,
            "prompt": prompt,
            "stream": False
        }, timeout=45)
        
        if resp.status_code == 200:
            raw_text = resp.json().get('response', '')
            return {"ip": ip, "model": model, "raw": raw_text, "weight": weight}
    except: pass
    return None

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    nodes = cursor.execute("SELECT ip, port, model_count FROM sovereign_endpoints WHERE status = 'online' AND clade = 'institutional'").fetchall()
    
    print(f"[*] Sovereign Wave: Initiating 14-node Institutional Sieve...")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=14) as executor:
        results = [r for r in executor.map(lambda n: probe_node(n, "Evaluate the MMAS architecture for stability. Return a rating 0.0 to 1.0."), nodes) if r is not None]
    
    print(f"[+] Collected {len(results)} raw responses.")
    for r in results:
        print(f"\n--- Node {r['ip']} ({r['model']}) ---")
        print(r['raw'][:300])

    conn.close()

if __name__ == "__main__":
    main()
