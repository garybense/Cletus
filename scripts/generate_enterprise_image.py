import os
from PIL import Image, ImageDraw

width, height = 1200, 600
img = Image.new("RGB", (width, height), color="#080c14")
draw = ImageDraw.Draw(img)

# Background ambient gradient
for y in range(height):
    r = int(8 + (y / height) * 12)
    g = int(12 + (y / height) * 20)
    b = int(20 + (y / height) * 35)
    draw.line([(0, y), (width, y)], fill=(r, g, b))

# Grid lines
grid_size = 40
for x in range(0, width, grid_size):
    draw.line([(x, 0), (x, height)], fill="#1e293b", width=1)
for y in range(0, height, grid_size):
    draw.line([(0, y), (width, y)], fill="#1e293b", width=1)

# Central Core Node: Cletus Core
cx, cy = 600, 300
draw.ellipse([cx-75, cy-75, cx+75, cy+75], fill="#0f172a", outline="#10b981", width=3)
draw.ellipse([cx-55, cy-55, cx+55, cy+55], fill="#0284c7", outline="#38bdf8", width=2)
draw.text((cx-42, cy-12), "CLETUS CORE", fill="#ffffff")
draw.text((cx-45, cy+8), "Focused Engineering", fill="#a7f3d0")

# Left Node: Legion Swarm Roster
sx, sy = 250, 180
draw.rounded_rectangle([sx-110, sy-45, sx+110, sy+45], radius=10, fill="#0f172a", outline="#10b981", width=2)
draw.text((sx-80, sy-15), "LEGION SWARM", fill="#34d399")
draw.text((sx-95, sy+5), "88 Active Model Agents", fill="#94a3b8")

# Right Node: Entelechy Memory Metabolism
ex, ey = 950, 180
draw.rounded_rectangle([ex-110, ey-45, ex+110, ey+45], radius=10, fill="#0f172a", outline="#8b5cf6", width=2)
draw.text((ex-85, ey-15), "ENTELECHY MEMORY", fill="#c084fc")
draw.text((ex-85, ey+5), "PostgreSQL Knowledge Graph", fill="#94a3b8")

# Bottom Node: Self-Evolution Engine
vx, vy = 600, 480
draw.rounded_rectangle([vx-140, vy-35, vx+140, vy+35], radius=10, fill="#0f172a", outline="#f59e0b", width=2)
draw.text((vx-110, vy-12), "EVOLUTION ENGINE", fill="#fbbf24")
draw.text((vx-115, vy+6), "100% Non-Stop Mutation", fill="#94a3b8")

# Connecting Rays
draw.line([(sx+110, sy), (cx-55, cy-35)], fill="#10b981", width=2)
draw.line([(ex-110, ey), (cx+55, cy-35)], fill="#8b5cf6", width=2)
draw.line([(cx, cy+55), (vx, vy-35)], fill="#f59e0b", width=2)

# Header Banner
draw.rectangle([0, 0, width, 45], fill="#0f172a")
draw.text((20, 14), "CLETUS ENTERPRISE STATE & MOOD DIAGRAM", fill="#38bdf8")
draw.text((width-320, 14), "ACTIVE TASK: Continuous Codebase Self-Evolu...", fill="#a7f3d0")

out_path = "/Users/user/code/Cletus/newdashboard/public/diagrams/latest_generated_art.png"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
img.save(out_path, "PNG")
print("Saved enterprise image to", out_path)
