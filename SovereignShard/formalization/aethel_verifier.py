import json
import requests
import sqlite3
import concurrent.futures
from datetime import datetime

def verify_endpoint(endpoint):
    ip, port = endpoint.split(':')
    base_url = f"http://{ip}:{port}"
    
    result = {
        "ip": ip,
        "port": port,
        "status": "offline",
        "version": None,
        "models": [],
        "model_count": 0
    }
    
    try:
        # 1. Check Version
        v_resp = requests.get(f"{base_url}/api/version", timeout=10)
        if v_resp.status_code == 200:
            result["status"] = "online"
            result["version"] = v_resp.json().get("version")
            
            # 2. List Models
            m_resp = requests.get(f"{base_url}/api/tags", timeout=10)
            if m_resp.status_code == 200:
                models = m_resp.json().get("models", [])
                result["models"] = [m["name"] for m in models]
                result["model_count"] = len(models)
    except:
        pass
    
    return result

def update_db(results):
    conn = sqlite3.connect('/Users/user/.cletus/state.db')
    cursor = conn.cursor()
    
    for res in results:
        id_hash = f"verified_{res['ip'].replace('.', '_')}"
        status = res['status']
        model_count = res['model_count']
        
        cursor.execute("""
            INSERT OR REPLACE INTO sovereign_endpoints (id, ip, port, model_count, status, last_seen)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (id_hash, res['ip'], res['port'], model_count, status, datetime.now().isoformat()))
    
    conn.commit()
    conn.close()

def main():
    print("[*] Aethel Verifier: Initiating Bulk Verification...")
    try:
        with open("/Users/user/code/CletusWork/ollama_ips_master.json", "r") as f:
            endpoints = json.load(f)
    except FileNotFoundError:
        print("[!] Master keyring not found.")
        return

    print(f"[*] Verifying {len(endpoints)} endpoints...")
    
    verified_results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        future_to_endpoint = {executor.submit(verify_endpoint, ep): ep for ep in endpoints}
        for future in concurrent.futures.as_completed(future_to_endpoint):
            res = future.result()
            if res["status"] == "online":
                print(f"[+] {res['ip']}:{res['port']} | ONLINE | {res['model_count']} models")
                verified_results.append(res)
            else:
                # print(f"[-] {res['ip']}:{res['port']} | OFFLINE")
                pass

    if verified_results:
        update_db(verified_results)
        print(f"\n[SUCCESS] Verification Complete. {len(verified_results)} active nodes added to Sovereign Arsenal.")
    else:
        print("[!] No active nodes discovered in this wave.")

if __name__ == "__main__":
    main()
