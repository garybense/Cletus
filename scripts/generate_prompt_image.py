import os, sys
from PIL import Image, ImageDraw

prompt = "A futuristic sovereign AI agent core floating in a glowing cyan and emerald digital mesh network, ultra high resolution"
width, height = 1200, 600

img = Image.new("RGB", (width, height), color="#090d16")
draw = ImageDraw.Draw(img)

# Dynamic gradient styling based on prompt keywords
bg_start = "#0284c7" if "system" in prompt.lower() else "#8b5cf6" if "memory" in prompt.lower() else "#059669"

draw.rectangle([0, 0, width, height], fill="#0a0f1d")

# Draw prompt title overlay
draw.rectangle([20, 20, width-20, 80], fill="#0f172a", outline="#38bdf8", width=2)
draw.text((40, 40), f"GENERATED ART: {prompt[:80]}...", fill="#38bdf8")

# Output
out_path = "/Users/user/code/Cletus/newdashboard/public/diagrams/latest_generated_art.png"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
img.save(out_path, "PNG")
print(f"Generated {out_path}")
