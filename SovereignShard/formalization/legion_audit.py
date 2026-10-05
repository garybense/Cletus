import sqlite3
import requests
import json
import concurrent.futures
import time
import re
from datetime import datetime

DB_PATH = "/Users/user/.cletus/state.db"
BUNDLE_PATH = "/Users/user/code/CletusWork/legion_core_bundle.ts"

def resolve_best_audit_model(ip, port):
    try:
        resp = requests.get(f"http://{ip}:{port}/api/tags", timeout=5).json()
        models = [m['name'] for m in resp.get('models', [])]
        for pref in ["llama3.1:70b", "deepseek-r1:32b", "qwen3.8-abliterated", "llama3:latest"]:
            match = next((m for m in models if pref in m.lower()), None)
            if match: return match
        return models[0]
    except: return "llama3:latest"

def probe_node(node, bundle_text):
    ip, port, weight = node
    model = resolve_best_audit_model(ip, port)
    url = f"http://{ip}:{port}/api/generate"
    
    prompt = f"""
    SYSTEM: You are the SOVEREIGN CODE AUDITOR. 
    MMAS Grounding: 1,000-node substrate.
    
    CONTEXT (Source Code):
    {bundle_text}
    
    TASK:
    1. Critical Bottleneck: Identify the single most dangerous bottleneck in the current Cletus Orchestrator.
    2. Trading Edge: Propose a 'Counter-Intuitive' information arbitrage pattern.
    3. Rating: Architecture stability (0-1).
    
    OUTPUT: JSON with 'bottleneck', 'strategy', 'rating', 'logic'.
    """
    
    try:
        resp = requests.post(url, json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }, timeout=180)
        if resp.status_code == 200:
            return {"ip": ip, "model": model, "res": json.loads(resp.json()['response'])}
    except: pass
    return None

def main():
    print(f"[*] Legion: Auditing Substrate logic using verified High-Fidelity nodes...")
    with open(BUNDLE_PATH, 'r') as f: bundle_text = f.read()
    
    conn = sqlite3.connect(DB_PATH)
    # Select the top 10 verified high-model-count gateways
    nodes = conn.execute("SELECT ip, port, model_count FROM sovereign_endpoints WHERE status = 'online' AND is_gateway = 1 ORDER BY model_count DESC LIMIT 10").fetchall()
    conn.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = [r for r in executor.map(lambda n: probe_node(n, bundle_text), nodes) if r is not None]
    
    if results:
        print(f"\n\033[1;32m=== SOVEREIGN CODE AUDIT COMPLETE ===\033[0m")
        for r in results:
            print(f"\n[Node {r['ip']} | Model {r['model']}]")
            print(f"Stability: {r['res'].get('rating')}")
            print(f"Bottleneck: {r['res'].get('bottleneck')}")
            print(f"Alpha Strategy: {r['res'].get('strategy')}")
    else:
        print("[!] Collective Audit Failed. Nodes saturated.")

if __name__ == "__main__": main()
