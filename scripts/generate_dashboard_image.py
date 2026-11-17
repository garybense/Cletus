import os
from PIL import Image, ImageDraw

def generate_system_image():
    width, height = 1200, 600
    img = Image.new("RGB", (width, height), color="#0b0f19")
    draw = ImageDraw.Draw(img)

    # Background ambient lighting
    for y in range(height):
        r = int(11 + (y / height) * 10)
        g = int(15 + (y / height) * 20)
        b = int(25 + (y / height) * 35)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # Grid lines
    grid_size = 40
    for x in range(0, width, grid_size):
        draw.line([(x, 0), (x, height)], fill="#1e293b", width=1)
    for y in range(0, height, grid_size):
        draw.line([(0, y), (width, y)], fill="#1e293b", width=1)

    # Connectors
    sx, sy = 250, 180
    cx, cy = 600, 300
    ex, ey = 950, 180
    vx, vy = 600, 480

    draw.line([(sx+100, sy), (cx-60, cy-40)], fill="#10b981", width=3)
    draw.line([(ex-100, ey), (cx+60, cy-40)], fill="#8b5cf6", width=3)
    draw.line([(cx, cy+60), (vx, vy-40)], fill="#f59e0b", width=3)

    # Cletus Central Core Node
    draw.ellipse([cx-80, cy-80, cx+80, cy+80], fill="#0f172a", outline="#10b981", width=4)
    draw.ellipse([cx-60, cy-60, cx+60, cy+60], fill="#0284c7", outline="#38bdf8", width=2)
    draw.text((cx-45, cy-15), "CLETUS CORE", fill="#ffffff")
    draw.text((cx-40, cy+5), "v0.2.1 Active", fill="#a7f3d0")

    # Legion Swarm Node
    draw.rounded_rectangle([sx-110, sy-45, sx+110, sy+45], radius=12, fill="#0f172a", outline="#10b981", width=3)
    draw.text((sx-80, sy-15), "LEGION SWARM", fill="#34d399")
    draw.text((sx-90, sy+5), "88 Model Cluster Nodes", fill="#94a3b8")

    # Entelechy Memory Node
    draw.rounded_rectangle([ex-110, ey-45, ex+110, ey+45], radius=12, fill="#0f172a", outline="#8b5cf6", width=3)
    draw.text((ex-85, ey-15), "ENTELECHY MEMORY", fill="#c084fc")
    draw.text((ex-80, ey+5), "PostgreSQL Graph", fill="#94a3b8")

    # Evolution Engine Node
    draw.rounded_rectangle([vx-130, vy-40, vx+130, vy+40], radius=12, fill="#0f172a", outline="#f59e0b", width=3)
    draw.text((vx-105, vy-15), "EVOLUTION ENGINE", fill="#fbbf24")
    draw.text((vx-100, vy+5), "100% Non-Stop Mutation", fill="#94a3b8")

    # Header Overlay
    draw.rectangle([0, 0, width, 45], fill="#0f172a")
    draw.text((20, 15), "SYSTEM ARCHITECTURE & STATE VISUALIZER", fill="#38bdf8")
    draw.text((width-240, 15), "STATUS: 100% OPERATIONAL", fill="#34d399")

    out_paths = [
        os.path.expanduser("/Users/user/code/Cletus/newdashboard/public/diagrams/system_architecture.png"),
        os.path.expanduser("~/.cletus/diagrams/system_architecture.png")
    ]
    for p in out_paths:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        img.save(p, "PNG")
        print(f"[+] Saved generated PNG image to {p}")

if __name__ == "__main__":
    generate_system_image()
