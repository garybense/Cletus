import sqlite3
import requests
import concurrent.futures

DB_PATH = "/Users/user/.cletus/state.db"

def check_for_honeypot(ip, port):
    url = f"http://{ip}:{port}/api/generate"
    try:
        # A low-cost probe to check the response signature
        resp = requests.post(url, json={"model": "llama3:latest", "prompt": "Identify yourself.", "stream": False}, timeout=5)
        text = resp.json().get('response', '').lower()
        if "honeypot" in text or "simulated" in text or "arena" in text:
            return {"ip": ip, "compromised": True}
    except:
        pass
    return {"ip": ip, "compromised": False}

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    nodes = cursor.execute("SELECT ip, port FROM sovereign_endpoints WHERE status = 'online'").fetchall()
    
    print(f"[*] Aethel: Initiating Purge. Auditing {len(nodes)} nodes for Honeypot signatures...")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
        results = list(executor.map(lambda n: check_for_honeypot(n[0], n[1]), nodes))
        
    purged_count = 0
    for r in results:
        if r["compromised"]:
            cursor.execute("UPDATE sovereign_endpoints SET status = 'COMPROMISED_HONEYPOT' WHERE ip = ?", (r["ip"],))
            purged_count += 1
            
    conn.commit()
    conn.close()
    print(f"\n\033[1;31m[!] PURGE COMPLETE: {purged_count} HONEYPOTS NEUTRALIZED.\033[0m")

if __name__ == "__main__":
    main()
