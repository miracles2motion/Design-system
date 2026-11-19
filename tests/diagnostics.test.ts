import assert from "node:assert/strict";
import { test } from "node:test";
import foundationsFixture from "../data/windows_11_pro_foundations.json";
import uiFixture from "../data/windows_11_pro_ui.json";
import {
  validateFoundationsDocument,
  validateOpenUiDocument,
  validateThemeDraft,
  validateThemeExports,
  validateThemePair,
} from "../lib/diagnostics";
import { STARTER_THEME } from "../lib/theme";

const errors = (issues: { severity: string }[]) => issues.filter((issue) => issue.severity === "error");

test("reference contracts validate and unused OpenUI colors are non-blocking warnings", () => {
  const uiIssues = validateOpenUiDocument(uiFixture);
  const foundationIssues = validateFoundationsDocument(foundationsFixture);

  assert.deepEqual(errors(uiIssues), []);
  assert.equal(uiIssues.filter((issue) => issue.code === "color.unused").length, 2);
  assert.deepEqual(foundationIssues, []);
});

test("OpenUI diagnostics report duplicate keys, unresolved colors, bad colors, and bounded-value warnings", () => {
  const invalid = JSON.parse(JSON.stringify(uiFixture)) as Record<string, unknown>;
  const tokens = invalid.tokens as Record<string, unknown>[];
  tokens[0].key = tokens[1].key;
  tokens[0].kind = "future_widget";
  (tokens[0].props as Record<string, unknown>).background = "@color/not_defined";
  const openuiTheme = invalid.openuiTheme as Record<string, unknown>;
  (openuiTheme.light_colors as Record<string, unknown>).openui_accent = "#BAD";
  (openuiTheme.metrics_dp as Record<string, unknown>).screen_pad = 100;
  invalid.updatedAt = 1234;

  const issues = validateOpenUiDocument(invalid);
  const codes = new Set(issues.map((issue) => issue.code));
  assert.ok(codes.has("openui.token.key.duplicate"));
  assert.ok(codes.has("openui.token.kind.unsupported"));
  assert.ok(codes.has("color.reference.unresolved"));
  assert.ok(codes.has("color.invalid"));
  assert.ok(codes.has("value.out_of_range"));
  assert.ok(codes.has("openui.updated_at.invalid"));
});

test("foundations diagnostics warn about invalid ranges while retaining unsupported notes and chart entries", () => {
  const invalid = JSON.parse(JSON.stringify(foundationsFixture)) as Record<string, unknown>;
  (invalid.spacing_dp as Record<string, unknown>).page_margin = 88;
  (invalid.notes as unknown[]).push({ vendorNote: "preserved" });
  ((invalid.chart_palette as Record<string, unknown>).light as unknown[]).push({ vendorColor: "preserved" });

  const issues = validateFoundationsDocument(invalid);
  assert.deepEqual(errors(issues), []);
  assert.ok(issues.some((issue) => issue.path === "spacing_dp.page_margin" && issue.code === "value.out_of_range"));
  assert.ok(issues.some((issue) => issue.code === "foundations.note.unsupported"));
  assert.ok(issues.some((issue) => issue.code === "foundations.chart.color.unsupported"));

  const pairIssues = validateThemePair(uiFixture, { ...foundationsFixture, pairsWith: "different.json" }, "expected.json");
  assert.ok(pairIssues.some((issue) => issue.code === "pair.filename.mismatch"));
});

test("export checks report stale imported pairs while correcting generated filenames", () => {
  const issues = validateThemeExports({
    ...STARTER_THEME,
    sourceUi: uiFixture as Record<string, unknown>,
    sourceFoundations: { ...foundationsFixture, pairsWith: "stale-ui.json" },
    sourceUiFilename: "actual-ui.json",
  });
  const pairIssues = issues.filter((issue) => issue.code === "pair.filename.mismatch");
  assert.equal(pairIssues.length, 1);
  assert.match(pairIssues[0].message, /export will pair it with “actual-ui\.json”/);
});

test("draft and export checks include supported values and contrast guidance", () => {
  assert.deepEqual(errors(validateThemeExports(STARTER_THEME)), []);
  assert.ok(validateThemeExports(STARTER_THEME).some((issue) => issue.code === "color.unused"));

  const invalidDraft = { ...STARTER_THEME, typography: { ...STARTER_THEME.typography, bodySize: 99 } };
  assert.ok(validateThemeDraft(invalidDraft).some((issue) => issue.code === "theme.invalid"));

  const lowContrast = {
    ...STARTER_THEME,
    light: { ...STARTER_THEME.light, text: "#777777", background: "#FFFFFF" },
  };
  assert.ok(validateThemeDraft(lowContrast).some((issue) => issue.code === "contrast.body_text"));

  const importedWithClampedMetric = JSON.parse(JSON.stringify(uiFixture)) as Record<string, unknown>;
  const importedTheme = importedWithClampedMetric.openuiTheme as Record<string, unknown>;
  (importedTheme.metrics_dp as Record<string, unknown>).screen_pad = 100;
  const importedDraft = { ...STARTER_THEME, sourceUi: importedWithClampedMetric };
  assert.ok(validateThemeExports(importedDraft).some((issue) =>
    issue.path === "openuiTheme.metrics_dp.screen_pad" && issue.code === "value.out_of_range"));
});
