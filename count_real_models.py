import re
import os

path = "/Users/user/code/Cletus/models.txt"
if os.path.exists(path):
    with open(path, "r") as f:
        content = f.read()
    
    real_matches = re.findall(r'\[(REAL\s+|REAL_DESPITE_NAME)\s*\]\s+([\d\.]+s)\s+\|\s+([\d\.]+)\s+\|\s+([^\s\|]+)\s+\|\s+([\d]+c)', content)
    print(f"Strictly verified working real models with token generation: {len(real_matches)}")
    
    # Print unique models
    unique_models = set(m[3] for m in real_matches)
    print(f"Unique real working models: {len(unique_models)}")
    for m in unique_models:
        print("  -", m)
