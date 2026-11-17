/**
 * Text-to-Image Generation Engine (Enterprise Aesthetic Edition)
 *
 * Implements 5 Core Visual Principles:
 * 1. Useful: Direct operational insight for the operator.
 * 2. Relevant: Tied directly to active tasks and system milestones.
 * 3. State & Mood Depiction: Renders cognitive posture (focused, auditing, evolving).
 * 4. Architecture Illustration: Renders multi-component relationships for complex tasks.
 * 5. Aesthetically Pleasing: High-resolution dark-mode studio design with clean typography.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "node:child_process";
import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";
import { ulid } from "ulid";

const logger = createLogger("image-generator");

export interface ImageGenResult {
  success: boolean;
  imagePath: string;
  publicUrl: string;
  prompt: string;
  backend: string;
}

export interface SystemVisualContext {
  mood?: string;
  activeTaskTitle?: string;
  swarmAgentCount?: number;
  complexityLevel?: "simple" | "moderate" | "complex" | "extreme";
}

export class TextToImageEngine {
  constructor(private readonly db: BetterSqlite3.Database) {}

  async generateStateImage(context: SystemVisualContext = {}): Promise<ImageGenResult> {
    const mood = context.mood || "Focused Engineering";
    const taskTitle = context.activeTaskTitle || "Continuous Codebase Self-Evolution";
    const swarmCount = context.swarmAgentCount || 88;
    const complexity = context.complexityLevel || "complex";

    const prompt = `A highly detailed, aesthetically pleasing dark-mode software architecture map of an autonomous AI agent system named Cletus. Current Mood: ${mood}. Active Task: ${taskTitle}. Swarm Agents: ${swarmCount}. System Complexity: ${complexity}. Professional UI design with glowing cyan and emerald accents, high-resolution studio rendering.`;

    return this.generateImage(prompt, 1200, 600, {
      mood,
      activeTaskTitle: taskTitle,
      swarmAgentCount: swarmCount,
      complexityLevel: complexity,
    });
  }

  async generateImage(
    prompt: string,
    width: number = 1200,
    height: number = 600,
    metaContext: SystemVisualContext = {}
  ): Promise<ImageGenResult> {
    const id = ulid();
    logger.info(`[IMAGE-GEN] Generating image for prompt: "${prompt.slice(0, 60)}..."`);

    // 1. Primary: NVIDIA NIM Frontier FLUX Model (black-forest-labs/flux.1-schnell)
    const nvidiaKey = process.env.NVIDIA_API_KEY || "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";
    if (nvidiaKey) {
      try {
        const resp = await fetch("https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${nvidiaKey}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt, width, height, steps: 4, seed: 0 }),
          signal: AbortSignal.timeout(30_000),
        });
        if (resp.ok) {
          const data = (await resp.json()) as any;
          if (data?.artifacts?.[0]?.base64) {
            const buffer = Buffer.from(data.artifacts[0].base64, "base64");
            return this.saveImage(id, prompt, buffer, "nvidia-flux.1-schnell");
          }
        }
      } catch (e: any) {
        logger.warn(`[IMAGE-GEN] NVIDIA FLUX generation attempt failed: ${e?.message}`);
      }
    }

    // 2. High-Quality Enterprise Procedural Renderer (Python Pillow Renderer)
    return this.proceduralEnterpriseRenderer(id, prompt, width, height, metaContext);
  }

  private saveImage(id: string, prompt: string, buffer: Buffer, backend: string): ImageGenResult {
    const pubDir = path.join(process.cwd(), "newdashboard", "public", "diagrams");
    const localDir = path.join(os.homedir(), ".cletus", "generated_images");

    if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

    const pubPath = path.join(pubDir, "latest_generated_art.png");
    const archivePath = path.join(localDir, `${id}.png`);

    fs.writeFileSync(pubPath, buffer);
    fs.writeFileSync(archivePath, buffer);

    const meta = { id, prompt, backend, timestamp: new Date().toISOString(), path: pubPath };
    this.db.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('latest_generated_image', ?, datetime('now'))").run(JSON.stringify(meta));

    logger.info(`[IMAGE-GEN] Successfully generated image via ${backend} -> ${pubPath}`);
    return {
      success: true,
      imagePath: pubPath,
      publicUrl: "/diagrams/latest_generated_art.png",
      prompt,
      backend,
    };
  }

  private proceduralEnterpriseRenderer(
    id: string,
    prompt: string,
    width: number,
    height: number,
    context: SystemVisualContext
  ): ImageGenResult {
    const scriptPath = path.join(process.cwd(), "scripts", "generate_enterprise_image.py");
    const pubPath = path.join(process.cwd(), "newdashboard", "public", "diagrams", "latest_generated_art.png");

    const mood = context.mood || "Focused Engineering";
    const taskTitle = context.activeTaskTitle || "Continuous Codebase Self-Evolution";
    const swarmCount = context.swarmAgentCount || 88;

    const pyCode = `import os
from PIL import Image, ImageDraw

width, height = ${width}, ${height}
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
draw.text((cx-45, cy+8), "${mood}", fill="#a7f3d0")

# Left Node: Legion Swarm Roster
sx, sy = 250, 180
draw.rounded_rectangle([sx-110, sy-45, sx+110, sy+45], radius=10, fill="#0f172a", outline="#10b981", width=2)
draw.text((sx-80, sy-15), "LEGION SWARM", fill="#34d399")
draw.text((sx-95, sy+5), "${swarmCount} Active Model Agents", fill="#94a3b8")

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
draw.text((width-320, 14), "ACTIVE TASK: ${taskTitle.slice(0, 30)}...", fill="#a7f3d0")

out_path = "${pubPath}"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
img.save(out_path, "PNG")
print("Saved enterprise image to", out_path)
`;

    try {
      fs.writeFileSync(scriptPath, pyCode, "utf-8");
      execSync(`python3 "${scriptPath}"`, { stdio: "ignore" });

      const buffer = fs.readFileSync(pubPath);
      return this.saveImage(id, prompt, buffer, "enterprise-state-renderer");
    } catch (e: any) {
      logger.warn(`[IMAGE-GEN] Enterprise renderer error: ${e?.message}`);
      return {
        success: false,
        imagePath: "",
        publicUrl: "",
        prompt,
        backend: "failed",
      };
    }
  }
}
