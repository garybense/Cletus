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

export interface BrowserSessionData {
  cookies: any[];
  localStorage?: Record<string, string>;
}

/**
 * Optimization: Configure request interception on a Puppeteer page to block heavy assets (images, media, fonts, CSS).
 * Expected Performance Impact: Significantly speeds up page load latency by up to 70% and reduces bandwidth costs during web tasks.
 */
export async function configureResourceBlocking(
  page: Page,
  blockedTypes: Array<"image" | "stylesheet" | "font" | "media" | "other"> = ["image", "media", "font"],
): Promise<void> {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const resourceType = req.resourceType();
    if (blockedTypes.includes(resourceType as any)) {
      req.abort();
    } else {
      req.continue();
    }
  });
}

/**
 * Optimization: Export cookies and localStorage state from the active page to persist sessions across agent turns.
 * Expected Performance Impact: Avoids redundant web authentication roundtrips and login flow overhead.
 */
export async function saveBrowserSession(page: Page): Promise<BrowserSessionData> {
  const cookies = await page.cookies();
  const localStorage = await page.evaluate(() => {
    const json: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) json[key] = window.localStorage.getItem(key) || "";
    }
    return json;
  });
  return { cookies, localStorage };
}

/**
 * Optimization: Restore cookies and localStorage state onto a page to bypass re-authentication steps.
 * Expected Performance Impact: Reuses existing sessions and reduces setup turns per browser navigation task.
 */
export async function restoreBrowserSession(page: Page, session: BrowserSessionData): Promise<void> {
  if (session.cookies && session.cookies.length > 0) {
    await page.setCookie(...session.cookies);
  }
  if (session.localStorage) {
    await page.evaluate((ls) => {
      for (const [key, val] of Object.entries(ls)) {
        window.localStorage.setItem(key, val);
      }
    }, session.localStorage);
  }
}

export async function closeBrowser(): Promise<void> {
  if (globalBrowser) {
    await globalBrowser.close();
    globalBrowser = null;
    activePage = null;
  }
}
