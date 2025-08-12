// Optional puppeteer types - allows compilation without puppeteer installed
declare module 'puppeteer' {
  export interface Browser {
    newPage(): Promise<Page>
    close(): Promise<void>
  }

  export interface Page {
    setUserAgent(userAgent: string): Promise<void>
    setViewport(viewport: { width: number; height: number }): Promise<void>
    goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<void>
    waitForSelector(selector: string, options?: { timeout?: number }): Promise<void>
    evaluate<T>(pageFunction: (...args: any[]) => T, ...args: any[]): Promise<T>
    close(): Promise<void>
  }

  export interface LaunchOptions {
    headless?: boolean
    args?: string[]
  }

  export function launch(options?: LaunchOptions): Promise<Browser>
  export default { launch }
}