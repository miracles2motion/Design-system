import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyThemeProposal,
  parseThemeProposal,
  SPACING_PRESETS,
  STARTER_THEME,
} from "../lib/theme";

test("assistant proposals validate and apply typography and spacing without changing the draft early", () => {
  const before = structuredClone(STARTER_THEME);
  const patch = parseThemeProposal({
    summary: "Make the workspace more editorial and spacious.",
    typography: { family: "serif", bodySize: 16, headingSize: 34, lineHeight: 1.6 },
    spacing: { pageMargin: 32, sectionGap: 20, cardPadding: 24, controlHeight: 42, rowHeight: 80 },
  });

  assert.equal(patch.summary, "Make the workspace more editorial and spacious.");
  assert.deepEqual(STARTER_THEME, before);
  const approved = applyThemeProposal(STARTER_THEME, patch);
  assert.deepEqual(approved.typography, { family: "serif", bodySize: 16, headingSize: 34, lineHeight: 1.6 });
  assert.deepEqual(approved.spacing, { pageMargin: 32, sectionGap: 20, cardPadding: 24, controlHeight: 42, rowHeight: 80 });
  assert.equal(approved.light.accent, STARTER_THEME.light.accent);
  assert.equal(approved.name, STARTER_THEME.name);
});

test("assistant density proposals derive spacing presets before applying explicit overrides", () => {
  const patch = parseThemeProposal({ density: "compact", spacing: { sectionGap: 8 } });
  const approved = applyThemeProposal(STARTER_THEME, patch);

  assert.deepEqual(approved.spacing, { ...SPACING_PRESETS.compact, sectionGap: 8 });
  assert.equal(approved.density, "compact");
});

test("assistant proposal parser rejects out-of-range and unsupported foundation fields", () => {
  assert.throws(() => parseThemeProposal({ typography: { family: "comic-sans" } }), /font family/i);
  assert.throws(() => parseThemeProposal({ typography: { bodySize: 19 } }), /bodySize/i);
  assert.throws(() => parseThemeProposal({ typography: { lineHeight: 1.45 } }), /lineHeight/i);
  assert.throws(() => parseThemeProposal({ spacing: { pageMargin: 7 } }), /pageMargin/i);
  assert.throws(() => parseThemeProposal({ spacing: { unknownGap: 12 } }), /unsupported spacing field/i);
  assert.throws(() => parseThemeProposal({ paletteMode: "light" }), /unsupported field/i);
  assert.throws(() => parseThemeProposal({ summary: "No token fields" }), /usable design changes/i);
});
