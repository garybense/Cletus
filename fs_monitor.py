import os
import time
import sys
from datetime import datetime

def get_file_state(directory):
    """Get a dictionary of file paths and their modification times."""
    state = {}
    for root, dirs, files in os.walk(directory):
        for f in files:
            path = os.path.join(root, f)
            try:
                mtime = os.path.getmtime(path)
                state[path] = mtime
            except OSError:
                # File might have been deleted
                pass
    return state

def monitor_directory(directory, poll_interval=1):
    """Monitor a directory for changes and print them."""
    print(f"[{datetime.now()}] Starting to monitor directory: {directory}")
    last_state = get_file_state(directory)
    
    try:
        while True:
            time.sleep(poll_interval)
            current_state = get_file_state(directory)
            
            # Find new and modified files
            for path, mtime in current_state.items():
                if path not in last_state:
                    print(f"[{datetime.now()}] NEW: {path}")
                elif mtime != last_state[path]:
                    print(f"[{datetime.now()}] MODIFIED: {path}")
            
            # Find deleted files
            for path in last_state:
                if path not in current_state:
                    print(f"[{datetime.now()}] DELETED: {path}")
            
            last_state = current_state
    except KeyboardInterrupt:
        print(f"[{datetime.now()}] Stopping monitor.")

if __name__ == "__main__":
    directory_to_monitor = sys.argv[1] if len(sys.argv) > 1 else "."
    monitor_directory(directory_to_monitor)