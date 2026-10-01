import { describe, it, expect, vi } from 'vitest';
import { configureResourceBlocking, saveBrowserSession, restoreBrowserSession } from '../browser/browser-service';

describe('Browser Service Optimizations', () => {
  it('configures request interception for resource blocking', async () => {
    let requestHandler: ((req: any) => void) | null = null;
    const mockPage: any = {
      setRequestInterception: vi.fn().mockResolvedValue(undefined),
      on: vi.fn((event: string, handler: any) => {
        if (event === 'request') requestHandler = handler;
      }),
    };

    await configureResourceBlocking(mockPage, ['image', 'font']);
    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function));

    const imageReq = { resourceType: () => 'image', abort: vi.fn().mockResolvedValue(undefined), continue: vi.fn().mockResolvedValue(undefined) };
    const docReq = { resourceType: () => 'document', abort: vi.fn().mockResolvedValue(undefined), continue: vi.fn().mockResolvedValue(undefined) };

    requestHandler!(imageReq);
    expect(imageReq.abort).toHaveBeenCalled();
    expect(imageReq.continue).not.toHaveBeenCalled();

    requestHandler!(docReq);
    expect(docReq.continue).toHaveBeenCalled();
    expect(docReq.abort).not.toHaveBeenCalled();
  });

  it('saves and restores browser session state', async () => {
    const mockCookies = [{ name: 'session_id', value: '12345', domain: 'example.com' }];
    const mockPage: any = {
      cookies: vi.fn().mockResolvedValue(mockCookies),
      evaluate: vi.fn().mockResolvedValue('MockUserAgent/1.0'),
      setCookie: vi.fn().mockResolvedValue(undefined),
      setUserAgent: vi.fn().mockResolvedValue(undefined),
    };

    const session = await saveBrowserSession(mockPage);
    expect(session.cookies).toEqual(mockCookies);
    expect(session.userAgent).toBe('MockUserAgent/1.0');

    await restoreBrowserSession(mockPage, session);
    expect(mockPage.setCookie).toHaveBeenCalledWith(...mockCookies);
    expect(mockPage.setUserAgent).toHaveBeenCalledWith('MockUserAgent/1.0');
  });
});
