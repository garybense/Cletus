import sqlite3
import requests
import json
import re

DB_PATH = "/Users/user/.cletus/state.db"

def probe_node(node, source_code):
    ip, port = node
    url = f"http://{ip}:{port}/api/generate"
    try:
        # Get tags to find model
        tags = requests.get(f"http://{ip}:{port}/api/tags", timeout=5).json()
        model = tags['models'][0]['name']
        print(f"[*] Probing {ip} using {model}...")
        
        prompt = f"SYSTEM: You are a SOVEREIGN AUDITOR. TASK: Find the concurrency bottleneck in this code and propose a MAS-native fix. SOURCE:\n{source_code}\nOUTPUT: JSON with 'flaw' and 'fix'."
        
        resp = requests.post(url, json={"model": model, "prompt": prompt, "stream": False, "format": "json"}, timeout=60)
        if resp.status_code == 200:
            return {"ip": ip, "res": json.loads(resp.json()['response'])}
    except Exception as e:
        print(f"[!] Node {ip} failed.")
    return None

def main():
    with open("/Users/user/code/CletusWork/orchestrator_core.ts", "r") as f: source_code = f.read()
    conn = sqlite3.connect(DB_PATH)
    nodes = conn.execute("SELECT ip, port FROM sovereign_endpoints WHERE status = 'online' AND is_gateway = 1 AND clade IN ('elite', 'institutional') LIMIT 10").fetchall()
    conn.close()

    for node in nodes:
        result = probe_node(node, source_code)
        if result:
            print(f"\n\033[1;32m=== CORE AUDIT RESULT ({result['ip']}) ===\033[0m")
            print(f"Flaw: {result['res'].get('flaw')}")
            print(f"Fix:  {result['res'].get('fix')}")
            break

if __name__ == "__main__":
    main()
