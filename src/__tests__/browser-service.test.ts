import { describe, it, expect, vi } from "vitest";
import { configureResourceBlocking } from "../browser/browser-service.js";

describe("Browser Service Resource Blocking", () => {
  it("configures request interception and attaches request listener when blocking is enabled", async () => {
    let interceptionEnabled = false;
    let requestHandler: ((req: any) => void) | null = null;

    const mockPage: any = {
      setRequestInterception: vi.fn(async (enabled: boolean) => {
        interceptionEnabled = enabled;
      }),
      off: vi.fn(),
      on: vi.fn((event: string, handler: any) => {
        if (event === "request") requestHandler = handler;
      }),
    };

    await configureResourceBlocking({ blockImages: true, blockFonts: true }, mockPage);

    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(mockPage.on).toHaveBeenCalledWith("request", expect.any(Function));
    expect(interceptionEnabled).toBe(true);

    // Test request blocking handler behavior
    let aborted = false;
    let continued = false;

    const mockImageReq: any = {
      resourceType: () => "image",
      abort: vi.fn(async () => { aborted = true; }),
      continue: vi.fn(async () => { continued = true; }),
    };

    if (requestHandler) {
      requestHandler(mockImageReq);
      expect(mockImageReq.abort).toHaveBeenCalled();
      expect(mockImageReq.continue).not.toHaveBeenCalled();
    }
  });

  it("disables request interception when all blocking options are false", async () => {
    const mockPage: any = {
      setRequestInterception: vi.fn(async () => {}),
      off: vi.fn(),
      on: vi.fn(),
    };

    await configureResourceBlocking(
      { blockImages: false, blockStylesheets: false, blockFonts: false, blockMedia: false },
      mockPage,
    );

    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(false);
  });
});
