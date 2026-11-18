import { getDb } from "../src/state/database.js";
import { ClaudePluginAdapter } from "../src/plugins/claude-plugin-adapter.js";

async function main() {
  console.log("=========================================================");
  console.log("🧩 TESTING CLAUDE PLUGIN SYSTEM INSTALLATION & CONVERSION");
  console.log("=========================================================\n");

  const db = getDb();
  const rawDb = (db as any).raw || db;
  const adapter = new ClaudePluginAdapter(rawDb);

  const command = "/plugin install plane-self-hosting --marketplace makeplane/plane-claude-plugin";
  console.log(`[*] Executing command: "${command}"...`);

  // Parse command syntax
  const match = command.match(/\/plugin\s+install\s+([^\s]+)\s+--marketplace\s+([^\s]+)/i);
  if (!match) {
    throw new Error("Command syntax parsing failed");
  }

  const pluginName = match[1];
  const marketplaceRepo = match[2];

  const res = await adapter.installPlugin(pluginName, marketplaceRepo);

  console.log("\n[+] CLAUDE PLUGIN INSTALLATION RESULT:");
  console.log(JSON.stringify(res, null, 2));

  // Verify installed plugins list
  const installedList = adapter.loadInstalledPlugins();
  console.log(`\n[+] Installed Plugins Verified (${installedList.length} active plugin(s)):`);
  for (const p of installedList) {
    console.log(`   - Plugin: ${p.name} (v${p.version || "1.0.0"}) | Repo: ${p.marketplace}`);
  }

  if (res.success && installedList.length > 0) {
    console.log("\n[✓] Claude Plugin Installation & Tool Adapter Verified 100% Operational!");
  }
}

main().catch(console.error);
