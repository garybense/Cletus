import json
import requests
import sqlite3
import concurrent.futures
import os
from datetime import datetime

# UPDATED: Path to Wave 26 candidate list
CANDIDATE_FILE = "/Users/user/code/CletusWork/masscan_ollama_raw_v26.json"
DB_PATH = "/Users/user/.cletus/state.db"

def verify_endpoint(ip):
    url = f"http://{ip}:11434"
    try:
        # Step 1: Version Check
        v_resp = requests.get(f"{url}/api/version", timeout=3)
        if v_resp.status_code == 200:
            # Step 2: Model Listing
            m_resp = requests.get(f"{url}/api/tags", timeout=5)
            if m_resp.status_code == 200:
                models = m_resp.json().get("models", [])
                return {
                    "ip": ip,
                    "port": 11434,
                    "model_count": len(models),
                    "status": "online"
                }
    except:
        pass
    return None

def main():
    print("\033[34m[*] Aethel Mass Verifier v2: Processing Wave 26 (The Global Hub Sweep)...\033[0m")
    
    if not os.path.exists(CANDIDATE_FILE):
        print("[!] Candidate file not found.")
        return

    with open(CANDIDATE_FILE, 'r') as f:
        raw_data = json.load(f)
    
    candidates = [item['ip'] for item in raw_data]
    print(f"[*] Verifying {len(candidates)} new potential nodes...")

    verified_nodes = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
        results = executor.map(verify_endpoint, candidates)
        for res in results:
            if res:
                print(f"[+] Verified Active Node: {res['ip']} ({res['model_count']} models)")
                verified_nodes.append(res)

    if verified_nodes:
        print(f"[*] Ingesting {len(verified_nodes)} nodes into Sovereign Arsenal...")
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        for node in verified_nodes:
            id_hash = f"verified_{node['ip'].replace('.', '_')}"
            cursor.execute("""
                INSERT OR REPLACE INTO sovereign_endpoints (id, ip, port, model_count, status, last_seen)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (id_hash, node['ip'], node['port'], node['model_count'], 'online', datetime.now().isoformat()))
        conn.commit()
        conn.close()
        print(f"\033[1;32m[SUCCESS] Wave 26 Ingest Complete. Added {len(verified_nodes)} verified nodes.\033[0m")
    else:
        print("[!] No active nodes found in this wave.")

if __name__ == "__main__":
    main()
