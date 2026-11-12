import { loadConfig } from "../src/config.js";

async function main() {
  const config = loadConfig();
  if (!config) {
    console.error("FAILED to load CletusConfig via loadConfig()");
    process.exit(1);
  }

  console.log("✓ Cletus loadConfig() successfully parsed ~/.cletus/cletus.json");
  console.log(`  - Active Model: ${config.inferenceModel}`);
  console.log(`  - Conway API URL: ${config.conwayApiUrl}`);
  console.log(`  - Max Children: ${config.maxChildren}`);
  console.log(`  - Log Level: ${config.logLevel}`);
  console.log(`  - Treasury Minimum Reserve: ${config.treasuryPolicy?.minimumReserveCents} cents`);
  console.log(`  - Soul Reflection Enabled: ${config.soulConfig?.enableSoulReflection}`);
}

main().catch((err) => {
  console.error("Config load error:", err);
  process.exit(1);
});
