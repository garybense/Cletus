import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const mockPage = {
  setRequestInterception: vi.fn().mockResolvedValue(undefined),
  removeAllListeners: vi.fn(),
  off: vi.fn(),
  on: vi.fn(),
  cookies: vi.fn().mockResolvedValue([{ name: 'session', value: 'abc123xyz' }]),
  setCookie: vi.fn().mockResolvedValue(undefined),
  setUserAgent: vi.fn().mockResolvedValue(undefined),
  setViewport: vi.fn().mockResolvedValue(undefined),
  isClosed: vi.fn().mockReturnValue(false),
  evaluate: vi.fn().mockImplementation((fn: any, ...args: any[]) => {
    if (typeof fn === 'function') {
      if (args.length > 0) {
        return Promise.resolve(undefined);
      }
      return Promise.resolve({ theme: 'dark', auth_token: 'tok_456' });
    }
    return Promise.resolve({});
  }),
};

const mockBrowser = {
  connected: true,
  pages: vi.fn().mockResolvedValue([mockPage]),
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn().mockImplementation(() => Promise.resolve(mockBrowser)),
  },
}));

import {
  configureResourceBlocking,
  saveBrowserSession,
  restoreBrowserSession,
} from '../browser/browser-service.js';

describe('Browser Service Optimizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('configures resource blocking with custom blocked resource types', async () => {
    await configureResourceBlocking(true, ['image', 'font']);

    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function));

    await configureResourceBlocking(false);
    expect(mockPage.off).toHaveBeenCalledWith('request', expect.any(Function));
  });

  it('saves and restores browser session state to disk', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cletus-browser-test-'));
    const sessionFile = path.join(tmpDir, 'session.json');

    try {
      await saveBrowserSession(sessionFile);
      expect(fs.existsSync(sessionFile)).toBe(true);

      const content = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      expect(content.cookies).toEqual([{ name: 'session', value: 'abc123xyz' }]);
      expect(content.localStorage).toEqual({ theme: 'dark', auth_token: 'tok_456' });

      await restoreBrowserSession(sessionFile);
      expect(mockPage.setCookie).toHaveBeenCalledWith({ name: 'session', value: 'abc123xyz' });
      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), {
        theme: 'dark',
        auth_token: 'tok_456',
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
