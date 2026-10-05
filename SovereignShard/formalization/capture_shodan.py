import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        try:
            browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9222")
            context = browser.contexts[0]
            page = await context.new_page()
            
            url = 'https://www.shodan.io/search?query=product:"Ollama"'
            print(f"[*] Capturing: {url}")
            await page.goto(url)
            await asyncio.sleep(5) # Wait for load
            
            screenshot_path = "/Users/user/code/CletusWork/shodan_debug.png"
            await page.screenshot(path=screenshot_path)
            print(f"[+] Screenshot saved to {screenshot_path}")
            
            content = await page.content()
            with open("/Users/user/code/CletusWork/shodan_debug.html", "w") as f:
                f.write(content)
            print(f"[+] HTML content saved.")
            
        except Exception as e:
            print(f"[!] Error: {e}")

if __name__ == "__main__":
    asyncio.run(run())
