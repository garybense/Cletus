import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  configureResourceBlocking,
  saveBrowserSession,
  restoreBrowserSession,
} from "../browser/browser-service.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Browser Service Optimization Tools", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cletus-browser-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("configures resource blocking on page request listener with safe promise rejection catching", async () => {
    const listeners: Record<string, (req: any) => void> = {};
    const mockPage: any = {
      setRequestInterception: vi.fn().mockResolvedValue(undefined),
      on: vi.fn((event: string, handler: (req: any) => void) => {
        listeners[event] = handler;
      }),
    };

    await configureResourceBlocking(mockPage, {
      blockImages: true,
      blockFonts: true,
      blockMedia: true,
      blockStylesheets: false,
    });

    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(mockPage.on).toHaveBeenCalledWith("request", expect.any(Function));

    const requestListener = listeners["request"];
    expect(requestListener).toBeDefined();

    const mockImageReq = {
      resourceType: () => "image",
      abort: vi.fn().mockResolvedValue(undefined),
      continue: vi.fn().mockResolvedValue(undefined),
    };
    requestListener(mockImageReq);
    expect(mockImageReq.abort).toHaveBeenCalled();
    expect(mockImageReq.continue).not.toHaveBeenCalled();

    const mockDocReq = {
      resourceType: () => "document",
      abort: vi.fn().mockResolvedValue(undefined),
      continue: vi.fn().mockResolvedValue(undefined),
    };
    requestListener(mockDocReq);
    expect(mockDocReq.abort).not.toHaveBeenCalled();
    expect(mockDocReq.continue).toHaveBeenCalled();
  });

  it("saves browser session cookies and localStorage to disk", async () => {
    const sessionPath = path.join(tmpDir, "session.json");
    const mockCookies = [
      { name: "auth_token", value: "secret123", domain: "example.com" },
    ];
    const mockPage: any = {
      cookies: vi.fn().mockResolvedValue(mockCookies),
      evaluate: vi.fn().mockImplementation((_fn: Function) => {
        return Promise.resolve({ user_id: "42" });
      }),
    };

    await saveBrowserSession(mockPage, sessionPath);

    expect(fs.existsSync(sessionPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
    expect(content.cookies).toEqual(mockCookies);
    expect(content.localStorage).toEqual({ user_id: "42" });
    expect(content.savedAt).toBeDefined();
  });

  it("restores browser session cookies and evaluates localStorage on new documents for target origin binding", async () => {
    const sessionPath = path.join(tmpDir, "session.json");
    const mockSession = {
      cookies: [{ name: "session_id", value: "xyz987", domain: "test.com" }],
      localStorage: { theme: "dark" },
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(sessionPath, JSON.stringify(mockSession));

    const mockPage: any = {
      setCookie: vi.fn().mockResolvedValue(undefined),
      evaluateOnNewDocument: vi.fn().mockResolvedValue(undefined),
    };

    await restoreBrowserSession(mockPage, sessionPath);

    expect(mockPage.setCookie).toHaveBeenCalledWith(mockSession.cookies[0]);
    expect(mockPage.evaluateOnNewDocument).toHaveBeenCalledWith(
      expect.any(Function),
      mockSession.localStorage
    );
  });
});
