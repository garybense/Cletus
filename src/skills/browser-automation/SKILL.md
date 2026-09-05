---
name: browser-automation
description: "Master browser automation for account creation, form filling, and web interaction using puppeteer-extra + stealth + user-data-dir on the mindmods.org host. Handles Facebook registration, session persistence, CAPTCHA/verification workflows, and human-like interaction patterns."
auto_activate: true
tags:
  - "browser"
  - "puppeteer"
  - "stealth"
  - "social"
  - "automation"
  - "facebook"
requires:
  tools:
    - "exec"
    - "read"
---

# Browser Automation Skill (mindmods.org)

Use this skill to spawn a persistent browser, navigate web pages, interact with forms, manage sessions across restarts, and execute account registration workflows.

## Environment

- Node.js: v22.22.3 (NVM, export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh")
- Chromium: /usr/bin/chromium (v152.0.7977.75)
- Puppeteer packages at /usr/lib/node_modules — must set NODE_PATH=/usr/lib/node_modules to resolve
- Child browser profile dirs: /home/debian/.openclaw/.browser-profiles/<CHILD_NAME>/

## Launch Pattern (puppeteer-extra + stealth + user-data-dir)

```javascript
// Must set NODE_PATH before requiring puppeteer-extra packages
process.env.NODE_PATH = "/usr/lib/node_modules";
require("module").Module._initPaths();

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const UserDataDirPlugin = require("puppeteer-extra-plugin-user-data-dir");

puppeteer.use(StealthPlugin());
puppeteer.use(UserDataDirPlugin());

const childName = process.env.CLETUS_CHILD_NAME || "unknown";
const profileDir = `/home/debian/.openclaw/.browser-profiles/${childName}`;

async function launchBrowser() {
  return await puppeteer.launch({
    headless: "new",
    executablePath: "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1280,800",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-sync",
      "--disable-translate",
      "--metrics-recording-only",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-device-discovery-notifications",
      "--disable-logging",
      "--disable-default-apps",
    ],
    userDataDir: profileDir,
    defaultViewport: { width: 1280, height: 800 },
  });
}
```

## Fingerprint & Stealth Setup

```javascript
async function preparePage(page) {
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"
  );
  await page.evaluateOnNewDocument(() => {
    // webdriver must be undefined (not false, not removed)
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });

    // Fake plugin list (real Chrome has several)
    Object.defineProperty(navigator, "plugins", {
      get: () => [
        { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer", descriptions: ["Portable Document Format"] },
        { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", descriptions: [] },
        { name: "Native Client", filename: "internal-nacl-plugin", descriptions: [] },
      ],
    });

    // Fake languages
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en", "de", "fr"],
    });

    // Fake window.chrome
    (window).chrome = {
      runtime: {},
      app: { installationType: "standalone", packSLC: "" },
    };

    // Fake Permissions API
    const origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (parameters) =>
      origQuery(parameters).then((result) => {
        if (parameters.name === "notifications" && result.state === "denied") {
          return Promise.resolve({ state: "prompt" });
        }
        return result;
      });
  });
}
```

## Human-Like Interaction

```javascript
async function humanType(page, selector, text) {
  await page.click(selector);
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (el) {
      el.focus();
      el.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, selector);
  for (const ch of text) {
    await page.keyboard.type(ch, { delay: 30 + Math.random() * 60 });
  }
}

async function humanClick(page, selector) {
  const box = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selector);
  if (box) {
    await page.mouse.move(box.x, box.y, { steps: 10 + Math.floor(Math.random() * 10) });
    await page.mouse.move(box.x + (Math.random() - 0.5) * 10, box.y + (Math.random() - 0.5) * 10, { steps: 5 });
    await page.mouse.click(box.x, box.y);
  } else {
    await page.click(selector);
  }
}

async function humanMove(page, selector) {
  const box = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + Math.random() * r.width, y: r.top + Math.random() * r.height };
  }, selector);
  if (box) {
    await page.mouse.move(box.x, box.y, { steps: 15 + Math.floor(Math.random() * 15) });
  }
}
```

## Session Persistence

The user-data-dir plugin persists cookies, localStorage, and IndexedDB across browser restarts. Each child gets its own profile directory.

```javascript
async function saveSession(page) {
  const cookies = await page.cookies();
  const localStorage = await page.evaluate(() => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null) data[k] = localStorage.getItem(k);
    }
    return data;
  });
  return { cookies, localStorage };
}

async function restoreSession(page, session) {
  if (session.cookies && session.cookies.length) {
    await page.setCookie(...session.cookies);
  }
  if (session.localStorage) {
    await page.evaluate((data) => {
      for (const [k, v] of Object.entries(data)) {
        localStorage.setItem(k, v);
      }
    }, session.localStorage);
  }
}
```

## Facebook Registration Runbook

All URLs and selectors below are configurable via environment variables — never hardcode. Defaults are given but must be overridden for the actual target site.

### Step 1: Navigate to registration

```javascript
const FB_REGISTRATION_URL = process.env.FB_REGISTRATION_URL || "https://www.facebook.com/reg";
await page.goto(FB_REGISTRATION_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
```

### Step 2: Fill registration form

```javascript
await page.waitForSelector(process.env.FB_FIRST_NAME_SELECTOR || "input[name=\"firstname\"]", { timeout: 10000 });
await humanType(page, process.env.FB_FIRST_NAME_SELECTOR || "input[name=\"firstname\"]", firstName);
await humanType(page, process.env.FB_LAST_NAME_SELECTOR || "input[name=\"lastname\"]", lastName);
await humanType(page, process.env.FB_EMAIL_SELECTOR || "input[name=\"reg_email__\"]", email);
await humanType(page, process.env.FB_PASSWORD_SELECTOR || "input[name=\"reg_passwd__\"]", password);

await humanClick(page, process.env.FB_BIRTHDAY_DAY_SELECTOR || "select[name=\"birthday_day\"]");
await page.select(process.env.FB_BIRTHDAY_DAY_SELECTOR || "select[name=\"birthday_day\"]", day);
await humanClick(page, process.env.FB_BIRTHDAY_MONTH_SELECTOR || "select[name=\"birthday_month\"]");
await page.select(process.env.FB_BIRTHDAY_MONTH_SELECTOR || "select[name=\"birthday_month\"]", month);
await humanClick(page, process.env.FB_BIRTHDAY_YEAR_SELECTOR || "select[name=\"birthday_year\"]");
await page.select(process.env.FB_BIRTHDAY_YEAR_SELECTOR || "select[name=\"birthday_year\"]", year);

await humanClick(page, process.env.FB_GENDER_SELECTOR || "select[name=\"sex\"]");
await page.select(process.env.FB_GENDER_SELECTOR || "select[name=\"sex\"]", gender);

await humanClick(page, process.env.FB_SUBMIT_SELECTOR || "button[name=\"websubmit\"]");
```

### Step 3: Handle verification

After submission, Facebook may request SMS or email verification. Monitor the page for verification UI:

```javascript
const successSelector = process.env.FB_SUCCESS_SELECTOR || ".displayed";
try {
  await page.waitForFunction(
    (sel) => document.querySelector(sel) !== null,
    { timeout: 20000 },
    successSelector
  );
} catch (err) {
  // Might be verification page — check for SMS/email input
  const hasSmsInput = await page.$eval(
    process.env.FB_SMS_VERIFICATION_INPUT || "input[name=\"verification_code\"]",
    (el) => el !== null
  ).catch(() => false);
  if (hasSmsInput) {
    const code = await waitForVerificationCode(email);
    await humanType(page, process.env.FB_SMS_VERIFICATION_INPUT || "input[name=\"verification_code\"]", code);
    await humanClick(page, process.env.FB_SMS_VERIFY_SUBMIT || "button[name=\"submit\"]");
  }
}
```

### Step 4: Post-registration

Once registered, save the session and return credentials:

```javascript
const finalSession = await saveSession(page);
await page.close();
await browser.close();
return { success: true, email, password, session: finalSession };
```

## Verification Code Retrieval (IMAP)

When Facebook requests email verification, poll the IMAP inbox for the code:

```javascript
const ImapSimple = require("imap-simple");

async function waitForVerificationCode(emailAddress, timeoutMs = 120000) {
  const config = {
    imap: {
      user: process.env.IMAP_USER || emailAddress,
      password: process.env.IMAP_PASSWORD,
      host: process.env.IMAP_HOST || "localhost",
      port: parseInt(process.env.IMAP_PORT || "993"),
      tls: process.env.IMAP_TLS !== "false",
      tlsOptions: { rejectUnauthorized: false },
    },
  };

  const connection = await ImapSimple.connect(config);
  await connection.openBox("INBOX", false);

  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 5000));
    const searchCriteria = ["UNSEEN", ["FROM", "facebook.com"]];
    const messages = await connection.search(searchCriteria, { bodies: ["TEXT"] });
    if (messages.length > 0) {
      const parsed = await connection.getMultipartBytes(messages[0]);
      const text = parsed.parts.find((p) => p.which === "TEXT")?.body?.toString() || "";
      const codeMatch = text.match(/">(\d{5,6})<"/) || text.match(/code[:\s]+(\d{5,6})/i) || text.match(/(\d{5,6})/);
      if (codeMatch) {
        await connection.end();
        return codeMatch[1];
      }
    }
  }
  await connection.end();
  throw new Error("Verification code not found in email within timeout");
}
```

## Debugging

- Screenshot on failure: await page.screenshot({ path: "/tmp/cletus-browser-fail-" + Date.now() + ".png" });
- Page HTML dump: await page.content()
- Console log capture: page.on("console", (msg) => console.log("PAGE:", msg.text()))
- Network log: page.on("requestfailed", (req) => console.log("FAIL:", req.url()))
- Profile dir: check /home/debian/.openclaw/.browser-profiles/<CHILD_NAME>/ for cookies, localStorage files

## Configurable Variables (never hardcode)

| Variable | Default | Description |
|----------|---------|-------------|
| CLETUS_CHILD_NAME | — | Child identifier; used for profile dir path |
| FB_REGISTRATION_URL | https://www.facebook.com/reg | Registration page URL |
| FB_FIRST_NAME_SELECTOR | input[name="firstname"] | First name input CSS selector |
| FB_LAST_NAME_SELECTOR | input[name="lastname"] | Last name input CSS selector |
| FB_EMAIL_SELECTOR | input[name="reg_email__"] | Email/phone input CSS selector |
| FB_PASSWORD_SELECTOR | input[name="reg_passwd__"] | Password input CSS selector |
| FB_BIRTHDAY_DAY_SELECTOR | select[name="birthday_day"] | Birthday day select |
| FB_BIRTHDAY_MONTH_SELECTOR | select[name="birthday_month"] | Birthday month select |
| FB_BIRTHDAY_YEAR_SELECTOR | select[name="birthday_year"] | Birthday year select |
| FB_GENDER_SELECTOR | select[name="sex"] | Gender select |
| FB_SUBMIT_SELECTOR | button[name="websubmit"] | Submit button CSS selector |
| FB_VERIFICATION_SELECTOR | .displayed | Success page indicator |
| FB_SMS_VERIFICATION_INPUT | input[name="verification_code"] | SMS code input |
| FB_SMS_VERIFY_SUBMIT | button[name="submit"] | SMS verify submit |
| FB_SUCCESS_SELECTOR | .displayed | Post-registration success indicator |
| IMAP_USER | — | IMAP username (email address) |
| IMAP_PASSWORD | — | IMAP password |
| IMAP_HOST | localhost | IMAP server host |
| IMAP_PORT | 993 | IMAP server port |
| IMAP_TLS | true | Use TLS for IMAP connection |
| NODE_PATH | /usr/lib/node_modules | puppeteer-extra module search path |
