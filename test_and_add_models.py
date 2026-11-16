import re
import json
import os
import requests

models_txt_path = "/Users/user/code/Cletus/models.txt"
if not os.path.exists(models_txt_path):
    print("models.txt not found")
    exit(1)

with open(models_txt_path, "r") as f:
    content = f.read()

# Extract lines marked with [REAL ] or verified successful
real_lines = re.findall(r'\[REAL\s+\]\s+([\d\.]+s)\s+\|\s+([\d\.]+)\s+\|\s+([^\s\|]+)\s+\|', content)
print(f"Found {len(real_lines)} REAL model entries in models.txt")

verified_providers = {}

for elapsed, ip, model_name in real_lines:
    if ip not in verified_providers:
        verified_providers[ip] = []
    if model_name not in verified_providers[ip]:
        verified_providers[ip].append(model_name)

print(f"Extracted {len(verified_providers)} unique valid IPs with real models.")

# Build provider config
providers = []
priority = 1

for ip, models in verified_providers.items():
    provider_id = f"ollama-{ip.replace('.', '-')}"
    base_url = f"http://{ip}:11434/v1"
    
    model_configs = []
    for m in models:
        tier = "reasoning" if ("r1" in m or "70b" in m or "72b" in m) else "fast"
        model_configs.append({
            "id": m,
            "tier": tier,
            "contextWindow": 128000,
            "maxOutputTokens": 8192,
            "supportsTools": True,
            "supportsStreaming": True
        })
    
    providers.append({
        "id": provider_id,
        "name": f"Ollama ({ip}) - Verified Real",
        "baseUrl": base_url,
        "apiKeyEnvVar": "OLLAMA_API_KEY",
        "models": model_configs,
        "priority": priority,
        "enabled": True
    })
    priority += 1

inference_config = {
    "allowInsecureRemoteHttp": True,
    "providers": providers
}

output_path = os.path.expanduser("~/.cletus/inference-providers.json")
with open(output_path, "w") as f:
    json.dump(inference_config, f, indent=2)

print(f"Successfully added {len(providers)} verified real Ollama provider nodes to {output_path}")
