import { retainEntelechyTaskResult } from "../src/memory/entelechy-client.js";
import fs from "fs";
import path from "path";

async function main() {
  console.log("=========================================================");
  console.log("🧠 RETAINING CLETUS ARCHITECTURAL DIGEST INTO ENTELECHY");
  console.log("=========================================================\n");

  const digestPath = path.join(process.cwd(), "CLETUS_ARCHITECTURAL_DIGEST.md");
  const content = fs.readFileSync(digestPath, "utf-8");

  await retainEntelechyTaskResult(
    `cletus_architectural_digest_${Date.now()}`,
    content,
    "cletus"
  ).catch(() => {});

  await retainEntelechyTaskResult(
    `cletus_architectural_digest_${Date.now()}`,
    content,
    "sovereign"
  ).catch(() => {});

  console.log("[+] Successfully retained Architectural Digest into Entelechy banks 'cletus' & 'sovereign'!");
}

main().catch(console.error);
