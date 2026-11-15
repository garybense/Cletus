import json
import os

cletus_dir = os.path.expanduser("~/.cletus")
canonical_path = os.path.join(cletus_dir, "cletus.json")

# Source files to merge into cletus.json and then remove
other_paths = [
    os.path.join(cletus_dir, "config.json"),
    os.path.join(cletus_dir, "automaton.json"),
    "/Users/user/code/Cletus/shortcut/cletus.json",
    "/Users/user/code/Cletus/shortcut/automaton.json",
]

merged = {}

# Start with canonical cletus.json if present
if os.path.exists(canonical_path):
    with open(canonical_path, "r") as f:
        merged.update(json.load(f))

# Merge keys from all other config files
for p in other_paths:
    if os.path.exists(p):
        try:
            with open(p, "r") as f:
                data = json.load(f)
                for k, v in data.items():
                    if k not in merged or (merged[k] is None and v is not None):
                        merged[k] = v
        except Exception as e:
            print(f"Warning reading {p}: {e}")

# Ensure clean model routing & no telegram token conflict
merged.pop("telegramBotToken", None)
merged.pop("telegramChatId", None)
merged["llmProvider"] = "ollama"
merged["primaryModel"] = "llama3.2:3b"
merged["inferenceModel"] = "llama3.2:3b"
merged["conwayApiUrl"] = "http://178.128.133.89:11434/v1"
merged["apiUrl"] = "http://178.128.133.89:11434/v1"
merged["ollamaBaseUrl"] = "http://178.128.133.89:11434"

# Save consolidated canonical cletus.json
with open(canonical_path, "w") as f:
    json.dump(merged, f, indent=2)
print(f"Consolidated canonical config written to {canonical_path}")

# Remove all redundant config files
for p in other_paths:
    if os.path.exists(p):
        try:
            os.remove(p)
            print(f"Removed redundant config: {p}")
        except Exception as e:
            print(f"Error removing {p}: {e}")
