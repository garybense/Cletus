import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        try:
            browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222")
            for context in browser.contexts:
                for page in context.pages:
                    url = page.url
                    if "shodan.io" in url:
                        print(f"[*] Found: {url}")
                        content = await page.content()
                        # Save first 2000 chars of content for inspection
                        print(f"Content Start: {content[:1000]}")
                        # Save to a file for deeper grep
                        with open("/Users/user/code/CletusWork/current_tab.html", "w") as f:
                            f.write(content)
            await browser.close()
        except Exception as e:
            print(f"[!] Error: {e}")

if __name__ == "__main__":
    asyncio.run(run())
