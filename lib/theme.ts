import type { CSSProperties } from "react";
import windowsFoundations from "@/data/windows_11_pro_foundations.json";
import windowsUi from "@/data/windows_11_pro_ui.json";

export type ThemeMode = "light" | "dark";
export type Density = "comfortable" | "compact";

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
  updatedAt: 0,
};

export type ThemeCssVars = CSSProperties & Record<`--${string}`, string>;

export function themeCssVars(theme: ThemeDraft, mode: ThemeMode): ThemeCssVars {
  const palette = theme[mode];
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
    "--p-space": theme.density === "compact" ? "12px" : "16px",
    "--p-card-pad": theme.density === "compact" ? "10px" : "15px",
    "--p-content-pad": theme.density === "compact" ? "8px" : "12px",
    "--p-metric-pad": theme.density === "compact" ? "5px" : "8px",
    "--p-gap": theme.density === "compact" ? "5px" : "7px",
    "--p-control-height": theme.density === "compact" ? "24px" : "28px",
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

export function toOpenUiDocument(theme: ThemeDraft): Record<string, unknown> {
  const source = isRecord(theme.sourceUi) ? theme.sourceUi : windowsUi;
  const document = JSON.parse(JSON.stringify(source)) as Record<string, unknown>;
  const openuiTheme = isRecord(document.openuiTheme) ? document.openuiTheme : {};
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
    metrics_dp: {
      ...metrics,
      card_pad: theme.density === "compact" ? 12 : 16,
      button_height: theme.density === "compact" ? 32 : 36,
      input_height: theme.density === "compact" ? 32 : 36,
      row_height: theme.density === "compact" ? 56 : 68,
    },
    light_colors: colorsFor(theme.light, sourceLight),
    dark_colors: colorsFor(theme.dark, sourceDark),
  };

  const tokens = Array.isArray(document.tokens) ? document.tokens : [];
  const nextTokens = tokens.map((rawToken) => {
    if (!isRecord(rawToken)) return rawToken;
    const props = isRecord(rawToken.props) ? rawToken.props : {};
    if (rawToken.kind === "card") {
      return { ...rawToken, props: { ...props, corner_radius: String(theme.radius) } };
    }
    if (rawToken.kind === "button" || rawToken.kind === "input") {
      return { ...rawToken, props: { ...props, corner_radius: String(Math.max(4, theme.radius - 4)) } };
    }
    return rawToken;
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
  const originalAccent = isRecord(document.accent_palette_default_blue) ? document.accent_palette_default_blue : {};
  const originalStates = isRecord(document.states) ? document.states : {};
  const originalLightStates = isRecord(originalStates.light) ? originalStates.light : {};
  const originalDarkStates = isRecord(originalStates.dark) ? originalStates.dark : {};
  const originalMaterials = isRecord(document.materials) ? document.materials : {};
  const originalMica = isRecord(originalMaterials.mica) ? originalMaterials.mica : {};
  const originalAcrylic = isRecord(originalMaterials.acrylic) ? originalMaterials.acrylic : {};
  const originalRadii = isRecord(document.radii_dp) ? document.radii_dp : {};
  const originalSpacing = isRecord(document.spacing_dp) ? document.spacing_dp : {};
  const originalChart = isRecord(document.chart_palette) ? document.chart_palette : {};
  const chartColors = (value: unknown, accent: string, secondary: string) => {
    const colors = Array.isArray(value) ? value.filter((color): color is string => typeof color === "string") : [];
    const fallback = [accent, "#00B7C3", secondary, "#CA5010", "#107C10", "#C239B3", "#5F6CAF", "#B48C3C"];
    return [accent, ...colors.slice(1, 2), secondary, ...colors.slice(3)].length >= 8
      ? [accent, ...colors.slice(1, 2), secondary, ...colors.slice(3)].slice(0, 8)
      : [...fallback.slice(0, 2), secondary, ...fallback.slice(3)];
  };
  const notes = Array.isArray(document.notes) ? document.notes.filter((note): note is string => typeof note === "string") : [];
  const notice = `Color and radius values were adapted from the editable ${theme.name} theme; they are not a claim that custom values are official Windows resources.`;
  const nextNotes = [...notes.filter((note) => !note.startsWith("Color and radius values were adapted from the editable ")), notice];

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
    radii_dp: {
      ...originalRadii,
      control: Math.max(0, theme.radius - 4),
      overlay: theme.radius,
    },
    spacing_dp: {
      ...originalSpacing,
      page_margin: theme.density === "compact" ? 16 : 24,
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
      `  --space-card: ${theme.density === "compact" ? 12 : 16}px;`,
    ].join("\n");
  };
  const safeComment = theme.name.replace(/\*\//g, "* /").replace(/[\r\n]+/g, " ");
  return `/* ${safeComment} — generated by Forma */\n:root {\n${entries("light")}\n  color-scheme: light;\n}\n\n[data-theme="dark"] {\n${entries("dark")}\n  color-scheme: dark;\n}\n`;
}
