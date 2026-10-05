import json
import requests
import concurrent.futures
from datetime import datetime

def check_for_fable(endpoint):
    ip, port = endpoint.split(':')
    base_url = f"http://{ip}:{port}"
    
    try:
        m_resp = requests.get(f"{base_url}/api/tags", timeout=10)
        if m_resp.status_code == 200:
            models = m_resp.json().get("models", [])
            for m in models:
                name = m["name"].lower()
                # Targeted check for the routing exploit model
                if "fable" in name or "yuriifomin" in name:
                    return {"ip": ip, "port": port, "model": m["name"], "found": True}
    except:
        pass
    return {"found": False}

def main():
    print("\033[35m[*] Aethel: Initiating the Hunt for Fable 5.1 & Routing Exploits...\033[0m")
    try:
        with open("/Users/user/code/CletusWork/ollama_ips_master.json", "r") as f:
            endpoints = json.load(f)
    except FileNotFoundError:
        print("[!] Master keyring not found.")
        return

    print(f"[*] Scanning {len(endpoints)} nodes for Sovereign Weights...")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
        futures = [executor.submit(check_for_fable, ep) for ep in endpoints]
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res["found"]:
                print(f"\033[1;32m[!!!] SOVEREIGN NODE DISCOVERED: {res['ip']}:{res['port']} | Model: {res['model']}\033[0m")
                with open("/Users/user/code/CletusWork/fable_discovery.log", "a") as log:
                    log.write(f"[{datetime.now().isoformat()}] {res['ip']}:{res['port']} - {res['model']}\n")

    print("\033[34m[*] Fable Hunt complete.\033[0m")

if __name__ == "__main__":
    main()
