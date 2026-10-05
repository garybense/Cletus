import { describe, it, expect, vi } from 'vitest';
import { configureResourceBlocking, saveBrowserSession, restoreBrowserSession } from '../browser/browser-service.js';

describe('Browser Service Optimizations', () => {
  it('configures request interception and blocks heavy resource types', async () => {
    let requestHandler: ((req: any) => void) | null = null;
    const mockPage: any = {
      setRequestInterception: vi.fn().mockResolvedValue(undefined),
      on: vi.fn().mockImplementation((event: string, handler: any) => {
        if (event === 'request') requestHandler = handler;
      }),
    };

    await configureResourceBlocking(mockPage, {
      blockImages: true,
      blockMedia: true,
      blockFonts: true,
      blockStylesheets: false,
    });

    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function));
    expect(requestHandler).not.toBeNull();

    // Test blocking images
    const mockImageReq: any = {
      resourceType: () => 'image',
      abort: vi.fn().mockResolvedValue(undefined),
      continue: vi.fn().mockResolvedValue(undefined),
    };
    requestHandler!(mockImageReq);
    expect(mockImageReq.abort).toHaveBeenCalled();
    expect(mockImageReq.continue).not.toHaveBeenCalled();

    // Test allowing document/script
    const mockDocReq: any = {
      resourceType: () => 'document',
      abort: vi.fn().mockResolvedValue(undefined),
      continue: vi.fn().mockResolvedValue(undefined),
    };
    requestHandler!(mockDocReq);
    expect(mockDocReq.continue).toHaveBeenCalled();
    expect(mockDocReq.abort).not.toHaveBeenCalled();
  });

  it('saves and restores browser cookies and session state', async () => {
    const mockCookies = [{ name: 'session_id', value: 'xyz123', domain: 'example.com' }];
    const mockLocalStorage = { auth_token: 'jwt-abc-789' };

    const mockPage: any = {
      cookies: vi.fn().mockResolvedValue(mockCookies),
      evaluate: vi.fn().mockResolvedValue(mockLocalStorage),
      setCookie: vi.fn().mockResolvedValue(undefined),
    };

    const savedSession = await saveBrowserSession(mockPage);
    expect(mockPage.cookies).toHaveBeenCalled();
    expect(savedSession.cookies).toEqual(mockCookies);
    expect(savedSession.localStorageData).toEqual(mockLocalStorage);

    const restorePage: any = {
      setCookie: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(undefined),
    };

    const restored = await restoreBrowserSession(restorePage, savedSession);
    expect(restored).toBe(true);
    expect(restorePage.setCookie).toHaveBeenCalledWith(...mockCookies);
    expect(restorePage.evaluate).toHaveBeenCalled();
  });
});
