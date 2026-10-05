#!/usr/bin/env python3
import json
import urllib.request

# Fetch AWS IP ranges
with urllib.request.urlopen('https://ip-ranges.amazonaws.com/ip-ranges.json') as response:
    data = json.loads(response.read())

# Define target regions
target_regions = {
    'ap-northeast-1': 'Tokyo',
    'ap-northeast-2': 'Seoul', 
    'ap-south-1': 'Mumbai',
}

print('# AWS Asia-Pacific CIDR Blocks (High-Density Developer Infrastructure)')
print('=' * 70)

for region, city in target_regions.items():
    print(f'\n### Asia Pacific ({city}) - {region}')
    
    # Get all EC2 and AMAZON prefixes for this region
    prefixes = set()
    for prefix in data['prefixes']:
        if prefix['region'] == region:
            if prefix['service'] in ['EC2', 'AMAZON']:
                prefixes.add(prefix['ip_prefix'])
    
    # Sort and print
    sorted_prefixes = sorted(prefixes)
    for p in sorted_prefixes:
        print(f'  {p}')
    
    print(f'Total: {len(prefixes)} prefixes')