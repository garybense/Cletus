import re
import json
import glob
import os

def extract_ips_from_html(file_path):
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # regex for finding host links which usually look like /host/1.2.3.4
    host_ips = re.findall(r'/host/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', content)
    
    # regex for standard IP patterns
    standard_ips = re.findall(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', content)
    
    combined = set(host_ips + standard_ips)
    # Filter out local and common false positives
    valid_ips = [ip for ip in combined if not ip.startswith(('127.', '10.', '192.168.', '0.', '172.', '169.254.'))]
    
    return list(set(valid_ips))

if __name__ == "__main__":
    all_harvested = set()
    files = glob.glob("/Users/user/code/CletusWork/shodan_*.html")
    for f in files:
        print(f"[*] Processing {os.path.basename(f)}...")
        found = extract_ips_from_html(f)
        print(f"[+] Found {len(found)} IPs.")
        for ip in found:
            all_harvested.add(f"{ip}:11434")
            
    if all_harvested:
        output_path = "/Users/user/code/CletusWork/ollama_ips_extracted.json"
        with open(output_path, 'w') as out:
            json.dump(sorted(list(all_harvested)), out, indent=2)
        print(f"\n[SUCCESS] Extracted {len(all_harvested)} unique IPs to {output_path}")
    else:
        print("[!] No IPs found in the HTML files.")
