import asyncio
import json
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
                print("[!] No Shodan search results tab found.")
                return

            print(f"[+] Found tab: {target_page.url}")
            await target_page.bring_to_front()
            
            # Take a screenshot for visual confirmation
            await target_page.screenshot(path="/Users/user/code/CletusWork/shodan_results_live.png")
            print("[*] Screenshot captured to /Users/user/code/CletusWork/shodan_results_live.png")

            # Scrape using a very specific Shodan selector
            # Shodan IPs are usually in <div class="ip"> inside an <a> tag
            ips = await target_page.evaluate("""() => {
                const results = [];
                // Look for common Shodan result selectors
                const items = document.querySelectorAll('.search-result, .result');
                items.forEach(item => {
                    const ipLink = item.querySelector('a.ip, .ip a');
                    const portEl = item.querySelector('.port, .result-port');
                    if (ipLink) {
                        const ip = ipLink.innerText.trim();
                        const port = portEl ? portEl.innerText.trim() : '11434';
                        results.push(`${ip}:${port}`);
                    }
                });
                return results;
            }""")
            
            if ips:
                unique_ips = list(set(ips))
                output_path = "/Users/user/code/CletusWork/ollama_ips.json"
                with open(output_path, "w") as f:
                    json.dump(unique_ips, f, indent=2)
                print(f"\n[SUCCESS] HARVESTED {len(unique_ips)} IPs from the live session.")
            else:
                print("[!] Selector failed. Let's try the raw text dump.")
                text = await target_page.inner_text("body")
                import re
                found = re.findall(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', text)
                if found:
                    print(f"[+] Found {len(found)} IPs via raw text scan.")
                    with open("/Users/user/code/CletusWork/ollama_ips.json", "w") as f:
                        json.dump(list(set(found)), f, indent=2)
                else:
                    print("[!] Truly zero data found in the body text.")

            await browser.close()
            
        except Exception as e:
            print(f"[!] Error: {e}")

if __name__ == "__main__":
    asyncio.run(run())
