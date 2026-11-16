import sqlite3
import os

DB_PATH = "/Users/user/.cletus/state.db"

def assign_regional_masters():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Define Regions based on IP Geolocation (Simplified)
    regions = {
        "us-west": "171.67.%",   # Stanford/SV
        "asia-east": "133.11.%",  # Tokyo
        "eu-central": "116.202.%" # Hetzner
    }
    
    print("[*] Aethel: Assigning Regional Sieve Masters...")
    for region, ip_pattern in regions.items():
        master = cursor.execute("SELECT ip FROM sovereign_endpoints WHERE ip LIKE ? AND is_gateway = 1 LIMIT 1", (ip_pattern,)).fetchone()
        if master:
            print(f"[+] Region {region}: Master assigned to {master[0]}")
            # Mark in DB
            cursor.execute("UPDATE sovereign_endpoints SET clade = 'REGIONAL_MASTER' WHERE ip = ?", (master[0],))
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    assign_regional_masters()
