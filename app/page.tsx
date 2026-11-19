"use client";

import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Heart,
  Home,
  Layers3,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Palette,
  PanelLeft,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import foundationsJson from "@/data/windows_11_pro_foundations.json";
import uiJson from "@/data/windows_11_pro_ui.json";
import { STARTER_DESIGNS, type StarterDesign } from "@/data/marketplace";
import { clearLocal, readLocal, removeLocal, writeLocal } from "@/lib/storage";
import { strToU8, zipSync } from "fflate";
import {
  contrastRatio,
  STARTER_THEME,
  themeCssVars,
  toCssFile,
  toFoundationsDocument,
  toOpenUiDocument,
  type ThemeDraft,
  type ThemeMode,
  type ThemePalette,
} from "@/lib/theme";

type View = "overview" | "studio" | "marketplace" | "settings";
type Provider = "openai" | "anthropic" | "gemini" | "openrouter" | "nvidia" | "custom";
type ChatMessage = { id: string; role: "assistant" | "user"; text: string };
type AppMode = "light" | "dark";
type PreviewViewport = "desktop" | "tablet" | "mobile";
type PendingProposal = { patch: Record<string, unknown>; summary: string };

type ProviderConfig = { provider: Provider; model: string; baseUrl?: string };
type RememberedProviderKey = { provider: Provider; key: string };

const PROVIDERS: { id: Provider; name: string; detail: string; icon: string; sampleModel: string }[] = [
  { id: "openai", name: "OpenAI", detail: "GPT models", icon: "O", sampleModel: "gpt-4o-mini" },
  { id: "anthropic", name: "Anthropic", detail: "Claude models", icon: "A", sampleModel: "claude-3-5-haiku-latest" },
  { id: "gemini", name: "Google Gemini", detail: "Gemini API", icon: "G", sampleModel: "gemini-2.0-flash" },
  { id: "openrouter", name: "OpenRouter", detail: "Route to many models", icon: "R", sampleModel: "openai/gpt-4o-mini" },
  { id: "nvidia", name: "NVIDIA NIM", detail: "NVIDIA-hosted models", icon: "N", sampleModel: "meta/llama-3.1-70b-instruct" },
  { id: "custom", name: "Any provider", detail: "OpenAI-compatible API", icon: "C", sampleModel: "" },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "Describe your product and the mood you want. I can propose light/dark color roles, corner radius, density, and theme name/description. I receive only your prompt and current theme values—not your website, assets, or code. Review every proposal before applying.",
  },
];

const COLOR_FIELDS: { key: keyof ThemePalette; label: string; description: string }[] = [
  { key: "accent", label: "Brand accent", description: "Primary actions and active states" },
  { key: "secondary", label: "Secondary", description: "Supporting brand and chart color" },
  { key: "background", label: "Canvas", description: "Page background" },
  { key: "surface", label: "Surface", description: "Cards and primary panels" },
  { key: "text", label: "Primary text", description: "Headings and body text" },
  { key: "muted", label: "Secondary text", description: "Supporting labels" },
  { key: "border", label: "Default border", description: "Separators and card outlines" },
];

const PROPOSAL_PALETTE_ROLES: { key: keyof ThemePalette; label: string }[] = [
  { key: "background", label: "Canvas" },
  { key: "surface", label: "Surface" },
  { key: "accent", label: "Accent" },
  { key: "secondary", label: "Secondary" },
  { key: "text", label: "Text" },
];

function isHex(value: string): boolean {
  return /^#[\da-f]{6}$/i.test(value);
}

function safeTheme(value: unknown): value is ThemeDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<ThemeDraft>;
  const paletteKeys: (keyof ThemePalette)[] = ["background", "surface", "elevated", "highlight", "accent", "accentPressed", "accentSubtle", "secondary", "text", "muted", "faint", "border", "interactiveBorder", "onAccent"];
  const validPalette = (palette: unknown) => Boolean(palette) && typeof palette === "object" && paletteKeys.every((key) => isHex(String((palette as ThemePalette)[key] ?? "")));
  return typeof draft.id === "string" && typeof draft.name === "string" &&
    typeof draft.description === "string" && typeof draft.author === "string" &&
    Array.isArray(draft.tags) && validPalette(draft.light) && validPalette(draft.dark) &&
    typeof draft.radius === "number" && Number.isFinite(draft.radius) && draft.radius >= 0 && draft.radius <= 24 &&
    (draft.density === "comfortable" || draft.density === "compact");
}

function themeWithProposal(theme: ThemeDraft, patch: Record<string, unknown>): ThemeDraft {
  const next = { ...theme };
  if (typeof patch.name === "string") next.name = patch.name;
  if (typeof patch.description === "string") next.description = patch.description;
  if (typeof patch.radius === "number") next.radius = patch.radius;
  if (patch.density === "comfortable" || patch.density === "compact") next.density = patch.density;
  if (patch.light && typeof patch.light === "object" && !Array.isArray(patch.light)) {
    next.light = { ...theme.light, ...(patch.light as Partial<ThemePalette>) };
  }
  if (patch.dark && typeof patch.dark === "object" && !Array.isArray(patch.dark)) {
    next.dark = { ...theme.dark, ...(patch.dark as Partial<ThemePalette>) };
  }
  return next;
}

function upsertDraft(list: ThemeDraft[], draft: ThemeDraft): ThemeDraft[] {
  const next = [...list.filter((item) => item.id !== draft.id), draft];
  return next.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

function safeProviderSettings(config: ProviderConfig): ProviderConfig {
  let baseUrl = "";
  try {
    const parsed = new URL(config.baseUrl ?? "");
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.search && !parsed.hash) {
      baseUrl = parsed.toString().replace(/\/$/, "");
    }
  } catch {
    // Keep incomplete URLs only in page memory; never persist credentials or query values.
  }
  return { provider: config.provider, model: config.model.slice(0, 160), baseUrl };
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `draft-${Date.now()}`;
}

function downloadBlob(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadZip(name: string, files: Record<string, string>) {
  const archive = zipSync(Object.fromEntries(Object.entries(files).map(([fileName, content]) => [fileName, strToU8(content)])));
  const bytes = Uint8Array.from(archive);
  const blob = new Blob([bytes.buffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatTime(timestamp: number) {
  if (!timestamp) return "Just now";
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(timestamp);
}

function AppIcon() {
  return (
    <span className="forma-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

function IconButton({
  label,
  onClick,
  children,
  className = "",
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button className={`icon-button ${className}`} type="button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

function SampleWebsite({
  theme,
  mode,
  small = false,
  viewport = "desktop",
}: {
  theme: ThemeDraft;
  mode: ThemeMode;
  small?: boolean;
  viewport?: PreviewViewport;
}) {
  const SampleControl = small ? "span" : "button";

  return (
    <div className={`sample-site sample-site--${viewport} ${small ? "sample-site--small" : ""}`} style={themeCssVars(theme, mode)} data-theme={mode} data-viewport={viewport}>
      <aside className="sample-nav">
        <div className="sample-nav__brand"><span className="sample-dot" /> Northstar</div>
        <div className="sample-nav__section">WORKSPACE</div>
        <div className="sample-nav__item sample-nav__item--active"><LayoutDashboard size={14} /> Overview</div>
        <div className="sample-nav__item"><Activity size={14} /> Analytics</div>
        <div className="sample-nav__item"><Layers3 size={14} /> Projects <span className="sample-count">8</span></div>
        <div className="sample-nav__item"><MessageCircle size={14} /> Inbox <span className="sample-count">3</span></div>
        <div className="sample-nav__section sample-nav__section--spaced">PREFERENCES</div>
        <div className="sample-nav__item"><Settings size={14} /> Settings</div>
        <div className="sample-profile">
          <div className="sample-avatar">JD</div>
          <div><b>Jordan Davis</b><small>Product team</small></div>
          <MoreHorizontal size={14} />
        </div>
      </aside>
      <section className="sample-main">
        <header className="sample-topbar">
          <div className="sample-crumb">Workspace <ChevronRight size={12} /> Overview</div>
          <div className="sample-topbar__actions"><span className="sample-status"><span /> All systems normal</span><SampleControl className="sample-icon" aria-label="Search"><Search size={14} /></SampleControl><div className="sample-mini-avatar">JD</div></div>
        </header>
        <div className="sample-content">
          <div className="sample-heading">
            <div><div className="sample-eyebrow">MONDAY, MAY 19, 2026</div><h3>Good morning, Jordan <span>✦</span></h3><p>Here’s what’s happening with your workspace today.</p></div>
            <SampleControl className="sample-primary"><Plus size={13} /> New project</SampleControl>
          </div>
          <div className="sample-metrics">
            <div className="sample-metric"><div className="sample-metric__top"><span>Active projects</span><span className="sample-metric-icon"><Layers3 size={13} /></span></div><strong>12</strong><small className="sample-positive">↑ 2 <i>this month</i></small></div>
            <div className="sample-metric"><div className="sample-metric__top"><span>Tasks completed</span><span className="sample-metric-icon"><Check size={13} /></span></div><strong>84</strong><small className="sample-positive">↑ 12% <i>this week</i></small></div>
            <div className="sample-metric"><div className="sample-metric__top"><span>Team activity</span><span className="sample-metric-icon"><Activity size={13} /></span></div><strong>96.8%</strong><small className="sample-positive">↑ 4.3% <i>this month</i></small></div>
          </div>
          <div className="sample-grid">
            <div className="sample-card sample-chart-card">
              <div className="sample-card__head"><div><b>Project health</b><small>Progress across your workspace</small></div><SampleControl className="sample-select">This month <ChevronDown size={12} /></SampleControl></div>
              <div className="sample-chart-legend"><span><i /> Completed</span><span><i /> In progress</span></div>
              <div className="sample-chart">
                <div className="chart-y"><span>100</span><span>75</span><span>50</span><span>25</span></div>
                <div className="chart-area"><div className="chart-lines"><i /><i /><i /><i /></div><svg viewBox="0 0 360 115" preserveAspectRatio="none" aria-label="Project progress trend"><defs><linearGradient id={`chart-fill-${mode}-${small ? "small" : "large"}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--p-accent)" stopOpacity=".22"/><stop offset="100%" stopColor="var(--p-accent)" stopOpacity=".01"/></linearGradient></defs><path d="M0,82 C24,70 34,62 58,68 S91,85 115,61 S154,52 177,55 S205,37 230,45 S267,56 290,29 S329,39 360,15 L360,115 L0,115 Z" fill={`url(#chart-fill-${mode}-${small ? "small" : "large"})`} /><path d="M0,82 C24,70 34,62 58,68 S91,85 115,61 S154,52 177,55 S205,37 230,45 S267,56 290,29 S329,39 360,15" fill="none" stroke="var(--p-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg><div className="chart-x"><span>May 1</span><span>May 5</span><span>May 10</span><span>May 15</span><span>May 19</span></div></div>
              </div>
            </div>
            <div className="sample-card sample-activity-card">
              <div className="sample-card__head"><div><b>Recent activity</b><small>What your team has been up to</small></div><SampleControl className="sample-more"><MoreHorizontal size={15} /></SampleControl></div>
              <div className="sample-activity"><div className="sample-activity-avatar sample-activity-avatar--blue">AC</div><div><b>Alex Chen</b><p>completed <strong>Q2 roadmap</strong></p><small>12 minutes ago</small></div></div>
              <div className="sample-activity"><div className="sample-activity-avatar sample-activity-avatar--green">SK</div><div><b>Sam Kim</b><p>shared a new <strong>design review</strong></p><small>48 minutes ago</small></div></div>
              <div className="sample-activity"><div className="sample-activity-avatar sample-activity-avatar--peach">MT</div><div><b>Morgan Taylor</b><p>added you to <strong>Mobile refresh</strong></p><small>2 hours ago</small></div></div>
            </div>
          </div>
          <div className="sample-card sample-table-card">
            <div className="sample-card__head"><div><b>Projects</b><small>Your team’s latest work</small></div><SampleControl className="sample-link">View all <ArrowRight size={12} /></SampleControl></div>
            <div className="sample-table">
              <div className="sample-table__row sample-table__row--head"><span>PROJECT</span><span>OWNER</span><span>STATUS</span><span>PROGRESS</span></div>
              <div className="sample-table__row"><span className="sample-project"><i className="project-dot project-dot--blue"/><b>Q2 roadmap</b></span><span><span className="sample-owner">AC</span> Alex Chen</span><span><em className="sample-pill sample-pill--green">On track</em></span><span className="sample-progress"><i style={{ width: "76%" }}/><b>76%</b></span></div>
              <div className="sample-table__row"><span className="sample-project"><i className="project-dot project-dot--violet"/><b>Mobile refresh</b></span><span><span className="sample-owner sample-owner--peach">MT</span> Morgan Taylor</span><span><em className="sample-pill sample-pill--blue">In progress</em></span><span className="sample-progress"><i style={{ width: "48%" }}/><b>48%</b></span></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ColorInput({
  label,
  value,
  description,
  onChange,
}: {
  label: string;
  value: string;
  description: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="color-field">
      <span className="color-field__swatch" style={{ background: value }}>
        <input type="color" value={isHex(value) ? value : "#000000"} onChange={(event) => onChange(event.target.value.toUpperCase())} aria-label={`${label} color`} />
      </span>
      <span className="color-field__copy"><b>{label}</b><small>{description}</small></span>
      <span className="color-field__hex">{value.toUpperCase()}</span>
    </label>
  );
}

function MiniStat({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  return <div className="mini-stat"><span className={`mini-stat__icon ${tone}`}>{icon}</span><div><small>{label}</small><b>{value}</b></div></div>;
}

function StarterCard({
  item,
  mode,
  favorite,
  onToggleFavorite,
  onPreview,
  onApply,
  compact = false,
}: {
  item: StarterDesign;
  mode: ThemeMode;
  favorite: boolean;
  onToggleFavorite: () => void;
  onPreview: () => void;
  onApply: () => void;
  compact?: boolean;
}) {
  return (
    <article className={`starter-card ${compact ? "starter-card--compact" : ""}`}>
      <button className="starter-card__preview" type="button" onClick={onPreview} aria-label={`Preview ${item.title}`}>
        <div className="starter-card__mini"><SampleWebsite theme={item.theme} mode={mode} small /></div>
        <span className="starter-card__peek"><Eye size={14} /> Preview</span>
      </button>
      <div className="starter-card__body">
        <div className="starter-card__title-row"><div><div className="starter-card__eyebrow">{item.collection} <span>·</span> {item.tokenCount} tokens</div><h3>{item.title}</h3></div>{!compact && <button className={`favorite-button ${favorite ? "is-favorite" : ""}`} type="button" onClick={onToggleFavorite} aria-label={favorite ? "Remove from saved designs" : "Save design"}><Heart size={17} fill={favorite ? "currentColor" : "none"}/></button>}</div>
        <p>{item.description}</p>
        <div className="starter-card__meta"><div className="creator-avatar">{item.creator.slice(0, 1)}</div><span>{item.creator}</span><button className="text-button" type="button" onClick={onApply}>Use design <ArrowRight size={13}/></button></div>
      </div>
    </article>
  );
}

function OverviewView({
  theme,
  projects,
  mode,
  onCreate,
  onOpenStudio,
  onOpenAssistant,
  onOpenProject,
  onOpenMarketplace,
  onImport,
  onApply,
  onPreviewItem,
}: {
  theme: ThemeDraft;
  projects: ThemeDraft[];
  mode: ThemeMode;
  onCreate: () => void;
  onOpenStudio: () => void;
  onOpenAssistant: () => void;
  onOpenProject: (project: ThemeDraft) => void;
  onOpenMarketplace: () => void;
  onImport: () => void;
  onApply: (item: StarterDesign) => void;
  onPreviewItem: (item: StarterDesign) => void;
}) {
  const featured = STARTER_DESIGNS[0];
  return (
    <div className="page-stack overview-view">
      <section className="welcome-hero">
        <div className="welcome-hero__copy">
          <div className="eyebrow-label"><span className="eyebrow-line" /> YOUR DESIGN SYSTEM WORKSPACE</div>
          <h1>Good design starts<br/>with <em>good foundations.</em></h1>
          <p>Shape a visual language, preview it on a real sample website, and take the tokens wherever you build.</p>
          <div className="hero-actions"><button className="button button--primary" type="button" onClick={onOpenAssistant}><Sparkles size={16}/> Chat with Forma <ArrowRight size={15}/></button><button className="button button--subtle" type="button" onClick={onCreate}><Plus size={15}/> Start from scratch</button><button className="button button--subtle" type="button" onClick={onImport}><Upload size={15}/> Import JSON</button></div>
          <div className="hero-note"><ShieldCheck size={14}/> No account required <span/> Your work stays in this browser</div>
        </div>
        <div className="welcome-hero__visual">
          <div className="hero-ornament hero-ornament--one"/><div className="hero-ornament hero-ornament--two"/>
          <div className="hero-preview-card">
            <div className="hero-preview-card__top"><span className="hero-window-dots"><i/><i/><i/></span><span>LIVE PREVIEW</span><span className="hero-live-dot"/></div>
            <div className="hero-preview-card__body" style={themeCssVars(theme, mode)}>
              <div className="hero-preview-sidebar"><div className="hero-preview-logo"/><i className="selected"/><i/><i/><i/><div className="hero-preview-sidebar__bottom"/></div>
              <div className="hero-preview-content"><div className="hero-preview-line hero-preview-line--short"/><div className="hero-preview-line hero-preview-line--title"/><div className="hero-preview-pills"><i/><i/><i/></div><div className="hero-preview-cards"><i/><i/><i/></div><div className="hero-preview-chart"><svg viewBox="0 0 280 74" preserveAspectRatio="none"><path d="M0,57 C30,43 42,50 66,37 S96,54 120,31 S151,47 176,23 S213,37 236,16 S259,22 280,7" fill="none" stroke="var(--p-accent)" strokeWidth="2.4"/><path d="M0,57 C30,43 42,50 66,37 S96,54 120,31 S151,47 176,23 S213,37 236,16 S259,22 280,7 L280,74 L0,74Z" fill="var(--p-accent)" opacity=".08"/></svg></div></div>
            </div>
            <div className="hero-preview-card__footer"><span><i style={{ background: theme.light.accent }}/>{theme.name}</span><span>Light mode <ChevronDown size={12}/></span></div>
          </div>
          <div className="hero-float-chip"><span className="hero-float-chip__spark"><Sparkles size={14}/></span><span><b>58 tokens</b><small>Ready to explore</small></span><CheckCircle2 size={16} className="hero-float-chip__check"/></div>
        </div>
      </section>

      <section className="overview-stats">
        <MiniStat label="Your design systems" value={`${projects.length} local project${projects.length === 1 ? "" : "s"}`} icon={<Layers3 size={17}/>} tone="tone-blue"/>
        <MiniStat label="Active project" value={theme.name} icon={<Palette size={17}/>} tone="tone-purple"/>
        <MiniStat label="Available modes" value="Light & dark" icon={<Sun size={17}/>} tone="tone-amber"/>
        <button className="overview-stat-link" type="button" onClick={onOpenStudio}>Open workspace <ArrowUpRight size={15}/></button>
      </section>

      <section className="recent-section">
        <div className="section-heading"><div><span className="section-kicker">PICK UP WHERE YOU LEFT OFF</span><h2>Recent work</h2></div><button className="text-button text-button--quiet" type="button" onClick={onOpenStudio}>View all <ArrowRight size={14}/></button></div>
        <div className="recent-project-list">{projects.slice(0, 4).map((project) => <button className={`recent-project ${project.id === theme.id ? "recent-project--active" : ""}`} type="button" key={project.id} onClick={() => onOpenProject(project)}>
          <div className="recent-project__swatches"><i style={{ background: project.light.accent }}/><i style={{ background: project.light.secondary }}/><i style={{ background: project.light.background }}/><i style={{ background: project.light.text }}/></div>
          <div className="recent-project__info"><div className="recent-project__title">{project.name}{project.id === theme.id && <span className="local-badge"><span/> Active</span>}</div><p>{project.description}</p></div>
          <div className="recent-project__meta"><span><Clock3 size={14}/> Edited {formatTime(project.updatedAt)}</span><span>Light + dark</span></div>
          <ArrowRight size={17} className="recent-project__arrow"/>
        </button>)}</div>
      </section>

      <section className="starter-section">
        <div className="section-heading"><div><span className="section-kicker">START WITH A STRONG BASE</span><h2>Explore the starter library</h2><p>Curated starting points you can make your own.</p></div><button className="text-button text-button--quiet" type="button" onClick={onOpenMarketplace}>Browse all <ArrowRight size={14}/></button></div>
        <div className="starter-strip"><StarterCard item={featured} mode={mode} favorite={false} onToggleFavorite={() => {}} onPreview={() => onPreviewItem(featured)} onApply={() => onApply(featured)} compact/><StarterCard item={STARTER_DESIGNS[1]} mode={mode} favorite={false} onToggleFavorite={() => {}} onPreview={() => onPreviewItem(STARTER_DESIGNS[1])} onApply={() => onApply(STARTER_DESIGNS[1])} compact/><StarterCard item={STARTER_DESIGNS[2]} mode={mode} favorite={false} onToggleFavorite={() => {}} onPreview={() => onPreviewItem(STARTER_DESIGNS[2])} onApply={() => onApply(STARTER_DESIGNS[2])} compact/></div>
      </section>
    </div>
  );
}

function StudioView({
  theme,
  mode,
  onModeChange,
  onThemeChange,
  onUndo,
  canUndo,
  onExport,
  onExportFoundations,
  onExportPair,
  onDownloadCss,
  onImport,
  provider,
  model,
  baseUrl,
  apiKey,
  rememberApiKey,
  onGoSettings,
  onToast,
}: {
  theme: ThemeDraft;
  mode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
  onThemeChange: (updater: (draft: ThemeDraft) => ThemeDraft) => void;
  onUndo: () => void;
  canUndo: boolean;
  onExport: () => void;
  onExportFoundations: () => void;
  onExportPair: () => void;
  onDownloadCss: () => void;
  onImport: () => void;
  provider: Provider;
  model: string;
  baseUrl?: string;
  apiKey: string;
  rememberApiKey: boolean;
  onGoSettings: () => void;
  onToast: (message: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeInspector, setActiveInspector] = useState<"colors" | "style" | "tokens">("colors");
  const [activeTokenGroup, setActiveTokenGroup] = useState("Colors");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");
  const [showLargePreview, setShowLargePreview] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<PendingProposal | null>(null);
  const [previewingProposal, setPreviewingProposal] = useState(false);

  const applyPatch = (patch: Record<string, unknown>) => {
    onThemeChange((draft) => ({ ...themeWithProposal(draft, patch), updatedAt: Date.now() }));
  };

  const sendPrompt = async (event?: React.FormEvent, preset?: string) => {
    event?.preventDefault();
    const text = (preset ?? prompt).trim();
    if (!text || isGenerating) return;
    if (pendingProposal) {
      onToast("Apply or discard the current proposal before asking for another change");
      return;
    }
    const userMessage: ChatMessage = { id: createId(), role: "user", text };
    setMessages((items) => [...items, userMessage]);
    setPrompt("");
    if (!apiKey) {
      setMessages((items) => [...items, { id: createId(), role: "assistant", text: "Your request is ready. Add a provider key in Settings and I’ll turn it into a reviewable token proposal. You can still adjust palette colors, corner radius, and density manually right now." }]);
      onToast("Add a provider key to generate with the assistant");
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json", "x-provider-api-key": apiKey },
        body: JSON.stringify({ provider, model, ...(provider === "custom" ? { baseUrl } : {}), prompt: text, current: { name: theme.name, description: theme.description, light: theme.light, dark: theme.dark, radius: theme.radius, density: theme.density } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The generation request failed.");
      if (!data.patch || typeof data.patch !== "object") throw new Error("The provider returned a malformed token proposal.");
      const patch = data.patch as Record<string, unknown>;
      const summary = typeof patch.summary === "string" ? patch.summary : "I’ve prepared a token proposal. Review the changes below before applying them.";
      setPendingProposal({ patch, summary });
      setPreviewingProposal(false);
      setMessages((items) => [...items, { id: createId(), role: "assistant", text: "I’ve prepared a proposal. Review the changes below; nothing has been applied yet." }]);
      onToast("Review the proposed token changes before applying");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The provider request failed.";
      setMessages((items) => [...items, { id: createId(), role: "assistant", text: `${message} Your draft is unchanged.` }]);
      onToast("Could not generate a token proposal");
    } finally {
      setIsGenerating(false);
    }
  };

  const palette = theme[mode];
  const contrast = contrastRatio(palette.text, palette.background);
  const accessibilityPass = contrast !== null && contrast >= 4.5;
  const exampleTokens = [
    ["color/openui_accent", palette.accent, "Color"],
    ["color/openui_bg", palette.background, "Color"],
    ["color/openui_text_primary", palette.text, "Color"],
    ["radius/card", `${theme.radius} dp`, "Dimension"],
    ["space/card_pad", theme.density === "compact" ? "12 dp" : "16 dp", "Dimension"],
    ["type/body", "Fixed in template", "Typography"],
  ];
  const proposalTheme = pendingProposal ? themeWithProposal(theme, pendingProposal.patch) : theme;
  const proposalPaletteModes = pendingProposal ? (["light", "dark"] as const).filter((paletteMode) => {
    const value = pendingProposal.patch[paletteMode];
    return Boolean(value && typeof value === "object" && !Array.isArray(value) &&
      Object.values(value as Record<string, unknown>).some((color) => isHex(String(color))));
  }) : [];
  const proposalRows = pendingProposal ? Object.entries(pendingProposal.patch).flatMap(([key, value]) => {
    if (key === "summary") return [];
    if ((key === "light" || key === "dark") && value && typeof value === "object" && !Array.isArray(value)) {
      return Object.entries(value as Record<string, unknown>).map(([field, next]) => ({
        label: `${key}.${field}`,
        previous: theme[key as ThemeMode][field as keyof ThemePalette],
        next,
      }));
    }
    const previous = key === "radius" ? theme.radius : key === "density" ? theme.density : key === "name" ? theme.name : key === "description" ? theme.description : "—";
    return [{ label: key, previous, next: value }];
  }) : [];
  const proposalPreviewActive = Boolean(pendingProposal && previewingProposal);
  const displayedPreviewTheme = proposalPreviewActive ? proposalTheme : theme;

  return (
    <div className="page-stack studio-view">
      <div className="studio-heading">
        <div><div className="breadcrumb"><span>Workspace</span><ChevronRight size={13}/><span>Studio</span></div><div className="studio-title-row"><h1>{theme.name}</h1><span className="local-badge"><span/> Saved locally</span></div><p>Refine your tokens and see them applied to the sample website.</p></div>
        <div className="studio-toolbar"><button className="button button--subtle button--small" type="button" onClick={onImport}><Upload size={14}/> Import</button><button className="button button--subtle button--small" type="button" onClick={onUndo} disabled={!canUndo}><ArrowDownToLine size={14}/> Undo</button><div className="export-actions"><button className="button button--primary button--small" type="button" onClick={onExportPair}><Download size={14}/> Export pair</button><button className="export-more" type="button" aria-label="More export formats" aria-expanded={exportMenuOpen} onClick={() => setExportMenuOpen((open) => !open)}><ChevronDown size={14}/></button>{exportMenuOpen && <div className="export-menu" role="menu"><button type="button" role="menuitem" onClick={() => { onExport(); setExportMenuOpen(false); }}><FileText size={13}/> OpenUI 1.0 JSON</button><button type="button" role="menuitem" onClick={() => { onExportFoundations(); setExportMenuOpen(false); }}><Layers3 size={13}/> Foundations draft JSON</button><button type="button" role="menuitem" onClick={() => { onDownloadCss(); setExportMenuOpen(false); }}><Download size={13}/> CSS variables</button></div>}</div></div>
      </div>
      <div className="studio-grid">
        <section className="assistant-panel panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-icon panel-icon--purple"><Sparkles size={16}/></span><div><h2>Design assistant</h2><small>Token proposals · palettes, corner radius & density</small></div></div><button className="more-button" type="button" aria-label="More assistant options"><MoreHorizontal size={17}/></button></div>
          <div className="assistant-context"><span className="assistant-context__avatar"><Sparkles size={14}/></span><div><b>Working on {theme.name}</b><small>{apiKey ? `Key ready · ${PROVIDERS.find((item) => item.id === provider)?.name ?? provider}` : "Add a provider key in Settings"}</small></div><button type="button" onClick={onGoSettings} aria-label="Provider settings"><Settings size={14}/></button></div>
          <div className="chat-thread">
            {messages.map((message) => <div className={`chat-message chat-message--${message.role}`} key={message.id}>{message.role === "assistant" && <span className="chat-avatar"><Sparkles size={13}/></span>}<div className="chat-message__bubble">{message.text}</div></div>)}
            {isGenerating && <div className="chat-message chat-message--assistant"><span className="chat-avatar"><Sparkles size={13}/></span><div className="chat-message__bubble typing"><i/><i/><i/> Building a token proposal…</div></div>}
          </div>
          {pendingProposal && <div className="proposal-card">
            <div className="proposal-card__head"><span className="proposal-card__icon"><Sparkles size={13}/></span><div><b>Review token proposal</b><small>{proposalRows.length} proposed change{proposalRows.length === 1 ? "" : "s"} · draft unchanged</small></div></div>
            <p>{pendingProposal.summary}</p>
            {proposalPaletteModes.length > 0 && <div className="proposal-palette-preview">
              <div className="proposal-palette-preview__heading"><b>Proposed palette</b><span>Resulting colors by mode</span></div>
              {proposalPaletteModes.map((paletteMode) => <div className="proposal-palette-preview__mode" key={paletteMode}>
                <b>{paletteMode === "light" ? "Light mode" : "Dark mode"}</b>
                <div className="proposal-palette-preview__roles">{PROPOSAL_PALETTE_ROLES.map(({ key, label }) => <div className="proposal-palette-preview__role" key={key}>
                  <span>{label}</span><i style={{ backgroundColor: proposalTheme[paletteMode][key] }} title={`${paletteMode} ${label}: ${proposalTheme[paletteMode][key]}`}/>
                </div>)}</div>
              </div>)}
            </div>}
            <div className="proposal-diff__heading"><b>Change details</b><span>{proposalRows.length > 5 ? "Scroll for all · Current → proposed" : "Current → proposed"}</span></div>
            <div className="proposal-diff" aria-label="All proposed token changes">{proposalRows.map((row) => <div className="proposal-diff__row" key={row.label}>
              <span title={row.label}>{row.label}</span><div>
                <span className="proposal-value">{isHex(String(row.previous)) && <i style={{ backgroundColor: String(row.previous) }} title={`Current ${row.label}: ${String(row.previous)}`}/>}<code>{String(row.previous)}</code></span>
                <ArrowRight size={11}/>
                <span className="proposal-value proposal-value--next">{isHex(String(row.next)) && <i style={{ backgroundColor: String(row.next) }} title={`Proposed ${row.label}: ${String(row.next)}`}/>}<code>{String(row.next)}</code></span>
              </div>
            </div>)}</div>
            <button type="button" className="proposal-preview-toggle" aria-pressed={previewingProposal} onClick={() => setPreviewingProposal((current) => !current)}>{previewingProposal ? <EyeOff size={13}/> : <Eye size={13}/>}<span>{previewingProposal ? "Exit proposal preview" : "Preview on sample website"}</span><small>Draft stays unchanged</small></button>
            <div className="proposal-actions"><button type="button" className="button button--subtle button--small" onClick={() => { setPendingProposal(null); setPreviewingProposal(false); onToast("Proposal discarded; your draft is unchanged"); }}>Discard</button><button type="button" className="button button--primary button--small" onClick={() => { applyPatch(pendingProposal.patch); setPendingProposal(null); setPreviewingProposal(false); onToast("Approved proposal applied to your local draft"); }}><Check size={13}/> Apply changes</button></div>
          </div>}
          <div className="suggestion-block"><span className="suggestion-label">QUICK START</span><button type="button" className="suggestion-chip" onClick={() => { setPrompt("Create a warmer, more welcoming palette while keeping the text easy to read."); }}>Warm it up <ArrowUpRight size={12}/></button><button type="button" className="suggestion-chip" onClick={() => { setPrompt("Make the interface more compact for a data-heavy desktop dashboard."); }}>More compact <ArrowUpRight size={12}/></button><button type="button" className="suggestion-chip" onClick={() => { setPrompt("Give this system a confident, premium dark mode with a softer accent."); }}>Refine dark mode <ArrowUpRight size={12}/></button></div>
          <form className="chat-composer" onSubmit={(event) => sendPrompt(event)}><textarea id="assistant-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={apiKey ? "Describe a change for your design system…" : "Add a provider key in Settings to chat…"} rows={3} aria-label="Describe a design change"/><div className="chat-composer__footer"><span><span className={apiKey ? "connection-dot connection-dot--on" : "connection-dot"}/>{apiKey ? "Provider key ready for this session" : "No AI key connected"}</span><button type="submit" className="send-button" disabled={!prompt.trim() || isGenerating} aria-label="Send prompt"><span>Send</span><Send size={14}/></button></div></form>
          <p className="assistant-footnote"><ShieldCheck size={12}/> {rememberApiKey ? "Key is remembered in this browser by your choice and sent only with prompts." : "Key stays in memory and is sent only when you submit a prompt."}</p>
        </section>

        <section className="preview-panel panel">
          <div className="panel-header preview-panel__header"><div className="panel-title"><span className="panel-icon panel-icon--blue"><Eye size={16}/></span><div><h2>Sample website</h2><small>{proposalPreviewActive ? "Proposal preview · draft unchanged" : "Live preview · tokens update as you edit"}</small></div></div><div className="preview-controls"><div className="mode-toggle" role="group" aria-label="Preview mode"><button type="button" className={mode === "light" ? "is-active" : ""} onClick={() => onModeChange("light")} aria-label="Light preview"><Sun size={14}/></button><button type="button" className={mode === "dark" ? "is-active" : ""} onClick={() => onModeChange("dark")} aria-label="Dark preview"><Moon size={14}/></button></div><label className="preview-width"><PanelLeft size={14}/><select value={viewport} onChange={(event) => setViewport(event.target.value as PreviewViewport)} aria-label="Sample website viewport"><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option></select><ChevronDown size={12}/></label><IconButton label="Open preview in larger view" onClick={() => setShowLargePreview(true)}><ArrowUpRight size={15}/></IconButton></div></div>
          <div className={`preview-stage preview-stage--${viewport}`}><div className="preview-stage__top">{proposalPreviewActive ? <span className="preview-stage__proposal-label"><Sparkles size={10}/> PROPOSAL PREVIEW · NOT APPLIED</span> : <span><i/> NORTHSTAR / WORKSPACE</span>}<span className="preview-stage__zoom">{viewport === "desktop" ? "1440 px" : viewport === "tablet" ? "768 px" : "390 px"}</span></div><SampleWebsite theme={displayedPreviewTheme} mode={mode} viewport={viewport}/></div>
          <div className="preview-panel__footer"><span><span className={`live-indicator ${proposalPreviewActive ? "live-indicator--proposal" : ""}`}/>{proposalPreviewActive ? "Unapplied proposal" : "Live theme preview"}</span><span>Built-in dashboard template <span className="footer-dot">·</span> {viewport === "desktop" ? "1440 px" : viewport === "tablet" ? "768 px" : "390 px"}</span></div>
        </section>

        <section className="inspector-panel panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-icon panel-icon--amber"><SlidersHorizontal size={15}/></span><div><h2>Theme controls</h2><small>Adjust your foundation</small></div></div><button className="more-button" type="button" aria-label="More theme controls"><MoreHorizontal size={17}/></button></div>
          <div className="inspector-tabs" role="tablist"><button type="button" role="tab" className={activeInspector === "colors" ? "is-active" : ""} onClick={() => setActiveInspector("colors")}>Colors</button><button type="button" role="tab" className={activeInspector === "style" ? "is-active" : ""} onClick={() => setActiveInspector("style")}>Style</button><button type="button" role="tab" className={activeInspector === "tokens" ? "is-active" : ""} onClick={() => setActiveInspector("tokens")}>Tokens</button></div>
          {activeInspector === "colors" && <div className="inspector-body"><div className="inspector-subheading"><div><b>{mode === "light" ? "Light palette" : "Dark palette"}</b><small>Editing {mode} mode</small></div><span className="color-pair-count">7 roles</span></div><div className="color-fields">{COLOR_FIELDS.map((field) => <ColorInput key={field.key} label={field.label} description={field.description} value={palette[field.key]} onChange={(value) => onThemeChange((draft) => ({ ...draft, [mode]: { ...draft[mode], [field.key]: value }, updatedAt: Date.now() }))}/>)}</div><button className="mode-switch-link" type="button" onClick={() => onModeChange(mode === "light" ? "dark" : "light")}>Edit {mode === "light" ? "dark" : "light"} palette <ArrowRight size={13}/></button><div className={`contrast-card ${accessibilityPass ? "contrast-card--pass" : "contrast-card--warn"}`}><span className="contrast-card__icon"><ShieldCheck size={15}/></span><div><b>{accessibilityPass ? "Text contrast looks good" : "Check text contrast"}</b><small>{contrast ? `${contrast}:1 · body text on canvas` : "Contrast could not be measured"}</small></div><span className="contrast-badge">{accessibilityPass ? "AA" : "REVIEW"}</span></div></div>}
          {activeInspector === "style" && <div className="inspector-body"><div className="inspector-subheading"><div><b>Shape & density</b><small>Set the overall feel</small></div></div><div className="control-group"><div className="control-label-row"><label htmlFor="radius-range">Corner radius</label><span>{theme.radius} dp</span></div><input id="radius-range" className="range-control" type="range" min="0" max="24" value={theme.radius} onChange={(event) => onThemeChange((draft) => ({ ...draft, radius: Number(event.target.value), updatedAt: Date.now() }))}/><div className="range-ends"><span>Sharp</span><span>Soft</span></div></div><div className="control-group"><div className="control-label-row"><span>Density</span></div><div className="density-choices"><button type="button" className={theme.density === "comfortable" ? "is-selected" : ""} onClick={() => onThemeChange((draft) => ({ ...draft, density: "comfortable", updatedAt: Date.now() }))}><span className="density-icon density-icon--comfortable"><i/><i/><i/></span><b>Comfortable</b><small>More breathing room</small></button><button type="button" className={theme.density === "compact" ? "is-selected" : ""} onClick={() => onThemeChange((draft) => ({ ...draft, density: "compact", updatedAt: Date.now() }))}><span className="density-icon density-icon--compact"><i/><i/><i/></span><b>Compact</b><small>More on screen</small></button></div></div><div className="foundations-note"><span className="foundations-note__icon"><Layers3 size={14}/></span><div><b>Built on a token system</b><p>Palette, radius, and density update this template; typography and component-specific styling remain fixed.</p></div></div></div>}
          {activeInspector === "tokens" && <div className="inspector-body token-explorer"><div className="inspector-subheading"><div><b>Token explorer</b><small>Example tokens · {exampleTokens.length} shown</small></div><button className="filter-small" type="button"><Filter size={13}/></button></div><div className="token-group-list"><button type="button" className={activeTokenGroup === "Colors" ? "is-open" : ""} onClick={() => setActiveTokenGroup(activeTokenGroup === "Colors" ? "" : "Colors")}><ChevronDown size={13}/> Colors <span>3</span></button>{activeTokenGroup === "Colors" && exampleTokens.slice(0, 3).map(([name, value, type]) => <div className="token-row" key={name}><span className="token-color-dot" style={{ background: value.startsWith("#") ? value : "transparent" }}/><span><b>{name}</b><small>{type}</small></span><code>{value}</code></div>)}<button type="button" className={activeTokenGroup === "Dimensions" ? "is-open" : ""} onClick={() => setActiveTokenGroup(activeTokenGroup === "Dimensions" ? "" : "Dimensions")}><ChevronDown size={13}/> Dimensions <span>2</span></button>{activeTokenGroup === "Dimensions" && exampleTokens.slice(3, 5).map(([name, value, type]) => <div className="token-row" key={name}><span className="token-dimension-icon">↔</span><span><b>{name}</b><small>{type}</small></span><code>{value}</code></div>)}<button type="button" className={activeTokenGroup === "Typography" ? "is-open" : ""} onClick={() => setActiveTokenGroup(activeTokenGroup === "Typography" ? "" : "Typography")}><ChevronDown size={13}/> Typography <span>1</span></button>{activeTokenGroup === "Typography" && exampleTokens.slice(5).map(([name, value, type]) => <div className="token-row" key={name}><span className="token-type-icon">Aa</span><span><b>{name}</b><small>{type}</small></span><code>{value}</code></div>)}</div><div className="token-footer"><span>Schema</span><b>openui-1.0</b><span className="schema-dot"/></div></div>}
          <div className="inspector-bottom"><button type="button" className="text-button" onClick={onExport}><Download size={14}/> Export this theme</button><span>Changes save to this browser</span></div>
        </section>
      </div>
      {showLargePreview && <div className="modal-backdrop" onClick={() => setShowLargePreview(false)}><section className="preview-modal" role="dialog" aria-modal="true" aria-label="Sample website preview" onClick={(event) => event.stopPropagation()}><div className="preview-modal__head"><div><span className="section-kicker">{proposalPreviewActive ? "PROPOSAL PREVIEW · NOT APPLIED" : `LIVE TOKEN PREVIEW · ${viewport.toUpperCase()}`}</span><h2>{displayedPreviewTheme.name}</h2><p>{proposalPreviewActive ? "This temporary preview leaves your draft unchanged." : "Changes in the editor are reflected here immediately."}</p></div><IconButton label="Close preview" onClick={() => setShowLargePreview(false)}><X size={17}/></IconButton></div><div className="preview-modal__toolbar"><span>{mode === "light" ? "Light mode" : "Dark mode"} <span>·</span> {viewport} viewport</span><div className="mode-toggle" role="group" aria-label="Preview mode"><button type="button" className={mode === "light" ? "is-active" : ""} onClick={() => onModeChange("light")} aria-label="Light preview"><Sun size={13}/></button><button type="button" className={mode === "dark" ? "is-active" : ""} onClick={() => onModeChange("dark")} aria-label="Dark preview"><Moon size={13}/></button></div></div><div className="preview-modal__stage"><SampleWebsite theme={displayedPreviewTheme} mode={mode} viewport={viewport}/></div><div className="preview-modal__footer"><span>Built-in SaaS dashboard template · {viewport === "desktop" ? "1440 px" : viewport === "tablet" ? "768 px" : "390 px"}</span><button type="button" className="button button--subtle" onClick={() => setShowLargePreview(false)}>Close preview</button></div></section></div>}
    </div>
  );
}

function MarketplaceView({
  mode,
  favorites,
  onToggleFavorite,
  onApply,
  onPreview,
}: {
  mode: ThemeMode;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onApply: (item: StarterDesign) => void;
  onPreview: (item: StarterDesign) => void;
}) {
  const [search, setSearch] = useState("");
  const [collection, setCollection] = useState("All designs");
  const [sort, setSort] = useState("Featured");
  const collections = ["All designs", "Desktop", "Productivity", "Editorial", "Dark-first", "Minimal"];
  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    let items = STARTER_DESIGNS.filter((item) => collection === "All designs" || item.collection === collection);
    if (query) items = items.filter((item) => `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase().includes(query));
    if (sort === "Name A–Z") items = [...items].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "Recently added") items = [...items].reverse();
    return items;
  }, [collection, search, sort]);
  return (
    <div className="page-stack marketplace-view">
      <section className="market-hero"><div className="market-hero__copy"><div className="eyebrow-label"><span className="eyebrow-line"/> DESIGN SYSTEM LIBRARY</div><h1>Find a foundation<br/>for your <em>next idea.</em></h1><p>Browse ready-to-remix design systems. Preview each one on the sample website, then bring its tokens into your workspace.</p><div className="market-hero__foot"><span><span className="market-live-dot"/> Starter library is available now</span><span>Community publishing is coming later</span></div></div><div className="market-hero__art"><div className="market-orbit market-orbit--one"/><div className="market-orbit market-orbit--two"/><div className="market-stack market-stack--back"><i/><i/><i/></div><div className="market-stack market-stack--front"><span/><span/><b/><i/><i/><i/><small/></div><div className="market-spark market-spark--one">✦</div><div className="market-spark market-spark--two">✦</div></div></section>
      <section className="market-controls"><div className="market-tabs"><button className="is-active" type="button"><Sparkles size={14}/> Starter library <span>{STARTER_DESIGNS.length}</span></button><button type="button" className="market-community-tab" onClick={() => window.dispatchEvent(new CustomEvent("forma:community-info"))}><Layers3 size={14}/> Community designs <span className="coming-pill">Coming soon</span></button></div><div className="market-tools"><label className="search-field"><Search size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search systems…"/><kbd>⌘ K</kbd></label><label className="sort-select"><SlidersHorizontal size={14}/><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort designs"><option>Featured</option><option>Name A–Z</option><option>Recently added</option></select><ChevronDown size={13}/></label></div></section>
      <div className="market-body"><aside className="market-filters"><div className="filter-heading">COLLECTIONS <button type="button" aria-label="Clear collection filter" onClick={() => setCollection("All designs")}><Filter size={13}/></button></div>{collections.map((name, index) => <button key={name} type="button" className={`filter-option ${collection === name ? "is-active" : ""}`} onClick={() => setCollection(name)}>{index === 0 ? <Layers3 size={15}/> : <span className={`filter-dot filter-dot--${index}`}/>}<span>{name}</span><small>{index === 0 ? STARTER_DESIGNS.length : STARTER_DESIGNS.filter((item) => item.collection === name).length}</small></button>)}<div className="filter-promo"><span><Sparkles size={15}/></span><b>Make it yours</b><p>Every starter is editable. Change the palette, shape, or density in one click.</p><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("forma:create"))}>Start creating <ArrowRight size={13}/></button></div></aside><section className="market-results"><div className="market-results__heading"><div><span>{filtered.length} STARTER SYSTEMS</span><h2>{collection === "All designs" ? "Curated foundations" : collection}</h2></div></div>
        {filtered.length ? <div className="market-grid">{filtered.map((item) => <StarterCard key={item.id} item={item} mode={mode} favorite={favorites.includes(item.id)} onToggleFavorite={() => onToggleFavorite(item.id)} onPreview={() => onPreview(item)} onApply={() => onApply(item)}/>)}</div> : <div className="empty-state"><span><Search size={22}/></span><h3>No matching designs</h3><p>Try a different search or collection.</p><button className="button button--subtle" type="button" onClick={() => { setSearch(""); setCollection("All designs"); }}>Clear filters</button></div>}
        <div className="market-note"><span><ShieldCheck size={14}/></span><p><b>Community marketplace, coming next.</b> These are Forma starter designs. We’ll add community publishing after a moderation and storage path is in place—no one’s private draft is shared.</p><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("forma:community-info"))}>How it works <ArrowRight size={13}/></button></div>
      </section></div>
    </div>
  );
}

function SettingsView({
  provider,
  model,
  baseUrl,
  apiKey,
  onProviderChange,
  onModelChange,
  onBaseUrlChange,
  onApiKeyChange,
  onClear,
  onExportPair,
  onToast,
  onStartChat,
  rememberApiKey,
  onRememberApiKeyChange,
  theme,
}: {
  provider: Provider;
  model: string;
  baseUrl?: string;
  apiKey: string;
  onProviderChange: (provider: Provider) => void;
  onModelChange: (model: string) => void;
  onBaseUrlChange: (baseUrl: string) => void;
  onApiKeyChange: (key: string) => void;
  onClear: () => void;
  onExportPair: () => void;
  onToast: (message: string) => void;
  onStartChat: () => void;
  rememberApiKey: boolean;
  onRememberApiKeyChange: (remember: boolean) => void;
  theme: ThemeDraft;
}) {
  const [visibleKey, setVisibleKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"connected" | "error" | "idle">("idle");
  const [confirmClear, setConfirmClear] = useState(false);
  const selectedProvider = PROVIDERS.find((item) => item.id === provider) ?? PROVIDERS[0];

  const testConnection = async () => {
    if (provider === "custom" && !baseUrl?.trim()) {
      onToast("Enter your provider’s HTTPS API base URL first");
      return;
    }
    if (!apiKey.trim()) {
      onToast("Enter your provider key first");
      return;
    }
    setTesting(true);
    setTestStatus("idle");
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json", "x-provider-api-key": apiKey },
        body: JSON.stringify({
          provider,
          model,
          ...(provider === "custom" ? { baseUrl } : {}),
          prompt: "Connection check: return a tiny JSON patch with name set to the existing name, radius set to the current radius, density set to the current density, and summary set to 'Provider connection successful'. Do not change the palettes.",
          current: { name: theme.name, radius: theme.radius, density: theme.density, light: theme.light, dark: theme.dark },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Connection test failed.");
      setTestStatus("connected");
      onToast(`Connected to ${selectedProvider.name}`);
    } catch (error) {
      setTestStatus("error");
      onToast(error instanceof Error ? error.message : "Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="page-stack settings-view">
      <div className="settings-heading"><div><div className="breadcrumb"><span>Workspace</span><ChevronRight size={13}/><span>Settings</span></div><h1>Settings</h1><p>Set up your model provider and manage what stays on this device.</p></div></div>
      <div className="settings-layout"><aside className="settings-nav"><span>YOUR WORKSPACE</span><button type="button" className="is-active"><Sparkles size={15}/> AI provider</button><button type="button" onClick={() => document.getElementById("local-data")?.scrollIntoView({ behavior: "smooth", block: "center" })}><HardDriveIcon/> Local data</button><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("forma:toggle-app-mode"))}><Sun size={15}/> Appearance</button><span className="settings-nav__footer">No account · Local-first</span></aside>
        <div className="settings-content">
          <section className="settings-card"><div className="settings-card__head"><div><div className="settings-card__icon settings-card__icon--purple"><Sparkles size={17}/></div><div><h2>AI provider</h2><p>Bring your own key. Forma forwards it only for the request you make.</p></div></div><span className={`settings-status ${testStatus === "connected" ? "settings-status--ok" : testStatus === "error" ? "settings-status--error" : ""}`}><i/>{testStatus === "connected" ? "Connected" : testStatus === "error" ? "Check connection" : apiKey ? "Key ready" : "Not connected"}</span></div>
            <div className="provider-grid">{PROVIDERS.map((option) => <button type="button" key={option.id} className={`provider-option ${provider === option.id ? "is-selected" : ""}`} onClick={() => { onProviderChange(option.id); onModelChange(option.sampleModel); setTestStatus("idle"); }}><span className={`provider-logo provider-logo--${option.id}`}>{option.icon}</span><span><b>{option.name}</b><small>{option.detail}</small></span>{provider === option.id && <CheckCircle2 size={16} className="provider-check"/>}</button>)}</div>
            <div className={`settings-form-grid ${provider === "custom" ? "settings-form-grid--custom" : ""}`}>{provider === "custom" && <label className="settings-field"><span>OpenAI-compatible API base URL</span><input value={baseUrl ?? ""} onChange={(event) => { onBaseUrlChange(event.target.value); setTestStatus("idle"); }} placeholder="https://api.example.com/v1" autoComplete="url" spellCheck={false}/><small>HTTPS endpoint only. Private network and local addresses are blocked by the proxy.</small></label>}<label className="settings-field"><span>Model ID</span><input value={model} onChange={(event) => { onModelChange(event.target.value); setTestStatus("idle"); }} placeholder={selectedProvider.sampleModel || "your-model-id"}/><small>Use a model ID enabled for your provider account.</small></label><label className="settings-field"><span>API key</span><div className="secret-input"><input type={visibleKey ? "text" : "password"} value={apiKey} onChange={(event) => { onApiKeyChange(event.target.value); setTestStatus("idle"); }} placeholder={`Paste your ${selectedProvider.name} key`} autoComplete="off" spellCheck={false}/><button type="button" onClick={() => setVisibleKey((value) => !value)} aria-label={visibleKey ? "Hide API key" : "Show API key"}>{visibleKey ? <EyeOff size={15}/> : <Eye size={15}/>}</button></div><small>By default, the key stays in this tab only. Remembering it is optional.</small></label></div>
            <label className="remember-key-option"><input type="checkbox" checked={rememberApiKey} onChange={(event) => onRememberApiKeyChange(event.target.checked)}/><span><b>Remember provider key on this device</b><small>{rememberApiKey ? "Saved in this browser’s IndexedDB; not encrypted by Forma. Avoid shared devices." : "Optional. Saves to browser storage without encryption; use only on a private device."}</small></span></label>
            <div className="settings-card__actions settings-card__actions--provider"><div className="settings-provider-actions"><button type="button" className="button button--primary" onClick={onStartChat} disabled={!apiKey.trim() || !model.trim() || (provider === "custom" && !baseUrl?.trim())}><MessageCircle size={15}/> Chat with Forma <ArrowRight size={14}/></button><button type="button" className="button button--subtle" onClick={testConnection} disabled={!apiKey.trim() || testing || !model.trim() || (provider === "custom" && !baseUrl?.trim())}>{testing ? <span className="button-spinner"/> : testStatus === "connected" ? <Check size={15}/> : <Zap size={15}/>} {testing ? "Testing provider…" : testStatus === "connected" ? "Connection verified" : "Test connection"}</button></div><span><ShieldCheck size={13}/> Testing is optional. Your key is used when you send a prompt.</span></div>
            <div className="privacy-callout"><span><ShieldCheck size={16}/></span><div><b>{rememberApiKey ? "Saved locally by your choice." : "Kept in this tab by default."}</b><p>{rememberApiKey ? "Your key is saved in this browser’s IndexedDB and is not encrypted by Forma. Avoid shared devices; turn this option off or clear local data to remove it." : "Your key stays in page memory and is cleared when you close or refresh this tab."} When you chat, your brief and current theme are sent to your selected provider; Forma does not retain the key on its server.</p></div></div>
          </section>
          <section className="settings-card" id="local-data"><div className="settings-card__head"><div><div className="settings-card__icon settings-card__icon--blue"><HardDriveIcon/></div><div><h2>Local data</h2><p>Projects, saved designs, and an optional remembered provider key stay in this browser, not an account.</p></div></div><span className="local-only-pill"><span/> On this device</span></div><div className="storage-row"><div className="storage-row__glyph"><FileText size={18}/></div><div><b>Design system drafts</b><small>Saved automatically in browser storage</small></div><span className="storage-row__value">Private to this browser</span></div><div className="storage-row"><div className="storage-row__glyph storage-row__glyph--yellow"><Bookmark size={18}/></div><div><b>Saved starter designs</b><small>Favorites are stored locally</small></div><span className="storage-row__value">No login needed</span></div><div className="settings-warning"><CircleHelp size={15}/><span>Browser storage may be cleared. Clear local data also removes a remembered provider key. Paired ZIP backups contain theme files only, never API keys.</span></div><div className="settings-card__actions settings-card__actions--between"><button type="button" className="button button--subtle" onClick={onExportPair}><Download size={14}/> Download paired backup ZIP</button>{confirmClear ? <div className="confirm-inline"><span>Clear drafts, favorites, and remembered provider key?</span><button type="button" onClick={onClear}>Yes, clear</button><button type="button" onClick={() => setConfirmClear(false)}>Cancel</button></div> : <button type="button" className="button button--danger-ghost" onClick={() => setConfirmClear(true)}>Clear local data</button>}</div></section>
          <section className="settings-card settings-card--market"><div className="settings-card__head"><div><div className="settings-card__icon settings-card__icon--amber"><Layers3 size={17}/></div><div><h2>Community marketplace</h2><p>Public designs will be opt-in and moderated. Private drafts stay local.</p></div></div><span className="coming-pill">Planned</span></div><div className="marketplace-settings-row"><span className="marketplace-settings-row__icon"><ShieldCheck size={17}/></span><div><b>Nothing is published automatically</b><small>When community publishing is added, you’ll explicitly choose what to share.</small></div><button type="button" onClick={() => onToast("The first build uses a curated local starter library.")}>Details <ArrowRight size={13}/></button></div></section>
        </div>
      </div>
    </div>
  );
}

function HardDriveIcon() {
  return <span className="harddrive-glyph"><i/><i/></span>;
}

export default function HomePage() {
  const [view, setView] = useState<View>("overview");
  const [theme, setTheme] = useState<ThemeDraft>(STARTER_THEME);
  const [projects, setProjects] = useState<ThemeDraft[]>([]);
  const [previewMode, setPreviewMode] = useState<ThemeMode>("light");
  const [appMode, setAppMode] = useState<AppMode>("light");
  const [history, setHistory] = useState<ThemeDraft[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({ provider: "openai", model: "gpt-4o-mini", baseUrl: "" });
  const [apiKey, setApiKey] = useState("");
  const [rememberApiKey, setRememberApiKey] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [toast, setToast] = useState("");
  const [previewItem, setPreviewItem] = useState<StarterDesign | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [importInputKey, setImportInputKey] = useState(0);
  const [showCommunityInfo, setShowCommunityInfo] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyPersistence = useRef<Promise<void>>(Promise.resolve());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }, []);

  const persistProviderKey = useCallback((value: string | null) => {
    const operation = keyPersistence.current.catch(() => undefined).then(() => (
      value ? writeLocal("provider-key", { provider: providerConfig.provider, key: value }) : removeLocal("provider-key")
    ));
    keyPersistence.current = operation.catch(() => undefined);
    return operation;
  }, [providerConfig.provider]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      readLocal<ThemeDraft[]>("projects").catch(() => null),
      readLocal<ThemeDraft>("active-draft").catch(() => null),
      readLocal<string[]>("favorites").catch(() => null),
      readLocal<ProviderConfig>("provider-config").catch(() => null),
      readLocal<RememberedProviderKey>("provider-key").catch(() => null),
      readLocal<AppMode>("app-mode").catch(() => null),
    ]).then(([savedProjects, savedTheme, savedFavorites, savedProvider, savedApiKey, savedMode]) => {
      if (!alive) return;
      let restoredProjects = Array.isArray(savedProjects) ? savedProjects.filter(safeTheme) : safeTheme(savedTheme) ? [savedTheme] : [];
      if (!Array.isArray(savedProjects) && !safeTheme(savedTheme)) restoredProjects = [{ ...STARTER_THEME }];
      if (safeTheme(savedTheme) && (!Array.isArray(savedProjects) || restoredProjects.some((item) => item.id === savedTheme.id))) {
        restoredProjects = upsertDraft(restoredProjects, savedTheme);
      }
      const active = safeTheme(savedTheme) && restoredProjects.some((item) => item.id === savedTheme.id)
        ? restoredProjects.find((item) => item.id === savedTheme.id)!
        : restoredProjects[0] ?? { ...STARTER_THEME };
      setProjects(restoredProjects);
      setTheme(active);
      if (Array.isArray(savedFavorites)) setFavorites(savedFavorites.filter((item) => typeof item === "string"));
      const restoredProvider = savedProvider && PROVIDERS.some((item) => item.id === savedProvider.provider)
        ? savedProvider.provider
        : "openai";
      setProviderConfig({
        provider: restoredProvider,
        model: savedProvider && typeof savedProvider.model === "string" ? savedProvider.model : "gpt-4o-mini",
        baseUrl: savedProvider && typeof savedProvider.baseUrl === "string" ? savedProvider.baseUrl : "",
      });
      if (savedApiKey && savedApiKey.provider === restoredProvider && typeof savedApiKey.key === "string" && savedApiKey.key.trim() && savedApiKey.key.length <= 500) {
        setApiKey(savedApiKey.key.trim());
        setRememberApiKey(true);
      } else if (savedApiKey) {
        removeLocal("provider-key").catch(() => undefined);
      }
      if (savedMode === "dark" || savedMode === "light") setAppMode(savedMode);
      setIsLoaded(true);
    });
    return () => { alive = false; if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    writeLocal("active-draft", theme).catch(() => notify("Could not save locally. Export a backup to keep your work."));
  }, [theme, isLoaded, notify]);

  useEffect(() => {
    if (!isLoaded) return;
    writeLocal("projects", projects).catch(() => notify("Could not save your project list. Export a backup to keep your work."));
  }, [projects, isLoaded, notify]);

  useEffect(() => {
    if (isLoaded) writeLocal("favorites", favorites).catch(() => undefined);
  }, [favorites, isLoaded]);

  useEffect(() => {
    if (isLoaded) writeLocal("provider-config", safeProviderSettings(providerConfig)).catch(() => undefined);
  }, [providerConfig, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !rememberApiKey) return;
    const key = apiKey.trim();
    const timeout = window.setTimeout(() => {
      persistProviderKey(key || null).catch(() => notify("Could not remember your provider key. It will be lost when you close or refresh this tab."));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [apiKey, rememberApiKey, isLoaded, notify, persistProviderKey]);

  useEffect(() => {
    if (isLoaded) writeLocal("app-mode", appMode).catch(() => undefined);
  }, [appMode, isLoaded]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setView("marketplace");
        setMobileMenu(false);
        setTimeout(() => document.querySelector<HTMLInputElement>(".search-field input")?.focus(), 80);
      }
      if (event.key === "Escape") {
        setMobileMenu(false);
        setPreviewItem(null);
        setShowCommunityInfo(false);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const create = () => createNewSystem();
    const toastListener = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      if (typeof message === "string") notify(message);
    };
    const community = () => setShowCommunityInfo(true);
    const toggleMode = () => setAppMode((current) => current === "light" ? "dark" : "light");
    window.addEventListener("forma:create", create);
    window.addEventListener("forma:toast", toastListener);
    window.addEventListener("forma:community-info", community);
    window.addEventListener("forma:toggle-app-mode", toggleMode);
    return () => {
      window.removeEventListener("forma:create", create);
      window.removeEventListener("forma:toast", toastListener);
      window.removeEventListener("forma:community-info", community);
      window.removeEventListener("forma:toggle-app-mode", toggleMode);
    };
  });

  const updateTheme = useCallback((updater: (draft: ThemeDraft) => ThemeDraft) => {
    const current = theme;
    const next = { ...updater(current), updatedAt: Date.now() };
    setHistory((previous) => [...previous, current].slice(-30));
    setTheme(next);
    setProjects((previous) => upsertDraft(previous, next));
  }, [theme]);

  const undo = () => {
    if (!history.length) return;
    const restored = { ...history[history.length - 1], updatedAt: Date.now() };
    setTheme(restored);
    setProjects((previous) => upsertDraft(previous, restored));
    setHistory((previous) => previous.slice(0, -1));
    notify("Last change undone");
  };

  const createNewSystem = () => {
    updateTheme(() => ({
      ...STARTER_THEME,
      id: createId(),
      name: "Untitled design system",
      description: "A new design system, ready for your direction.",
      author: "You",
      light: { ...STARTER_THEME.light },
      dark: { ...STARTER_THEME.dark },
      updatedAt: Date.now(),
    }));
    setPreviewMode("light");
    setView("studio");
    setMobileMenu(false);
    notify("New local design system created");
  };

  const applyStarter = (item: StarterDesign) => {
    updateTheme(() => ({ ...item.theme, id: createId(), author: "You", updatedAt: Date.now() }));
    setPreviewMode("light");
    setPreviewItem(null);
    setView("studio");
    notify(`${item.title} copied into your local workspace`);
  };

  const toggleFavorite = (id: string) => {
    setFavorites((items) => items.includes(id) ? items.filter((value) => value !== id) : [...items, id]);
    notify(favorites.includes(id) ? "Removed from saved designs" : "Saved to your local favorites");
  };

  const getSafeName = () => theme.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "design-system";
  const getExportNames = () => {
    const safeName = getSafeName();
    return {
      safeName,
      uiFilename: `${safeName}-openui-1.0.json`,
      foundationsFilename: `${safeName}-openui-foundations-draft.json`,
    };
  };

  const exportJson = () => {
    const { uiFilename } = getExportNames();
    downloadBlob(uiFilename, JSON.stringify(toOpenUiDocument(theme), null, 2), "application/json");
    notify("OpenUI 1.0 JSON downloaded");
  };

  const exportFoundations = () => {
    const { uiFilename, foundationsFilename } = getExportNames();
    downloadBlob(foundationsFilename, JSON.stringify(toFoundationsDocument(theme, uiFilename), null, 2), "application/json");
    notify("Foundations draft JSON downloaded");
  };

  const exportPair = () => {
    const { safeName, uiFilename, foundationsFilename } = getExportNames();
    const uiDocument = toOpenUiDocument(theme);
    const foundationsDocument = toFoundationsDocument(theme, uiFilename);
    downloadZip(`${safeName}-openui-pair.zip`, {
      [uiFilename]: JSON.stringify(uiDocument, null, 2),
      [foundationsFilename]: JSON.stringify(foundationsDocument, null, 2),
    });
    notify("Paired OpenUI 1.0 and foundations JSON downloaded");
  };

  const exportCss = () => {
    downloadBlob(`${getSafeName()}-tokens.css`, toCssFile(theme), "text/css");
    notify("CSS variables downloaded");
  };

  const openImport = () => {
    setImportInputKey((value) => value + 1);
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const importJson = async (selectedFiles?: FileList | File[]) => {
    const files = Array.from(selectedFiles ?? []);
    if (!files.length) return;
    if (files.length > 2) {
      notify("Choose one OpenUI file or a pair of files.");
      return;
    }
    if (files.some((file) => file.size > 2_000_000)) {
      notify("Each JSON file must be smaller than 2 MB.");
      return;
    }

    try {
      const imported = await Promise.all(files.map(async (file) => {
        const parsed: unknown = JSON.parse(await file.text());
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${file.name} is not a JSON object.`);
        return { file, document: parsed as Record<string, unknown> };
      }));
      const uiEntry = imported.find(({ document }) => document.specVersion === uiJson.specVersion);
      const foundationsEntry = imported.find(({ document }) => document.specVersion === foundationsJson.specVersion);
      if (!uiEntry && !foundationsEntry) {
        throw new Error("Unsupported JSON contract. Forma imports openui-1.0 and openui-foundations-draft files.");
      }
      if (uiEntry && !uiEntry.document.openuiTheme) throw new Error("This openui-1.0 file is missing openuiTheme.");
      if (foundationsEntry && !foundationsEntry.document.accent_palette_default_blue) throw new Error("This foundations file is missing its accent palette.");

      const next: ThemeDraft = {
        ...STARTER_THEME,
        id: createId(),
        light: { ...STARTER_THEME.light },
        dark: { ...STARTER_THEME.dark },
        sourceUi: uiEntry?.document,
        sourceFoundations: foundationsEntry?.document,
        updatedAt: Date.now(),
      };

      if (uiEntry) {
        const document = uiEntry.document;
        const openuiTheme = document.openuiTheme as Record<string, unknown>;
        const light = (openuiTheme.light_colors && typeof openuiTheme.light_colors === "object" ? openuiTheme.light_colors : {}) as Record<string, unknown>;
        const dark = (openuiTheme.dark_colors && typeof openuiTheme.dark_colors === "object" ? openuiTheme.dark_colors : {}) as Record<string, unknown>;
        const nextPalette = (current: ThemePalette, source: Record<string, unknown>): ThemePalette => ({
          ...current,
          background: typeof source.openui_bg === "string" && isHex(source.openui_bg) ? source.openui_bg : current.background,
          surface: typeof source.openui_fg === "string" && isHex(source.openui_fg) ? source.openui_fg : current.surface,
          elevated: typeof source.openui_elevated === "string" && isHex(source.openui_elevated) ? source.openui_elevated : current.elevated,
          highlight: typeof source.openui_highlight === "string" && isHex(source.openui_highlight) ? source.openui_highlight : current.highlight,
          accent: typeof source.openui_accent === "string" && isHex(source.openui_accent) ? source.openui_accent : current.accent,
          accentPressed: typeof source.openui_accent_pressed === "string" && isHex(source.openui_accent_pressed) ? source.openui_accent_pressed : current.accentPressed,
          accentSubtle: typeof source.openui_accent_subtle === "string" && isHex(source.openui_accent_subtle) ? source.openui_accent_subtle : current.accentSubtle,
          secondary: typeof source.openui_secondary === "string" && isHex(source.openui_secondary) ? source.openui_secondary : current.secondary,
          text: typeof source.openui_text_primary === "string" && isHex(source.openui_text_primary) ? source.openui_text_primary : current.text,
          muted: typeof source.openui_text_secondary === "string" && isHex(source.openui_text_secondary) ? source.openui_text_secondary : current.muted,
          faint: typeof source.openui_text_tertiary === "string" && isHex(source.openui_text_tertiary) ? source.openui_text_tertiary : current.faint,
          border: typeof source.openui_border_default === "string" && isHex(source.openui_border_default) ? source.openui_border_default : current.border,
          interactiveBorder: typeof source.openui_border_interactive === "string" && isHex(source.openui_border_interactive) ? source.openui_border_interactive : current.interactiveBorder,
          onAccent: typeof source.openui_text_on_accent === "string" && isHex(source.openui_text_on_accent) ? source.openui_text_on_accent : current.onAccent,
        });
        const radii = (openuiTheme.radii_dp && typeof openuiTheme.radii_dp === "object" ? openuiTheme.radii_dp : {}) as Record<string, unknown>;
        next.name = typeof openuiTheme.title === "string" ? openuiTheme.title : typeof document.title === "string" ? document.title : "Imported design system";
        next.description = "Imported from an openui-1.0 file.";
        next.light = nextPalette(next.light, light);
        next.dark = nextPalette(next.dark, dark);
        next.radius = typeof radii.card === "number" ? Math.max(0, Math.min(24, radii.card)) : next.radius;
        next.density = openuiTheme.density === "compact" ? "compact" : "comfortable";
      }

      if (foundationsEntry && !uiEntry) {
        const document = foundationsEntry.document;
        const accent = document.accent_palette_default_blue as Record<string, unknown>;
        const states = document.states && typeof document.states === "object" ? document.states as Record<string, unknown> : {};
        const lightStates = states.light && typeof states.light === "object" ? states.light as Record<string, unknown> : {};
        const darkStates = states.dark && typeof states.dark === "object" ? states.dark as Record<string, unknown> : {};
        const materials = document.materials && typeof document.materials === "object" ? document.materials as Record<string, unknown> : {};
        const mica = materials.mica && typeof materials.mica === "object" ? materials.mica as Record<string, unknown> : {};
        const acrylic = materials.acrylic && typeof materials.acrylic === "object" ? materials.acrylic as Record<string, unknown> : {};
        const radii = document.radii_dp && typeof document.radii_dp === "object" ? document.radii_dp as Record<string, unknown> : {};
        const spacing = document.spacing_dp && typeof document.spacing_dp === "object" ? document.spacing_dp as Record<string, unknown> : {};
        const chart = document.chart_palette && typeof document.chart_palette === "object" ? document.chart_palette as Record<string, unknown> : {};
        const chartLight = Array.isArray(chart.light) ? chart.light : [];
        const chartDark = Array.isArray(chart.dark) ? chart.dark : [];
        const color = (value: unknown, fallback: string) => typeof value === "string" && isHex(value) ? value : fallback;
        next.name = typeof document.title === "string" ? document.title.replace(/ foundations$/i, "") : "Imported foundations";
        next.description = "Imported from an openui-foundations-draft file. UI colors are adapted from the foundation palette.";
        next.light = {
          ...next.light,
          background: color(mica.light, next.light.background),
          surface: color(acrylic.light, next.light.surface),
          accent: color(accent.dark1, color(accent.base, next.light.accent)),
          accentPressed: color(lightStates.accent_pressed, next.light.accentPressed),
          secondary: color(chartLight[2], next.light.secondary),
        };
        next.dark = {
          ...next.dark,
          background: color(mica.dark, next.dark.background),
          surface: color(acrylic.dark, next.dark.surface),
          accent: color(accent.light2, color(accent.base, next.dark.accent)),
          accentPressed: color(darkStates.accent_pressed, next.dark.accentPressed),
          secondary: color(chartDark[2], next.dark.secondary),
        };
        next.radius = typeof radii.overlay === "number" ? Math.max(0, Math.min(24, radii.overlay)) : next.radius;
        next.density = typeof spacing.page_margin === "number" && spacing.page_margin <= 16 ? "compact" : "comfortable";
      }

      updateTheme(() => next);
      setPreviewMode("light");
      setView("studio");
      const pairMatches = uiEntry && foundationsEntry && typeof foundationsEntry.document.pairsWith === "string" && foundationsEntry.document.pairsWith !== uiEntry.file.name;
      notify(pairMatches
        ? "Imported both formats. Their original pair filename differs; exports will write a matching pair."
        : uiEntry && foundationsEntry
          ? "Imported the OpenUI and foundations pair; source fields are preserved."
          : uiEntry
            ? "Imported openui-1.0; its original token data is preserved."
            : "Imported foundations draft; palette, radius, and spacing are mapped to the preview.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not import this JSON file.");
    }
  };

  const navItems: { id: View; label: string; icon: React.ReactNode; section: "main" | "manage" }[] = [
    { id: "overview", label: "Overview", icon: <Home size={17}/>, section: "main" },
    { id: "studio", label: "AI Studio", icon: <Sparkles size={17}/>, section: "main" },
    { id: "marketplace", label: "Marketplace", icon: <Layers3 size={17}/>, section: "main" },
    { id: "settings", label: "Settings", icon: <Settings size={17}/>, section: "manage" },
  ];
  const activeNav = navItems.find((item) => item.id === view);

  const onNav = (next: View) => {
    setView(next);
    setMobileMenu(false);
  };

  const openAssistant = () => {
    setView("studio");
    setMobileMenu(false);
    window.setTimeout(() => {
      const composer = document.querySelector<HTMLTextAreaElement>("#assistant-prompt");
      if (!composer) return;
      composer.scrollIntoView({ behavior: "smooth", block: "center" });
      composer.focus({ preventScroll: true });
    }, 80);
  };

  const changeProvider = (provider: Provider) => {
    if (provider === providerConfig.provider) return;
    setProviderConfig((config) => ({ ...config, provider }));
    setApiKey("");
    if (rememberApiKey) {
      setRememberApiKey(false);
      persistProviderKey(null).catch(() => notify("Could not remove the saved provider key from this browser."));
    }
  };

  const changeRememberApiKey = (remember: boolean) => {
    setRememberApiKey(remember);
    if (!remember) {
      persistProviderKey(null).then(() => notify("Remembered provider key removed from this browser")).catch(() => notify("Could not remove the saved provider key."));
    } else if (apiKey.trim()) {
      persistProviderKey(apiKey.trim()).then(() => notify("Provider key saved in this browser")).catch(() => {
        setRememberApiKey(false);
        notify("Could not save the provider key. It will remain in memory only.");
      });
    } else {
      notify("Enter a provider key and Forma will remember it on this device.");
    }
  };

  const openProject = (project: ThemeDraft) => {
    setTheme(project);
    setHistory([]);
    setView("studio");
    setMobileMenu(false);
  };

  const main = view === "overview" ? <OverviewView theme={theme} projects={projects} mode={previewMode} onCreate={createNewSystem} onOpenStudio={() => onNav("studio")} onOpenAssistant={openAssistant} onOpenProject={openProject} onOpenMarketplace={() => onNav("marketplace")} onImport={openImport} onApply={applyStarter} onPreviewItem={setPreviewItem}/> :
    view === "studio" ? <StudioView theme={theme} mode={previewMode} onModeChange={setPreviewMode} onThemeChange={updateTheme} onUndo={undo} canUndo={history.length > 0} onExport={exportJson} onExportFoundations={exportFoundations} onExportPair={exportPair} onDownloadCss={exportCss} onImport={openImport} provider={providerConfig.provider} model={providerConfig.model} baseUrl={providerConfig.baseUrl} apiKey={apiKey} rememberApiKey={rememberApiKey} onGoSettings={() => onNav("settings")} onToast={notify}/> :
      view === "marketplace" ? <MarketplaceView mode={previewMode} favorites={favorites} onToggleFavorite={toggleFavorite} onApply={applyStarter} onPreview={setPreviewItem}/> :
        <SettingsView provider={providerConfig.provider} model={providerConfig.model} baseUrl={providerConfig.baseUrl} apiKey={apiKey} rememberApiKey={rememberApiKey} onRememberApiKeyChange={changeRememberApiKey} onProviderChange={changeProvider} onModelChange={(model) => { setProviderConfig((config) => ({ ...config, model })); }} onBaseUrlChange={(baseUrl) => { setProviderConfig((config) => ({ ...config, baseUrl })); }} onApiKeyChange={(key) => { setApiKey(key); }} onClear={async () => { setApiKey(""); setRememberApiKey(false); await keyPersistence.current.catch(() => undefined); await clearLocal().catch(() => undefined); setTheme({ ...STARTER_THEME, id: createId() }); setProjects([]); setFavorites([]); setHistory([]); setProviderConfig({ provider: "openai", model: "gpt-4o-mini", baseUrl: "" }); notify("Local project data cleared"); }} onExportPair={exportPair} onToast={notify} onStartChat={openAssistant} theme={theme}/>;

  return (
    <div className={`app-shell ${appMode === "dark" ? "app-shell--dark" : ""}`}>
      <input key={importInputKey} ref={fileInputRef} type="file" accept="application/json,.json" multiple className="visually-hidden" onChange={(event) => importJson(event.target.files ?? undefined)}/>
      <button className="mobile-menu-toggle" type="button" aria-label="Open navigation" onClick={() => setMobileMenu((open) => !open)}><Menu size={20}/></button>
      {mobileMenu && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileMenu(false)}/>}
      <aside className={`sidebar ${mobileMenu ? "sidebar--open" : ""}`}>
        <div className="sidebar-brand"><div className="brand-lockup"><div className="brand-logo"><AppIcon/></div><div><b>forma</b><small>DESIGN SYSTEM STUDIO</small></div></div></div>
        <button className="workspace-switch" type="button" onClick={() => notify("Your workspace is local to this browser")}><span className="workspace-avatar">F</span><span className="workspace-switch__copy"><b>Personal workspace</b><small>Local · No account</small></span><ChevronDown size={14}/></button>
        <div className="sidebar-group"><span className="sidebar-label">WORKSPACE</span>{navItems.filter((item) => item.section === "main").map((item) => <button type="button" key={item.id} className={`nav-link ${view === item.id ? "is-active" : ""}`} onClick={() => onNav(item.id)}>{item.icon}<span>{item.label}</span>{item.id === "marketplace" && <span className="nav-new">NEW</span>}</button>)}</div>
        <div className="sidebar-projects"><div className="sidebar-projects__heading"><span className="sidebar-label">YOUR PROJECTS</span><button type="button" aria-label="Create project" onClick={createNewSystem}><Plus size={14}/></button></div><div className="sidebar-projects__list">{projects.slice(0, 5).map((project) => <button className={`project-link ${view === "studio" && theme.id === project.id ? "is-active" : ""}`} type="button" key={project.id} onClick={() => openProject(project)}><span className="project-link__swatch" style={{ background: project.light.accent }}/><span>{project.name}</span>{theme.id === project.id && <span className="project-link__status"/>}</button>)}{projects.length > 5 && <button className="project-overflow" type="button" onClick={() => onNav("overview")}>+ {projects.length - 5} more projects</button>}{!projects.length && <span className="project-empty">No local drafts yet</span>}</div></div>
        <div className="sidebar-group sidebar-group--manage"><span className="sidebar-label">PREFERENCES</span>{navItems.filter((item) => item.section === "manage").map((item) => <button type="button" key={item.id} className={`nav-link ${view === item.id ? "is-active" : ""}`} onClick={() => onNav(item.id)}>{item.icon}<span>{item.label}</span></button>)}</div>
        <div className="sidebar-bottom"><div className="sidebar-storage"><span className="storage-icon"><ShieldCheck size={15}/></span><div><b>Private by default</b><small>Saved on this device</small></div><span className="storage-online-dot"/></div><button className="sidebar-profile" type="button" onClick={() => onNav("settings")}><span className="profile-avatar">Y</span><span><b>You</b><small>Local workspace</small></span><MoreHorizontal size={17}/></button></div>
      </aside>
      <main className="main-area">
        <header className="topbar"><div className="topbar__left"><span className="topbar-product">FORMA</span><ChevronRight size={13}/><span className="topbar-current">{activeNav?.label ?? "Workspace"}</span>{view === "studio" && <><ChevronRight size={13}/><span className="topbar-project">{theme.name}</span></>}</div><div className="topbar__right"><button className="command-search" type="button" onClick={() => { onNav("marketplace"); setTimeout(() => document.querySelector<HTMLInputElement>(".search-field input")?.focus(), 80); }}><Search size={14}/><span>Search designs</span><kbd>⌘ K</kbd></button><button className="topbar-icon" type="button" aria-label="Help" onClick={() => notify("Help: start from a preset, prompt, or imported JSON.")}><CircleHelp size={17}/></button><span className="topbar-divider"/><button className="theme-toggle" type="button" onClick={() => setAppMode((current) => current === "light" ? "dark" : "light")} aria-label={appMode === "light" ? "Switch app to dark mode" : "Switch app to light mode"}>{appMode === "light" ? <Moon size={16}/> : <Sun size={16}/>}</button><button className="topbar-account" type="button" onClick={() => onNav("settings")}><span className="profile-avatar profile-avatar--small">Y</span></button></div></header>
        <div className="main-scroll"><div className="page-container">{main}<footer className="page-footer"><span>FORMA <span>·</span> DESIGN SYSTEM STUDIO</span><span><span className="footer-private-dot"/> Drafts stay on this device</span></footer></div></div>
      </main>
      {toast && <div className="toast-message" role="status"><span className="toast-message__icon"><Check size={14}/></span>{toast}<button type="button" aria-label="Dismiss notification" onClick={() => setToast("")}><X size={14}/></button></div>}
      {previewItem && <div className="modal-backdrop" onClick={() => setPreviewItem(null)}><section className="preview-modal" role="dialog" aria-modal="true" aria-label={`Preview ${previewItem.title}`} onClick={(event) => event.stopPropagation()}><div className="preview-modal__head"><div><span className="section-kicker">STARTER PREVIEW · {previewItem.collection.toUpperCase()}</span><h2>{previewItem.title}</h2><p>{previewItem.description}</p></div><IconButton label="Close preview" onClick={() => setPreviewItem(null)}><X size={17}/></IconButton></div><div className="preview-modal__toolbar"><span>{previewItem.tokenCount} tokens <span>·</span> Light + dark</span><div className="preview-modal__swatches">{[previewItem.theme.light.accent, previewItem.theme.light.secondary, previewItem.theme.light.background, previewItem.theme.light.text].map((color) => <i key={color} style={{ background: color }}/>)}</div></div><div className="preview-modal__stage"><SampleWebsite theme={previewItem.theme} mode={previewMode}/></div><div className="preview-modal__footer"><span>Preview uses the built-in sample website.</span><button className="button button--primary" type="button" onClick={() => applyStarter(previewItem)}>Use this design <ArrowRight size={14}/></button></div></section></div>}
      {showCommunityInfo && <div className="modal-backdrop" onClick={() => setShowCommunityInfo(false)}><section className="small-modal" role="dialog" aria-modal="true" aria-label="Community marketplace details" onClick={(event) => event.stopPropagation()}><button type="button" className="small-modal__close" aria-label="Close" onClick={() => setShowCommunityInfo(false)}><X size={17}/></button><span className="small-modal__icon"><Layers3 size={19}/></span><span className="section-kicker">COMMUNITY MARKETPLACE</span><h2>Shared designs, with permission.</h2><p>The first build keeps personal projects in your browser and shows a curated starter library. Community designs will be added only after there’s a moderated way to submit and publish them—nothing is shared automatically.</p><div className="small-modal__note"><ShieldCheck size={15}/> Public designs only. Never API keys, prompts, or private drafts.</div><button type="button" className="button button--primary" onClick={() => { setShowCommunityInfo(false); onNav("marketplace"); }}>Explore starter designs <ArrowRight size={14}/></button></section></div>}
      {!isLoaded && <div className="loading-scrim"><span className="loading-mark"><AppIcon/></span><span>Opening your workspace…</span></div>}
    </div>
  );
}
