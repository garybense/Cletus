import ipaddress, concurrent.futures, requests, re, time, sys
from requests.adapters import HTTPAdapter

targets_path='/Users/user/code/Cletus/azure_ml_targets.txt'
out_path='/Users/user/code/Cletus/azure_ollama_models.txt'

ips=[l.strip() for l in open(targets_path) if l.strip()]
print('total', len(ips), flush=True)

sess=requests.Session()
adapter=HTTPAdapter(pool_connections=256, pool_maxsize=256, max_retries=0)
sess.mount('http://', adapter)

def probe(ip):
    url=f'http://{ip}:11434/api/tags'
    try:
        r=sess.get(url, timeout=(3,8))
        if r.status_code!=200: return None
        data=r.json()
        models=[m.get('name') for m in data.get('models',[]) if m.get('name')]
        if not models: return None
        return f"{ip}: {', '.join(models)}"
    except Exception:
        return None

found=0
with open(out_path,'w') as out:
    with concurrent.futures.ThreadPoolExecutor(max_workers=512) as ex:
        fut={ex.submit(probe,ip):ip for ip in ips}
        for i,f in enumerate(concurrent.futures.as_completed(fut),1):
            res=f.result()
            if res:
                out.write(res+'\n'); out.flush(); found+=1
                print(res, flush=True)
            if i%5000==0:
                print(f'progress {i}/{len(ips)} found={found}', flush=True)
print(f'DONE found={found}', flush=True)
