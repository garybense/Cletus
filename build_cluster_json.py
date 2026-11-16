import re
import json

models_txt_path = "/Users/user/code/Cletus/models.txt"
with open(models_txt_path, "r") as f:
    content = f.read()

matches = re.findall(r'\[(REAL\s+|REAL_DESPITE_NAME)\s*\]\s+([\d\.]+s)\s+\|\s+([\d\.]+)\s+\|\s+([^\s\|]+)\s+\|\s+([\d]+c)', content)

cluster_nodes = {}
for m in matches:
    ip = m[2]
    model_name = m[3]
    if model_name not in cluster_nodes:
        cluster_nodes[model_name] = f"http://{ip}:11434"

out_path = "/Users/user/code/Cletus/scripts/cluster_nodes.json"
with open(out_path, "w") as f:
    json.dump(cluster_nodes, f, indent=2)

print(f"Generated {out_path} with {len(cluster_nodes)} verified model mappings.")
