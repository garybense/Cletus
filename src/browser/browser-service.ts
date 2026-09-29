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

/**
 * Optimization: Enables request interception on a page to block heavy resources (images, fonts, stylesheets, media)
 * during data collection, price scraping, and content aggregation tasks.
 * Expected performance impact: Reduces page download size by up to 80% and improves load times by 2x-5x.
 */
export async function configureResourceBlocking(
  page: Page,
  options: { blockHeavyResources?: boolean; resourceTypesToBlock?: string[] } = {},
): Promise<void> {
  const { blockHeavyResources = true, resourceTypesToBlock = ["image", "font", "media"] } = options;
  if (!blockHeavyResources) return;

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const resourceType = req.resourceType();
    if (resourceTypesToBlock.includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });
}

export interface NavigateOptions {
  waitUntil?: "load" | "domcontentloaded" | "networkidle0";
  timeout?: number;
  blockHeavyResources?: boolean;
  resourceTypesToBlock?: string[];
}

export async function navigateTo(
  url: string,
  optionsOrWaitUntil: NavigateOptions | "load" | "domcontentloaded" | "networkidle0" = "domcontentloaded",
): Promise<{
  title: string;
  url: string;
  contentSample: string;
}> {
  const page = await getActivePage();
  const options: NavigateOptions = typeof optionsOrWaitUntil === "string"
    ? { waitUntil: optionsOrWaitUntil }
    : optionsOrWaitUntil;

  const waitUntil = options.waitUntil ?? "domcontentloaded";
  const timeout = options.timeout ?? 30000;

  if (options.blockHeavyResources) {
    await configureResourceBlocking(page, {
      blockHeavyResources: true,
      resourceTypesToBlock: options.resourceTypesToBlock,
    });
  }

  await page.goto(url, { waitUntil, timeout });
  const title = await page.title();
  const currentUrl = page.url();
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 3000) || "");
  return { title, url: currentUrl, contentSample: bodyText };
}

/**
 * Optimization: Saves cookies and localStorage to disk for session reuse across tasks/heartbeats.
 * Reduces login and re-authentication latency during social network navigation and authenticated scraping.
 */
export async function saveBrowserSession(filePath: string): Promise<string> {
  const page = await getActivePage();
  const cookies = await page.cookies();
  const localStorageData = await page.evaluate(() => {
    const items: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null) items[key] = localStorage.getItem(key) ?? "";
    }
    return items;
  });

  const fs = await import("fs");
  const path = await import("path");
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify({ cookies, localStorage: localStorageData, savedAt: new Date().toISOString() }, null, 2));
  return `Browser session saved to ${filePath}`;
}

/**
 * Optimization: Restores saved cookies and localStorage to page to reuse active session.
 */
export async function restoreBrowserSession(filePath: string): Promise<string> {
  const fs = await import("fs");
  if (!fs.existsSync(filePath)) {
    return `Session file ${filePath} not found`;
  }

  const page = await getActivePage();
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (data.cookies?.length) {
    await page.setCookie(...data.cookies);
  }
  if (data.localStorage) {
    await page.evaluate((items: Record<string, string>) => {
      Object.entries(items).forEach(([k, v]) => localStorage.setItem(k, v));
    }, data.localStorage);
  }
  return `Browser session restored from ${filePath}`;
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
