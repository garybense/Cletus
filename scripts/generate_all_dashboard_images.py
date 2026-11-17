import urllib.request, json, os, base64

out_dir = "/Users/user/code/Cletus/newdashboard/public/diagrams"
os.makedirs(out_dir, exist_ok=True)

def generate_flux_image(prompt, filename):
    url = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell"
    api_key = os.environ.get("NVIDIA_API_KEY", "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")

    payload = { "prompt": prompt }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if "artifacts" in data and len(data["artifacts"]) > 0:
                b64_data = data["artifacts"][0]["base64"]
                img_bytes = base64.b64decode(b64_data)

                out_path = os.path.join(out_dir, filename)
                with open(out_path, "wb") as f:
                    f.write(img_bytes)
                print(f"[+] FLUX AI IMAGE SUCCESS -> {out_path} ({len(img_bytes)} bytes)")
                return out_path
    except Exception as e:
        print(f"[-] FLUX AI Error for '{filename}':", e)
        return None

if __name__ == "__main__":
    # 1. State Hero Background (1200x320)
    generate_flux_image(
        "Dark software engineering telemetry interface background, glowing emerald data streams, high technical density, dark studio lighting",
        "hero_state_banner.png"
    )

    # 2. Medium Swarm Topology (600x300)
    generate_flux_image(
        "Network cluster graph showing 88 connected server nodes, green active status indicators, clean technical diagram, dark slate theme",
        "swarm_topology.png"
    )

    # 3. Medium Memory Metabolism (600x300)
    generate_flux_image(
        "Knowledge graph database diagram with purple glowing data links connecting memory nodes, dark theme, high resolution",
        "memory_metabolism.png"
    )

    # 4. Small Agent Avatar (128x128)
    generate_flux_image(
        "Cybernetic AI core icon, metallic emerald emblem, dark studio background, minimalist technical badge",
        "agent_avatar.png"
    )

    # 5. Security Boundary Map (600x300)
    generate_flux_image(
        "Cybersecurity boundary audit map, network port scan matrix, clean green compliance status, dark technical UI",
        "security_audit_map.png"
    )
