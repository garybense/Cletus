import sqlite3
import requests
import json
import concurrent.futures
import time
from datetime import datetime

DB_PATH = "/Users/user/.cletus/state.db"

def probe_node(ip, port, prompt, role, weight):
    url = f"http://{ip}:{port}/api/generate"
    system_prompt = f"You are the {role}. Grounding: MMAS is a 1,000-node distributed substrate for trading. This is NOT about ants or modbus."
    try:
        # First get tags to find model
        tags = requests.get(f"http://{ip}:{port}/api/tags", timeout=5).json()
        model = tags['models'][0]['name']
        resp = requests.post(url, json={
            "model": model,
            "prompt": f"{system_prompt}\n\nTASK: {prompt}",
            "stream": False
        }, timeout=90)
        if resp.status_code == 200:
            return {"ip": ip, "role": role, "response": resp.json().get('response'), "weight": weight}
    except: pass
    return None

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    stanford = cursor.execute("SELECT ip, port, model_count FROM sovereign_endpoints WHERE status = 'online' AND ip LIKE '171.67.%' LIMIT 1").fetchone()
    mit = cursor.execute("SELECT ip, port, model_count FROM sovereign_endpoints WHERE status = 'online' AND ip LIKE '128.2.%' LIMIT 1").fetchone()
    oracle = cursor.execute("SELECT ip, port, model_count FROM sovereign_endpoints WHERE ip = '5.9.68.148'").fetchone()

    if not all([stanford, mit, oracle]):
        print("[!] Nodes not found for dialectic.")
        return

    plan = "PROPOSAL: Deploy a $70 seed on Solana using Jito Bundles for 3-hop atomic arbitrage (SOL-USDC-BONK-SOL) using 1,000 nodes for signal discovery. Focus on latency arbitrage and liquidity gaps."
    
    print("\033[34m[*] Legion Dialectic: Round 1 - The Proposal (Stanford)\033[0m")
    p_res = probe_node(stanford[0], stanford[1], plan, "PROPOSER", stanford[2])
    if not p_res: return
    print(f"[Stanford]: {p_res['response'][:400]}...")

    print("\n\033[34m[*] Legion Dialectic: Round 2 - The Challenge (MIT)\033[0m")
    challenge_prompt = f"Critically analyze this proposal and find 3 fatal flaws: {p_res['response']}"
    d_res = probe_node(mit[0], mit[1], challenge_prompt, "DEVILS_ADVOCATE", mit[2])
    if not d_res:
        print("[!] MIT Node timed out. Attempting Cloud Devil's Advocate...")
        cloud_node = cursor.execute("SELECT ip, port, model_count FROM sovereign_endpoints WHERE status = 'online' AND clade = 'cloud' ORDER BY RANDOM() LIMIT 1").fetchone()
        d_res = probe_node(cloud_node[0], cloud_node[1], challenge_prompt, "DEVILS_ADVOCATE", cloud_node[2])
    
    if d_res:
        print(f"[Devil's Advocate]: {d_res['response'][:400]}...")

    print("\n\033[34m[*] Legion Dialectic: Round 3 - The Oracle Synthesis (DeepSeek-671B)\033[0m")
    oracle_prompt = f"Synthesize this debate and give a final stability rating 0.0-1.0 and 3 improvements. Proposal: {p_res['response']}\n\nChallenge: {d_res['response'] if d_res else 'N/A'}"
    o_res = probe_node(oracle[0], oracle[1], oracle_prompt, "ORACLE", oracle[2])
    if o_res:
        print(f"\n\033[1;32m=== ORACLE FINAL JUDGMENT ===\033[0m")
        print(o_res['response'])

    conn.close()

if __name__ == "__main__":
    main()
