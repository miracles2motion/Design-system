import assert from "node:assert/strict";
import { test } from "node:test";
import foundationsFixture from "../data/windows_11_pro_foundations.json";
import uiFixture from "../data/windows_11_pro_ui.json";
import {
  DEFAULT_TYPOGRAPHY,
  importFoundationsDocument,
  importOpenUiDocument,
  isThemeSpacing,
  isThemeTypography,
  normalizeThemeDraft,
  spacingForDensity,
  STARTER_THEME,
  themeCssVars,
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
  const uiTheme = ui.openuiTheme as Record<string, unknown>;
  assert.deepEqual(uiTheme.typography && (uiTheme.typography as Record<string, unknown>).body_size_dp, STARTER_THEME.typography.bodySize);
  assert.deepEqual(uiTheme.spacing_dp && (uiTheme.spacing_dp as Record<string, unknown>).page_margin, STARTER_THEME.spacing.pageMargin);

  assert.equal(foundations.specVersion, "openui-foundations-draft");
  assert.equal(foundations.pairsWith, "forma-openui-1.0.json");
  assert.ok(foundations.device);
  assert.ok(foundations.typography);
  assert.ok(foundations.motion);
  assert.ok(foundations.provenance);
});

test("reference OpenUI and foundations imports normalize typography and spacing", () => {
  const ui = importOpenUiDocument(uiFixture as Record<string, unknown>, STARTER_THEME);
  const foundations = importFoundationsDocument(foundationsFixture as Record<string, unknown>, STARTER_THEME);

  assert.deepEqual(ui.typography, { family: "humanist", bodySize: 14, headingSize: 28, lineHeight: 1.4 });
  assert.deepEqual(ui.spacing, { pageMargin: 24, sectionGap: 16, cardPadding: 16, controlHeight: 32, rowHeight: 68 });
  assert.deepEqual(foundations.typography, { family: "humanist", bodySize: 14, headingSize: 28, lineHeight: 1.4 });
  assert.deepEqual(foundations.spacing, { pageMargin: 24, sectionGap: 16, cardPadding: 16, controlHeight: 40, rowHeight: 68 });
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

test("typography and spacing validation is bounded and legacy drafts get defaults", () => {
  assert.equal(isThemeTypography(DEFAULT_TYPOGRAPHY), true);
  assert.equal(isThemeTypography({ ...DEFAULT_TYPOGRAPHY, bodySize: 19 }), false);
  assert.equal(isThemeTypography({ ...DEFAULT_TYPOGRAPHY, lineHeight: 1.45 }), false);
  assert.equal(isThemeSpacing(spacingForDensity("comfortable")), true);
  assert.equal(isThemeSpacing({ ...STARTER_THEME.spacing, pageMargin: 7 }), false);
  assert.equal(isThemeSpacing({ ...STARTER_THEME.spacing, rowHeight: 97 }), false);

  const legacyDraft: Record<string, unknown> = { ...STARTER_THEME };
  delete legacyDraft.typography;
  delete legacyDraft.spacing;
  const migrated = normalizeThemeDraft(legacyDraft);
  assert.ok(migrated);
  assert.deepEqual(migrated.typography, DEFAULT_TYPOGRAPHY);
  assert.deepEqual(migrated.spacing, spacingForDensity("comfortable"));
  assert.equal(normalizeThemeDraft({ ...legacyDraft, typography: { ...DEFAULT_TYPOGRAPHY, headingSize: 99 } }), null);
});

test("typography and spacing round-trip through both supported JSON contracts", () => {
  const sourceUi = JSON.parse(JSON.stringify(toOpenUiDocument(STARTER_THEME))) as Record<string, unknown>;
  sourceUi.vendorExtension = { preserve: "ui-root" };
  const sourceUiTheme = sourceUi.openuiTheme as Record<string, unknown>;
  sourceUiTheme.typography = { ...(sourceUiTheme.typography as Record<string, unknown>), vendorTypeField: "keep-ui-type" };
  sourceUiTheme.spacing_dp = { ...(sourceUiTheme.spacing_dp as Record<string, unknown>), vendorSpacingField: "keep-ui-space" };
  (sourceUi.tokens as Record<string, unknown>[]).push({ key: "vendor/custom", kind: "custom", props: { vendorField: "keep-token" } });

  const sourceFoundations = JSON.parse(JSON.stringify(toFoundationsDocument(STARTER_THEME, "source-ui.json"))) as Record<string, unknown>;
  sourceFoundations.vendorExtension = { preserve: "foundation-root" };
  const sourceTypography = sourceFoundations.typography as Record<string, unknown>;
  sourceTypography.vendorTypeField = "keep-foundation-type";
  const sourceStyles = sourceTypography.styles as Record<string, unknown>[];
  sourceStyles[5].vendorStyleField = "keep-style";
  (sourceFoundations.spacing_dp as Record<string, unknown>).vendorSpacingField = "keep-foundation-space";
  (sourceFoundations.notes as unknown[]).push({ vendorNote: "keep-note" });
  const sourceChart = sourceFoundations.chart_palette as Record<string, unknown>;
  (sourceChart.light as unknown[]).push({ vendorColor: "keep-chart-entry" });

  const edited: ThemeDraft = {
    ...STARTER_THEME,
    name: "Editorial workspace",
    density: "compact",
    typography: { family: "serif", bodySize: 16, headingSize: 32, lineHeight: 1.6 },
    spacing: { pageMargin: 32, sectionGap: 20, cardPadding: 24, controlHeight: 42, rowHeight: 80 },
    sourceUi,
    sourceFoundations,
  };
  const ui = JSON.parse(JSON.stringify(toOpenUiDocument(edited))) as Record<string, unknown>;
  const foundations = JSON.parse(JSON.stringify(toFoundationsDocument(edited, "editorial-openui.json"))) as Record<string, unknown>;
  const uiRoundTrip = importOpenUiDocument(ui, edited);
  const foundationsRoundTrip = importFoundationsDocument(foundations, edited);
  const uiTheme = ui.openuiTheme as Record<string, unknown>;
  const uiMetrics = uiTheme.metrics_dp as Record<string, unknown>;
  const uiTokens = ui.tokens as Record<string, unknown>[];
  const bodyToken = uiTokens.find((token) => token.key === "body")!;
  const bodyProps = bodyToken.props as Record<string, unknown>;
  const foundationTypography = foundations.typography as Record<string, unknown>;
  const foundationSpacing = foundations.spacing_dp as Record<string, unknown>;

  assert.deepEqual(uiRoundTrip.typography, edited.typography);
  assert.deepEqual(uiRoundTrip.spacing, edited.spacing);
  assert.deepEqual(foundationsRoundTrip.typography, edited.typography);
  assert.deepEqual(foundationsRoundTrip.spacing, edited.spacing);
  assert.equal(uiMetrics.screen_pad, 32);
  assert.equal(uiMetrics.button_height, 42);
  assert.equal(bodyProps.text_size, "16");
  assert.equal(bodyProps.font_family, "Georgia, 'Times New Roman', serif");
  assert.equal(foundationSpacing.page_margin, 32);
  assert.equal(foundationSpacing.row_height, 80);
  assert.deepEqual(ui.vendorExtension, { preserve: "ui-root" });
  assert.equal((uiTheme.typography as Record<string, unknown>).vendorTypeField, "keep-ui-type");
  assert.equal((uiTheme.spacing_dp as Record<string, unknown>).vendorSpacingField, "keep-ui-space");
  assert.equal((uiTokens.at(-1)!.props as Record<string, unknown>).vendorField, "keep-token");
  assert.deepEqual(foundations.vendorExtension, { preserve: "foundation-root" });
  assert.equal(foundationTypography.vendorTypeField, "keep-foundation-type");
  assert.equal((foundationTypography.styles as Record<string, unknown>[])[5].vendorStyleField, "keep-style");
  assert.equal(foundationSpacing.vendorSpacingField, "keep-foundation-space");
  assert.ok((foundations.notes as unknown[]).some((note) =>
    note !== null && typeof note === "object" && (note as Record<string, unknown>).vendorNote === "keep-note"));
  assert.ok(((foundations.chart_palette as Record<string, unknown>).light as unknown[]).some((color) =>
    color !== null && typeof color === "object" && (color as Record<string, unknown>).vendorColor === "keep-chart-entry"));
});

test("CSS export includes both theme modes and editable foundation variables", () => {
  const edited = {
    ...STARTER_THEME,
    name: "Test */ system\nname",
    typography: { family: "monospace" as const, bodySize: 16, headingSize: 34, lineHeight: 1.6 },
    spacing: { pageMargin: 32, sectionGap: 20, cardPadding: 24, controlHeight: 42, rowHeight: 80 },
  };
  const css = toCssFile(edited);
  const previewVars = themeCssVars(edited, "light");
  assert.match(css, /:root \{/);
  assert.match(css, /\[data-theme="dark"\]/);
  assert.match(css, /--color-accent: #0067C0;/);
  assert.match(css, /--color-accent: #4CC2FF;/);
  assert.match(css, /--font-family: ui-monospace/);
  assert.match(css, /--font-size-body: 16px;/);
  assert.match(css, /--space-page-margin: 32px;/);
  assert.match(css, /--size-row-height: 80px;/);
  assert.equal(previewVars["--p-font-family"], "ui-monospace, SFMono-Regular, Menlo, monospace");
  assert.equal(previewVars["--p-section-gap"], "20px");
  assert.match(css, /Test \* \/ system name/);
});
