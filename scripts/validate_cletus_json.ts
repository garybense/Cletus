import fs from "fs";
import path from "path";

async function main() {
  const configPath = "/Users/user/.cletus/cletus.json";
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    console.log("✓ JSON syntax is 100% valid.");
    console.log(`✓ Total parameters defined: ${Object.keys(raw).length}`);
    console.log("\nParameters Breakdown:");
    for (const [key, value] of Object.entries(raw)) {
      const displayVal = typeof value === "object" ? JSON.stringify(value) : String(value);
      console.log(`  - ${key}: ${displayVal}`);
    }
  } catch (err: any) {
    console.error("Invalid JSON format:", err.message);
  }
}

main();
