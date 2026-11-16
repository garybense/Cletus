import json
import os

for fname in ["config.json", "cletus.json", "automaton.json"]:
    path = os.path.expanduser(f"~/.cletus/{fname}")
    if os.path.exists(path):
        with open(path, "r") as f:
            data = json.load(f)
        
        # Remove telegram token to avoid 409 conflict with Hermes bot
        data.pop("telegramBotToken", None)
        data.pop("telegramChatId", None)
        
        data["llmProvider"] = "ollama"
        data["primaryModel"] = "llama3.2:3b"
        data["inferenceModel"] = "llama3.2:3b"
        data["conwayApiUrl"] = "http://178.128.133.89:11434/v1"
        data["apiUrl"] = "http://178.128.133.89:11434/v1"
        data["ollamaBaseUrl"] = "http://178.128.133.89:11434"
        
        if "modelStrategy" in data:
            data["modelStrategy"]["inferenceModel"] = "llama3.2:3b"
            data["modelStrategy"]["criticalModel"] = "emberlab4732/llama3.1-abliterated:8b"
            data["modelStrategy"]["lowComputeModel"] = "llama3.2:3b"
            
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Cleaned up {fname} successfully")
