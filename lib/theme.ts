import type { CSSProperties } from "react";
import windowsFoundations from "@/data/windows_11_pro_foundations.json";
import windowsUi from "@/data/windows_11_pro_ui.json";

export type ThemeMode = "light" | "dark";
export type Density = "comfortable" | "compact";
export type ThemeFontFamily = "humanist" | "system" | "serif" | "monospace";

export interface ThemeTypography {
  family: ThemeFontFamily;
  bodySize: number;
  headingSize: number;
  lineHeight: number;
}

export interface ThemeSpacing {
  pageMargin: number;
  sectionGap: number;
  cardPadding: number;
  controlHeight: number;
  rowHeight: number;
}

export const FONT_FAMILY_LABELS: Record<ThemeFontFamily, string> = {
  humanist: "Humanist sans",
  system: "System sans",
  serif: "Editorial serif",
  monospace: "Monospace",
};

export const FONT_FAMILY_STACKS: Record<ThemeFontFamily, string> = {
  humanist: "'Segoe UI', 'Trebuchet MS', system-ui, sans-serif",
  system: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  monospace: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

export const DEFAULT_TYPOGRAPHY: ThemeTypography = {
  family: "humanist",
  bodySize: 14,
  headingSize: 28,
  lineHeight: 1.4,
};

export const SPACING_PRESETS: Record<Density, ThemeSpacing> = {
  comfortable: { pageMargin: 24, sectionGap: 16, cardPadding: 16, controlHeight: 36, rowHeight: 68 },
  compact: { pageMargin: 16, sectionGap: 12, cardPadding: 12, controlHeight: 32, rowHeight: 56 },
};
export const DEFAULT_SPACING: ThemeSpacing = SPACING_PRESETS.comfortable;

export function spacingForDensity(density: Density): ThemeSpacing {
  return { ...SPACING_PRESETS[density] };
}

export function isThemeTypography(value: unknown): value is ThemeTypography {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const typography = value as Partial<ThemeTypography>;
  return (typography.family === "humanist" || typography.family === "system" || typography.family === "serif" || typography.family === "monospace") &&
    typeof typography.bodySize === "number" && Number.isInteger(typography.bodySize) && typography.bodySize >= 12 && typography.bodySize <= 18 &&
    typeof typography.headingSize === "number" && Number.isInteger(typography.headingSize) && typography.headingSize >= 20 && typography.headingSize <= 40 &&
    typeof typography.lineHeight === "number" && Number.isFinite(typography.lineHeight) && typography.lineHeight >= 1.2 && typography.lineHeight <= 1.8 &&
    Math.abs(typography.lineHeight * 10 - Math.round(typography.lineHeight * 10)) < 0.0001;
}

export function isThemeSpacing(value: unknown): value is ThemeSpacing {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const spacing = value as Partial<ThemeSpacing>;
  return typeof spacing.pageMargin === "number" && Number.isInteger(spacing.pageMargin) && spacing.pageMargin >= 8 && spacing.pageMargin <= 48 &&
    typeof spacing.sectionGap === "number" && Number.isInteger(spacing.sectionGap) && spacing.sectionGap >= 4 && spacing.sectionGap <= 32 &&
    typeof spacing.cardPadding === "number" && Number.isInteger(spacing.cardPadding) && spacing.cardPadding >= 4 && spacing.cardPadding <= 32 &&
    typeof spacing.controlHeight === "number" && Number.isInteger(spacing.controlHeight) && spacing.controlHeight >= 24 && spacing.controlHeight <= 48 &&
    typeof spacing.rowHeight === "number" && Number.isInteger(spacing.rowHeight) && spacing.rowHeight >= 40 && spacing.rowHeight <= 96;
}

export function fontFamilyFromName(value: unknown): ThemeFontFamily {
  if (typeof value !== "string") return "humanist";
  const family = value.toLowerCase();
  if (/mono|consolas|courier|code/.test(family)) return "monospace";
  if (/serif|georgia|times/.test(family) && !/sans[- ]?serif/.test(family)) return "serif";
  if (family === "system" || /system[- ]?ui|system font/.test(family)) return "system";
  return "humanist";
}

export interface ThemePalette {
  background: string;
  surface: string;
  elevated: string;
  highlight: string;
  accent: string;
  accentPressed: string;
  accentSubtle: string;
  secondary: string;
  text: string;
  muted: string;
  faint: string;
  border: string;
  interactiveBorder: string;
  onAccent: string;
}

const PALETTE_KEYS: (keyof ThemePalette)[] = [
  "background", "surface", "elevated", "highlight", "accent", "accentPressed", "accentSubtle", "secondary",
  "text", "muted", "faint", "border", "interactiveBorder", "onAccent",
];

export function isThemePalette(value: unknown): value is ThemePalette {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return PALETTE_KEYS.every((key) => typeof (value as Record<string, unknown>)[key] === "string" &&
    /^#[\da-f]{6}$/i.test((value as Record<string, string>)[key]));
}

export interface ThemeDraft {
  id: string;
  name: string;
  description: string;
  author: string;
  tags: string[];
  light: ThemePalette;
  dark: ThemePalette;
  radius: number;
  density: Density;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  updatedAt: number;
  /** Preserve imported format data so edits do not discard unknown contract fields. */
  sourceUi?: Record<string, unknown>;
  sourceFoundations?: Record<string, unknown>;
}

export const STARTER_THEME: ThemeDraft = {
  id: "windows-11-pro",
  name: "Windows 11 Pro",
  description: "A calm, layered desktop system inspired by Fluent foundations.",
  author: "Forma starter",
  tags: ["Fluent", "Desktop", "Light + dark"],
  light: {
    background: "#F3F3F3",
    surface: "#FBFBFB",
    elevated: "#FFFFFF",
    highlight: "#F2F2F2",
    accent: "#0067C0",
    accentPressed: "#3385CD",
    accentSubtle: "#E6F0F9",
    secondary: "#8764B8",
    text: "#1B1B1B",
    muted: "#616161",
    faint: "#8D8D8D",
    border: "#E5E5E5",
    interactiveBorder: "#8D8D8D",
    onAccent: "#FFFFFF",
  },
  dark: {
    background: "#202020",
    surface: "#2B2B2B",
    elevated: "#2C2C2C",
    highlight: "#383838",
    accent: "#4CC2FF",
    accentPressed: "#45A4D5",
    accentSubtle: "#30424B",
    secondary: "#B4A0FF",
    text: "#FFFFFF",
    muted: "#C5C5C5",
    faint: "#878787",
    border: "#383838",
    interactiveBorder: "#9F9F9F",
    onAccent: "#000000",
  },
  radius: 8,
  density: "comfortable",
  typography: { ...DEFAULT_TYPOGRAPHY },
  spacing: spacingForDensity("comfortable"),
  updatedAt: 0,
};

export function normalizeThemeDraft(value: unknown): ThemeDraft | null {
  if (!isRecord(value)) return null;
  const density = value.density;
  if (typeof value.id !== "string" || typeof value.name !== "string" || typeof value.description !== "string" ||
    typeof value.author !== "string" || !Array.isArray(value.tags) || !value.tags.every((tag) => typeof tag === "string") ||
    !isThemePalette(value.light) || !isThemePalette(value.dark) ||
    typeof value.radius !== "number" || !Number.isFinite(value.radius) || value.radius < 0 || value.radius > 24 ||
    (density !== "comfortable" && density !== "compact") ||
    (value.typography !== undefined && !isThemeTypography(value.typography)) ||
    (value.spacing !== undefined && !isThemeSpacing(value.spacing)) ||
    (value.sourceUi !== undefined && !isRecord(value.sourceUi)) ||
    (value.sourceFoundations !== undefined && !isRecord(value.sourceFoundations))) {
    return null;
  }

  return {
    ...value,
    tags: [...value.tags],
    typography: value.typography === undefined ? { ...DEFAULT_TYPOGRAPHY } : { ...value.typography },
    spacing: value.spacing === undefined ? spacingForDensity(density) : { ...value.spacing },
    updatedAt: typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt) ? value.updatedAt : 0,
  } as ThemeDraft;
}

export type ThemeCssVars = CSSProperties & Record<`--${string}`, string>;

export function themeCssVars(theme: ThemeDraft, mode: ThemeMode): ThemeCssVars {
  const palette = theme[mode];
  const typography = isThemeTypography(theme.typography) ? theme.typography : DEFAULT_TYPOGRAPHY;
  const spacing = isThemeSpacing(theme.spacing) ? theme.spacing : spacingForDensity(theme.density);
  return {
    "--p-bg": palette.background,
    "--p-surface": palette.surface,
    "--p-raised": palette.elevated,
    "--p-highlight": palette.highlight,
    "--p-accent": palette.accent,
    "--p-accent-pressed": palette.accentPressed,
    "--p-accent-subtle": palette.accentSubtle,
    "--p-secondary": palette.secondary,
    "--p-text": palette.text,
    "--p-muted": palette.muted,
    "--p-faint": palette.faint,
    "--p-border": palette.border,
    "--p-border-interactive": palette.interactiveBorder,
    "--p-on-accent": palette.onAccent,
    "--p-radius": `${theme.radius}px`,
    "--p-radius-control": `${Math.max(4, theme.radius - 4)}px`,
    "--p-font-family": FONT_FAMILY_STACKS[typography.family],
    "--p-body-size": `${typography.bodySize}px`,
    "--p-heading-size": `${typography.headingSize}px`,
    "--p-line-height": String(typography.lineHeight),
    "--p-page-margin": `${spacing.pageMargin}px`,
    "--p-section-gap": `${spacing.sectionGap}px`,
    "--p-card-padding": `${spacing.cardPadding}px`,
    "--p-row-height": `${spacing.rowHeight}px`,
    "--p-control-height": `${spacing.controlHeight}px`,
    "--p-space": `${spacing.sectionGap}px`,
    "--p-card-pad": `${spacing.cardPadding}px`,
    "--p-content-pad": `${Math.round(spacing.pageMargin / 2)}px`,
    "--p-metric-pad": `${Math.round(spacing.cardPadding / 2)}px`,
    "--p-gap": `${Math.max(4, Math.round(spacing.sectionGap * 0.4375))}px`,
  };
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "");
  if (!/^[\da-f]{6}$/i.test(clean)) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function linearize(value: number) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(foreground: string, background: string): number | null {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) return null;
  const luminance = (rgb: [number, number, number]) =>
    0.2126 * linearize(rgb[0]) + 0.7152 * linearize(rgb[1]) + 0.0722 * linearize(rgb[2]);
  const a = luminance(fg);
  const b = luminance(bg);
  return Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2));
}

function mixHex(color: string, target: string, amount: number): string {
  const a = hexToRgb(color);
  const b = hexToRgb(target);
  if (!a || !b) return color;
  const channel = (index: number) => Math.round(a[index] * (1 - amount) + b[index] * amount);
  return `#${[0, 1, 2].map((i) => channel(i).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export interface ThemeProposalPatch {
  summary?: string;
  name?: string;
  description?: string;
  radius?: number;
  density?: Density;
  light?: Partial<ThemePalette>;
  dark?: Partial<ThemePalette>;
  typography?: Partial<ThemeTypography>;
  spacing?: Partial<ThemeSpacing>;
}

const FONT_FAMILIES = ["humanist", "system", "serif", "monospace"] as const;
const SPACING_KEYS: (keyof ThemeSpacing)[] = ["pageMargin", "sectionGap", "cardPadding", "controlHeight", "rowHeight"];
const PROPOSAL_KEYS = new Set(["summary", "name", "description", "radius", "density", "light", "dark", "typography", "spacing"]);

export function parseThemeProposal(value: unknown): ThemeProposalPatch {
  if (!isRecord(value)) throw new Error("The model returned an invalid response.");
  for (const key of Object.keys(value)) {
    if (!PROPOSAL_KEYS.has(key)) throw new Error(`The model proposed an unsupported field: ${key}.`);
  }

  const patch: ThemeProposalPatch = {};
  if (value.summary !== undefined) {
    if (typeof value.summary !== "string") throw new Error("The model returned an invalid proposal summary.");
    patch.summary = value.summary.slice(0, 500);
  }
  if (value.name !== undefined) {
    if (typeof value.name !== "string") throw new Error("The model returned an invalid theme name.");
    patch.name = value.name.slice(0, 64);
  }
  if (value.description !== undefined) {
    if (typeof value.description !== "string") throw new Error("The model returned an invalid theme description.");
    patch.description = value.description.slice(0, 160);
  }
  if (value.radius !== undefined) {
    if (typeof value.radius !== "number" || !Number.isFinite(value.radius) || value.radius < 0 || value.radius > 24) {
      throw new Error("The model proposed an unsupported corner radius.");
    }
    patch.radius = Math.round(value.radius);
  }
  if (value.density !== undefined) {
    if (value.density !== "comfortable" && value.density !== "compact") throw new Error("The model proposed an unsupported density.");
    patch.density = value.density;
  }

  for (const mode of ["light", "dark"] as const) {
    const rawPalette = value[mode];
    if (rawPalette === undefined) continue;
    if (!isRecord(rawPalette)) throw new Error("The model returned an invalid color palette.");
    const palette: Partial<ThemePalette> = {};
    for (const [key, color] of Object.entries(rawPalette)) {
      if (!PALETTE_KEYS.includes(key as keyof ThemePalette)) throw new Error(`The model proposed an unsupported ${mode} palette field: ${key}.`);
      if (typeof color !== "string" || !/^#[\da-f]{6}$/i.test(color)) throw new Error(`The model returned an invalid ${mode} color for ${key}.`);
      palette[key as keyof ThemePalette] = color.toUpperCase();
    }
    if (Object.keys(palette).length > 0) patch[mode] = palette;
  }

  if (value.typography !== undefined) {
    if (!isRecord(value.typography)) throw new Error("The model returned invalid typography values.");
    const typography: Partial<ThemeTypography> = {};
    for (const [key, raw] of Object.entries(value.typography)) {
      if (key === "family") {
        if (typeof raw !== "string" || !FONT_FAMILIES.includes(raw as ThemeFontFamily)) throw new Error("The model proposed an unsupported font family.");
        typography.family = raw as ThemeFontFamily;
      } else if (key === "bodySize" || key === "headingSize") {
        const min = key === "bodySize" ? 12 : 20;
        const max = key === "bodySize" ? 18 : 40;
        if (typeof raw !== "number" || !Number.isInteger(raw) || raw < min || raw > max) throw new Error(`The model proposed an unsupported typography value for ${key}.`);
        typography[key] = raw;
      } else if (key === "lineHeight") {
        if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 1.2 || raw > 1.8 || Math.abs(raw * 10 - Math.round(raw * 10)) >= 0.0001) {
          throw new Error("The model proposed an unsupported typography value for lineHeight.");
        }
        typography.lineHeight = raw;
      } else {
        throw new Error(`The model proposed an unsupported typography field: ${key}.`);
      }
    }
    if (Object.keys(typography).length > 0) patch.typography = typography;
  }

  if (value.spacing !== undefined) {
    if (!isRecord(value.spacing)) throw new Error("The model returned invalid spacing values.");
    const spacing: Partial<ThemeSpacing> = {};
    const bounds: Record<keyof ThemeSpacing, [number, number]> = {
      pageMargin: [8, 48],
      sectionGap: [4, 32],
      cardPadding: [4, 32],
      controlHeight: [24, 48],
      rowHeight: [40, 96],
    };
    for (const [key, raw] of Object.entries(value.spacing)) {
      if (!SPACING_KEYS.includes(key as keyof ThemeSpacing)) throw new Error(`The model proposed an unsupported spacing field: ${key}.`);
      const [min, max] = bounds[key as keyof ThemeSpacing];
      if (typeof raw !== "number" || !Number.isInteger(raw) || raw < min || raw > max) throw new Error(`The model proposed an unsupported spacing value for ${key}.`);
      spacing[key as keyof ThemeSpacing] = raw;
    }
    if (Object.keys(spacing).length > 0) patch.spacing = spacing;
  }

  if (!Object.keys(patch).some((key) => key !== "summary")) throw new Error("The model did not return any usable design changes.");
  return patch;
}

export function applyThemeProposal(theme: ThemeDraft, patch: ThemeProposalPatch): ThemeDraft {
  const densityChanged = patch.density !== undefined && patch.density !== theme.density;
  const baseSpacing = densityChanged && patch.density ? spacingForDensity(patch.density) : theme.spacing;
  return {
    ...theme,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.radius !== undefined ? { radius: patch.radius } : {}),
    ...(patch.density !== undefined ? { density: patch.density } : {}),
    light: { ...theme.light, ...patch.light },
    dark: { ...theme.dark, ...patch.dark },
    typography: { ...theme.typography, ...patch.typography },
    spacing: { ...baseSpacing, ...patch.spacing },
  };
}

function numberFromSource(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const number = numberFromSource(value);
  return number === null ? fallback : Math.max(min, Math.min(max, Math.round(number)));
}

function lineHeightRatio(value: unknown, bodySize: number, fallback: number): number {
  const number = numberFromSource(value);
  if (number === null) return fallback;
  const ratio = number > 2 ? number / Math.max(1, bodySize) : number;
  return Math.round(Math.max(1.2, Math.min(1.8, ratio)) * 10) / 10;
}

function tokenMap(document: Record<string, unknown>): Map<string, Record<string, unknown>> {
  const tokens = Array.isArray(document.tokens) ? document.tokens : [];
  return new Map(tokens.filter(isRecord).map((token) => [String(token.key ?? ""), token]));
}

function tokenProps(tokens: Map<string, Record<string, unknown>>, key: string): Record<string, unknown> {
  const token = tokens.get(key);
  return token && isRecord(token.props) ? token.props : {};
}

export function importOpenUiDocument(document: Record<string, unknown>, base: ThemeDraft = STARTER_THEME): Pick<ThemeDraft, "name" | "description" | "light" | "dark" | "radius" | "density" | "typography" | "spacing"> {
  const openuiTheme = isRecord(document.openuiTheme) ? document.openuiTheme : {};
  const lightSource = isRecord(openuiTheme.light_colors) ? openuiTheme.light_colors : {};
  const darkSource = isRecord(openuiTheme.dark_colors) ? openuiTheme.dark_colors : {};
  const colorsFor = (current: ThemePalette, source: Record<string, unknown>): ThemePalette => ({
    ...current,
    background: typeof source.openui_bg === "string" && /^#[\da-f]{6}$/i.test(source.openui_bg) ? source.openui_bg : current.background,
    surface: typeof source.openui_fg === "string" && /^#[\da-f]{6}$/i.test(source.openui_fg) ? source.openui_fg : current.surface,
    elevated: typeof source.openui_elevated === "string" && /^#[\da-f]{6}$/i.test(source.openui_elevated) ? source.openui_elevated : current.elevated,
    highlight: typeof source.openui_highlight === "string" && /^#[\da-f]{6}$/i.test(source.openui_highlight) ? source.openui_highlight : current.highlight,
    accent: typeof source.openui_accent === "string" && /^#[\da-f]{6}$/i.test(source.openui_accent) ? source.openui_accent : current.accent,
    accentPressed: typeof source.openui_accent_pressed === "string" && /^#[\da-f]{6}$/i.test(source.openui_accent_pressed) ? source.openui_accent_pressed : current.accentPressed,
    accentSubtle: typeof source.openui_accent_subtle === "string" && /^#[\da-f]{6}$/i.test(source.openui_accent_subtle) ? source.openui_accent_subtle : current.accentSubtle,
    secondary: typeof source.openui_secondary === "string" && /^#[\da-f]{6}$/i.test(source.openui_secondary) ? source.openui_secondary : current.secondary,
    text: typeof source.openui_text_primary === "string" && /^#[\da-f]{6}$/i.test(source.openui_text_primary) ? source.openui_text_primary : current.text,
    muted: typeof source.openui_text_secondary === "string" && /^#[\da-f]{6}$/i.test(source.openui_text_secondary) ? source.openui_text_secondary : current.muted,
    faint: typeof source.openui_text_tertiary === "string" && /^#[\da-f]{6}$/i.test(source.openui_text_tertiary) ? source.openui_text_tertiary : current.faint,
    border: typeof source.openui_border_default === "string" && /^#[\da-f]{6}$/i.test(source.openui_border_default) ? source.openui_border_default : current.border,
    interactiveBorder: typeof source.openui_border_interactive === "string" && /^#[\da-f]{6}$/i.test(source.openui_border_interactive) ? source.openui_border_interactive : current.interactiveBorder,
    onAccent: typeof source.openui_text_on_accent === "string" && /^#[\da-f]{6}$/i.test(source.openui_text_on_accent) ? source.openui_text_on_accent : current.onAccent,
  });
  const tokens = tokenMap(document);
  const bodyProps = tokenProps(tokens, "body");
  const titleProps = tokenProps(tokens, "title");
  const screenProps = tokenProps(tokens, "screen");
  const cardProps = tokenProps(tokens, "card");
  const buttonProps = tokenProps(tokens, "primary_button");
  const inputProps = tokenProps(tokens, "input");
  const radii = isRecord(openuiTheme.radii_dp) ? openuiTheme.radii_dp : {};
  const metrics = isRecord(openuiTheme.metrics_dp) ? openuiTheme.metrics_dp : {};
  const spacingSource = isRecord(openuiTheme.spacing_dp) ? openuiTheme.spacing_dp : {};
  const rawDensity = openuiTheme.density;
  const density: Density = rawDensity === "compact" || rawDensity === "comfortable" ? rawDensity : base.density;
  const typographySource = isRecord(openuiTheme.typography) ? openuiTheme.typography : {};
  const bodySize = boundedInteger(typographySource.body_size_dp ?? typographySource.bodySize ?? bodyProps.text_size, base.typography.bodySize, 12, 18);
  const headingSize = boundedInteger(typographySource.heading_size_dp ?? typographySource.headingSize ?? titleProps.text_size, base.typography.headingSize, 20, 40);
  const lineHeight = lineHeightRatio(typographySource.line_height ?? typographySource.lineHeight ?? bodyProps.line_height, bodySize, base.typography.lineHeight);
  const fontName = typographySource.family ?? typographySource.font_family ?? openuiTheme.font_family ?? bodyProps.font_family;
  const metricsSpacing: ThemeSpacing = {
    pageMargin: boundedInteger(metrics.screen_pad ?? metrics.page_margin ?? spacingSource.page_margin ?? screenProps.padding, base.spacing.pageMargin, 8, 48),
    sectionGap: boundedInteger(metrics.section_gap ?? spacingSource.section_gap ?? screenProps.gap, base.spacing.sectionGap, 4, 32),
    cardPadding: boundedInteger(metrics.card_pad ?? spacingSource.card_padding ?? cardProps.padding, base.spacing.cardPadding, 4, 32),
    controlHeight: boundedInteger(metrics.control_height ?? metrics.button_height ?? metrics.input_height ?? spacingSource.control_height ?? buttonProps.height ?? inputProps.height, base.spacing.controlHeight, 24, 48),
    rowHeight: boundedInteger(metrics.row_height ?? spacingSource.row_height, base.spacing.rowHeight, 40, 96),
  };
  const fontFamily = fontName === undefined ? base.typography.family : fontFamilyFromName(fontName);

  return {
    name: typeof openuiTheme.title === "string" ? openuiTheme.title : typeof document.title === "string" ? document.title : base.name,
    description: "Imported from an openui-1.0 file.",
    light: colorsFor(base.light, lightSource),
    dark: colorsFor(base.dark, darkSource),
    radius: boundedInteger(radii.card, base.radius, 0, 24),
    density,
    typography: { family: fontFamily, bodySize, headingSize, lineHeight },
    spacing: metricsSpacing,
  };
}

export function importFoundationsDocument(document: Record<string, unknown>, base: ThemeDraft = STARTER_THEME): Pick<ThemeDraft, "name" | "description" | "light" | "dark" | "radius" | "density" | "typography" | "spacing"> {
  const accent = isRecord(document.accent_palette_default_blue) ? document.accent_palette_default_blue : {};
  const states = isRecord(document.states) ? document.states : {};
  const lightStates = isRecord(states.light) ? states.light : {};
  const darkStates = isRecord(states.dark) ? states.dark : {};
  const materials = isRecord(document.materials) ? document.materials : {};
  const mica = isRecord(materials.mica) ? materials.mica : {};
  const acrylic = isRecord(materials.acrylic) ? materials.acrylic : {};
  const radii = isRecord(document.radii_dp) ? document.radii_dp : {};
  const sourceSpacing = isRecord(document.spacing_dp) ? document.spacing_dp : {};
  const chart = isRecord(document.chart_palette) ? document.chart_palette : {};
  const chartLight = Array.isArray(chart.light) ? chart.light : [];
  const chartDark = Array.isArray(chart.dark) ? chart.dark : [];
  const colorsFor = (value: unknown, fallback: string) => typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
  const styles = isRecord(document.typography) && Array.isArray(document.typography.styles)
    ? document.typography.styles.filter(isRecord)
    : [];
  const style = (name: string) => styles.find((item) => item.name === name) ?? {};
  const bodyStyle = style("body");
  const titleStyle = style("title");
  const titleLargeStyle = style("titleLarge");
  const bodySize = boundedInteger(bodyStyle.size, base.typography.bodySize, 12, 18);
  const headingSize = boundedInteger(titleStyle.size ?? (numberFromSource(titleLargeStyle.size) === null ? undefined : Number(titleLargeStyle.size) - 12), base.typography.headingSize, 20, 40);
  const lineHeight = lineHeightRatio(bodyStyle.line ?? bodyStyle.lineHeight, bodySize, base.typography.lineHeight);
  const typographySource = isRecord(document.typography) ? document.typography : {};
  const family = typographySource.family === undefined ? base.typography.family : fontFamilyFromName(typographySource.family);
  const spacing: ThemeSpacing = {
    pageMargin: boundedInteger(sourceSpacing.page_margin, base.spacing.pageMargin, 8, 48),
    sectionGap: boundedInteger(sourceSpacing.section_gap, base.spacing.sectionGap, 4, 32),
    cardPadding: boundedInteger(sourceSpacing.card_padding, base.spacing.cardPadding, 4, 32),
    controlHeight: boundedInteger(sourceSpacing.control_height ?? sourceSpacing.min_touch_target, base.spacing.controlHeight, 24, 48),
    rowHeight: boundedInteger(sourceSpacing.row_height, base.spacing.rowHeight, 40, 96),
  };
  const density: Density = numberFromSource(sourceSpacing.page_margin) !== null && Number(sourceSpacing.page_margin) <= 16 ? "compact" : base.density;

  return {
    name: typeof document.title === "string" ? document.title.replace(/ foundations$/i, "") : base.name,
    description: "Imported from an openui-foundations-draft file. UI colors are adapted from the foundation palette.",
    light: {
      ...base.light,
      background: colorsFor(mica.light, base.light.background),
      surface: colorsFor(acrylic.light, base.light.surface),
      accent: colorsFor(accent.dark1, colorsFor(accent.base, base.light.accent)),
      accentPressed: colorsFor(lightStates.accent_pressed, base.light.accentPressed),
      secondary: colorsFor(chartLight[2], base.light.secondary),
    },
    dark: {
      ...base.dark,
      background: colorsFor(mica.dark, base.dark.background),
      surface: colorsFor(acrylic.dark, base.dark.surface),
      accent: colorsFor(accent.light2, colorsFor(accent.base, base.dark.accent)),
      accentPressed: colorsFor(darkStates.accent_pressed, base.dark.accentPressed),
      secondary: colorsFor(chartDark[2], base.dark.secondary),
    },
    radius: boundedInteger(radii.overlay, base.radius, 0, 24),
    density,
    typography: { family, bodySize, headingSize, lineHeight },
    spacing,
  };
}

export function toOpenUiDocument(theme: ThemeDraft): Record<string, unknown> {
  const source = isRecord(theme.sourceUi) ? theme.sourceUi : windowsUi;
  const document = JSON.parse(JSON.stringify(source)) as Record<string, unknown>;
  const openuiTheme = isRecord(document.openuiTheme) ? document.openuiTheme : {};
  const typography = isThemeTypography(theme.typography) ? theme.typography : DEFAULT_TYPOGRAPHY;
  const spacing = isThemeSpacing(theme.spacing) ? theme.spacing : spacingForDensity(theme.density);
  const sourceLight = isRecord(openuiTheme.light_colors) ? openuiTheme.light_colors : {};
  const sourceDark = isRecord(openuiTheme.dark_colors) ? openuiTheme.dark_colors : {};
  const colorsFor = (palette: ThemePalette, source: Record<string, unknown>) => ({
    ...source,
    openui_bg: palette.background,
    openui_fg: palette.surface,
    openui_sunk: mixHex(palette.background, palette.text, 0.04),
    openui_elevated: palette.elevated,
    openui_highlight: palette.highlight,
    openui_accent: palette.accent,
    openui_accent_pressed: palette.accentPressed,
    openui_accent_subtle: palette.accentSubtle,
    openui_text_on_accent: palette.onAccent,
    openui_secondary: palette.secondary,
    openui_text_primary: palette.text,
    openui_text_secondary: palette.muted,
    openui_text_tertiary: palette.faint,
    openui_text_brand: palette.accent,
    openui_border_default: palette.border,
    openui_border_interactive: palette.interactiveBorder,
  });

  const radii = isRecord(openuiTheme.radii_dp) ? openuiTheme.radii_dp : {};
  const metrics = isRecord(openuiTheme.metrics_dp) ? openuiTheme.metrics_dp : {};
  const nextTheme = {
    ...openuiTheme,
    title: theme.name,
    brand_color: theme.light.accent,
    secondary_color: theme.light.secondary,
    corner_profile: theme.radius <= 4 ? "crisp" : theme.radius >= 14 ? "round" : "soft",
    density: theme.density,
    radii_dp: {
      ...radii,
      card: theme.radius,
      button: Math.max(4, theme.radius - 4),
      input: Math.max(4, theme.radius - 4),
      chip: Math.max(4, theme.radius - 4),
      tag: Math.max(4, theme.radius - 4),
      callout: Math.max(4, theme.radius - 4),
    },
    typography: {
      ...(isRecord(openuiTheme.typography) ? openuiTheme.typography : {}),
      family: typography.family,
      font_family: FONT_FAMILY_STACKS[typography.family],
      body_size_dp: typography.bodySize,
      heading_size_dp: typography.headingSize,
      line_height: typography.lineHeight,
    },
    spacing_dp: {
      ...(isRecord(openuiTheme.spacing_dp) ? openuiTheme.spacing_dp : {}),
      page_margin: spacing.pageMargin,
      section_gap: spacing.sectionGap,
      card_padding: spacing.cardPadding,
      control_height: spacing.controlHeight,
      row_height: spacing.rowHeight,
    },
    metrics_dp: {
      ...metrics,
      screen_pad: spacing.pageMargin,
      section_gap: spacing.sectionGap,
      card_pad: spacing.cardPadding,
      button_height: spacing.controlHeight,
      input_height: spacing.controlHeight,
      row_height: spacing.rowHeight,
    },
    light_colors: colorsFor(theme.light, sourceLight),
    dark_colors: colorsFor(theme.dark, sourceDark),
  };

  const tokens = Array.isArray(document.tokens) ? document.tokens : [];
  const textSizes: Record<string, number> = {
    title_large: Math.min(68, typography.headingSize + 12),
    title: typography.headingSize,
    headline: Math.max(16, typography.headingSize - 8),
    body_large: Math.min(24, typography.bodySize + 4),
    body_strong: typography.bodySize,
    body: typography.bodySize,
    label: typography.bodySize,
    link: typography.bodySize,
    caption: Math.max(12, typography.bodySize - 2),
  };
  const nextTokens = tokens.map((rawToken) => {
    if (!isRecord(rawToken)) return rawToken;
    const props = isRecord(rawToken.props) ? rawToken.props : {};
    const key = String(rawToken.key ?? "").split("/").pop() ?? "";
    const nextProps: Record<string, unknown> = { ...props };

    if (rawToken.kind === "card") nextProps.corner_radius = String(theme.radius);
    if (rawToken.kind === "button" || rawToken.kind === "input") {
      nextProps.corner_radius = String(Math.max(4, theme.radius - 4));
      if (props.height !== undefined) nextProps.height = String(spacing.controlHeight);
      if (props.text_size !== undefined) nextProps.text_size = String(typography.bodySize);
    }
    if (rawToken.kind === "screen") {
      nextProps.padding = String(spacing.pageMargin);
      nextProps.gap = String(spacing.sectionGap);
    }
    if (rawToken.kind === "card" && (key === "card" || key === "sunk_card")) {
      nextProps.padding = String(spacing.cardPadding);
    }
    if (rawToken.kind === "text" && Object.hasOwn(textSizes, key)) {
      nextProps.text_size = String(textSizes[key]);
      nextProps.font_family = FONT_FAMILY_STACKS[typography.family];
      nextProps.line_height = String(typography.lineHeight);
    }
    return { ...rawToken, props: nextProps };
  });

  return {
    ...document,
    title: theme.name,
    specVersion: "openui-1.0",
    openuiTheme: nextTheme,
    tokens: nextTokens,
    updatedAt: Date.now(),
  };
}

/** Export a separate foundations-draft document and point it at its paired UI filename. */
export function toFoundationsDocument(theme: ThemeDraft, uiFilename: string): Record<string, unknown> {
  const source = isRecord(theme.sourceFoundations) ? theme.sourceFoundations : windowsFoundations;
  const document = JSON.parse(JSON.stringify(source)) as Record<string, unknown>;
  const typography = isThemeTypography(theme.typography) ? theme.typography : DEFAULT_TYPOGRAPHY;
  const spacing = isThemeSpacing(theme.spacing) ? theme.spacing : spacingForDensity(theme.density);
  const originalAccent = isRecord(document.accent_palette_default_blue) ? document.accent_palette_default_blue : {};
  const originalStates = isRecord(document.states) ? document.states : {};
  const originalLightStates = isRecord(originalStates.light) ? originalStates.light : {};
  const originalDarkStates = isRecord(originalStates.dark) ? originalStates.dark : {};
  const originalMaterials = isRecord(document.materials) ? document.materials : {};
  const originalMica = isRecord(originalMaterials.mica) ? originalMaterials.mica : {};
  const originalAcrylic = isRecord(originalMaterials.acrylic) ? originalMaterials.acrylic : {};
  const originalRadii = isRecord(document.radii_dp) ? document.radii_dp : {};
  const originalSpacing = isRecord(document.spacing_dp) ? document.spacing_dp : {};
  const originalTypography = isRecord(document.typography) ? document.typography : {};
  const fallbackStyles = isRecord(windowsFoundations.typography) && Array.isArray(windowsFoundations.typography.styles) ? windowsFoundations.typography.styles : [];
  const sourceStyles = Array.isArray(originalTypography.styles) ? originalTypography.styles : fallbackStyles;
  const styleSizes: Record<string, number> = {
    caption: Math.max(12, typography.bodySize - 2),
    body: typography.bodySize,
    bodyStrong: typography.bodySize,
    bodyLarge: Math.min(24, typography.bodySize + 4),
    subtitle: Math.max(20, typography.headingSize - 8),
    title: typography.headingSize,
    titleLarge: Math.min(68, typography.headingSize + 12),
    display: Math.min(68, typography.headingSize + 28),
  };
  const typographyStyles = sourceStyles.map((rawStyle) => {
    if (!isRecord(rawStyle) || typeof rawStyle.name !== "string" || !Object.hasOwn(styleSizes, rawStyle.name)) return rawStyle;
    const size = styleSizes[rawStyle.name];
    return { ...rawStyle, size, line: Math.round(size * typography.lineHeight) };
  });
  const originalChart = isRecord(document.chart_palette) ? document.chart_palette : {};
  const chartColors = (value: unknown, accent: string, secondary: string) => {
    const fallback = [accent, "#00B7C3", secondary, "#CA5010", "#107C10", "#C239B3", "#5F6CAF", "#B48C3C"];
    const colors = Array.isArray(value) ? [...value] : [...fallback];
    while (colors.length < 8) colors.push(fallback[colors.length]);
    colors[0] = accent;
    colors[2] = secondary;
    return colors;
  };
  const noteValues = Array.isArray(document.notes) ? [...document.notes] : [];
  const notes = noteValues.filter((note): note is string => typeof note === "string");
  const unsupportedNotes = noteValues.filter((note) => typeof note !== "string");
  const notice = `Color, radius, typography, and spacing values were adapted from the editable ${theme.name} theme; custom values are not official Windows resources.`;
  const nextNotes = [...notes.filter((note) => !note.startsWith("Color and radius values were adapted from the editable ") && !note.startsWith("Color, radius, typography, and spacing values were adapted from the editable ")), ...unsupportedNotes, notice];

  return {
    ...document,
    title: `${theme.name} foundations`,
    specVersion: "openui-foundations-draft",
    pairsWith: uiFilename,
    accent_palette_default_blue: {
      ...originalAccent,
      light3: mixHex(theme.dark.accent, "#FFFFFF", 0.72),
      light2: theme.dark.accent,
      light1: mixHex(theme.light.accent, "#FFFFFF", 0.24),
      base: theme.light.accent,
      dark1: theme.light.accent,
      dark2: mixHex(theme.light.accent, "#000000", 0.34),
      dark3: mixHex(theme.light.accent, "#000000", 0.62),
      usage: "light theme fill = dark1, dark theme fill = light2, accent text = dark2 / light3",
    },
    states: {
      ...originalStates,
      light: { ...originalLightStates, accent_hover: theme.light.accentPressed, accent_pressed: theme.light.accentPressed },
      dark: { ...originalDarkStates, accent_hover: theme.dark.accentPressed, accent_pressed: theme.dark.accentPressed },
    },
    materials: {
      ...originalMaterials,
      mica: { ...originalMica, light: theme.light.background, dark: theme.dark.background },
      acrylic: { ...originalAcrylic, light: theme.light.surface, dark: theme.dark.surface },
    },
    typography: {
      ...originalTypography,
      family: FONT_FAMILY_STACKS[typography.family],
      styles: typographyStyles,
    },
    radii_dp: {
      ...originalRadii,
      control: Math.max(0, theme.radius - 4),
      overlay: theme.radius,
    },
    spacing_dp: {
      ...originalSpacing,
      scale: (() => {
        const scale = Array.isArray(originalSpacing.scale) ? [...originalSpacing.scale] : [];
        for (const value of [spacing.pageMargin, spacing.sectionGap, spacing.cardPadding]) {
          if (!scale.some((entry) => numberFromSource(entry) === value)) scale.push(value);
        }
        return scale;
      })(),
      page_margin: spacing.pageMargin,
      section_gap: spacing.sectionGap,
      card_padding: spacing.cardPadding,
      control_height: spacing.controlHeight,
      row_height: spacing.rowHeight,
    },
    chart_palette: {
      ...originalChart,
      light: chartColors(originalChart.light, theme.light.accent, theme.light.secondary),
      dark: chartColors(originalChart.dark, theme.dark.accent, theme.dark.secondary),
    },
    notes: nextNotes,
  };
}

export function toCssFile(theme: ThemeDraft): string {
  const typography = isThemeTypography(theme.typography) ? theme.typography : DEFAULT_TYPOGRAPHY;
  const spacing = isThemeSpacing(theme.spacing) ? theme.spacing : spacingForDensity(theme.density);
  const entries = (mode: ThemeMode) => {
    const p = theme[mode];
    return [
      `  --color-canvas: ${p.background};`,
      `  --color-surface: ${p.surface};`,
      `  --color-surface-raised: ${p.elevated};`,
      `  --color-accent: ${p.accent};`,
      `  --color-accent-hover: ${p.accentPressed};`,
      `  --color-accent-subtle: ${p.accentSubtle};`,
      `  --color-secondary: ${p.secondary};`,
      `  --color-text: ${p.text};`,
      `  --color-text-muted: ${p.muted};`,
      `  --color-border: ${p.border};`,
      `  --radius-card: ${theme.radius}px;`,
      `  --radius-control: ${Math.max(4, theme.radius - 4)}px;`,
      `  --font-family: ${FONT_FAMILY_STACKS[typography.family]};`,
      `  --font-size-body: ${typography.bodySize}px;`,
      `  --font-size-heading: ${typography.headingSize}px;`,
      `  --line-height-body: ${typography.lineHeight};`,
      `  --space-page-margin: ${spacing.pageMargin}px;`,
      `  --space-section-gap: ${spacing.sectionGap}px;`,
      `  --space-card-padding: ${spacing.cardPadding}px;`,
      `  --size-control-height: ${spacing.controlHeight}px;`,
      `  --size-row-height: ${spacing.rowHeight}px;`,
      `  --space-card: ${spacing.cardPadding}px;`,
    ].join("\n");
  };
  const safeComment = theme.name.replace(/\*\//g, "* /").replace(/[\r\n]+/g, " ");
  return `/* ${safeComment} — generated by Forma */\n:root {\n${entries("light")}\n  color-scheme: light;\n}\n\n[data-theme="dark"] {\n${entries("dark")}\n  color-scheme: dark;\n}\n`;
}
