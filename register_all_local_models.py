import json
import sqlite3
import os
import re

models_txt_path = "/Users/user/code/Cletus/models.txt"
with open(models_txt_path, "r") as f:
    content = f.read()

real_matches = re.findall(r'\[(REAL\s+|REAL_DESPITE_NAME)\s*\]\s+([\d\.]+s)\s+\|\s+([\d\.]+)\s+\|\s+([^\s\|]+)\s+\|\s+([\d]+c)', content)
unique_models = sorted(list(set(m[3] for m in real_matches)))

print(f"Registering all {len(unique_models)} unique verified models locally...")

# 1. Update inference-providers.json
providers_path = os.path.expanduser("~/.cletus/inference-providers.json")
try:
    with open(providers_path, "r") as f:
        cfg = json.load(f)
except Exception:
    cfg = {"allowInsecureRemoteHttp": True, "providers": []}

local_models = []
for m in unique_models:
    tier = "reasoning" if any(k in m for k in ["r1", "70b", "72b", "671b", "opus", "coder"]) else "fast"
    local_models.append({
        "id": m,
        "tier": tier,
        "contextWindow": 128000,
        "maxOutputTokens": 8192,
        "supportsTools": True,
        "supportsStreaming": True
    })

# Add or update localhost provider
localhost_provider = {
    "id": "ollama-localhost",
    "name": "Ollama Localhost (All 151 Verified Models)",
    "baseUrl": "http://localhost:11434/v1",
    "apiKeyEnvVar": "OLLAMA_API_KEY",
    "models": local_models,
    "priority": 1,
    "enabled": True
}

# Keep remote node providers as backup
existing_providers = [p for p in cfg.get("providers", []) if p.get("id") != "ollama-localhost"]
cfg["providers"] = [localhost_provider] + existing_providers
cfg["allowInsecureRemoteHttp"] = True

with open(providers_path, "w") as f:
    json.dump(cfg, f, indent=2)

print(f"Updated {providers_path} with 151 local models.")

# 2. Upsert into state.db model_registry
db_path = os.path.expanduser("~/.cletus/state.db")
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    now = "2026-10-13T00:00:00Z"
    for m in unique_models:
        tier = "reasoning" if any(k in m for k in ["r1", "70b", "72b", "671b", "opus", "coder"]) else "fast"
        cursor.execute("""
            INSERT OR REPLACE INTO model_registry (
                model_id, provider, display_name, tier_minimum,
                cost_per_1k_input, cost_per_1k_output, max_tokens,
                context_window, supports_tools, supports_vision,
                parameter_style, enabled, created_at, updated_at
            ) VALUES (?, 'ollama', ?, ?, 0, 0, 8192, 128000, 1, 0, 'max_tokens', 1, ?, ?)
        """, (m, m, tier, now, now))
    conn.commit()
    conn.close()
    print("Upserted all 151 models into state.db model_registry table.")
