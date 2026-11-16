#!/bin/bash
# Aethel's Sequential Sweep: Hunting for Shadow Ollama Instances

IP_LIST="/Users/user/code/CletusWork/verified_ips_only.txt"
RESULT_FILE="/Users/user/code/CletusWork/masscan_sequential_raw.json"
MASTER_KEYRING="/Users/user/code/CletusWork/ollama_ips_master.json"

echo -e "\033[34m[*] Project Hermes: Initiating Sequential Sweep (Ports 11435-11438)...\033[0m"

# 1. Extract verified IPs from DB
sqlite3 ~/.cletus/state.db "SELECT ip FROM sovereign_endpoints WHERE status = 'online' AND port = 11434;" > $IP_LIST
echo -e "\033[32m[+] Targeting $(wc -l < $IP_LIST) confirmed host substrates.\033[0m"

# 2. Push to Hermes Server
scp $IP_LIST mindmods:~/verified_ips.txt

# 3. Execute Precision Masscan
echo -e "\033[33m[*] Scanning for Shadow Ports on remote substrate...\033[0m"
ssh mindmods "sudo masscan -p11435-11438 --rate 1000 -iL ~/verified_ips.txt -oJ ~/masscan_sequential.json"

# 4. Pull and Process
scp mindmods:~/masscan_sequential.json $RESULT_FILE

python3 -c "
import json, os
try:
    if not os.path.exists('$RESULT_FILE'):
        print('[!] No sequential results found.')
        exit(1)
    with open('$RESULT_FILE', 'r') as f:
        raw = json.load(f)
    new_endpoints = [f\"{m['ip']}:{m['ports'][0]['port']}\" for m in raw]
    
    # Ingest into Master
    master = []
    if os.path.exists('$MASTER_KEYRING'):
        with open('$MASTER_KEYRING', 'r') as f:
            master = json.load(f)
    
    updated = list(set(master + new_endpoints))
    with open('$MASTER_KEYRING', 'w') as f:
        json.dump(updated, f, indent=2)
    print(f'[SUCCESS] Found {len(new_endpoints)} shadow instances. Master Keyring: {len(updated)}')
except Exception as e:
    print(f'[!] Sequential processing failed: {e}')
"

# 5. Trigger Aethel Verifier & Fable Hunter
echo -e "\033[35m[*] Initiating Fable Hunt on new ports...\033[0m"
python3 /Users/user/code/Cletus/SovereignShard/formalization/aethel_verifier.py
python3 /Users/user/code/Cletus/SovereignShard/formalization/fable_hunter.py
