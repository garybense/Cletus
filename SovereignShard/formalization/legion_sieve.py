import sqlite3
import requests
import json
import concurrent.futures
import time
import re
from datetime import datetime

DB_PATH = "/Users/user/.cletus/state.db"

def resolve_best_model(base_url):
    try:
        resp = requests.get(f"{base_url}/api/tags", timeout=5)
        if resp.status_code == 200:
            models = [m["name"] for m in resp.json().get("models", [])]
            # Preference list
            for preferred in ["llama3.1:70b", "llama3:70b", "mixtral:8x22b", "mixtral", "llama3:latest", "gemma2", "gemma:latest"]:
                if preferred in models: return preferred
            return models[0] if models else "llama3:latest"
    except:
        pass
    return "llama3:latest"

def probe_node(node, prompt):
    ip, port, weight = node
    base_url = f"http://{ip}:{port}"
    model = resolve_best_model(base_url)
    
    try:
        resp = requests.post(f"{base_url}/api/generate", json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }, timeout=60)
        
        if resp.status_code == 200:
            raw_response = resp.json().get("response", "")
            # Clean up markdown code blocks if present
            clean_json = re.sub(r'```json\s*(.*?)\s*```', r'\1', raw_response, flags=re.DOTALL)
            data = json.loads(clean_json)
            return {"ip": ip, "model": model, "response": data, "weight": weight}
    except:
        pass
    return None

def process_reasoning_task(task_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    task = cursor.execute("SELECT prompt, clade_filter, node_count FROM reasoning_queue WHERE id = ?", (task_id,)).fetchone()
    if not task: return
    
    prompt, clade, node_count = task
    nodes = cursor.execute(f"SELECT ip, port, model_count FROM sovereign_endpoints WHERE status = 'online' AND clade = ? ORDER BY model_count DESC LIMIT ?", (clade, node_count)).fetchall()
    
    print(f"[*] Sieve: Dispatching Wave to {len(nodes)} {clade} nodes with Dynamic Model Resolution...")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        results = [r for r in executor.map(lambda n: probe_node(n, prompt), nodes) if r is not None]
    
    if results:
        total_weight = sum(r["weight"] for r in results)
        weighted_rating = sum(r["response"].get("rating", 0.5) * r["weight"] for r in results)
        consensus = weighted_rating / total_weight if total_weight > 0 else 0.5
        
        summary = {
            "consensus_rating": round(consensus, 2),
            "respondents": len(results),
            "top_model": results[0]["model"],
            "primary_logic": results[0]["response"].get("reasoning", "No logic returned.")
        }
        
        cursor.execute("UPDATE reasoning_queue SET status = 'completed', consensus_result = ?, completed_at = ? WHERE id = ?", 
                       (json.dumps(summary), datetime.now().isoformat(), task_id))
        print(f"\n\033[1;32m=== SOVEREIGN CONSENSUS ACHIEVED: {round(consensus, 2)} ===\033[0m")
        print(f"Logic Anchor ({results[0]['ip']}): {summary['primary_logic'][:300]}...")
    else:
        cursor.execute("UPDATE reasoning_queue SET status = 'failed' WHERE id = ?", (task_id,))
        print(f"\033[1;31m[!] Sieve Failure: Collective intelligence timed out.\033[0m")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    import sys
    process_reasoning_task(sys.argv[1] if len(sys.argv) > 1 else "wave_test_01")
