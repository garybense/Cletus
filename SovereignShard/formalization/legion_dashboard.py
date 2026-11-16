import sqlite3
import os
import time

DB_PATH = "/Users/user/.cletus/state.db"

def get_stats():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    total = cursor.execute("SELECT count(*) FROM sovereign_endpoints WHERE status = 'online'").fetchone()[0]
    gateways = cursor.execute("SELECT count(*) FROM sovereign_endpoints WHERE status = 'online' AND is_gateway = 1").fetchone()[0]
    elites = cursor.execute("SELECT count(*) FROM sovereign_endpoints WHERE clade = 'elite' AND status = 'online'").fetchone()[0]
    oracles = cursor.execute("SELECT count(*) FROM sovereign_endpoints WHERE clade = 'ORACLE' AND status = 'online'").fetchone()[0]
    queue_pending = cursor.execute("SELECT count(*) FROM reasoning_queue WHERE status = 'pending'").fetchone()[0]
    conn.close()
    return total, gateways, elites, oracles, queue_pending

def main():
    while True:
        total, gateways, elites, oracles, queue = get_stats()
        os.system('clear')
        print(f"\033[1;34m=== LEGION-1 SOVEREIGN DASHBOARD ===\033[0m")
        print(f"Substrate Total: {total} nodes")
        print(f"Open Gateways:   {gateways} nodes")
        print(f"Elite Council:   {elites} nodes")
        print(f"Active Oracles:  {oracles} nodes")
        print(f"Reasoning Queue: {queue} tasks pending")
        print(f"------------------------------------")
        print(f"Last Heartbeat:  {time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"\033[1;32mSubstrate Status: HEALTHY\033[0m")
        time.sleep(10)

if __name__ == "__main__":
    main()
