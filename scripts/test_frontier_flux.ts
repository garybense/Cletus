import { getDb } from "../src/state/database.js";
import fs from "fs";
import path from "path";

async function main() {
  console.log("=========================================================");
  console.log("🎨 TESTING FRONTIER MODEL IMAGE GENERATION (FLUX.1 SCHNELL)");
  console.log("=========================================================\n");

  const prompt = "A highly detailed, cinematic, high-resolution visual of Cletus: an autonomous sovereign AI core pulsing in an emerald digital architecture grid.";
  const apiKey = process.env.NVIDIA_API_KEY || "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";
  const model = "black-forest-labs/flux.1-schnell";
  const endpoint = `https://ai.api.nvidia.com/v1/genai/${model}`;

  console.log(`[*] Querying Frontier Model FLUX endpoint: ${endpoint}`);
  console.log(`[*] Prompt: "${prompt}"`);

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, width: 1024, height: 768, steps: 4 }),
    });

    console.log(`[+] HTTP Response Status: ${resp.status}`);
    const data = (await resp.json()) as any;
    console.log("[+] Response Payload:\n", JSON.stringify(data, null, 2));

    if (data?.artifacts?.[0]?.base64) {
      const b64 = data.artifacts[0].base64;
      const buffer = Buffer.from(b64, "base64");
      const pubPath = path.join(process.cwd(), "newdashboard", "public", "diagrams", "system_architecture.png");
      fs.mkdirSync(path.dirname(pubPath), { recursive: true });
      fs.writeFileSync(pubPath, buffer);
      console.log(`\n[✓] FRONTIER FLUX IMAGE GENERATED & SAVED TO: ${pubPath}`);
    } else if (data?.image || data?.b64_json) {
      console.log("\n[✓] Frontier FLUX Image Generated Successfully!");
    }
  } catch (err: any) {
    console.error("[-] Frontier FLUX error:", err?.message || err);
  }
}

main().catch(console.error);
