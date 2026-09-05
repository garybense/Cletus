import fs from "node:fs";
import path from "node:path";

async function main() {
  const prompt = process.argv[2] || "professional software engineer, 28 years old, candid natural portrait, warm smile, studio lighting";
  const outputPath = process.argv[3] || path.join(process.env.HOME || '/root', '.cletus', 'personas', 'default', 'avatar.png');

  console.log(`Generating portrait for prompt: "${prompt}"`);
  console.log(`Output target: ${outputPath}`);

  const enhancedPrompt = encodeURIComponent(
    prompt + ", photorealistic portrait, professional natural lighting, 8k, authentic human face, sharp focus"
  );
  const url = `https://image.pollinations.ai/prompt/${enhancedPrompt}?width=1024&height=1024&nologo=true&model=flux`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Avatar generation request failed with status: ${resp.status}`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
  console.log(`✅ Avatar generated and saved successfully (${arrayBuffer.byteLength} bytes) to ${outputPath}`);
}

main().catch(err => {
  console.error("❌ Avatar generation failed:", err.message);
  process.exit(1);
});
