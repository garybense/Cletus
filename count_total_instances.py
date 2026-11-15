import re
import os

path = "/Users/user/code/Cletus/models.txt"
if os.path.exists(path):
    with open(path, "r") as f:
        content = f.read()
    
    # Extract every REAL model line (IP + model_name tuple = unique instance)
    real_instances = re.findall(r'\[(REAL\s+|REAL_DESPITE_NAME)\s*\]\s+([\d\.]+s)\s+\|\s+([\d\.]+)\s+\|\s+([^\s\|]+)\s+\|\s+([\d]+c)', content)
    
    # Set of (IP, model_name) pairs = distinct usable model instances
    distinct_instances = set((m[2], m[3]) for m in real_instances)
    
    print(f"Total verified usable model instances across all IPs: {len(distinct_instances)}")
    
    # Count breakdown by model name
    from collections import Counter
    model_counts = Counter(m[3] for m in real_instances)
    
    print("\nModel Instance Multiplicity:")
    for model_name, count in model_counts.most_common(20):
        print(f"  - {model_name}: {count} instances across nodes")
