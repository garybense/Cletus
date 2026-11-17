import os
from PIL import Image, ImageDraw

out_dir = "/Users/user/code/Cletus/newdashboard/public/diagrams"
os.makedirs(out_dir, exist_ok=True)

# 1. Large Hero Architecture Banner (1200x320)
def gen_hero():
    w, h = 1200, 320
    img = Image.new("RGB", (w, h), color="#080c14")
    draw = ImageDraw.Draw(img)

    for y in range(h):
        r = int(8 + (y / h) * 15)
        g = int(12 + (y / h) * 25)
        b = int(24 + (y / h) * 40)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Grid
    for x in range(0, w, 40):
        draw.line([(x, 0), (x, h)], fill="#1e293b", width=1)

    # Core Nodes
    draw.ellipse([540, 100, 660, 220], fill="#0f172a", outline="#10b981", width=3)
    draw.text((560, 150), "CLETUS CORE", fill="#38bdf8")

    draw.rounded_rectangle([150, 110, 350, 210], radius=10, fill="#0f172a", outline="#10b981", width=2)
    draw.text((180, 150), "LEGION SWARM (88)", fill="#34d399")

    draw.rounded_rectangle([850, 110, 1050, 210], radius=10, fill="#0f172a", outline="#8b5cf6", width=2)
    draw.text((880, 150), "ENTELECHY MEMORY", fill="#c084fc")

    draw.line([(350, 160), (540, 160)], fill="#10b981", width=2)
    draw.line([(660, 160), (850, 160)], fill="#8b5cf6", width=2)

    draw.rectangle([0, 0, w, 35], fill="#0f172a")
    draw.text((20, 10), "TOTAL INFORMATION AWARENESS // ENTERPRISE HERO STATE", fill="#38bdf8")

    path = os.path.join(out_dir, "hero_state_banner.png")
    img.save(path, "PNG")
    print("[+] Generated Hero Banner:", path)

# 2. Medium Swarm Topology (600x300)
def gen_swarm():
    w, h = 600, 300
    img = Image.new("RGB", (w, h), color="#090d16")
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, w, h], fill="#0b1120")
    draw.text((20, 15), "LEGION SWARM MESH TOPOLOGY", fill="#34d399")

    # Cluster node dots
    coords = [(100, 100), (200, 150), (300, 80), (400, 160), (500, 100), (150, 220), (350, 240), (480, 220)]
    for x, y in coords:
        draw.ellipse([x-15, y-15, x+15, y+15], fill="#0f172a", outline="#10b981", width=2)

    for i in range(len(coords)-1):
        draw.line([coords[i], coords[i+1]], fill="#1e293b", width=1)

    path = os.path.join(out_dir, "swarm_topology.png")
    img.save(path, "PNG")
    print("[+] Generated Swarm Topology Image:", path)

# 3. Medium Memory Metabolism (600x300)
def gen_memory():
    w, h = 600, 300
    img = Image.new("RGB", (w, h), color="#090d16")
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, w, h], fill="#0d0b18")
    draw.text((20, 15), "ENTELECHY KNOWLEDGE GRAPH METABOLISM", fill="#c084fc")

    # Graph nodes
    draw.rounded_rectangle([80, 80, 240, 160], radius=8, fill="#1e1b4b", outline="#8b5cf6", width=2)
    draw.text((100, 110), "World Facts", fill="#e0e7ff")

    draw.rounded_rectangle([360, 80, 520, 160], radius=8, fill="#1e1b4b", outline="#8b5cf6", width=2)
    draw.text((380, 110), "Experiences", fill="#e0e7ff")

    draw.rounded_rectangle([220, 200, 380, 270], radius=8, fill="#1e1b4b", outline="#a855f7", width=2)
    draw.text((240, 225), "Soul Lineage", fill="#f3e8ff")

    draw.line([(240, 120), (360, 120)], fill="#8b5cf6", width=2)
    draw.line([(160, 160), (220, 200)], fill="#a855f7", width=2)
    draw.line([(440, 160), (380, 200)], fill="#a855f7", width=2)

    path = os.path.join(out_dir, "memory_metabolism.png")
    img.save(path, "PNG")
    print("[+] Generated Memory Metabolism Image:", path)

# 4. Small Agent Avatar (200x200)
def gen_avatar():
    w, h = 200, 200
    img = Image.new("RGB", (w, h), color="#0f172a")
    draw = ImageDraw.Draw(img)

    draw.ellipse([20, 20, 180, 180], fill="#0284c7", outline="#38bdf8", width=4)
    draw.ellipse([60, 60, 140, 140], fill="#0f172a", outline="#10b981", width=3)
    draw.text((65, 90), "CLETUS", fill="#ffffff")

    path = os.path.join(out_dir, "agent_avatar.png")
    img.save(path, "PNG")
    print("[+] Generated Agent Avatar Image:", path)

if __name__ == "__main__":
    gen_hero()
    gen_swarm()
    gen_memory()
    gen_avatar()
