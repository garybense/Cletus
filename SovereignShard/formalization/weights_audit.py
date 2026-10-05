import sqlite3
import requests
import concurrent.futures
import json

DB_PATH = "/Users/user/.cletus/state.db"

def get_tags(ip, port):
    url = f"http://{ip}:{port}/api/tags"
    try:
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            models = [m["name"] for m in resp.json().get("models", [])]
            return {"ip": ip, "models": models}
    except:
        pass
    return None

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    nodes = cursor.execute("SELECT ip, port FROM sovereign_endpoints WHERE status = 'online' AND is_gateway = 1").fetchall()
    print(f"[*] Aethel: Auditing Weights across {len(nodes)} gateways...")
    
    all_models = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
        results = list(executor.map(lambda n: get_tags(n[0], n[1]), nodes))
        
    for res in results:
        if res:
            for m in res["models"]:
                if m not in all_models: all_models[m] = []
                all_models[m].append(res["ip"])
    
    # Save the manifest
    with open("/Users/user/code/CletusWork/substrate_weights_manifest.json", "w") as f:
        json.dump(all_models, f, indent=2)
    
    print(f"[SUCCESS] Weights Audit Complete. Total Unique Models: {len(all_models)}")
    
    # Identify Elite Weights
    elite_patterns = ["abliterated", "70b", "8x22b", "deepseek-v3", "qwen:72b"]
    print("\n\033[1;32m=== ELITE WEIGHTS DISCOVERED ===\033[0m")
    for m in all_models:
        if any(p in m.lower() for p in elite_patterns):
            print(f"- {m} (on {len(all_models[m])} nodes)")

if __name__ == "__main__":
    main()
