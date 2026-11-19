import { DEFAULT_TYPOGRAPHY, spacingForDensity, type ThemeDraft } from "@/lib/theme";

export interface StarterDesign {
  id: string;
  title: string;
  description: string;
  collection: string;
  creator: string;
  tags: string[];
  featured?: boolean;
  tokenCount: number;
  theme: ThemeDraft;
}

const base = (overrides: Partial<ThemeDraft>): ThemeDraft => {
  const density = overrides.density ?? "comfortable";
  return {
    id: "starter",
    name: "Starter design",
    description: "A ready-to-remix starting point.",
    author: "Forma starter library",
    tags: ["Starter"],
    light: {
      background: "#F4F5F7",
      surface: "#FFFFFF",
      elevated: "#FFFFFF",
      highlight: "#EDF1F5",
      accent: "#3D6FB6",
      accentPressed: "#315C98",
      accentSubtle: "#E7EFFA",
      secondary: "#7B6CB2",
      text: "#20242A",
      muted: "#626B76",
      faint: "#8A929B",
      border: "#DDE2E8",
      interactiveBorder: "#8A929B",
      onAccent: "#FFFFFF",
    },
    dark: {
      background: "#191D23",
      surface: "#222832",
      elevated: "#29313C",
      highlight: "#303A47",
      accent: "#83B5FF",
      accentPressed: "#A3C7FF",
      accentSubtle: "#26374D",
      secondary: "#C2B3FF",
      text: "#F2F4F8",
      muted: "#C1C8D2",
      faint: "#919BA8",
      border: "#39424F",
      interactiveBorder: "#8693A2",
      onAccent: "#11233B",
    },
    radius: 10,
    updatedAt: Date.now(),
    ...overrides,
    density,
    typography: overrides.typography ?? { ...DEFAULT_TYPOGRAPHY },
    spacing: overrides.spacing ?? spacingForDensity(density),
  };
};

export const STARTER_DESIGNS: StarterDesign[] = [
  {
    id: "windows-11-pro",
    title: "Fluent Workspace",
    description: "Layered surfaces, clear hierarchy, and a confident blue accent.",
    collection: "Desktop",
    creator: "Forma foundations",
    tags: ["Windows-inspired", "Light + dark", "Desktop"],
    featured: true,
    tokenCount: 58,
    theme: {
      id: "windows-11-pro",
      name: "Windows 11 Pro",
      description: "A calm, layered desktop system inspired by Fluent foundations.",
      author: "Forma foundations",
      tags: ["Windows-inspired", "Desktop", "Light + dark"],
      light: {
        background: "#F3F3F3", surface: "#FBFBFB", elevated: "#FFFFFF", highlight: "#F2F2F2",
        accent: "#0067C0", accentPressed: "#3385CD", accentSubtle: "#E6F0F9", secondary: "#8764B8",
        text: "#1B1B1B", muted: "#616161", faint: "#8D8D8D", border: "#E5E5E5", interactiveBorder: "#8D8D8D", onAccent: "#FFFFFF",
      },
      dark: {
        background: "#202020", surface: "#2B2B2B", elevated: "#2C2C2C", highlight: "#383838",
        accent: "#4CC2FF", accentPressed: "#45A4D5", accentSubtle: "#30424B", secondary: "#B4A0FF",
        text: "#FFFFFF", muted: "#C5C5C5", faint: "#878787", border: "#383838", interactiveBorder: "#9F9F9F", onAccent: "#000000",
      },
      radius: 8,
      density: "comfortable",
      typography: { ...DEFAULT_TYPOGRAPHY },
      spacing: spacingForDensity("comfortable"),
      updatedAt: Date.now(),
    },
  },
  {
    id: "moss-paper",
    title: "Moss & Paper",
    description: "Warm neutrals paired with a grounded botanical green.",
    collection: "Editorial",
    creator: "Forma starter library",
    tags: ["Warm", "Editorial", "Accessible palette"],
    tokenCount: 46,
    theme: base({
      id: "moss-paper", name: "Moss & Paper", author: "Forma starter library", tags: ["Warm", "Editorial"], radius: 12,
      light: {
        background: "#F5F4EE", surface: "#FCFBF7", elevated: "#FFFFFF", highlight: "#ECEDE3",
        accent: "#426B54", accentPressed: "#365A46", accentSubtle: "#E5EEE7", secondary: "#A16E4D",
        text: "#242923", muted: "#606B61", faint: "#899187", border: "#DEE2D8", interactiveBorder: "#7F8B80", onAccent: "#FFFFFF",
      },
      dark: {
        background: "#1A211D", surface: "#232D27", elevated: "#2A362F", highlight: "#35443A",
        accent: "#9AC6A7", accentPressed: "#B3D6BC", accentSubtle: "#293C31", secondary: "#E0AE8A",
        text: "#F1F5F0", muted: "#C1CFC4", faint: "#8C9D90", border: "#3D4B41", interactiveBorder: "#87998B", onAccent: "#14251A",
      },
    }),
  },
  {
    id: "citrus-workbench",
    title: "Citrus Workbench",
    description: "An optimistic orange accent balanced by cool, quiet surfaces.",
    collection: "Productivity",
    creator: "Forma starter library",
    tags: ["Bright", "Productivity", "Compact"],
    tokenCount: 52,
    theme: base({
      id: "citrus-workbench", name: "Citrus Workbench", author: "Forma starter library", tags: ["Bright", "Compact"], radius: 6, density: "compact",
      light: {
        background: "#F1F4F6", surface: "#FAFBFC", elevated: "#FFFFFF", highlight: "#E8EEF2",
        accent: "#C6532B", accentPressed: "#A94422", accentSubtle: "#F8E8E2", secondary: "#477064",
        text: "#20262A", muted: "#5E686D", faint: "#879196", border: "#DCE3E7", interactiveBorder: "#7E8A90", onAccent: "#FFFFFF",
      },
      dark: {
        background: "#1B2023", surface: "#252D31", elevated: "#2D373C", highlight: "#364248",
        accent: "#FF9D78", accentPressed: "#FFB296", accentSubtle: "#4A3029", secondary: "#92C3B2",
        text: "#F3F6F7", muted: "#C1CBCF", faint: "#8B989D", border: "#3B474D", interactiveBorder: "#92A0A5", onAccent: "#3C1D12",
      },
    }),
  },
  {
    id: "violet-night",
    title: "Violet Nightshift",
    description: "A deep workspace palette with a luminous lavender action color.",
    collection: "Dark-first",
    creator: "Forma starter library",
    tags: ["Dark-first", "Creative", "Soft corners"],
    tokenCount: 61,
    theme: base({
      id: "violet-night", name: "Violet Nightshift", author: "Forma starter library", tags: ["Dark-first", "Creative"], radius: 14,
      light: {
        background: "#F5F3FA", surface: "#FCFAFF", elevated: "#FFFFFF", highlight: "#EFEBF7",
        accent: "#6B52AE", accentPressed: "#58418F", accentSubtle: "#EEE8FA", secondary: "#2E7481",
        text: "#25212D", muted: "#676172", faint: "#918A9B", border: "#E3DFEB", interactiveBorder: "#8B8299", onAccent: "#FFFFFF",
      },
      dark: {
        background: "#1D1A24", surface: "#282330", elevated: "#302A39", highlight: "#3A3246",
        accent: "#C6ACFF", accentPressed: "#D4C1FF", accentSubtle: "#382B50", secondary: "#93D5E1",
        text: "#F5F1FA", muted: "#D1C9DB", faint: "#9A91A6", border: "#463D52", interactiveBorder: "#9589A3", onAccent: "#2D194D",
      },
    }),
  },
  {
    id: "blueprint-minimal",
    title: "Blueprint Minimal",
    description: "A crisp, low-noise system for analytics and admin tools.",
    collection: "Minimal",
    creator: "Forma starter library",
    tags: ["Minimal", "Analytics", "Compact"],
    tokenCount: 43,
    theme: base({
      id: "blueprint-minimal", name: "Blueprint Minimal", author: "Forma starter library", tags: ["Minimal", "Analytics"], radius: 4, density: "compact",
      light: {
        background: "#F2F5F9", surface: "#FFFFFF", elevated: "#FFFFFF", highlight: "#E8EEF6",
        accent: "#245C9A", accentPressed: "#1D4B7E", accentSubtle: "#E5EEF8", secondary: "#4C687C",
        text: "#17212D", muted: "#536273", faint: "#7D8996", border: "#D9E1EA", interactiveBorder: "#697887", onAccent: "#FFFFFF",
      },
      dark: {
        background: "#151C25", surface: "#1E2936", elevated: "#253343", highlight: "#2D3E52",
        accent: "#8DBFFF", accentPressed: "#A8CDFF", accentSubtle: "#263B55", secondary: "#A5C7DC",
        text: "#F3F7FC", muted: "#BCC9D7", faint: "#8796A6", border: "#354559", interactiveBorder: "#8597AA", onAccent: "#10243A",
      },
    }),
  },
];
