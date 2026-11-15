import ipaddress
blocks = [
 "141.142.0.0/16",
 "129.114.0.0/16",
 "132.249.0.0/16",
 "128.55.0.0/16",
 "131.243.0.0/16",
 "160.91.0.0/16",
]
n=0
with open('/Users/user/code/Cletus/hpc_11434_targets.txt','w') as f:
    for b in blocks:
        for ip in ipaddress.ip_network(b).hosts():
            f.write(f"{ip}\n"); n+=1
print(n)
