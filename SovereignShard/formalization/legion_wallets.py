import json
import os
import subprocess
from datetime import datetime

WALLET_DIR = "/Users/user/.cletus/legion_wallets"

def provision_sub_wallets(count=10):
    if not os.path.exists(WALLET_DIR):
        os.makedirs(WALLET_DIR, mode=0o700)
    
    print(f"[*] Provisioning {count} Legion Sub-Wallets...")
    for i in range(count):
        wallet_path = os.path.join(WALLET_DIR, f"wallet_{i:02d}.json")
        if not os.path.exists(wallet_path):
            # Using solana-cli to generate keypairs if available, else placeholder
            print(f"[+] Creating wallet {i:02d}...")
            subprocess.run(["solana-keygen", "new", "--no-passphrase", "-o", wallet_path], stdout=subprocess.DEVNULL)
    
    print(f"[SUCCESS] {count} Sub-Wallets ready for parallel execution.")

if __name__ == "__main__":
    provision_sub_wallets(10)
