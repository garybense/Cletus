import asyncio
import requests
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        print("[*] Connecting to 127.0.0.1:9222...")
        try:
            # Try to connect to the browser instance
            browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222")
            print("[+] Connected!")
            
            for context in browser.contexts:
                for page in context.pages:
                    print(f"Tab: {await page.title()} ({await page.url()})")
            
            await browser.close()
        except Exception as e:
            print(f"[!] Error: {e}")

if __name__ == "__main__":
    asyncio.run(run())
