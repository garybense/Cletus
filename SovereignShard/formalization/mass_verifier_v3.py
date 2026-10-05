import json, requests, sqlite3, concurrent.futures, os, re
from datetime import datetime

CANDIDATE_FILE = "/Users/user/code/CletusWork/masscan_ollama_raw_v27.json"
DB_PATH = "/Users/user/.cletus/state.db"

def verify_endpoint(ip):
    url = f"http://{ip}:11434"
    try:
        v_resp = requests.get(f"{url}/api/version", timeout=3)
        if v_resp.status_code == 200:
            m_resp = requests.get(f"{url}/api/tags", timeout=5)
            if m_resp.status_code == 200:
                models = m_resp.json().get("models", [])
                return {"ip": ip, "port": 11434, "model_count": len(models), "status": "online"}
    except: pass
    return None

def main():
    if not os.path.exists(CANDIDATE_FILE): return
    
    print("[*] Repairing and Loading Wave 27 Candidates...")
    with open(CANDIDATE_FILE, 'r', errors='ignore') as f:
        content = f.read()
    
    # Use regex to extract all IPs from the malformed Masscan JSON
    candidates = list(set(re.findall(r'"ip":\s*"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"', content)))
    
    print(f"[*] Found {len(candidates)} potential candidates. Verifying...")
    
    verified = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=200) as executor:
        results = list(executor.map(verify_endpoint, candidates))
        for res in results:
            if res: verified.append(res)
            
    if verified:
        print(f"[*] Ingesting {len(verified)} active nodes...")
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        for node in verified:
            id_hash = f"verified_{node['ip'].replace('.', '_')}"
            cursor.execute("INSERT OR REPLACE INTO sovereign_endpoints (id, ip, port, model_count, status, last_seen) VALUES (?, ?, ?, ?, ?, ?)", 
                           (id_hash, node['ip'], node['port'], node['model_count'], 'online', datetime.now().isoformat()))
        conn.commit(); conn.close()
        print(f'\n\033[1;32m[SUCCESS] PROJECT HERMES: Added {len(verified)} verified nodes.\033[0m')

if __name__ == "__main__": main()
