import asyncio
import re
import json
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        try:
            browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222")
            all_ips = set()
            for context in browser.contexts:
                for page in context.pages:
                    url = page.url
                    if "shodan.io/search" in url:
                        print(f"[*] Scraping: {url}")
                        content = await page.content()
                        # Shodan results usually look like: 1.2.3.4 (under an <a> tag)
                        # We look for IP patterns and check if they have a port nearby
                        # Or just grab all IPs and deduplicate
                        ips = re.findall(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', content)
                        for ip in ips:
                            all_ips.add(ip)
                        print(f"[+] Found {len(ips)} IP candidates in {url}")
            
            if all_ips:
                output = list(all_ips)
                print(f"[SUCCESS] Total unique IPs found: {len(output)}")
                with open("/Users/user/code/CletusWork/ollama_ips_regex.json", "w") as f:
                    json.dump(output, f, indent=2)
            else:
                print("[!] No IPs found.")
            await browser.close()
        except Exception as e:
            print(f"[!] Error: {e}")

if __name__ == "__main__":
    asyncio.run(run())
