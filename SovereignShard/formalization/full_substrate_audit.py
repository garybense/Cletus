import json
import requests
import sqlite3
import concurrent.futures
from datetime import datetime

DB_PATH = "/Users/user/.cletus/state.db"
MANIFEST_PATH = "/Users/user/code/CletusWork/substrate_weights_manifest.json"

def test_model_instance(ip, port, model):
    url = f"http://{ip}:{port}/api/generate"
    try:
        # Minimal probe to confirm execution capability
        resp = requests.post(url, json={
            "model": model,
            "prompt": "1+1",
            "stream": False
        }, timeout=15)
        
        if resp.status_code == 200:
            return {"ip": ip, "port": port, "model": model, "status": "operational"}
        else:
            return {"ip": ip, "port": port, "model": model, "status": f"failed_{resp.status_code}"}
    except:
        return {"ip": ip, "port": port, "model": model, "status": "timeout_or_refused"}

def main():
    print("\033[34m[*] Aethel: Initiating Full Substrate Model Audit...\033[0m")
    
    with open(MANIFEST_PATH, 'r') as f:
        manifest = json.load(f)
    
    tasks = []
    for model, ips in manifest.items():
        for ip in ips:
            tasks.append((ip, 11434, model))
    
    print(f"[*] Total model instances to verify: {len(tasks)}")
    
    verified_count = 0
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Process in large parallel batches
    with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
        future_to_model = {executor.submit(test_model_instance, *t): t for t in tasks}
        
        for future in concurrent.futures.as_completed(future_to_model):
            res = future.result()
            if res["status"] == "operational":
                cursor.execute("""
                    INSERT INTO operational_models (ip, port, model_name, last_verified, status)
                    VALUES (?, ?, ?, ?, ?)
                """, (res["ip"], res["port"], res["model"], datetime.now().isoformat(), "active"))
                verified_count += 1
                if verified_count % 50 == 0:
                    print(f"[+] Operational Models Found: {verified_count}")
            
            # Periodically commit to avoid losing progress
            if verified_count % 100 == 0:
                conn.commit()

    conn.commit()
    conn.close()
    print(f"\n\033[1;32m[SUCCESS] Audit Complete. {verified_count} models are confirmed active and usable.\033[0m")

if __name__ == "__main__":
    main()
