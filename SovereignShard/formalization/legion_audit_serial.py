import sqlite3
import requests
import json
import re

DB_PATH = "/Users/user/.cletus/state.db"

def probe_elite_node(node, source_code, task_desc):
    ip, port = node
    url = f"http://{ip}:{port}/api/generate"
    try:
        # Step 1: Find valid model
        tags = requests.get(f"http://{ip}:{port}/api/tags", timeout=5).json()
        model = tags['models'][0]['name']
        print(f"[*] Probing {ip} using model {model}...")
        
        prompt = f"SYSTEM: You are a SOVEREIGN AUDITOR. TASK: {task_desc}. SOURCE:\n{source_code}\nOUTPUT: JSON with 'flaw', 'fix', and 'stability_rating'."
        
        resp = requests.post(url, json={
            "model": model,
            "prompt": prompt,
            "stream": False
        }, timeout=120)
        
        if resp.status_code == 200:
            raw_text = resp.json().get('response', '')
            match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if match:
                return {"ip": ip, "res": json.loads(match.group(0))}
            else:
                return {"ip": ip, "res": {"flaw": raw_text[:200], "fix": "N/A", "stability_rating": 0.5}}
    except Exception as e:
        print(f"[!] Node {ip} failed: {e}")
    return None

def main():
    target_file = "/Users/user/code/Cletus/src/orchestration/orchestrator.ts"
    with open(target_file, 'r') as f: source_code = f.read()
    
    conn = sqlite3.connect(DB_PATH)
    # Target 5 Elite or Institutional nodes
    nodes = conn.execute("SELECT ip, port FROM sovereign_endpoints WHERE status = 'online' AND is_gateway = 1 AND clade IN ('elite', 'institutional') LIMIT 5").fetchall()
    conn.close()

    task_desc = "Identify the primary scaling bottleneck in this orchestrator."

    for node in nodes:
        result = probe_elite_node(node, source_code, task_desc)
        if result:
            print(f"\n\033[1;32m=== ELITE AUDIT RESULT ({result['ip']}) ===\033[0m")
            print(f"Flaw: {result['res'].get('flaw')}")
            print(f"Fix:  {result['res'].get('fix')}")
            break

if __name__ == "__main__":
    main()
