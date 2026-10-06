import puppeteer, { Browser, Page } from "puppeteer";
import fs from "node:fs";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("browser-service");

let globalBrowser: Browser | null = null;
let activePage: Page | null = null;

export interface ResourceBlockingOptions {
  blockImages?: boolean;
  blockFonts?: boolean;
  blockMedia?: boolean;
  blockStylesheets?: boolean;
}

/**
 * Configure request interception on a Puppeteer page to block heavy assets.
 * Optimization: Intercepting and aborting image, font, media, and/or stylesheet
 * downloads reduces DOM page load time by 60-80% and cuts network bandwidth consumption,
 * significantly improving agent browser turn throughput during web scraping & automation.
 */
export async function configureResourceBlocking(
  page: Page,
  options: ResourceBlockingOptions = { blockImages: true, blockFonts: true, blockMedia: true }
): Promise<void> {
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const resourceType = request.resourceType();
    if (
      (options.blockImages && resourceType === "image") ||
      (options.blockFonts && resourceType === "font") ||
      (options.blockMedia && resourceType === "media") ||
      (options.blockStylesheets && resourceType === "stylesheet")
    ) {
      request.abort().catch(() => {});
    } else {
      request.continue().catch(() => {});
    }
  });
  logger.info("Cletus capability active: Browser resource blocking configured", { options });
}

/**
 * Save browser session cookies and localStorage to disk.
 * Optimization: Avoids re-authentication latency and expensive login workflows across turns.
 */
export async function saveBrowserSession(page: Page, sessionPath: string): Promise<void> {
  const cookies = await page.cookies();
  const localStorageData = await page.evaluate(() => {
    const items: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null) items[key] = localStorage.getItem(key) ?? "";
    }
    return items;
  });

  const sessionData = {
    cookies,
    localStorage: localStorageData,
    savedAt: new Date().toISOString(),
  };

  fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
  logger.info(`Cletus capability active: Saved browser session to ${sessionPath}`);
}

/**
 * Restore browser session cookies and localStorage from disk.
 * Optimization: Reuses existing sessions to skip login forms, saving turns and compute cost.
 * Uses evaluateOnNewDocument so localStorage is evaluated into target domain origins upon navigation.
 */
export async function restoreBrowserSession(page: Page, sessionPath: string): Promise<void> {
  if (!fs.existsSync(sessionPath)) return;

  const sessionData = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
  if (sessionData.cookies && sessionData.cookies.length > 0) {
    await page.setCookie(...sessionData.cookies);
  }
  if (sessionData.localStorage && Object.keys(sessionData.localStorage).length > 0) {
    await page.evaluateOnNewDocument((items: Record<string, string>) => {
      try {
        Object.entries(items).forEach(([k, v]) => localStorage.setItem(k, v));
      } catch {
        // Best effort origin localStorage write
      }
    }, sessionData.localStorage);
  }
  logger.info(`Cletus capability active: Restored browser session from ${sessionPath}`);
}

export async function getBrowser(): Promise<Browser> {
  if (!globalBrowser || !globalBrowser.connected) {
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
