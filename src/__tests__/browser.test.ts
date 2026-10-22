import { describe, it, expect, vi } from 'vitest';
import { configureResourceBlocking } from '../browser/browser-service';

describe('Browser Service Resource Optimization', () => {
  it('aborts heavy resource requests when resource blocking is enabled', async () => {
    let requestHandler: ((req: any) => void) | undefined;
    const pageMock: any = {
      setRequestInterception: vi.fn().mockResolvedValue(undefined),
      removeAllListeners: vi.fn(),
      on: vi.fn((event: string, handler: (req: any) => void) => {
        if (event === 'request') requestHandler = handler;
      }),
    };

    await configureResourceBlocking(pageMock, { blockImages: true, blockFonts: true, blockMedia: true });

    expect(pageMock.setRequestInterception).toHaveBeenCalledWith(true);
    expect(pageMock.removeAllListeners).toHaveBeenCalledWith('request');
    expect(requestHandler).toBeDefined();

    const imageReqMock = { resourceType: () => 'image', abort: vi.fn(), continue: vi.fn() };
    requestHandler!(imageReqMock);
    expect(imageReqMock.abort).toHaveBeenCalled();
    expect(imageReqMock.continue).not.toHaveBeenCalled();

    const scriptReqMock = { resourceType: () => 'script', abort: vi.fn(), continue: vi.fn() };
    requestHandler!(scriptReqMock);
    expect(scriptReqMock.continue).toHaveBeenCalled();
    expect(scriptReqMock.abort).not.toHaveBeenCalled();
  });
});
