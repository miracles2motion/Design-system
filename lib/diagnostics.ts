import {
  contrastRatio,
  isThemePalette,
  isThemeSpacing,
  isThemeTypography,
  normalizeThemeDraft,
  toFoundationsDocument,
  toOpenUiDocument,
  type ThemeDraft,
} from "./theme";

export type DiagnosticSeverity = "error" | "warning";

export interface ThemeDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  path: string;
  message: string;
}

const HEX_COLOR = /^#[\da-f]{6}$/i;
const OPENUI_TOKEN_KINDS = new Set(["screen", "card", "list_row", "button", "input", "text"]);
const OPENUI_SPACING_RANGES: Record<string, [number, number]> = {
  screen_pad: [8, 48],
  page_margin: [8, 48],
  section_gap: [4, 32],
  card_pad: [4, 32],
  card_padding: [4, 32],
  control_height: [24, 48],
  button_height: [24, 48],
  input_height: [24, 48],
  min_touch_target: [24, 48],
  row_height: [40, 96],
};
const FOUNDATIONS_SPACING_RANGES: Record<string, [number, number]> = {
  page_margin: [8, 48],
  section_gap: [4, 32],
  card_padding: [4, 32],
  control_height: [24, 48],
  min_touch_target: [24, 48],
  row_height: [40, 96],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function add(
  issues: ThemeDiagnostic[],
  severity: DiagnosticSeverity,
  code: string,
  path: string,
  message: string,
) {
  issues.push({ severity, code, path, message });
}

function checkRange(
  issues: ThemeDiagnostic[],
  value: unknown,
  path: string,
  min: number,
  max: number,
  integer = true,
  step?: number,
) {
  if (value === undefined || value === null) return;
  const number = numericValue(value);
  const validStep = step === undefined || number === null ||
    Math.abs(number / step - Math.round(number / step)) < 0.0001;
  if (number === null || number < min || number > max || (integer && !Number.isInteger(number)) || !validStep) {
    const shape = integer ? "an integer" : step ? `a number in ${step} increments` : "a number";
    add(issues, "warning", "value.out_of_range", path, `Expected ${shape} from ${min} to ${max}; the preview may use a bounded fallback.`);
  }
}

function collectColorReferences(value: unknown, refs: Set<string>, visited = new WeakSet<object>()) {
  if (typeof value === "string") {
    for (const match of value.matchAll(/@color\/([\w.-]+)/g)) refs.add(match[1]);
    return;
  }
  if (!value || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectColorReferences(item, refs, visited);
  } else {
    for (const item of Object.values(value)) collectColorReferences(item, refs, visited);
  }
}

function validateSpacingRecord(
  issues: ThemeDiagnostic[],
  value: unknown,
  path: string,
  ranges: Record<string, [number, number]>,
) {
  if (!isRecord(value)) return;
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (Object.hasOwn(value, key)) checkRange(issues, value[key], `${path}.${key}`, min, max);
  }
}

function validateOpenUiTypography(issues: ThemeDiagnostic[], value: unknown) {
  if (!isRecord(value)) return;
  for (const key of ["body_size_dp", "bodySize"]) {
    if (Object.hasOwn(value, key)) checkRange(issues, value[key], `openuiTheme.typography.${key}`, 12, 18);
  }
  for (const key of ["heading_size_dp", "headingSize"]) {
    if (Object.hasOwn(value, key)) checkRange(issues, value[key], `openuiTheme.typography.${key}`, 20, 40);
  }
  for (const key of ["line_height", "lineHeight"]) {
    if (Object.hasOwn(value, key)) checkRange(issues, value[key], `openuiTheme.typography.${key}`, 1.2, 1.8, false, 0.1);
  }
  for (const key of ["family", "font_family"]) {
    if (Object.hasOwn(value, key) && (typeof value[key] !== "string" || !value[key].trim())) {
      add(issues, "warning", "typography.family.invalid", `openuiTheme.typography.${key}`, "Font family should be a non-empty string.");
    }
  }
}

export function validateThemeDraft(value: unknown): ThemeDiagnostic[] {
  const issues: ThemeDiagnostic[] = [];
  const theme = normalizeThemeDraft(value);
  if (!theme) {
    add(issues, "error", "theme.invalid", "theme", "The current draft does not satisfy Forma's supported theme contract.");
    return issues;
  }

  if (!isThemePalette(theme.light) || !isThemePalette(theme.dark) ||
    !isThemeTypography(theme.typography) || !isThemeSpacing(theme.spacing)) {
    add(issues, "error", "theme.foundation.invalid", "theme", "Palette, typography, or spacing values are outside the supported ranges.");
    return issues;
  }
  checkRange(issues, theme.radius, "radius", 0, 24);

  for (const mode of ["light", "dark"] as const) {
    const ratio = contrastRatio(theme[mode].text, theme[mode].background);
    if (ratio !== null && ratio < 4.5) {
      add(issues, "warning", "contrast.body_text", `${mode}.text`, `${mode} body text has ${ratio.toFixed(2)}:1 contrast against the canvas; WCAG AA recommends at least 4.5:1.`);
    }
  }
  return issues;
}

export function validateOpenUiDocument(value: unknown): ThemeDiagnostic[] {
  const issues: ThemeDiagnostic[] = [];
  if (!isRecord(value)) {
    add(issues, "error", "openui.document.invalid", "$", "Expected a JSON object for an openui-1.0 document.");
    return issues;
  }
  if (value.specVersion !== "openui-1.0") {
    add(issues, "error", "openui.version.unsupported", "specVersion", "Expected specVersion openui-1.0.");
  }
  if (typeof value.title !== "string" || !value.title.trim()) {
    add(issues, "warning", "openui.title.missing", "title", "A descriptive document title is recommended.");
  }
  if (value.updatedAt === undefined) {
    add(issues, "warning", "openui.updated_at.missing", "updatedAt", "The document has no update timestamp.");
  } else if (typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt) || value.updatedAt < 1_000_000_000_000) {
    add(issues, "warning", "openui.updated_at.invalid", "updatedAt", "updatedAt should be a finite Unix timestamp in milliseconds.");
  }

  const openuiTheme = value.openuiTheme;
  if (!isRecord(openuiTheme)) {
    add(issues, "error", "openui.theme.missing", "openuiTheme", "The required openuiTheme object is missing.");
    return issues;
  }

  const palettes: Partial<Record<"light" | "dark", Record<string, unknown>>> = {};
  for (const mode of ["light", "dark"] as const) {
    const path = `openuiTheme.${mode}_colors`;
    const palette = openuiTheme[`${mode}_colors`];
    if (!isRecord(palette)) {
      add(issues, "error", "openui.palette.missing", path, `The ${mode} color map is required.`);
      continue;
    }
    palettes[mode] = palette;
    for (const [key, color] of Object.entries(palette)) {
      if (typeof color !== "string" || !HEX_COLOR.test(color)) {
        add(issues, "error", "color.invalid", `${path}.${key}`, "Color values must be six-digit hexadecimal strings.");
      }
    }
  }

  const typography = openuiTheme.typography;
  validateOpenUiTypography(issues, typography);
  validateSpacingRecord(issues, openuiTheme.spacing_dp, "openuiTheme.spacing_dp", OPENUI_SPACING_RANGES);
  validateSpacingRecord(issues, openuiTheme.metrics_dp, "openuiTheme.metrics_dp", OPENUI_SPACING_RANGES);
  if (isRecord(openuiTheme.radii_dp)) {
    for (const [key, radius] of Object.entries(openuiTheme.radii_dp)) {
      if (key !== "note") checkRange(issues, radius, `openuiTheme.radii_dp.${key}`, 0, 24);
    }
  }
  if (openuiTheme.density !== undefined && openuiTheme.density !== "comfortable" && openuiTheme.density !== "compact") {
    add(issues, "warning", "density.unsupported", "openuiTheme.density", "Density should be comfortable or compact.");
  }

  const tokens = value.tokens;
  if (!Array.isArray(tokens)) {
    add(issues, "error", "openui.tokens.invalid", "tokens", "The tokens property must be an array.");
    return issues;
  }
  if (!tokens.length) add(issues, "warning", "openui.tokens.empty", "tokens", "The document contains no component tokens.");

  const keys = new Set<string>();
  const colorRefs = new Set<string>();
  tokens.forEach((token, index) => {
    const path = `tokens[${index}]`;
    if (!isRecord(token)) {
      add(issues, "error", "openui.token.invalid", path, "Each token must be an object.");
      return;
    }
    if (typeof token.key !== "string" || !token.key.trim()) {
      add(issues, "error", "openui.token.key.missing", `${path}.key`, "Each token needs a non-empty key.");
    } else if (keys.has(token.key)) {
      add(issues, "error", "openui.token.key.duplicate", `${path}.key`, `Token key “${token.key}” is duplicated.`);
    } else {
      keys.add(token.key);
    }
    if (typeof token.kind !== "string" || !token.kind.trim()) {
      add(issues, "error", "openui.token.kind.missing", `${path}.kind`, "Each token needs a component kind.");
    } else if (!OPENUI_TOKEN_KINDS.has(token.kind)) {
      add(issues, "warning", "openui.token.kind.unsupported", `${path}.kind`, `Kind “${token.kind}” is preserved but is not rendered by Forma's preview.`);
    }
    if (!isRecord(token.props)) {
      add(issues, "error", "openui.token.props.invalid", `${path}.props`, "Each token needs a props object.");
    } else {
      collectColorReferences(token.props, colorRefs);
    }
  });

  for (const reference of colorRefs) {
    const missingModes = (["light", "dark"] as const).filter((mode) => !palettes[mode] || !Object.hasOwn(palettes[mode]!, reference));
    if (missingModes.length) {
      add(issues, "error", "color.reference.unresolved", `tokens/@color/${reference}`, `Color reference is missing from the ${missingModes.join(" and ")} palette${missingModes.length === 1 ? "" : "s"}.`);
    }
  }
  const paletteColorNames = new Set([
    ...Object.keys(palettes.light ?? {}),
    ...Object.keys(palettes.dark ?? {}),
  ]);
  for (const key of paletteColorNames) {
    if (!colorRefs.has(key)) {
      add(issues, "warning", "color.unused", `openuiTheme.colors.${key}`, `Color “${key}” is not referenced by a component token in either mode.`);
    }
  }
  return issues;
}

export function validateFoundationsDocument(value: unknown): ThemeDiagnostic[] {
  const issues: ThemeDiagnostic[] = [];
  if (!isRecord(value)) {
    add(issues, "error", "foundations.document.invalid", "$", "Expected a JSON object for an openui-foundations-draft document.");
    return issues;
  }
  if (value.specVersion !== "openui-foundations-draft") {
    add(issues, "error", "foundations.version.unsupported", "specVersion", "Expected specVersion openui-foundations-draft.");
  }
  if (typeof value.title !== "string" || !value.title.trim()) {
    add(issues, "warning", "foundations.title.missing", "title", "A descriptive document title is recommended.");
  }
  if (typeof value.pairsWith !== "string" || !value.pairsWith.trim()) {
    add(issues, "warning", "foundations.pair.missing", "pairsWith", "The paired OpenUI filename is missing.");
  }

  const accent = value.accent_palette_default_blue;
  if (!isRecord(accent)) {
    add(issues, "error", "foundations.accent.missing", "accent_palette_default_blue", "The default accent palette is required.");
  } else {
    for (const key of ["light3", "light2", "light1", "base", "dark1", "dark2", "dark3"]) {
      if (accent[key] === undefined) {
        if (key === "base" || key === "dark1" || key === "light2") {
          add(issues, "error", "foundations.accent.value.missing", `accent_palette_default_blue.${key}`, `Accent value “${key}” is required.`);
        }
      } else if (typeof accent[key] !== "string" || !HEX_COLOR.test(accent[key] as string)) {
        add(issues, "error", "color.invalid", `accent_palette_default_blue.${key}`, "Color values must be six-digit hexadecimal strings.");
      }
    }
  }

  const typography = value.typography;
  if (!isRecord(typography)) {
    add(issues, "error", "foundations.typography.missing", "typography", "The typography foundation object is required.");
  } else if (!Array.isArray(typography.styles)) {
    add(issues, "error", "foundations.typography.styles.invalid", "typography.styles", "Typography styles must be an array.");
  } else {
    const names = new Set<string>();
    typography.styles.forEach((style, index) => {
      const path = `typography.styles[${index}]`;
      if (!isRecord(style)) {
        add(issues, "error", "foundations.typography.style.invalid", path, "Each typography style must be an object.");
        return;
      }
      if (typeof style.name !== "string" || !style.name.trim()) {
        add(issues, "error", "foundations.typography.style.name", `${path}.name`, "Each typography style needs a non-empty name.");
      } else if (names.has(style.name)) {
        add(issues, "error", "foundations.typography.style.duplicate", `${path}.name`, `Style name “${style.name}” is duplicated.`);
      } else {
        names.add(style.name);
      }
      checkRange(issues, style.size, `${path}.size`, 8, 96);
      checkRange(issues, style.line, `${path}.line`, 8, 120);
    });
  }
  if (typography && isRecord(typography) && typography.family !== undefined && typeof typography.family !== "string") {
    add(issues, "warning", "foundations.typography.family.invalid", "typography.family", "Font family should be a string.");
  }

  const spacing = value.spacing_dp;
  if (!isRecord(spacing)) {
    add(issues, "error", "foundations.spacing.missing", "spacing_dp", "The spacing foundation object is required.");
  } else {
    validateSpacingRecord(issues, spacing, "spacing_dp", FOUNDATIONS_SPACING_RANGES);
    if (spacing.scale !== undefined) {
      if (!Array.isArray(spacing.scale)) {
        add(issues, "warning", "foundations.spacing.scale.invalid", "spacing_dp.scale", "Spacing scale should be an array of numeric values.");
      } else {
        const values = spacing.scale.map(numericValue);
        if (values.some((entry) => entry === null || entry < 0)) {
          add(issues, "warning", "foundations.spacing.scale.value", "spacing_dp.scale", "Spacing scale values should be non-negative numbers.");
        }
        const validValues = values.filter((entry): entry is number => entry !== null);
        if (validValues.some((entry, index) => index > 0 && entry < validValues[index - 1])) {
          add(issues, "warning", "foundations.spacing.scale.order", "spacing_dp.scale", "Spacing scale values should be in ascending order.");
        }
      }
    }
  }

  const radii = value.radii_dp;
  if (radii !== undefined && isRecord(radii)) {
    for (const key of ["control", "overlay"]) {
      if (Object.hasOwn(radii, key)) checkRange(issues, radii[key], `radii_dp.${key}`, 0, 24);
    }
  }

  const materials = value.materials;
  if (isRecord(materials)) {
    for (const materialName of ["mica", "acrylic"]) {
      const material = materials[materialName];
      if (!isRecord(material)) continue;
      for (const mode of ["light", "dark"] as const) {
        const color = material[mode];
        if (color !== undefined && (typeof color !== "string" || !HEX_COLOR.test(color))) {
          add(issues, "warning", "color.invalid", `materials.${materialName}.${mode}`, "Material colors should be six-digit hexadecimal strings.");
        }
      }
    }
  }

  const chart = value.chart_palette;
  if (chart !== undefined && !isRecord(chart)) {
    add(issues, "warning", "foundations.chart.invalid", "chart_palette", "Chart palette should be an object.");
  } else if (isRecord(chart)) {
    for (const mode of ["light", "dark"] as const) {
      const colors = chart[mode];
      if (colors === undefined) continue;
      if (!Array.isArray(colors)) {
        add(issues, "warning", "foundations.chart.colors.invalid", `chart_palette.${mode}`, "Chart colors should be an array.");
        continue;
      }
      colors.forEach((color, index) => {
        if (typeof color !== "string" || !HEX_COLOR.test(color)) {
          add(issues, "warning", "foundations.chart.color.unsupported", `chart_palette.${mode}[${index}]`, "This chart entry is retained but is not a six-digit hexadecimal color.");
        }
      });
    }
  }

  if (Array.isArray(value.notes)) {
    value.notes.forEach((note, index) => {
      if (typeof note !== "string") {
        add(issues, "warning", "foundations.note.unsupported", `notes[${index}]`, "This note is retained but is not plain text.");
      }
    });
  }
  return issues;
}

export function validateThemePair(
  uiDocument: unknown,
  foundationsDocument: unknown,
  uiFilename: string,
): ThemeDiagnostic[] {
  const issues: ThemeDiagnostic[] = [];
  if (!isRecord(uiDocument) || !isRecord(foundationsDocument)) return issues;
  if (typeof foundationsDocument.pairsWith === "string" && foundationsDocument.pairsWith.trim() &&
    foundationsDocument.pairsWith !== uiFilename) {
    add(issues, "warning", "pair.filename.mismatch", "pairsWith", `Foundations points to “${foundationsDocument.pairsWith}”; export will pair it with “${uiFilename}”.`);
  }
  return issues;
}

export function validateThemeExports(themeValue: unknown): ThemeDiagnostic[] {
  const draftIssues = validateThemeDraft(themeValue);
  const theme = normalizeThemeDraft(themeValue);
  if (!theme) return draftIssues;

  const safeName = theme.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "design-system";
  const uiFilename = `${safeName}-openui-1.0.json`;
  const uiDocument = toOpenUiDocument(theme);
  const foundationsDocument = toFoundationsDocument(theme, uiFilename);
  const sourceIssues = [
    ...(theme.sourceUi ? validateOpenUiDocument(theme.sourceUi) : []),
    ...(theme.sourceFoundations ? validateFoundationsDocument(theme.sourceFoundations) : []),
    ...(theme.sourceUi && theme.sourceFoundations && typeof theme.sourceUiFilename === "string"
      ? validateThemePair(theme.sourceUi, theme.sourceFoundations, theme.sourceUiFilename)
      : []),
  ];
  const generatedIssues = [
    ...validateOpenUiDocument(uiDocument),
    ...validateFoundationsDocument(foundationsDocument),
    ...validateThemePair(uiDocument, foundationsDocument, uiFilename),
  ];
  const seen = new Set<string>();
  return [...draftIssues, ...sourceIssues, ...generatedIssues].filter((issue) => {
    const key = `${issue.severity}|${issue.code}|${issue.path}|${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
