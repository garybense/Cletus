import asyncio
import json
import time
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        print("[*] Attaching to Sovereign Browser...")
        try:
            browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222")
            context = browser.contexts[0]
            
            target_page = None
            for page in context.pages:
                if "shodan.io/search" in page.url:
                    target_page = page
                    break
            
            if not target_page:
                print("[!] No Shodan search tab found.")
                return

            print(f"[+] Reconstructing data from: {target_page.url}")
            
            # Reconstruction Payload: Iterates over the complex DOM and pieces together the IPs
            reconstructed_ips = await target_page.evaluate("""() => {
                const results = [];
                const searchItems = document.querySelectorAll('.search-result, .result');
                
                searchItems.forEach(item => {
                    // Try to find the IP element - it might be fragmented
                    const ipContainer = item.querySelector('.ip, .ip-address');
                    if (ipContainer) {
                        // Piecing together fragmented digits if they exist
                        const ip = ipContainer.innerText.replace(/\s/g, '').trim();
                        const portEl = item.querySelector('.port, .result-port');
                        const port = portEl ? portEl.innerText.trim() : '11434';
                        
                        if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
                            results.push(`${ip}:${port}`);
                        }
                    }
                });
                return results;
            }""")
            
            if reconstructed_ips:
                unique_ips = list(set(reconstructed_ips))
                output_path = "/Users/user/code/CletusWork/ollama_ips.json"
                with open(output_path, "w") as f:
                    json.dump(unique_ips, f, indent=2)
                print(f"\n[SUCCESS] RECONSTRUCTED {len(unique_ips)} IPs.")
            else:
                print("[!] Reconstruction yielded 0 results. Checking for raw attribute leaks...")
                # Fallback: Look for host-link patterns which often contain the IP in the URL
                attribute_ips = await target_page.evaluate("""() => {
                    const links = Array.from(document.querySelectorAll('a[href^="/host/"]'));
                    return links.map(a => a.href.split('/').pop());
                }""")
                if attribute_ips:
                    final_ips = [f"{ip}:11434" for ip in attribute_ips if "." in ip]
                    with open("/Users/user/code/CletusWork/ollama_ips.json", "w") as f:
                        json.dump(list(set(final_ips)), f, indent=2)
                    print(f"[SUCCESS] HARVESTED {len(set(final_ips))} IPs via Attribute Leak.")
                else:
                    print("[!] Substrate is opaque. Please ensure the page has finished loading.")

            await browser.close()
            
        except Exception as e:
            print(f"[!] Critical Error: {e}")

if __name__ == "__main__":
    asyncio.run(run())
