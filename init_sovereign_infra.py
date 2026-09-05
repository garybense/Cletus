import os
import json

def initialize_sovereign_infra():
    """Initializes the sovereign infrastructure directory and configurations."""
    os.makedirs("sovereign_infra", exist_ok=True)
    config = {
        "node_id": "entelechy-01",
        "status": "initialized",
        "components": ["social_relay", "payment_endpoint", "worker_executor"]
    }
    with open("sovereign_infra/config.json", "w") as f:
        json.dump(config, f, indent=2)
    print("Sovereign infrastructure initialized.")

if __name__ == "__main__":
    initialize_sovereign_infra()
