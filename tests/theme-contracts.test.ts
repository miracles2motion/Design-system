import assert from "node:assert/strict";
import { test } from "node:test";
import {
  STARTER_THEME,
  toCssFile,
  toFoundationsDocument,
  toOpenUiDocument,
  type ThemeDraft,
} from "../lib/theme";

test("starter exports retain both supplied contracts as separate documents", () => {
  const ui = toOpenUiDocument(STARTER_THEME);
  const foundations = toFoundationsDocument(STARTER_THEME, "forma-openui-1.0.json");

  assert.equal(ui.specVersion, "openui-1.0");
  assert.ok(Array.isArray(ui.tokens));
  assert.equal(ui.tokens.length, 58);
  assert.equal(ui.openuiTheme && typeof ui.openuiTheme === "object", true);

  assert.equal(foundations.specVersion, "openui-foundations-draft");
  assert.equal(foundations.pairsWith, "forma-openui-1.0.json");
  assert.ok(foundations.device);
  assert.ok(foundations.typography);
  assert.ok(foundations.motion);
  assert.ok(foundations.provenance);
});

test("edited themes update supported values and preserve unknown imported fields", () => {
  const originalUi = toOpenUiDocument(STARTER_THEME);
  const originalFoundations = toFoundationsDocument(STARTER_THEME, "original-ui.json");
  const sourceUi = { ...originalUi, vendorExtension: { keep: "ui-extension" } };
  const sourceFoundations = { ...originalFoundations, vendorExtension: { keep: "foundation-extension" } };
  const edited: ThemeDraft = {
    ...STARTER_THEME,
    name: "Test system",
    radius: 14,
    density: "compact",
    light: { ...STARTER_THEME.light, accent: "#334455" },
    dark: { ...STARTER_THEME.dark, accent: "#AABBCC" },
    sourceUi,
    sourceFoundations,
  };

  const ui = toOpenUiDocument(edited);
  const foundations = toFoundationsDocument(edited, "test-system-openui-1.0.json");
  const uiTheme = ui.openuiTheme as { light_colors: Record<string, string>; dark_colors: Record<string, string> };

  assert.equal(ui.title, "Test system");
  assert.equal(ui.specVersion, "openui-1.0");
  assert.equal(uiTheme.light_colors.openui_accent, "#334455");
  assert.equal(uiTheme.dark_colors.openui_accent, "#AABBCC");
  assert.deepEqual(ui.vendorExtension, { keep: "ui-extension" });

  assert.equal(foundations.specVersion, "openui-foundations-draft");
  assert.equal(foundations.pairsWith, "test-system-openui-1.0.json");
  assert.deepEqual(foundations.vendorExtension, { keep: "foundation-extension" });
});

test("CSS export includes both theme modes and uses a safe comment", () => {
  const css = toCssFile({ ...STARTER_THEME, name: "Test */ system\nname" });
  assert.match(css, /:root \{/);
  assert.match(css, /\[data-theme="dark"\]/);
  assert.match(css, /--color-accent: #0067C0;/);
  assert.match(css, /--color-accent: #4CC2FF;/);
  assert.match(css, /Test \* \/ system name/);
});
