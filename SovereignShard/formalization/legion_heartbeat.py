import sqlite3
import time
import os

DB_PATH = os.path.expanduser("~/.cletus/state.db")

def main():
    while True:
        try:
            conn = sqlite3.connect(DB_PATH)
            count = conn.execute("SELECT count(*) FROM operational_models WHERE status = 'active'").fetchone()[0]
            conn.close()
            
            # Write to a status file for external monitoring without a database hit
            with open("/Users/user/code/CletusWork/substrate_status.txt", "w") as f:
                f.write(f"ACTIVE_MODELS: {count}\nLAST_PULSE: {time.ctime()}\n")
            
        except Exception as e:
            print(f"Heartbeat Error: {e}")
            
        time.sleep(60) # Only pulse once per minute to save resources

if __name__ == "__main__":
    main()
