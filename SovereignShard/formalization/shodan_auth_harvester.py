import asyncio
import json
import time
import re
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        print("[*] Connecting to 127.0.0.1:9222...")
        try:
            browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222")
            context = browser.contexts[0]
            
            target_page = None
            for page in context.pages:
                if "shodan.io/search" in page.url:
                    target_page = page
                    break
            
            if not target_page:
                print("[!] No Shodan search tab detected.")
                return

            print(f"[+] Attached to: {target_page.url}")
            all_ips = set()
            
            for i in range(1, 11): 
                print(f"[*] Extracting IPs from Page {i}...")
                
                # Ruthless Scrape: Pull all text including shadow DOMs and attribute content
                page_data = await target_page.evaluate("""() => {
                    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                    let node;
                    const text = [];
                    while(node = walk.nextNode()) text.push(node.textContent);
                    // Also grab all links and titles
                    document.querySelectorAll('a').forEach(a => text.push(a.innerText, a.href));
                    return text.join(' ');
                }""")
                
                # Broad regex for IPv4
                found = re.findall(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', page_data)
                valid = [ip for ip in found if not ip.startswith(('127.', '10.', '192.168.', '0.', '172.', '169.254.', '224.', '255.'))]
                
                if valid:
                    for ip in valid:
                        all_ips.add(f"{ip}:11434")
                    print(f"[+] Page {i}: Found {len(set(valid))} unique IPs. Total unique: {len(all_ips)}")
                else:
                    print(f"[!] No IPs detected on Page {i}.")
                
                print("[*] Waiting for you to click 'Next' (15s)...")
                await asyncio.sleep(15)
            
            if all_ips:
                output_path = "/Users/user/code/CletusWork/ollama_ips.json"
                with open(output_path, "w") as f:
                    json.dump(list(all_ips), f, indent=2)
                print(f"\n[SUCCESS] TOTAL HARVEST: {len(all_ips)} IPs.")
            
        except Exception as e:
            print(f"[!] Error: {e}")

if __name__ == "__main__":
    asyncio.run(run())
