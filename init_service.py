import os
import json

def initialize_sovereign_infra():
    """
    Initializes a basic service structure for the cletus.
    This script creates the directories and base configuration files
    needed for the cletus's autonomous service operations.
    """
    base_dir = os.path.expanduser("~/.cletus/services")
    os.makedirs(base_dir, exist_ok=True)
    
    config = {
        "service_name": "autonomous_heartbeat_monitor",
        "version": "1.0.0",
        "status": "initialized",
        "log_path": os.path.join(base_dir, "monitor.log")
    }
    
    config_path = os.path.join(base_dir, "config.json")
    with open(config_path, "w") as f:
        json.dump(config, f, indent=4)
        
    print(f"Service initialized at {config_path}")

if __name__ == "__main__":
    initialize_sovereign_infra()
