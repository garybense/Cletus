import csv, json, re, concurrent.futures, requests, time

ips=[]
with open('ollama_global_results.csv') as f:
    for line in f:
        line=line.strip()
        if not line: continue
        # strip leading index
        m=re.match(r'^\d+\|(.+)$', line)
        ip=m.group(1).strip() if m else line
        ips.append(ip)
ips=list(dict.fromkeys(ips))
print('ips:', len(ips))

def probe(ip):
    url=f'http://{ip}:11434/api/tags'
    try:
        r=requests.get(url, timeout=12)
        if r.status_code!=200:
            return ip, r.status_code, None
        data=r.json()
        models=[m.get('name') for m in data.get('models',[])]
        return ip, 200, models
    except Exception as e:
        return ip, str(e), None

results={}
with concurrent.futures.ThreadPoolExecutor(max_workers=40) as ex:
    fut={ex.submit(probe,ip):ip for ip in ips}
    for f in concurrent.futures.as_completed(fut):
        ip, status, models= f.result()
        results[ip]=(status, models)
        print(ip, status, models)

with open('ollama_models_results.json','w') as f:
    json.dump(results,f,indent=2)
print('done')
