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

export interface ResourceBlockingOptions {
  blockedTypes?: string[];
}

/**
 * Optimization: Configures Puppeteer request interception to block heavy assets (images, stylesheets, fonts, media).
 * Performance impact: Reduces bandwidth consumption and lowers page navigation latency by up to 50-70%.
 */
export async function configureResourceBlocking(
  page: Page,
  options: ResourceBlockingOptions = {},
): Promise<void> {
  const blockedTypes = new Set(
    options.blockedTypes ?? ["image", "stylesheet", "font", "media"],
  );

  await page.setRequestInterception(true);

  page.on("request", (req) => {
    if (blockedTypes.has(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });
}

/**
 * Optimization: Persists browser session state (cookies and localStorage) to disk.
 * Performance impact: Eliminates redundant login/session initialization steps across automation tasks.
 */
export async function saveBrowserSession(
  page: Page,
  sessionFilePath: string,
): Promise<void> {
  const cookies = await page.cookies();
  const localStorageData = await page.evaluate(() => {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null) {
        data[key] = localStorage.getItem(key) ?? "";
      }
    }
    return data;
  });

  const sessionData = {
    cookies,
    localStorage: localStorageData,
    savedAt: new Date().toISOString(),
  };

  const fs = await import("fs");
  const path = await import("path");
  const dir = path.dirname(sessionFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(sessionFilePath, JSON.stringify(sessionData, null, 2), "utf-8");
}

/**
 * Optimization: Restores saved browser session state (cookies and localStorage) onto a page.
 * Performance impact: Reuses existing authenticated web sessions instantly.
 */
export async function restoreBrowserSession(
  page: Page,
  sessionFilePath: string,
): Promise<void> {
  const fs = await import("fs");
  if (!fs.existsSync(sessionFilePath)) {
    return;
  }

  const raw = fs.readFileSync(sessionFilePath, "utf-8");
  const sessionData = JSON.parse(raw);

  if (Array.isArray(sessionData.cookies) && sessionData.cookies.length > 0) {
    await page.setCookie(...sessionData.cookies);
  }

  if (sessionData.localStorage && typeof sessionData.localStorage === "object") {
    await page.evaluate((data: Record<string, string>) => {
      for (const [key, val] of Object.entries(data)) {
        localStorage.setItem(key, val);
      }
    }, sessionData.localStorage);
  }
}
