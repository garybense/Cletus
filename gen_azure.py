import json, ipaddress
d=json.load(open('/Users/user/Downloads/ServiceTags_Public_20261019.json'))
names=['AzureMachineLearning','AzureMachineLearningInference']
ips=set()
for v in d['values']:
    if v['name'] in names or v['name'].startswith('AzureMachineLearning.'):
        for p in v['properties']['addressPrefixes']:
            net=ipaddress.ip_network(p, strict=False)
            for ip in net.hosts():
                ips.add(str(ip))
with open('/Users/user/code/Cletus/azure_ml_targets.txt','w') as f:
    for ip in sorted(ips):
        f.write(ip+'\n')
print(len(ips))
