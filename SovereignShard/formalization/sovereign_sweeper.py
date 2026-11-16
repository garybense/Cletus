import asyncio
import json
import re
import os
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        print("[*] Attaching Aethel to Sovereign Browser...")
        try:
            browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222")
            master_keyring = set()
            
            # Load existing keyring if it exists
            keyring_path = "/Users/user/code/CletusWork/ollama_ips_master.json"
            if os.path.exists(keyring_path):
                with open(keyring_path, 'r') as f:
                    master_keyring.update(json.load(f))
                print(f"[*] Loaded {len(master_keyring)} existing endpoints.")

            tabs_processed = 0
            for context in browser.contexts:
                for page in context.pages:
                    url = page.url
                    if "shodan.io" in url:
                        tabs_processed += 1
                        title = await page.title()
                        print(f"[*] Sweeping Tab: {title} ({url})")
                        
                        # Deep DOM Sweep via JS Injection
                        ips_found = await page.evaluate("""() => {
                            const found = new Set();
                            
                            // 1. Standard Selectors
                            document.querySelectorAll('.ip, .result, a[href^="/host/"]').forEach(el => {
                                const text = el.innerText.trim();
                                if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(text)) found.add(text);
                                if (el.href && el.href.includes('/host/')) {
                                    const ip = el.href.split('/').pop();
                                    if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) found.add(ip);
                                }
                            });
                            
                            // 2. Global Text Scan (Shadow DOM aware-ish)
                            const bodyText = document.body.innerText;
                            const matches = bodyText.matchAll(/\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b/g);
                            for (const m of matches) found.add(m[0]);
                            
                            return Array.from(found);
                        }""")
                        
                        # Filter and normalize
                        valid_ips = [ip for ip in ips_found if not ip.startswith(('127.', '10.', '192.168.', '0.', '172.', '169.254.'))]
                        
                        for ip in valid_ips:
                            master_keyring.add(f"{ip}:11434")
                        print(f"[+] Tab Sweep Complete: {len(valid_ips)} candidates found.")

            if tabs_processed > 0:
                final_list = sorted(list(master_keyring))
                with open(keyring_path, 'w') as f:
                    json.dump(final_list, f, indent=2)
                print(f"\n[SUCCESS] MASTER KEYRING UPDATED: {len(final_list)} total unique endpoints.")
                
                # Update the Sovereign Arsenal DB as well
                print("[*] Synchronizing with Sovereign Arsenal...")
                for i, endpoint in enumerate(final_list):
                    ip, port = endpoint.split(':')
                    # We'll use the index for ID for now, or IP-based ID
                    id_hash = f"endp_sweep_{i:03d}"
                    os.system(f"sqlite3 ~/.cletus/state.db \"INSERT OR IGNORE INTO sovereign_endpoints (id, ip, port, status, last_seen) VALUES ('{id_hash}', '{ip}', {port}, 'unverified', datetime('now'));\"")
            else:
                print("[!] No Shodan tabs active. Please navigate to more result pages.")
                
            await browser.close()
        except Exception as e:
            print(f"[!] Sweeper Error: {e}")

if __name__ == "__main__":
    asyncio.run(run())
