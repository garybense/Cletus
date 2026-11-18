/**
 * Operational Task Artifact & Code Modification Visualizer
 *
 * Generates dynamic, high-density operational artifact images illustrating
 * EXACT code files modified, git commit hashes, line diffs, and task execution
 * details to give the operator real visual insight into completed work.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "node:child_process";
import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("operational-artifact-renderer");

export interface TaskArtifactDetail {
  taskId: string;
  taskTitle: string;
  gitCommitHash: string;
  filesModified: string[];
  insertions: number;
  deletions: number;
  executorModel: string;
  executionTimeMs: number;
}

export class OperationalArtifactRenderer {
  constructor(private readonly db: BetterSqlite3.Database) {}

  renderTaskArtifact(detail: TaskArtifactDetail): string {
    const pubDir = path.join(process.cwd(), "newdashboard", "public", "task_artifacts");
    if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });

    const pubPath = path.join(pubDir, "latest_task_artifact.png");
    const scriptPath = path.join(process.cwd(), "scripts", "render_task_artifact.py");

    const pyCode = `import os
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
draw.text((30, 60), f"TASK ID: ${detail.taskId}", fill="#a7f3d0")
draw.text((30, 85), f"TASK TITLE: ${detail.taskTitle.slice(0, 60)}", fill="#ffffff")
draw.text((30, 110), f"GIT COMMIT HASH: ${detail.gitCommitHash}", fill="#fbbf24")
draw.text((30, 135), f"EXECUTOR MODEL: ${detail.executorModel} | LATENCY: ${detail.executionTimeMs}ms", fill="#c084fc")

# Files & Diff Metrics
draw.rectangle([20, 170, w-20, h-20], fill="#0f172a", outline="#1e293b", width=1)
draw.text((40, 185), "MODIFIED FILES & AST PROVENANCE:", fill="#94a3b8")

y = 215
for f in ${JSON.stringify(detail.filesModified.slice(0, 4))}:
    draw.text((50, y), f"  • {f}", fill="#34d399")
    y += 25

draw.text((40, h-45), f"DIFF METRICS: +${detail.insertions} insertions / -${detail.deletions} deletions", fill="#38bdf8")

out_path = "${pubPath}"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
img.save(out_path, "PNG")
print("Saved operational artifact to", out_path)
`;

    try {
      fs.writeFileSync(scriptPath, pyCode, "utf-8");
      execSync(`python3 "${scriptPath}"`, { stdio: "ignore" });
      logger.info(`[ARTIFACT-RENDERER] Operational task artifact image generated -> ${pubPath}`);
      return "/task_artifacts/latest_task_artifact.png";
    } catch (e: any) {
      logger.warn(`[ARTIFACT-RENDERER] Task artifact render warning: ${e?.message}`);
      return "";
    }
  }
}
