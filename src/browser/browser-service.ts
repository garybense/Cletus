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

export interface ResourceBlockingOptions {
  blockImages?: boolean;
  blockFonts?: boolean;
  blockMedia?: boolean;
  blockStylesheets?: boolean;
}

/**
 * Intercepts network requests and blocks heavy assets (images, fonts, media) to optimize
 * browser page navigation speed and reduce bandwidth and memory footprint.
 *
 * Optimization: Bypasses rendering of non-essential assets when extracting web text/data.
 * Expected Performance Impact: 2x-5x faster page navigation and up to 70% lower RAM/network usage.
 */
export async function configureResourceBlocking(
  page: Page,
  options: ResourceBlockingOptions = { blockImages: true, blockFonts: true, blockMedia: true },
): Promise<void> {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const type = req.resourceType();
    if (
      (options.blockImages && type === "image") ||
      (options.blockFonts && type === "font") ||
      (options.blockMedia && type === "media") ||
      (options.blockStylesheets && type === "stylesheet")
    ) {
      req.abort().catch(() => {});
    } else {
      req.continue().catch(() => {});
    }
  });
}

/**
 * Persists active browser session state (cookies) to file for session reuse across runs.
 */
export async function saveBrowserSession(sessionPath: string): Promise<string> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const page = await getActivePage();
  const cookies = await page.cookies();
  await fs.mkdir(path.dirname(sessionPath), { recursive: true });
  await fs.writeFile(sessionPath, JSON.stringify(cookies, null, 2), "utf8");
  return `Saved session cookies (${cookies.length}) to ${sessionPath}`;
}

/**
 * Restores persisted browser session state (cookies) from file to avoid re-authentication.
 */
export async function restoreBrowserSession(sessionPath: string): Promise<string> {
  const fs = await import("fs/promises");
  try {
    const raw = await fs.readFile(sessionPath, "utf8");
    const cookies = JSON.parse(raw);
    const page = await getActivePage();
    if (Array.isArray(cookies) && cookies.length > 0) {
      await page.setCookie(...cookies);
      return `Restored session cookies (${cookies.length}) from ${sessionPath}`;
    }
  } catch {
    // Session file not present or invalid
  }
  return `No valid session restored from ${sessionPath}`;
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
