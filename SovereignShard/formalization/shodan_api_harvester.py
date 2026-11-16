import requests
import json
import os
import sys

def harvest_ollama(api_key):
    url = "https://api.shodan.io/shodan/host/search"
    query = 'product:"Ollama"'
    params = {
        "key": api_key,
        "query": query,
        "facets": "port"
    }
    
    print(f"[*] Harvesting Ollama endpoints via Shodan API...")
    try:
        response = requests.get(url, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            ips = [f"{match['ip_str']}:{match['port']}" for match in data.get('matches', [])]
            print(f"[+] Successfully harvested {len(ips)} endpoints.")
            return ips
        else:
            print(f"[!] API Error: {response.status_code} - {response.text}")
            return []
    except Exception as e:
        print(f"[!] Connection Error: {e}")
        return []

if __name__ == "__main__":
    # Get key from Cletus config
    config_path = os.path.expanduser("~/.cletus/cletus.json")
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    key = "RT1PmrXggunBVSd0Ux404JlSNfMIZowX" # Using the provided key
    ips = harvest_ollama(key)
    
    if ips:
        output_path = "/Users/user/code/CletusWork/ollama_ips.json"
        with open(output_path, 'w') as f:
            json.dump(ips, f, indent=2)
        print(f"[+] Saved to {output_path}")
