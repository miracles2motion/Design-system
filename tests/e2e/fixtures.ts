import {
  chromium as playwrightChromium,
  expect,
  test as base,
  type Browser,
} from "@playwright/test";
import bundledChromium from "@sparticuz/chromium";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const test = base.extend<{ browser: Browser }>({
  browser: async ({}, use) => {
    const installedBrowser = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
    const executablePath = installedBrowser ?? await bundledChromium.executablePath();
    // NSS/nspr libraries are not present on this host; cached in the repo
    // under .cache/nss-libs so they survive sandbox /tmp resets.
    let runtimeLibraries = join(
      process.cwd(),
      ".cache",
      "nss-libs",
    );
    if (!existsSync(runtimeLibraries)) {
      const fallback = join(tmpdir(), "nss-libs");
      if (existsSync(fallback)) runtimeLibraries = fallback;
    }
    const environment = process.platform === "linux" && !installedBrowser
      ? {
        ...process.env,
        LD_LIBRARY_PATH: [runtimeLibraries, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":"),
      }
      : process.env;
    const browser = await playwrightChromium.launch({
      executablePath,
      ...(installedBrowser ? {} : { args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] }),
      env: environment,
      headless: true,
    });
    try {
      await use(browser);
    } finally {
      await browser.close();
    }
  },
});

export { expect };
