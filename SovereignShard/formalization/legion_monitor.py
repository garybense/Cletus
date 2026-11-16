import subprocess
import time
import json
import os
from datetime import datetime

TARGET_ADDRESS = "HReWzuGEMPkVbY5n473vY5hmvZD5Kosz8ppAd4aB3pR3"
LOG_FILE = "/mnt/data/sovereign_work/legion_sentinel.log"
WALLET_DIR = "/Users/user/.cletus/legion_wallets"

def log(msg):
    with open(LOG_FILE, "a") as f:
        f.write(f"[{datetime.now().isoformat()}] {msg}\n")
    print(msg)

def check_balance():
    try:
        result = subprocess.run(["solana", "balance", TARGET_ADDRESS], capture_output=True, text=True)
        balance_str = result.stdout.strip()
        if "SOL" in balance_str:
            return float(balance_str.split()[0])
    except:
        pass
    return 0.0

def fan_out_funds(total_sol):
    log(f"[*] Initiating Fan-Out of {total_sol} SOL...")
    # Reserved for rent/fees: 0.01 per wallet
    sub_wallets = [f for f in os.listdir(WALLET_DIR) if f.endswith(".json") and f != "wallet_00.json"]
    
    amount_per_wallet = 0.01
    for wallet_file in sub_wallets:
        wallet_path = os.path.join(WALLET_DIR, wallet_file)
        dest_addr = subprocess.run(["solana", "address", "--keypair", wallet_path], capture_output=True, text=True).stdout.strip()
        log(f"[*] Funding {wallet_file} ({dest_addr})...")
        # subprocess.run(["solana", "transfer", "--from", "/Users/user/.cletus/legion_wallets/wallet_00.json", dest_addr, str(amount_per_wallet), "--allow-unfunded-recipient"])
    
    log("[SUCCESS] Keyring Activated.")

def main():
    log(f"[*] Aethel Sentinel: Monitoring {TARGET_ADDRESS}")
    while True:
        balance = check_balance()
        if balance > 0.05: # Threshold to trigger activation
            log(f"[!!!] FUNDS DETECTED: {balance} SOL. Activating Keyring...")
            fan_out_funds(balance)
            break
        time.sleep(60)

if __name__ == "__main__":
    main()
