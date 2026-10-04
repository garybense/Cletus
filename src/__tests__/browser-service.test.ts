import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { configureResourceBlocking, saveBrowserSession, restoreBrowserSession } from "../browser/browser-service.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("Browser Service Optimization Tools", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "browser-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("configureResourceBlocking enables request interception and aborts blocked types", async () => {
    let requestHandler: ((req: any) => void) | null = null;
    const mockPage: any = {
      setRequestInterception: vi.fn().mockResolvedValue(undefined),
      on: vi.fn((event: string, handler: any) => {
        if (event === "request") requestHandler = handler;
      }),
    };

    await configureResourceBlocking(mockPage, ["image", "font"]);

    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(mockPage.on).toHaveBeenCalledWith("request", expect.any(Function));

    // Simulate blocked image request
    const blockedReq: any = {
      resourceType: () => "image",
      abort: vi.fn(),
      continue: vi.fn(),
    };
    requestHandler?.(blockedReq);
    expect(blockedReq.abort).toHaveBeenCalled();
    expect(blockedReq.continue).not.toHaveBeenCalled();

    // Simulate allowed document request
    const allowedReq: any = {
      resourceType: () => "document",
      abort: vi.fn(),
      continue: vi.fn(),
    };
    requestHandler?.(allowedReq);
    expect(allowedReq.continue).toHaveBeenCalled();
    expect(allowedReq.abort).not.toHaveBeenCalled();
  });

  it("saveBrowserSession and restoreBrowserSession save and reload browser state", async () => {
    const sessionPath = path.join(tmpDir, "session.json");
    const mockSavePage: any = {
      cookies: vi.fn().mockResolvedValue([{ name: "sid", value: "12345", domain: "example.com" }]),
      evaluate: vi.fn().mockImplementation((fn: any) => {
        if (fn.toString().includes("localStorage")) {
          return Promise.resolve({ token: "abcxyz" });
        }
        return Promise.resolve();
      }),
    };

    await saveBrowserSession(mockSavePage, sessionPath);
    expect(fs.existsSync(sessionPath)).toBe(true);

    const mockRestorePage: any = {
      setCookie: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockImplementation((fn: any, arg: any) => {
        if (typeof fn === "function") {
          fn(arg);
        }
        return Promise.resolve();
      }),
    };

    await restoreBrowserSession(mockRestorePage, sessionPath);
    expect(mockRestorePage.setCookie).toHaveBeenCalledWith({
      name: "sid",
      value: "12345",
      domain: "example.com",
    });
    expect(mockRestorePage.evaluate).toHaveBeenCalled();
  });
});
