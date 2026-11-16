import json
import requests
import base64
import os
from datetime import datetime

# Jito Block Engine Mainnet (Global)
JITO_URL = "https://mainnet.block-engine.jito.wtf/api/v1/bundles"
RPC_URL = "https://api.mainnet-beta.solana.com"

def send_bundle(b64_txs):
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "sendBundle",
        "params": [b64_txs]
    }
    try:
        resp = requests.post(JITO_URL, json=payload, headers={"Content-Type": "application/json"}, timeout=10)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}

def main():
    print("\033[34m[*] Legion-Hand v1.0 (Python Core): ACTIVATED.\033[0m")
    
    # 1. Connectivity Check
    try:
        sol_price_resp = requests.get("https://api.dexscreener.com/latest/dex/pairs/solana/83v8iPyZihDEjDdY8RdZddyZNyUtXngz69Lgo9Kt5d6d").json()
        price = sol_price_resp['pair']['priceUsd']
        print(f"[*] SOL Pulse: ${price}")
    except:
        print("[!] Price fetch failed.")

    print("\033[1;32m[READY] The Sovereign Hand is primed. Standing by for $70 seed at HReWzuGEM...\033[0m")

if __name__ == "__main__":
    main()
