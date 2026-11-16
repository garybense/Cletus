import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        try:
            browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222")
            context = browser.contexts[0]
            
            target_page = None
            for page in context.pages:
                if "shodan.io/search" in page.url:
                    target_page = page
                    break
            
            if target_page:
                print(f"[*] Auditing: {target_page.url}")
                # Save a full-page screenshot
                await target_page.screenshot(path="/Users/user/code/CletusWork/shodan_visual_audit.png", full_page=True)
                # Save the raw outerHTML for deep inspection
                html = await target_page.content()
                with open("/Users/user/code/CletusWork/shodan_raw_audit.html", "w") as f:
                    f.write(html)
                print("[+] Visual and Structural Audit Saved.")
            else:
                print("[!] No Shodan search tab found.")
        except Exception as e:
            print(f"[!] Audit Failure: {e}")

if __name__ == "__main__":
    asyncio.run(run())
