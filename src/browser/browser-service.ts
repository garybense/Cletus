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

export interface ResourceBlockingOptions {
  blockImages?: boolean;
  blockStylesheets?: boolean;
  blockFonts?: boolean;
  blockMedia?: boolean;
}

let activeBlockingOptions: ResourceBlockingOptions = {};
let activeRequestHandler: ((req: any) => void) | null = null;

/**
 * Configure network resource blocking for browser pages to speed up page loads
 * and reduce bandwidth/memory overhead during web scraping, content aggregation, and monitoring tasks.
 *
 * Optimization: Aborts non-essential network requests (images, fonts, stylesheets, media).
 * Performance Impact: Up to 50-70% reduction in page load time and network/memory usage for data collection tasks.
 */
export async function configureResourceBlocking(
  options: ResourceBlockingOptions,
  page?: Page,
): Promise<void> {
  activeBlockingOptions = { ...activeBlockingOptions, ...options };
  const targetPage = page || (await getActivePage());
  const shouldIntercept = Boolean(
    activeBlockingOptions.blockImages ||
      activeBlockingOptions.blockStylesheets ||
      activeBlockingOptions.blockFonts ||
      activeBlockingOptions.blockMedia,
  );

  if (activeRequestHandler) {
    targetPage.off("request", activeRequestHandler);
    activeRequestHandler = null;
  }

  await targetPage.setRequestInterception(shouldIntercept);

  if (shouldIntercept) {
    activeRequestHandler = (req: any) => {
      const resourceType = req.resourceType();
      if (
        (activeBlockingOptions.blockImages && resourceType === "image") ||
        (activeBlockingOptions.blockStylesheets && resourceType === "stylesheet") ||
        (activeBlockingOptions.blockFonts && resourceType === "font") ||
        (activeBlockingOptions.blockMedia && resourceType === "media")
      ) {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    };
    targetPage.on("request", activeRequestHandler);
  }
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
    if (
      activeBlockingOptions.blockImages ||
      activeBlockingOptions.blockStylesheets ||
      activeBlockingOptions.blockFonts ||
      activeBlockingOptions.blockMedia
    ) {
      await configureResourceBlocking(activeBlockingOptions, activePage);
    }
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
