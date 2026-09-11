import puppeteer from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import userDataDirPlugin from 'puppeteer-extra-plugin-user-data-dir';

puppeteerExtra.use(stealthPlugin());
puppeteerExtra.use(userDataDirPlugin());

/**
 * Launch a stealth browser on mindmods.org.
 * NODE_PATH=/usr/lib/node_modules must be set (puppeteer + plugins are there).
 * Chromium binary is at /usr/bin/chromium.
 */
export function launchBrowser(profileName = 'default') {
  return puppeteerExtra.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium',
    userDataDir: `/home/debian/.openclaw/.browser-profiles/${profileName}`,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800',
      '--lang=en-US',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });
}

/**
 * Apply human-like fingerprints to a page.
 */
export async function fingerprintPage(page: import('puppeteer').Page) {
  await page.setUserAgent(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    // window.chrome must exist for site tech-checks
    (window as any).chrome = {
      runtime: {},
      loadTimes: () => {},
      csi: () => {},
      app: {},
    };
  });
}

/**
 * Type with human-like delay variance.
 */
export async function humanType(
  page: import('puppeteer').Page,
  selector: string,
  text: string,
) {
  await page.waitForSelector(selector, { timeout: 15000 });
  const chars = text.split('');
  for (let i = 0; i < chars.length; i++) {
    await page.type(selector, chars[i], { delay: 30 + Math.random() * 50 });
    if (i > 0 && i % 5 === 0) {
      await new Promise((r) => setTimeout(r, 80 + Math.random() * 120));
    }
  }
}

/**
 * Move mouse to a point with a curved, human-like path.
 */
export async function humanMove(
  page: import('puppeteer').Page,
  x: number,
  y: number,
) {
  const distance = Math.hypot(x, y);
  const duration = Math.max(200, distance * 0.8);
  await page.mouse.move(x, y, { steps: Math.max(5, Math.floor(duration / 30)) });
}

/**
 * Save cookies + localStorage to a JSON file for session reuse.
 */
export async function saveSession(
  page: import('puppeteer').Page,
  path: string,
): Promise<void> {
  const data = {
    cookies: await page.cookies(),
    localStorage: await page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== null) items[key] = localStorage.getItem(key) ?? '';
      }
      return items;
    }),
    savedAt: new Date().toISOString(),
  };
  const fs = await import('fs');
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

/**
 * Restore session from a JSON file.
 */
export async function restoreSession(
  page: import('puppeteer').Page,
  path: string,
): Promise<void> {
  const fs = await import('fs');
  if (!fs.existsSync(path)) return;
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (data.cookies?.length) await page.setCookie(...data.cookies);
  if (data.localStorage) {
    await page.evaluate(
      (items: Record<string, string>) => {
        Object.entries(items).forEach(([k, v]) => localStorage.setItem(k, v));
      },
      data.localStorage,
    );
  }
}
