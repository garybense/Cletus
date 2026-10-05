import requests
import time
import json
import concurrent.futures
import sqlite3

DB_PATH = "/Users/user/.cletus/state.db"

def fingerprint_node_v2(ip, port):
    url = f"http://{ip}:{port}/api/tags"
    try:
        # LLMmap pattern: High-fidelity model analysis
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            models = [m["name"] for m in resp.json().get("models", [])]
            # Identify "Stealth Elite" nodes via internal weight names
            is_elite = any(x in str(models).lower() for x in ["405b", "671b", "deepseek-v3", "abliterated"])
            # Identify "Vision Enabled" nodes
            is_vision = any(x in str(models).lower() for x in ["vision", "llava", "moondream"])
            return {"ip": ip, "is_elite": is_elite, "is_vision": is_vision, "model_count": len(models)}
    except: pass
    return None

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Audit all online nodes not yet categorized as ORACLE
    nodes = cursor.execute("SELECT ip, port FROM sovereign_endpoints WHERE status = 'online' AND clade != 'ORACLE'").fetchall()
    print(f"[*] Aethel: Running Advanced Fingerprinting v2 on {len(nodes)} nodes...")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
        results = list(executor.map(lambda n: fingerprint_node_v2(n[0], n[1]), nodes))
        
    elite_discovered = 0
    for r in results:
        if r and r["is_elite"]:
            cursor.execute("UPDATE sovereign_endpoints SET clade = 'ORACLE' WHERE ip = ?", (r["ip"],))
            elite_discovered += 1
            
    conn.commit()
    conn.close()
    print(f"\n\033[1;32m[SUCCESS] DISCOVERED {elite_discovered} STEALTH ELITE HUBS.\033[0m")

if __name__ == "__main__":
    main()
