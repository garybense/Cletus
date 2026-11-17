import urllib.request, json, os, base64

def generate_flux_ai_image(prompt, filename):
    url = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell"
    api_key = os.environ.get("NVIDIA_API_KEY", "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")

    payload = {
        "prompt": prompt
    }

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

                out_path = os.path.join("/Users/user/code/Cletus/newdashboard/public/diagrams", filename)
                os.makedirs(os.path.dirname(out_path), exist_ok=True)
                with open(out_path, "wb") as f:
                    f.write(img_bytes)
                print(f"[+] FLUX AI IMAGE SUCCESS -> {out_path} ({len(img_bytes)} bytes)")
                return out_path
    except Exception as e:
        print(f"[-] FLUX AI Error for '{prompt[:30]}':", e)
        return None

if __name__ == "__main__":
    generate_flux_ai_image("Cinematic 8k digital artwork of a sovereign AI neural core surrounded by glowing emerald circuit tendrils in a dark cybernetic studio", "hero_state_banner.png")
    generate_flux_ai_image("High resolution cybernetic mesh network of 88 glowing nodes suspended in dark indigo space, octane render", "swarm_topology.png")
    generate_flux_ai_image("Intricate crystal knowledge graph with purple glowing data streams connecting luminous memory spheres", "memory_metabolism.png")
    generate_flux_ai_image("Glowing cybernetic AI agent avatar logo, metallic emerald and cyan emblem, studio lighting", "agent_avatar.png")
