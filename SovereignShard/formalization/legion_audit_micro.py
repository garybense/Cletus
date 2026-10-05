import sqlite3
import requests
import json
import concurrent.futures
import re
from datetime import datetime

DB_PATH = "/Users/user/.cletus/state.db"

def probe_node(node, source_code, task_desc):
    ip, port, weight = node
    url = f"http://{ip}:{port}/api/generate"
    prompt = f"SYSTEM: You are a SOVEREIGN CODE AUDITOR. TASK: {task_desc}. SOURCE:\n{source_code}\nOUTPUT: JSON with 'flaw', 'fix', and 'stability_rating'."
    
    try:
        resp = requests.post(url, json={
            "model": "llama3:latest",
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }, timeout=60)
        if resp.status_code == 200:
            return {"ip": ip, "res": json.loads(resp.json()['response'])}
    except: pass
    return None

def main():
    target_file = "/Users/user/code/Cletus/src/orchestration/orchestrator.ts"
    print(f"[*] Legion: Auditing {target_file} for scaling bottlenecks...")
    
    with open(target_file, 'r') as f: source_code = f.read()
    
    conn = sqlite3.connect(DB_PATH)
    nodes = conn.execute("SELECT ip, port, model_count FROM sovereign_endpoints WHERE status = 'online' AND is_gateway = 1 ORDER BY RANDOM() LIMIT 50").fetchall()
    conn.close()

    task_desc = "Identify the primary bottleneck that prevents this orchestrator from handling 1,000 parallel agents."

    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        results = [r for r in executor.map(lambda n: probe_node(n, source_code, task_desc), nodes) if r is not None]
    
    if results:
        print(f"\n\033[1;32m=== MICRO-AUDIT COMPLETE ({len(results)} nodes) ===\033[0m")
        print(f"Primary Flaw: {results[0]['res'].get('flaw')}")
        print(f"Proposed Fix: {results[0]['res'].get('fix')}")
    else:
        print("[!] Sieve failed to return results.")

if __name__ == "__main__":
    main()
