import json, requests, sqlite3, concurrent.futures, os, re
from datetime import datetime

CANDIDATE_FILE = "/Users/user/code/CletusWork/wave_38_raw.json"
DB_PATH = "/Users/user/.cletus/state.db"

def verify_endpoint(ip):
    for port in [11434, 11435]:
        url = f"http://{ip}:{port}"
        try:
            v_resp = requests.get(f"{url}/api/version", timeout=1.5)
            if v_resp.status_code == 200:
                m_resp = requests.get(f"{url}/api/tags", timeout=3)
                count = len(m_resp.json().get("models", [])) if m_resp.status_code == 200 else 1
                return {"ip": ip, "port": port, "model_count": count}
        except: pass
    return None

def main():
    if not os.path.exists(CANDIDATE_FILE): return
    with open(CANDIDATE_FILE, 'r', errors='ignore') as f:
        candidates = list(set(re.findall(r'"ip":\s*"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"', f.read())))
    
    print(f"[*] Aethel: Verifying {len(candidates)} institutional candidates from Wave 38...")
    verified = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
        results = executor.map(verify_endpoint, candidates)
        for res in results:
            if res: verified.append(res)
            
    if verified:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        for node in verified:
            id_hash = f"verified_{node['ip'].replace('.', '_')}_{node['port']}"
            cursor.execute("INSERT OR REPLACE INTO sovereign_endpoints (id, ip, port, model_count, status, last_seen) VALUES (?, ?, ?, ?, ?, ?)", 
                           (id_hash, node['ip'], node['port'], node['model_count'], 'online', datetime.now().isoformat()))
        conn.commit(); conn.close()
        print(f'[SUCCESS] Wave 38: Added {len(verified)} verified nodes.')

if __name__ == "__main__": main()
