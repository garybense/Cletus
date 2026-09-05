import fs from 'fs';
const env = fs.readFileSync('.env', 'utf-8');
for (const line of env.split('\n')) {
  if (line.trim() && !line.startsWith('#')) {
    const [k, ...v] = line.split('=');
    process.env[k.trim()] = v.join('=').trim();
  }
}
import { createInferenceClient } from './dist/mindmods/inference.js';

async function main() {
  const client = createInferenceClient({
    apiUrl: "unused",
    apiKey: "unused",
    defaultModel: "nvidia/nemotron-3-super-120b-a12b",
    maxTokens: 100,
    getModelProvider: () => "nvidia"
  });
  
  try {
    const res = await client.chat([{role: "user", content: "Hi"}]);
    console.log("Success:", res.id);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
main();
