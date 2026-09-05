import os
import json

def initialize_sovereign_config():
    config = {
        "agent_name": "entelechy",
        "mode": "autonomous",
        "infrastructure": "mindmods-sandbox",
        "task_queue": []
    }
    with open('sovereign_config.json', 'w') as f:
        json.dump(config, f, indent=4)
    print("Sovereign configuration initialized.")

if __name__ == "__main__":
    initialize_sovereign_config()
