import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { configureResourceBlocking, saveBrowserSession, restoreBrowserSession } from "../browser/browser-service.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("BrowserService - Resource Blocking & Session Persistence", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cletus-browser-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should configure resource blocking on page", async () => {
    const mockRequest = {
      resourceType: vi.fn().mockReturnValue("image"),
      abort: vi.fn().mockResolvedValue(undefined),
      continue: vi.fn().mockResolvedValue(undefined)
    };

    let requestListener: ((req: any) => void) | null = null;
    const mockPage = {
      setRequestInterception: vi.fn().mockResolvedValue(undefined),
      on: vi.fn().mockImplementation((event, handler) => {
        if (event === "request") {
          requestListener = handler;
        }
      })
    } as any;

    await configureResourceBlocking(mockPage);

    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(mockPage.on).toHaveBeenCalledWith("request", expect.any(Function));

    expect(requestListener).not.toBeNull();
    if (requestListener) {
      requestListener(mockRequest);
      expect(mockRequest.abort).toHaveBeenCalled();
      expect(mockRequest.continue).not.toHaveBeenCalled();
    }
  });

  it("should save and restore browser session data", async () => {
    const sessionFile = path.join(tmpDir, "session.json");

    const mockCookies = [{ name: "auth_token", value: "secret123", domain: "example.com" }];
    const mockLocalStorage = { user_id: "42", theme: "dark" };

    const mockSavePage = {
      cookies: vi.fn().mockResolvedValue(mockCookies),
      evaluate: vi.fn().mockResolvedValue(mockLocalStorage)
    } as any;

    await saveBrowserSession(mockSavePage, sessionFile);

    expect(fs.existsSync(sessionFile)).toBe(true);

    const savedContent = JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
    expect(savedContent.cookies).toEqual(mockCookies);
    expect(savedContent.localStorage).toEqual(mockLocalStorage);

    const mockRestorePage = {
      setCookie: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockImplementation(async (fn, arg) => {
        return fn(arg);
      })
    } as any;

    const restored = await restoreBrowserSession(mockRestorePage, sessionFile);
    expect(restored).toBe(true);
    expect(mockRestorePage.setCookie).toHaveBeenCalledWith(...mockCookies);
    expect(mockRestorePage.evaluate).toHaveBeenCalled();
  });

  it("should return false when restoring from non-existent session file", async () => {
    const mockPage = {} as any;
    const restored = await restoreBrowserSession(mockPage, path.join(tmpDir, "non-existent.json"));
    expect(restored).toBe(false);
  });
});
