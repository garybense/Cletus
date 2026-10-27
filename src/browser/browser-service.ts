import puppeteer, { Browser, Page } from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("browser");

let globalBrowser: Browser | null = null;
let activePage: Page | null = null;
let resourceBlockingEnabled = false;
let blockedResourceTypes = new Set<string>(["image", "stylesheet", "font", "media"]);
let activeRequestHandler: ((req: any) => void) | null = null;

/**
 * Configure request interception on a Page to block heavy assets (images, fonts, stylesheets, media).
 * Optimization: Reduces page load times by up to 60-80% and saves network bandwidth during scraping.
 */
export async function configureResourceBlocking(
  page: Page,
  options?: { enable?: boolean; types?: string[] }
): Promise<string> {
  const enable = options?.enable ?? true;
  if (options?.types && options.types.length > 0) {
    blockedResourceTypes = new Set(options.types.map((t) => t.toLowerCase()));
  }

  resourceBlockingEnabled = enable;

  // Remove previous module handler if active
  if (activeRequestHandler) {
    page.off("request", activeRequestHandler);
    activeRequestHandler = null;
  }

  await page.setRequestInterception(enable);

  if (enable) {
    activeRequestHandler = (req) => {
      const resourceType = req.resourceType().toLowerCase();
      if (blockedResourceTypes.has(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    };
    page.on("request", activeRequestHandler);
    logger.info(`[BrowserOptimization] Resource blocking ENABLED for: ${Array.from(blockedResourceTypes).join(", ")}`);
    return `Resource blocking enabled. Intercepting and blocking: ${Array.from(blockedResourceTypes).join(", ")}`;
  } else {
    logger.info("[BrowserOptimization] Resource blocking DISABLED");
    return "Resource blocking disabled.";
  }
}

/**
 * Save browser session cookies and local storage state to disk for session persistence.
 * Capability: Persists web sessions across agent turns, preventing repetitive logins or captcha triggers.
 */
export async function saveBrowserSession(sessionName: string = "default"): Promise<string> {
  const page = await getActivePage();
  const sessionDir = path.join(process.env.HOME || "/root", ".cletus", "browser-sessions");
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
  }

  const sessionPath = path.join(sessionDir, `${sessionName}.json`);
  const cookies = await page.cookies();
  const localStorageData = await page.evaluate(() => {
    const json: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        json[key] = localStorage.getItem(key) || "";
      }
    }
    return json;
  });

  const sessionPayload = {
    cookies,
    localStorage: localStorageData,
    savedAt: new Date().toISOString(),
    url: page.url(),
  };

  fs.writeFileSync(sessionPath, JSON.stringify(sessionPayload, null, 2), { mode: 0o600 });
  logger.info(`[BrowserSession] Saved session '${sessionName}' to ${sessionPath} (${cookies.length} cookies)`);
  return `Browser session '${sessionName}' saved successfully (${cookies.length} cookies, ${Object.keys(localStorageData).length} local storage items).`;
}

/**
 * Restore browser session cookies and local storage state from disk.
 * Optimization: Reuses authenticated session state instantly without re-authentication overhead.
 */
export async function restoreBrowserSession(sessionName: string = "default"): Promise<string> {
  const sessionPath = path.join(process.env.HOME || "/root", ".cletus", "browser-sessions", `${sessionName}.json`);
  if (!fs.existsSync(sessionPath)) {
    return `Browser session file not found: ${sessionPath}`;
  }

  try {
    const raw = fs.readFileSync(sessionPath, "utf-8");
    const sessionPayload = JSON.parse(raw);
    const page = await getActivePage();

    // If session has a target URL and page is currently on about:blank, navigate first
    if (sessionPayload.url && page.url() === "about:blank") {
      try {
        await page.goto(sessionPayload.url, { waitUntil: "domcontentloaded", timeout: 15000 });
      } catch {}
    }

    if (sessionPayload.cookies && Array.isArray(sessionPayload.cookies)) {
      await page.setCookie(...sessionPayload.cookies);
    }

    if (sessionPayload.localStorage && typeof sessionPayload.localStorage === "object") {
      await page.evaluate((data) => {
        try {
          if (window.location.protocol.startsWith("http")) {
            for (const [key, val] of Object.entries(data)) {
              localStorage.setItem(key, val as string);
            }
          }
        } catch {}
      }, sessionPayload.localStorage);
    }

    logger.info(`[BrowserSession] Restored session '${sessionName}' from ${sessionPath}`);
    return `Browser session '${sessionName}' restored (${sessionPayload.cookies?.length || 0} cookies restored).`;
  } catch (err: any) {
    logger.error(`[BrowserSession] Failed to restore session '${sessionName}': ${err.message}`);
    return `Error restoring browser session '${sessionName}': ${err.message}`;
  }
}

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
