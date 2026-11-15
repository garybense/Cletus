import subprocess

models_to_pull = [
    "smollm2:135m",
    "tinyllama:latest",
    "llama3.2:1b",
    "llama3.2:3b",
    "qwen2.5:0.5b",
    "qwen2.5:1.5b",
    "qwen2.5:3b",
    "qwen2.5-coder:1.5b",
    "qwen2.5-coder:3b",
    "deepseek-r1:1.5b",
    "deepseek-r1:7b",
    "llama3.1:8b",
]

for m in models_to_pull:
    print(f"[*] Pulling {m} into local Ollama...")
    res = subprocess.run(["ollama", "pull", m], capture_output=True, text=True)
    if res.returncode == 0:
        print(f"[+] Successfully pulled {m}")
    else:
        print(f"[-] Failed to pull {m}: {res.stderr}")
