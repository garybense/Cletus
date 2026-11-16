import asyncio
import json
import re
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        try:
            print("[*] Connecting to 127.0.0.1:9222...")
            browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222")
            
            all_ips = set()
            
            for context in browser.contexts:
                for page in context.pages:
                    url = page.url
                    title = await page.title()
                    print(f"[*] Checking Tab: {title} ({url})")
                    
                    if "shodan.io/search" in url:
                        print(f"[+] Harvesting from active search tab...")
                        # Scroll to trigger lazy loading
                        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        await asyncio.sleep(2)
                        
                        # Extract IPs directly from the page source
                        content = await page.content()
                        # Shodan IPs are usually in elements with class 'ip' or inside host links
                        ips = re.findall(r'/host/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', content)
                        # Also look for plain text IPs that might be displayed
                        text_ips = re.findall(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', content)
                        
                        found = set(ips + text_ips)
                        valid = [ip for ip in found if not ip.startswith(('127.', '10.', '192.168.', '0.'))]
                        
                        for ip in valid:
                            all_ips.add(f"{ip}:11434")
                        print(f"[+] Found {len(valid)} candidates in this tab.")
            
            if all_ips:
                output_path = "/Users/user/code/CletusWork/ollama_ips_cdp.json"
                with open(output_path, 'w') as f:
                    json.dump(sorted(list(all_ips)), f, indent=2)
                print(f"\n[SUCCESS] TOTAL UNIQUE HARVEST: {len(all_ips)} IPs.")
            else:
                print("[!] Zero IPs found in the active CDP session.")
                
            await browser.close()
        except Exception as e:
            print(f"[!] CDP Harvest Error: {e}")

if __name__ == "__main__":
    asyncio.run(run())
