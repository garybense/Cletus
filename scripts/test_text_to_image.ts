import { getDb } from "../src/state/database.js";
import { TextToImageEngine } from "../src/agent/image-generator.js";

async function main() {
  console.log("=========================================================");
  console.log("🎨 TESTING TEXT-TO-IMAGE GENERATION ENGINE");
  console.log("=========================================================\n");

  const db = getDb();
  const rawDb = (db as any).raw || db;
  const engine = new TextToImageEngine(rawDb);

  const prompt = "A futuristic sovereign AI agent core floating in a glowing cyan and emerald digital mesh network, ultra high resolution";
  console.log(`[*] Generating image for prompt: "${prompt}"`);

  const res = await engine.generateImage(prompt, 1200, 600);
  console.log("[+] Text-to-Image Result:\n", JSON.stringify(res, null, 2));

  if (res.success) {
    console.log("\n[✓] Text-to-Image Generation Verified 100% Operational!");
  }
}

main().catch(console.error);
