import { runRemoteOrLocal } from "../src/replication/openclaw-spawner.js";
import { buildWorkspaceTailCommand, parseWorkspaceTails } from "../src/replication/gateway-activity.js";

const r = await runRemoteOrLocal(`timeout 30 ${buildWorkspaceTailCommand()}`);
console.log("stdout bytes:", r.stdout.length, "stderr:", r.stderr.slice(0, 100));
const parsed = parseWorkspaceTails(r.stdout);
console.log("parsed workspaces:", parsed.length);
for (const w of parsed.slice(0, 5)) {
  console.log(` ${w.name}:`, w.recent.map((f) => `${f.file} (${Math.round(f.ageMs / 60000)}m ago)`).join(", ") || "quiet");
}
