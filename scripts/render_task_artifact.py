import os
from PIL import Image, ImageDraw

w, h = 1024, 400
img = Image.new("RGB", (w, h), color="#090d16")
draw = ImageDraw.Draw(img)

# Background
draw.rectangle([0, 0, w, h], fill="#090d16")
draw.rectangle([0, 0, w, 40], fill="#0f172a")

# Header
draw.text((20, 12), "OPERATIONAL WORK ARTIFACT // REAL-TIME CODE MODIFICATION PROVENANCE", fill="#38bdf8")

# Task & Commit Meta
draw.text((30, 60), f"TASK ID: tsk_evolution_cycle_005", fill="#a7f3d0")
draw.text((30, 85), f"TASK TITLE: Non-Stop Codebase Self-Evolution & AST Refactoring", fill="#ffffff")
draw.text((30, 110), f"GIT COMMIT HASH: a20be5e", fill="#fbbf24")
draw.text((30, 135), f"EXECUTOR MODEL: deepseek-r1:671b | LATENCY: 14200ms", fill="#c084fc")

# Files & Diff Metrics
draw.rectangle([20, 170, w-20, h-20], fill="#0f172a", outline="#1e293b", width=1)
draw.text((40, 185), "MODIFIED FILES & AST PROVENANCE:", fill="#94a3b8")

y = 215
for f in ["src/orchestration/autonomous-growth.ts","newdashboard/src/components/mission/dashboard.tsx","src/agent/loop.ts"]:
    draw.text((50, y), f"  • {f}", fill="#34d399")
    y += 25

draw.text((40, h-45), f"DIFF METRICS: +172 insertions / -38 deletions", fill="#38bdf8")

out_path = "/Users/user/code/Cletus/newdashboard/public/task_artifacts/latest_task_artifact.png"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
img.save(out_path, "PNG")
print("Saved operational artifact to", out_path)
