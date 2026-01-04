import { chromium, type BrowserContext, type Page, type Browser } from "playwright";
import { ensureDir } from "./utils.js";
import type { CliFoodConfig } from "./config.js";

export type BrowserSession = {
  page: Page;
  context: BrowserContext;
  close: () => Promise<void>;
  remote: boolean;
};

export async function openSession(config: CliFoodConfig): Promise<BrowserSession> {
  const viewport = { width: 1280, height: 800 };
  const timeout = config.timeoutMs ?? 30_000;

  if (config.cdpUrl) {
    const browser = await chromium.connectOverCDP(config.cdpUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext({ locale: config.locale, viewport }));
    const page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(timeout);

    const close = async () => {
      try {
        await page.close({ runBeforeUnload: true });
      } catch {
        // ignore
      }
      await browser.close();
    };

    return { page, context, close, remote: true };
  }

  await ensureDir(config.profileDir);
  const context = await chromium.launchPersistentContext(config.profileDir, {
    headless: config.headless,
    slowMo: config.slowMo,
    locale: config.locale,
    viewport,
  });

  const page = context.pages()[0] ?? (await context.newPage());
  page.setDefaultTimeout(timeout);

  const close = async () => {
    await context.close();
  };

  return { page, context, close, remote: false };
}
