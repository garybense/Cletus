import puppeteer, { Browser, Page } from "puppeteer";
import fs from "node:fs/promises";
import path from "node:path";

let globalBrowser: Browser | null = null;
let activePage: Page | null = null;

export interface ResourceBlockingOptions {
  blockImages?: boolean;
  blockFonts?: boolean;
  blockMedia?: boolean;
  blockStylesheets?: boolean;
}

/**
  * Configures request interception on a Puppeteer page to block heavy assets (images, fonts, media).
  * OPTIMIZATION: Aborting non-essential network requests reduces browser page load latency by up to 60%
  * and significantly conserves network bandwidth during automated web navigation turns.
  */
export async function configureResourceBlocking(
  page?: Page,
  options: ResourceBlockingOptions = { blockImages: true, blockFonts: true, blockMedia: true }
): Promise<void> {
  const targetPage = page || (await getActivePage());
  await targetPage.setRequestInterception(true);

  targetPage.on("request", (req) => {
    const resourceType = req.resourceType();
    if (
      (options.blockImages && resourceType === "image") ||
      (options.blockFonts && resourceType === "font") ||
      (options.blockMedia && (resourceType === "media" || resourceType === "texttrack")) ||
      (options.blockStylesheets && resourceType === "stylesheet")
    ) {
      req.abort();
    } else {
      req.continue();
    }
  });
}

/**
  * Saves active browser cookies and localStorage state to a JSON session file.
  * OPTIMIZATION: Persisting browser sessions avoids redundant authentication flows across agent turns,
  * saving both time and compute credits.
  */
export async function saveBrowserSession(storagePath: string): Promise<void> {
  const page = await getActivePage();
  const cookies = await page.cookies();
  const localStorageData = await page.evaluate(() => {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        data[key] = localStorage.getItem(key) || "";
      }
    }
    return data;
  });

  const sessionData = {
    cookies,
    localStorage: localStorageData,
    savedAt: new Date().toISOString(),
  };

  const dir = path.dirname(storagePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(sessionData, null, 2), "utf-8");
}

/**
  * Restores cookies and localStorage state into the active browser page from a saved session file.
  */
export async function restoreBrowserSession(storagePath: string): Promise<boolean> {
  try {
    const raw = await fs.readFile(storagePath, "utf-8");
    const sessionData = JSON.parse(raw);
    const page = await getActivePage();

    if (Array.isArray(sessionData.cookies) && sessionData.cookies.length > 0) {
      await page.setCookie(...sessionData.cookies);
    }

    if (sessionData.localStorage && typeof sessionData.localStorage === "object") {
      await page.evaluate((data) => {
        for (const [key, val] of Object.entries(data)) {
          localStorage.setItem(key, val as string);
        }
      }, sessionData.localStorage);
    }

    return true;
  } catch (err) {
    return false;
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
