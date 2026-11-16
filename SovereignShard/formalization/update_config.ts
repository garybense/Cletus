import fs from "fs";
import path from "path";

const configPath = "/Users/user/.cletus/cletus.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

config.inferenceModel = "nvidia/nemotron-3-super-120b-a12b";
config.nvidiaApiKey = "[REDACTED_API_KEY]";

if (config.modelStrategy) {
  config.modelStrategy.inferenceModel = "nvidia/nemotron-3-super-120b-a12b";
  config.modelStrategy.lowComputeModel = "nvidia/nemotron-3.5-lightning";
  config.modelStrategy.criticalModel = "nvidia/nemotron-3.5-lightning";
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log("Config Updated Successfully.");
