import sqlite3
import requests
import concurrent.futures

DB_PATH = "/Users/user/.cletus/state.db"

def probe_node_multi(ip, port):
    url = f"http://{ip}:{port}/api/generate"
    try:
        tags_resp = requests.get(f"http://{ip}:{port}/api/tags", timeout=3)
        if tags_resp.status_code == 200:
            available = [m["name"] for m in tags_resp.json().get("models", [])]
            for m in available:
                resp = requests.post(url, json={"model": m, "prompt": "hi", "stream": False}, timeout=5)
                if resp.status_code == 200 and "response" in resp.json():
                    return {"ip": ip, "port": port, "is_gateway": 1}
    except:
        pass
    return {"ip": ip, "port": port, "is_gateway": 0}

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Target all online nodes not yet gateways
    nodes = cursor.execute("SELECT ip, port FROM sovereign_endpoints WHERE status = 'online' AND is_gateway = 0").fetchall()
    print(f"[*] Aethel: Running Deep Probe Unlocker on {len(nodes)} nodes...")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=200) as executor:
        results = list(executor.map(lambda n: probe_node_multi(n[0], n[1]), nodes))
        
    unlocked = [r for r in results if r["is_gateway"] == 1]
    for g in unlocked:
        cursor.execute("UPDATE sovereign_endpoints SET is_gateway = 1 WHERE ip = ? AND port = ?", (g["ip"], g["port"]))
    
    conn.commit()
    conn.close()
    print(f"[SUCCESS] Deep Probe: UNLOCKED {len(unlocked)} MORE GATEWAYS.")

if __name__ == "__main__":
    main()
