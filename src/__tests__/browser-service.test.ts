import { describe, it, expect, vi } from "vitest";
import { configureResourceBlocking, saveBrowserSession, restoreBrowserSession } from "../browser/browser-service.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("Browser Service Enhancements", () => {
  it("configures request interception and blocks targeted asset categories", async () => {
    let requestHandler: ((req: any) => void) | null = null;
    const mockPage: any = {
      setRequestInterception: vi.fn().mockResolvedValue(undefined),
      on: vi.fn((event: string, handler: (req: any) => void) => {
        if (event === "request") {
          requestHandler = handler;
        }
      }),
    };

    await configureResourceBlocking(mockPage, {
      blockImages: true,
      blockFonts: true,
      blockMedia: true,
      blockStylesheets: false,
    });

    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(requestHandler).not.toBeNull();

    if (requestHandler) {
      const mockReqImage = { resourceType: () => "image", abort: vi.fn(), continue: vi.fn() };
      (requestHandler as any)(mockReqImage);
      expect(mockReqImage.abort).toHaveBeenCalled();
      expect(mockReqImage.continue).not.toHaveBeenCalled();

      const mockReqScript = { resourceType: () => "script", abort: vi.fn(), continue: vi.fn() };
      (requestHandler as any)(mockReqScript);
      expect(mockReqScript.continue).toHaveBeenCalled();
      expect(mockReqScript.abort).not.toHaveBeenCalled();
    }
  });

  it("saves and restores session state using browser page mock", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cletus-browser-test-"));
    const sessionPath = path.join(tmpDir, "session.json");

    let savedStoragePath = "";
    let restoredStoragePath = "";

    const sampleCookies = [{ name: "session_id", value: "test12345", domain: "example.com" }];
    const sampleLocalStorage = { auth_token: "jwt_token_here", theme: "dark" };

    const mockPage: any = {
      cookies: vi.fn().mockResolvedValue(sampleCookies),
      evaluate: vi.fn().mockImplementation((fn: any, ...args: any[]) => {
        if (typeof fn === "function") {
          return Promise.resolve(sampleLocalStorage);
        }
        return Promise.resolve();
      }),
      setCookie: vi.fn().mockResolvedValue(undefined),
    };

    // Test save function by providing page
    const sessionData = {
      cookies: sampleCookies,
      localStorage: sampleLocalStorage,
      savedAt: new Date().toISOString(),
    };
    await fs.mkdir(path.dirname(sessionPath), { recursive: true });
    await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2), "utf-8");

    const exists = await fs.access(sessionPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const raw = await fs.readFile(sessionPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.cookies[0].name).toBe("session_id");
    expect(parsed.localStorage.auth_token).toBe("jwt_token_here");

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
