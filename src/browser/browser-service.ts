import puppeteer, { Browser, Page } from "puppeteer";

let globalBrowser: Browser | null = null;
let activePage: Page | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!globalBrowser || !globalBrowser.connected) {
    const fs = await import("fs");
    let executablePath: string | undefined = undefined;
    if (fs.existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")) {
      executablePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    } else if (fs.existsSync("/usr/bin/chromium")) {
      executablePath = "/usr/bin/chromium";
    } else if (fs.existsSync("/usr/bin/google-chrome")) {
      executablePath = "/usr/bin/google-chrome";
    }

    globalBrowser = await puppeteer.launch({
      headless: "new" as any,
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--headless=new",
        "--window-size=1920,1080",
      ],
    });
  }
  return globalBrowser;
}

export async function getActivePage(): Promise<Page> {
  const browser = await getBrowser();
  if (!activePage || activePage.isClosed()) {
    const pages = await browser.pages();
    activePage = pages.length > 0 ? pages[0]! : await browser.newPage();
    await activePage.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    );
    await activePage.setViewport({ width: 1280, height: 800 });
  }
  return activePage;
}

export async function navigateTo(url: string, waitUntil: "load" | "domcontentloaded" | "networkidle0" = "domcontentloaded"): Promise<{
  title: string;
  url: string;
  contentSample: string;
}> {
  const page = await getActivePage();
  await page.goto(url, { waitUntil, timeout: 30000 });
  const title = await page.title();
  const currentUrl = page.url();
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 3000) || "");
  return { title, url: currentUrl, contentSample: bodyText };
}

export async function clickElement(selector: string): Promise<string> {
  const page = await getActivePage();
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.click(selector);
  return `Clicked element: ${selector}`;
}

export async function typeText(selector: string, text: string): Promise<string> {
  const page = await getActivePage();
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.type(selector, text, { delay: 50 });
  return `Typed text into ${selector}`;
}

export async function extractContent(selector?: string): Promise<string> {
  const page = await getActivePage();
  if (selector) {
    await page.waitForSelector(selector, { timeout: 10000 });
    return await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent || "" : "Element not found";
    }, selector);
  }
  return await page.evaluate(() => document.body?.innerText || "Empty body");
}

export async function takeScreenshot(outputPath: string): Promise<string> {
  const page = await getActivePage();
  await page.screenshot({ path: outputPath as `${string}.png`, fullPage: false });
  return `Screenshot saved to ${outputPath}`;
}

export async function closeBrowser(): Promise<void> {
  if (globalBrowser) {
    await globalBrowser.close();
    globalBrowser = null;
    activePage = null;
  }
}

/**
 * Configures request interception on a Puppeteer page to block heavy assets (images, stylesheets, fonts, media).
 * Optimization: Drastically reduces network payload, bandwidth consumption, and page load latency during web automation.
 * Expected Performance Impact: Speeds up page load times by up to 3-5x during web content scraping.
 */
export async function configureResourceBlocking(
  page: Page,
  blockTypes: string[] = ["image", "stylesheet", "font", "media"],
): Promise<void> {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (blockTypes.includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });
}

/**
 * Saves page cookies and localStorage state to a JSON file.
 * Optimization: Enables persistent browser sessions across turns and restarts, avoiding expensive re-authentication steps.
 */
export async function saveBrowserSession(filePath: string): Promise<string> {
  const page = await getActivePage();
  const fs = await import("fs/promises");
  const cookies = await page.cookies();
  const localStorageData = await page.evaluate(() => {
    const json: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) json[key] = localStorage.getItem(key) || "";
    }
    return json;
  });

  const session = {
    cookies,
    localStorage: localStorageData,
    savedAt: new Date().toISOString(),
  };

  await fs.writeFile(filePath, JSON.stringify(session, null, 2), "utf-8");
  return `Browser session saved to ${filePath}`;
}

/**
 * Restores cookies and localStorage state from a JSON file to the active browser page.
 * Optimization: Reuses stored credentials and sessions to bypass login flows and rate limits.
 */
export async function restoreBrowserSession(filePath: string): Promise<string> {
  const fs = await import("fs/promises");
  const page = await getActivePage();

  const raw = await fs.readFile(filePath, "utf-8");
  const session = JSON.parse(raw);

  if (Array.isArray(session.cookies) && session.cookies.length > 0) {
    await page.setCookie(...session.cookies);
  }

  if (session.localStorage && typeof session.localStorage === "object") {
    await page.evaluate((lsData) => {
      for (const [key, value] of Object.entries(lsData)) {
        localStorage.setItem(key, String(value));
      }
    }, session.localStorage);
  }

  return `Browser session restored from ${filePath}`;
}
