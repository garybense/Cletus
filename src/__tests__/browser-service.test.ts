import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Mock puppeteer
vi.mock("puppeteer", () => {
  const mockPage = {
    isClosed: vi.fn().mockReturnValue(false),
    setUserAgent: vi.fn().mockResolvedValue(undefined),
    setViewport: vi.fn().mockResolvedValue(undefined),
    setRequestInterception: vi.fn().mockResolvedValue(undefined),
    removeAllListeners: vi.fn(),
    on: vi.fn(),
    cookies: vi.fn().mockResolvedValue([{ name: "session_id", value: "abc123test" }]),
    setCookie: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue("https://example.com"),
    goto: vi.fn().mockResolvedValue(undefined),
    title: vi.fn().mockResolvedValue("Example Title"),
    evaluate: vi.fn().mockResolvedValue("Sample content"),
  };

  const mockBrowser = {
    connected: true,
    pages: vi.fn().mockResolvedValue([mockPage]),
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    default: {
      launch: vi.fn().mockResolvedValue(mockBrowser),
    },
  };
});

import {
  configureResourceBlocking,
  saveBrowserSession,
  restoreBrowserSession,
  closeBrowser,
} from "../browser/browser-service.js";

describe("Browser Service Optimizations", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cletus-browser-test-"));
  });

  afterEach(async () => {
    await closeBrowser();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("configures resource blocking without error", async () => {
    await expect(configureResourceBlocking(true, ["image", "media"])).resolves.not.toThrow();
    await expect(configureResourceBlocking(false)).resolves.not.toThrow();
  });

  it("saves and restores browser session state correctly", async () => {
    const sessionFile = path.join(tmpDir, "session.json");

    await saveBrowserSession(sessionFile);
    const exists = await fs.stat(sessionFile).then((s) => s.isFile()).catch(() => false);
    expect(exists).toBe(true);

    const content = JSON.parse(await fs.readFile(sessionFile, "utf-8"));
    expect(content.cookies).toHaveLength(1);
    expect(content.cookies[0].name).toBe("session_id");

    const restored = await restoreBrowserSession(sessionFile);
    expect(restored).toBe(true);
  });

  it("returns false gracefully when restoring a non-existent session file", async () => {
    const sessionFile = path.join(tmpDir, "non_existent.json");
    const restored = await restoreBrowserSession(sessionFile);
    expect(restored).toBe(false);
  });
});
