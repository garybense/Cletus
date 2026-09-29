import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureResourceBlocking, saveBrowserSession, restoreBrowserSession } from "../browser/browser-service.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("Browser Service Optimizations", () => {
  it("configures request interception for resource blocking when blockHeavyResources is true", async () => {
    let interceptionEnabled = false;
    const requestHandlers: Array<(req: any) => void> = [];

    const mockPage: any = {
      setRequestInterception: vi.fn().mockImplementation(async (flag: boolean) => {
        interceptionEnabled = flag;
      }),
      on: vi.fn().mockImplementation((event: string, handler: (req: any) => void) => {
        if (event === "request") {
          requestHandlers.push(handler);
        }
      }),
    };

    await configureResourceBlocking(mockPage, {
      blockHeavyResources: true,
      resourceTypesToBlock: ["image", "font", "media"],
    });

    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(interceptionEnabled).toBe(true);
    expect(requestHandlers.length).toBe(1);

    // Test request blocking behavior
    let aborted = false;
    let continued = false;

    const mockImageRequest = {
      resourceType: () => "image",
      abort: () => { aborted = true; },
      continue: () => { continued = true; },
    };

    requestHandlers[0](mockImageRequest);
    expect(aborted).toBe(true);
    expect(continued).toBe(false);

    // Test allowed request behavior
    aborted = false;
    continued = false;

    const mockDocRequest = {
      resourceType: () => "document",
      abort: () => { aborted = true; },
      continue: () => { continued = true; },
    };

    requestHandlers[0](mockDocRequest);
    expect(aborted).toBe(false);
    expect(continued).toBe(true);
  });
});
