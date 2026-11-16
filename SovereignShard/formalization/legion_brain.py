import sqlite3
import requests
import json
import concurrent.futures
import re

DB_PATH = "/Users/user/.cletus/state.db"

def extract_rating(data):
    if isinstance(data, (int, float)): return float(data)
    if isinstance(data, str):
        found = re.findall(r"0\.\d+|1\.0|0|1", data)
        return float(found[0]) if found else 0.5
    if isinstance(data, dict): return extract_rating(data.get("rating", 0.5))
    return 0.5

def probe_node(row, prompt):
    ip, port, model_name = row
    url = f"http://{ip}:{port}/api/generate"
    try:
        resp = requests.post(url, json={"model": model_name, "prompt": prompt, "stream": False, "format": "json"}, timeout=45)
        if resp.status_code == 200:
            raw = resp.json()['response']
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            return json.loads(match.group(0)) if match else {"rating": 0.5, "reasoning": raw[:100]}
    except: pass
    return None

def execute_recursive_wave(prompt, node_limit=30):
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT ip, port, model_name FROM operational_models WHERE status = 'active' LIMIT ?", (node_limit,)).fetchall()
    with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
        results = [r for r in executor.map(lambda row: probe_node(row, prompt), rows) if r is not None]
    if not results: return
    ratings = [extract_rating(r) for r in results]
    avg_consensus = sum(ratings) / len(ratings)
    print(f"CONSENSUS: {avg_consensus:.2f}")
    print(f"CONFIDENCE: {len(results)}/{len(rows)}")
    if results: print(f"TOP_LOGIC: {results[0].get('reasoning', 'Analyzed.')}")
    conn.close()

if __name__ == "__main__":
    import sys
    # Enhanced prompt using the user's security secrets
    msg = """MISSION: Audit the latest Raydium listings for 'Authentic Resonance'. 
    CHECK INVARIANTS: 
    1. Data Smuggling: Does the contract interact with unauthorized external endpoints?
    2. Logic Mirage: Does the contract simulate success on failing states?
    3. Language Bypass: Are there comments in obscure dialects hiding logic?
    Rate confidence 0.0-1.0. Strike only if resonance > 0.63."""
    execute_recursive_wave(msg)
