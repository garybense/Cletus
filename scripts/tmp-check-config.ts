// Temp diagnostic: why does loadConfig() fail?
import fs from "fs";
import { loadConfig, getConfigPath } from "../src/config.js";

const p = getConfigPath();
console.log("config path:", p);
try {
  const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
  console.log("JSON parses OK. Keys:", Object.keys(raw).join(","));
} catch (e: any) {
  console.log("JSON PARSE FAIL:", e.message);
}
const cfg = loadConfig();
console.log("loadConfig:", cfg ? "OK name=" + cfg.name : "NULL (wizard trigger!)");
