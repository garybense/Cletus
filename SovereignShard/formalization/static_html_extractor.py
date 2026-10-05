import re
import json
import glob
import os

def extract_from_static(file_path):
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # 1. Look for common Shodan IP link pattern /host/IP
    host_ips = re.findall(r'/host/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', content)
    
    # 2. Broad regex for standard IPv4
    all_ips = re.findall(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', content)
    
    # Filter and merge
    candidates = set(host_ips + all_ips)
    valid = [ip for ip in candidates if not ip.startswith(('127.', '10.', '192.168.', '0.', '172.', '169.254.'))]
    
    return [f"{ip}:11434" for ip in valid]

if __name__ == "__main__":
    all_found = set()
    # Target the specific files the user mentioned
    files = [
        "/Users/user/code/CletusWork/shodan_tab_1.html",
        "/Users/user/code/CletusWork/shodan_tab_2.html",
        "/Users/user/code/CletusWork/shodan_raw_audit.html",
        "/Users/user/code/CletusWork/current_tab.html"
    ]
    
    for f in files:
        if os.path.exists(f):
            print(f"[*] Extracting from {os.path.basename(f)}...")
            res = extract_from_static(f)
            print(f"[+] Found {len(res)} candidates.")
            all_found.update(res)
            
    if all_found:
        output_path = "/Users/user/code/CletusWork/ollama_ips_master.json"
        # Load existing if present
        existing = []
        if os.path.exists(output_path):
            with open(output_path, 'r') as f:
                existing = json.load(f)
        
        final = list(set(existing + list(all_found)))
        with open(output_path, 'w') as out:
            json.dump(final, out, indent=2)
        print(f"\n[SUCCESS] Extracted {len(all_found)} IPs from static pages. Master Keyring Total: {len(final)}")
    else:
        print("[!] No IPs detected in the static HTML files.")
