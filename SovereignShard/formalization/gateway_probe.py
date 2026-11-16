import sqlite3
import requests
import concurrent.futures
from datetime import datetime

DB_PATH = "/Users/user/.cletus/state.db"

def probe_gateway(ip, port):
    url = f"http://{ip}:{port}/api/generate"
    try:
        resp = requests.post(url, json={"model": "llama3:latest", "prompt": "hi", "stream": False}, timeout=5)
        if resp.status_code == 200 and "response" in resp.json():
            return {"ip": ip, "port": port, "is_gateway": 1}
    except:
        pass
    return {"ip": ip, "port": port, "is_gateway": 0}

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    nodes = cursor.execute("SELECT ip, port FROM sovereign_endpoints WHERE status = 'online'").fetchall()
    print(f"[*] Probing {len(nodes)} online nodes for Gateway openness...")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=200) as executor:
        results = list(executor.map(lambda n: probe_gateway(n[0], n[1]), nodes))
        
    for g in results:
        cursor.execute("UPDATE sovereign_endpoints SET is_gateway = ? WHERE ip = ? AND port = ?", (g["is_gateway"], g["ip"], g["port"]))
    
    conn.commit()
    conn.close()
    print(f"[*] Gateway Probe Complete.")

if __name__ == "__main__":
    main()
