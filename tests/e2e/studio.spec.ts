import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { Download, Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import foundationsFixture from "../../data/windows_11_pro_foundations.json";
import uiFixture from "../../data/windows_11_pro_ui.json";
import { expect, test } from "./fixtures";

async function openStudio(page: Page) {
  await page.goto("/");
  await expect(page.locator(".loading-scrim")).toHaveCount(0);
  await page.getByRole("button", { name: "AI Studio" }).click();
  await expect(page.getByRole("button", { name: /Validate theme:/ })).toBeVisible();
}

async function readPair(download: Download) {
  const archivePath = await download.path();
  assert.ok(archivePath, "the browser should save the ZIP to a temporary file");
  const archive = unzipSync(new Uint8Array(await readFile(archivePath)));
  return Object.entries(archive).map(([name, bytes]) => ({
    name,
    document: JSON.parse(strFromU8(bytes)) as Record<string, unknown>,
  }));
}

test("serves the app shell with the configured security headers", async ({ page }) => {
  const response = await page.goto("/");
  expect(response).not.toBeNull();
  const headers = response!.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
});

test("validates the starter contract and downloads a synchronized JSON pair", async ({ page }) => {
  await openStudio(page);
  await page.getByRole("button", { name: /Validate theme:/ }).click();

  const dialog = page.getByRole("dialog", { name: "Theme validation report" });
  await expect(dialog).toBeVisible();
  const summary = dialog.locator(".validation-summary__item");
  await expect(summary.nth(0).locator("b")).toHaveText("0");
  await expect(summary.nth(1).locator("b")).toHaveText("2");
  await expect(dialog.getByText("openuiTheme.colors.openui_accent_pressed")).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export pair" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/-openui-pair\.zip$/);
  expect(await download.failure()).toBeNull();

  const documents = await readPair(download);
  expect(documents).toHaveLength(2);
  const ui = documents.find(({ document }) => document.specVersion === "openui-1.0");
  const foundations = documents.find(({ document }) => document.specVersion === "openui-foundations-draft");
  expect(ui).toBeDefined();
  expect(foundations).toBeDefined();
  expect(foundations!.document.pairsWith).toBe(ui!.name);
});

test("keeps keyboard focus inside the validation dialog and restores it on close", async ({ page }) => {
  await openStudio(page);
  const validate = page.getByRole("button", { name: /Validate theme:/ });
  await validate.click();

  const dialog = page.getByRole("dialog", { name: "Theme validation report" });
  await expect(dialog).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Done" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close validation report" })).toBeFocused();
  await page.keyboard.press("Escape");

  await expect(dialog).toBeHidden();
  await expect(validate).toBeFocused();
});

test("round-trips unknown fields from both imported contracts through ZIP export", async ({ page }) => {
  await openStudio(page);

  const uiDocument = JSON.parse(JSON.stringify(uiFixture)) as Record<string, unknown>;
  const foundationsDocument = JSON.parse(JSON.stringify(foundationsFixture)) as Record<string, unknown>;
  const uiExtension = { provider: "forma-e2e", flags: ["retain", "round-trip"] };
  const foundationsExtension = { source: "external", metadata: { revision: 7 } };
  uiDocument.vendorExtension = uiExtension;
  foundationsDocument.vendorExtension = foundationsExtension;
  foundationsDocument.pairsWith = "incoming-ui.json";

  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "incoming-ui.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(uiDocument)),
    },
    {
      name: "incoming-foundations.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(foundationsDocument)),
    },
  ]);
  await expect(page.getByRole("status")).toContainText("Imported the OpenUI and foundations pair");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export pair" }).click(),
  ]);
  const documents = await readPair(download);
  const ui = documents.find(({ document }) => document.specVersion === "openui-1.0");
  const foundations = documents.find(({ document }) => document.specVersion === "openui-foundations-draft");

  expect(ui?.document.vendorExtension).toEqual(uiExtension);
  expect(foundations?.document.vendorExtension).toEqual(foundationsExtension);
  expect(foundations?.document.pairsWith).toBe(ui?.name);
});

test("reports stale imported pair links and rewrites the exported pair", async ({ page }) => {
  await openStudio(page);

  const uiDocument = JSON.parse(JSON.stringify(uiFixture)) as Record<string, unknown>;
  const foundationsDocument = JSON.parse(JSON.stringify(foundationsFixture)) as Record<string, unknown>;
  foundationsDocument.pairsWith = "previous-ui.json";
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "current-ui.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(uiDocument)),
    },
    {
      name: "current-foundations.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(foundationsDocument)),
    },
  ]);
  await expect(page.getByRole("status")).toContainText("Their original pair filename differs");

  const validate = page.getByRole("button", { name: /Validate theme:/ });
  await expect(validate).toHaveAttribute("aria-label", /0 errors, 3 warnings/);
  await validate.click();
  const dialog = page.getByRole("dialog", { name: "Theme validation report" });
  await expect(dialog.getByText("pair.filename.mismatch")).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export pair" }).click(),
  ]);
  const documents = await readPair(download);
  const ui = documents.find(({ document }) => document.specVersion === "openui-1.0");
  const foundations = documents.find(({ document }) => document.specVersion === "openui-foundations-draft");
  expect(foundations?.document.pairsWith).toBe(ui?.name);
});

test("reports malformed imported data and blocks affected JSON exports", async ({ page }) => {
  await openStudio(page);

  const invalidUi = JSON.parse(JSON.stringify(uiFixture)) as Record<string, unknown>;
  const tokens = invalidUi.tokens as Record<string, unknown>[];
  tokens[1].key = tokens[0].key;
  (tokens[0].props as Record<string, unknown>).background = "@color/not_defined";
  const openuiTheme = invalidUi.openuiTheme as Record<string, unknown>;
  (openuiTheme.metrics_dp as Record<string, unknown>).screen_pad = 100;

  await page.locator('input[type="file"]').setInputFiles({
    name: "invalid-openui.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(invalidUi)),
  });
  await expect(page.getByRole("status")).toContainText("Validation found 2 errors");

  const validate = page.getByRole("button", { name: /Validate theme:/ });
  await expect(validate).toHaveAttribute("aria-label", /2 errors/);
  await validate.click();
  const dialog = page.getByRole("dialog", { name: "Theme validation report" });
  await expect(dialog.getByText("openui.token.key.duplicate")).toBeVisible();
  await expect(dialog.getByText("color.reference.unresolved")).toBeVisible();
  await expect(dialog.getByText("openuiTheme.metrics_dp.screen_pad")).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();

  let downloadCount = 0;
  page.on("download", () => { downloadCount += 1; });
  await page.getByRole("button", { name: "Export pair" }).click();
  await expect(page.getByRole("status")).toContainText("Export blocked by 2 validation errors");

  await page.getByRole("button", { name: "More export formats" }).click();
  await page.getByRole("menuitem", { name: "OpenUI 1.0 JSON" }).click();
  await expect(page.getByRole("status")).toContainText("Export blocked by 2 validation errors");
  expect(downloadCount).toBe(0);
});

test("updates foundation tokens live, survives reload, and fits a mobile viewport", async ({ page }) => {
  await openStudio(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Type + space" }).click();
  await page.getByLabel("Font family").selectOption("serif");

  const sample = page.locator(".preview-stage .sample-site");
  await expect.poll(() => sample.evaluate((element) =>
    getComputedStyle(element).getPropertyValue("--p-font-family"))).toContain("Georgia");
  await page.getByLabel("Sample website viewport").selectOption("mobile");
  await expect(sample).toHaveAttribute("data-viewport", "mobile");
  expect(await page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= window.innerWidth)).toBe(true);

  await page.reload();
  await expect(page.locator(".loading-scrim")).toHaveCount(0);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "AI Studio" }).click();
  await page.getByRole("tab", { name: "Type + space" }).click();
  await expect(page.locator("#font-family-select")).toHaveValue("serif");
  await expect.poll(() => sample.evaluate((element) =>
    getComputedStyle(element).getPropertyValue("--p-font-family"))).toContain("Georgia");
});

test("shows provider failures without applying changes or exposing the key", async ({ page }) => {
  const testKey = "forma-e2e-fake-provider-key";
  let requestCount = 0;
  let forwardedKey = "";
  let requestBody = "";
  await page.route("**/api/assistant", async (route) => {
    requestCount += 1;
    forwardedKey = route.request().headers()["x-provider-api-key"] ?? "";
    requestBody = route.request().postData() ?? "";
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "OpenAI returned an error (429). Check the provider, model, and key." }),
    });
  });

  await openStudio(page);
  await page.getByRole("button", { name: "Provider settings" }).click();
  await page.getByRole("textbox", { name: /API key/ }).fill(testKey);
  await page.getByRole("button", { name: "AI Studio" }).click();
  const sample = page.locator(".preview-stage .sample-site");
  const originalStyle = await sample.getAttribute("style");

  await page.getByRole("textbox", { name: "Describe a design change" }).fill("Make the dashboard warmer.");
  await page.getByRole("button", { name: "Send prompt" }).click();
  const failure = page.locator(".chat-message--assistant").last();
  await expect(failure).toContainText("OpenAI returned an error (429)");
  await expect(failure).toContainText("Your draft is unchanged.");
  await expect(failure).not.toContainText(testKey);
  expect(await sample.getAttribute("style")).toBe(originalStyle);
  expect(requestCount).toBe(1);
  expect(forwardedKey).toBe(testKey);
  expect(requestBody).not.toContain(testKey);
});

test("keeps the assistant usable without credentials and makes no provider request", async ({ page }) => {
  let providerRequests = 0;
  await page.route("**/api/assistant", async (route) => {
    providerRequests += 1;
    await route.abort();
  });
  await openStudio(page);
  await expect(page.getByText("No AI key connected")).toBeVisible();
  await page.getByRole("textbox", { name: "Describe a design change" }).fill("Make the dashboard feel warmer.");
  await page.getByRole("button", { name: "Send prompt" }).click();

  await expect(page.locator(".chat-message--assistant").last()).toContainText("Your request is ready");
  expect(providerRequests).toBe(0);
});
