import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  configureResourceBlocking,
  saveBrowserSession,
  restoreBrowserSession,
} from '../browser/browser-service.js';
import fs from 'fs';
import path from 'path';

describe('browser-service optimizations', () => {
  const tmpDir = path.join(process.cwd(), '.tmp-test-browser');

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('configures resource blocking on page request interception', async () => {
    let requestHandler: ((req: any) => void) | null = null;
    const setRequestInterceptionMock = vi.fn().mockResolvedValue(undefined);
    const onMock = vi.fn().mockImplementation((event: string, handler: any) => {
      if (event === 'request') {
        requestHandler = handler;
      }
    });

    const mockPage: any = {
      setRequestInterception: setRequestInterceptionMock,
      on: onMock,
    };

    await configureResourceBlocking(mockPage, {
      blockedTypes: ['image', 'font'],
    });

    expect(setRequestInterceptionMock).toHaveBeenCalledWith(true);
    expect(onMock).toHaveBeenCalledWith('request', expect.any(Function));
    expect(requestHandler).not.toBeNull();

    // Test aborting blocked resource
    const abortMock = vi.fn();
    const continueMock = vi.fn();
    const mockImageRequest = {
      resourceType: () => 'image',
      abort: abortMock,
      continue: continueMock,
    };

    requestHandler!(mockImageRequest);
    expect(abortMock).toHaveBeenCalled();
    expect(continueMock).not.toHaveBeenCalled();

    // Test allowing non-blocked resource
    const abortMock2 = vi.fn();
    const continueMock2 = vi.fn();
    const mockDocumentRequest = {
      resourceType: () => 'document',
      abort: abortMock2,
      continue: continueMock2,
    };

    requestHandler!(mockDocumentRequest);
    expect(abortMock2).not.toHaveBeenCalled();
    expect(continueMock2).toHaveBeenCalled();
  });

  it('saves browser session cookies and localStorage to disk', async () => {
    const mockPage: any = {
      cookies: vi.fn().mockResolvedValue([
        { name: 'session', value: 'secret123', domain: 'example.com' },
      ]),
      evaluate: vi.fn().mockImplementation((fn: any) => {
        return Promise.resolve({ auth_token: 'xyz789' });
      }),
    };

    const sessionPath = path.join(tmpDir, 'session.json');
    await saveBrowserSession(mockPage, sessionPath);

    expect(fs.existsSync(sessionPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    expect(content.cookies).toHaveLength(1);
    expect(content.cookies[0].name).toBe('session');
    expect(content.localStorage).toEqual({ auth_token: 'xyz789' });
  });

  it('restores browser session cookies and localStorage onto page', async () => {
    const sessionPath = path.join(tmpDir, 'session.json');
    const sessionData = {
      cookies: [{ name: 'session', value: 'secret123', domain: 'example.com' }],
      localStorage: { auth_token: 'xyz789' },
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(sessionPath, JSON.stringify(sessionData));

    const setCookieMock = vi.fn().mockResolvedValue(undefined);
    const evaluateMock = vi.fn().mockResolvedValue(undefined);

    const mockPage: any = {
      setCookie: setCookieMock,
      evaluate: evaluateMock,
    };

    await restoreBrowserSession(mockPage, sessionPath);

    expect(setCookieMock).toHaveBeenCalledWith(sessionData.cookies[0]);
    expect(evaluateMock).toHaveBeenCalled();
  });
});
