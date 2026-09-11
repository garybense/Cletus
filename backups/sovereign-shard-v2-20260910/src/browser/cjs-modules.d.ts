// Ambient declarations for CJS-only puppeteer-extra ecosystem packages.
// The actual runtime modules live in node_modules; these declarations let TS
// compile without reaching for @types packages that don't exist.

declare module 'puppeteer-extra' {
  import { Browser, PuppeteerNodeLaunchOptions, Product } from 'puppeteer';

  interface PuppeteerExtra {
    use(plugin: any): PuppeteerExtra;
    launch(options?: PuppeteerNodeLaunchOptions): Promise<Browser>;
    connect(options: any): Promise<Browser>;
    defaultArgs(): string[];
    executablePath(): string;
    createBrowserFetcher(): any;
    plugins: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getPluginData(plugin: any, key: string): any;
  }

  // The CJS module exports the class as .default AND exposes use/launch on itself.
  const puppeteerExtra: PuppeteerExtra & { default: PuppeteerExtra };
  export default puppeteerExtra;
  export = puppeteerExtra;
}

declare module 'puppeteer-extra-plugin-stealth' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface StealthPlugin { (...args: any[]): any; defaults: any; }
  const plugin: { default: StealthPlugin; plugin: StealthPlugin };
  export default plugin.default;
}

declare module 'puppeteer-extra-plugin-user-data-dir' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface UserDataDirPlugin { (...args: any[]): any; }
  const plugin: { default: UserDataDirPlugin; plugin: UserDataDirPlugin };
  export default plugin.default;
}
