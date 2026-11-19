# Design Token Studio — Implementation Plan

## 1. Goal

Build a Vercel-hosted, no-account design-token studio. A user can describe a product, provide or request a color palette, refine the design with an AI assistant using their own provider key, preview the result in a small adaptive demo app, and export valid JSON in the supplied format. Manual editing and preview should work even before an AI provider is configured.

The repository began as a greenfield starting point. The current implementation has a Next.js/TypeScript app scaffold, the supplied JSON fixtures, and the first local-first studio UI; this plan remains the product and quality roadmap.

## Implementation status — 19 November 2026

| Area | Status | Notes |
| --- | --- | --- |
| Scaffold and fixtures | Done | Next.js App Router, TypeScript, Vercel-compatible route, and both JSON contracts are in the repository. |
| No-login studio | Done for the first build | Overview, Studio, Discovery, Settings, responsive shell, Windows-inspired light/dark palettes, multiple IndexedDB drafts, and local favorites are wired. |
| Preview and editing | Done for supported theme values, including Brand Foundations v1 | The token-driven SaaS dashboard preview supports desktop/tablet/mobile, palette/radius/density controls, editable typography and five spacing metrics, contrast feedback, and reversible edits. It is not a rendering of arbitrary user code. |
| Import/export | Initial implementation done | Both contracts import independently or as a pair; typography and spacing map into the draft and back out, and unknown source fields remain attached for round-tripping. Individual JSON, paired ZIP with an updated `pairsWith`, and CSS-variable exports are available. Deeper schema/reference diagnostics remain future hardening. |
| AI assistant | Initial implementation done | Named provider adapters plus constrained OpenAI-compatible custom endpoints; keys stay in page memory by default, with an explicit optional on-device remember control. Proposals may include bounded typography and spacing fields and are validated, diffed, previewed, and reviewed before apply. Provider-specific capability fallbacks need ongoing testing. |
| Deployment/security QA | Unit/build and interactive browser QA passed; Vercel deployment pending project connection | `npm test` passes all 16 tests, `npm run typecheck` passes, and the production build succeeds. Desktop and 390px mobile browser checks covered create-from-scratch, foundation editing and reload persistence, live preview updates, dark/mobile rendering, both import/export flows (including paired ZIP, CSS, and unknown-field preservation), and assistant review-before-apply. No persisted browser test suite or live provider-key test has been performed. Vercel project deployment remains pending a project connection. Community publishing and any Sheets/Apps Script backend remain deferred. |

## 2. What the supplied files establish

The examples are a **pair of related but different documents**, so they should be treated as versioned contracts rather than flattened into one generic token object.

| File | Format | Contents and implementation implication |
| --- | --- | --- |
| `windows_11_pro_foundations-1.json` | `openui-foundations-draft` | Device/breakpoint values, typography, spacing, radii, shadows, materials, motion, accent colors, states, and chart palette. It includes provenance and a `pairsWith` filename. |
| `windows_11_pro_ui_final-1.json` | `openui-1.0` | `openuiTheme` with light and dark color maps, theme metrics/radii, plus a `tokens` array. The example has 58 tokens across six kinds and uses references such as `@color/openui_accent`. |

The UI example has unique token keys and no unresolved `@color` references. It has two defined colors that are not currently referenced; unused colors should be a non-blocking lint warning, not an import failure. The exporter should preserve the examples' field names and value conventions, update `updatedAt` in milliseconds, and set `pairsWith` to the actual exported UI filename. The two files should remain independently importable and exportable.

The foundations file distinguishes official, derived, and approximate values. Preserve those distinctions for the preset and do not present generated designs as official Windows or Fluent designs. Web rendering can approximate Mica/Acrylic materials; it cannot reproduce native Windows surfaces exactly.

## 3. MVP user journey

1. **Welcome, no login:** offer `Create with AI`, `Start from a preset`, `Import JSON`, and `Continue editing locally`. No account gate.
2. **Design brief:** ask what the product is, who it is for, desired tone, target platform, light/dark requirements, density, and any accessibility needs. Offer a color choice: enter brand colors, choose a palette, or let the agent propose one.
3. **Clarify and propose:** the assistant asks only for important missing choices, then returns a structured proposal. It should not silently replace user-entered values.
4. **Studio:** show the conversation, a searchable token/theme editor, and a live preview. Users can edit values directly, ask for changes in chat, undo, and compare a proposed change set before applying it.
5. **Preview:** apply the current imported or generated tokens to the built-in sample website, switch light/dark and responsive layouts, inspect component states, and see the active JSON version. The sample website updates as the draft changes.
6. **Export:** validate, show errors and warnings, then copy/download the UI JSON, foundations JSON, or both as a ZIP. Provide a local project backup because there is no account/cloud sync in the MVP.
7. **Settings:** choose provider and model, enter/test an API key, set generation preferences, and clear local data. Keep settings reachable from the studio at all times.

## 4. Recommended technical design

### Application

- **Next.js App Router + React + TypeScript**, deployed to Vercel.
- Use CSS custom properties as the runtime theme contract; Tailwind may be used for layout utilities, but component appearance should resolve through the design tokens rather than hard-coded palette classes.
- Use a schema library such as **Zod** (and JSON Schema where providers support structured output) for runtime validation.
- Persist projects, imported files, and revision snapshots in **IndexedDB**. No database or login is needed for the first release.
- Keep a canonical internal model separate from provider responses and the two exported formats. Importers normalize known fields; exporters deterministically map the internal model back to each supported format. Preserve unknown imported fields where possible so round-tripping does not discard user data.

Suggested modules:

```text
app/                         routes and Vercel API route handlers
components/studio/           onboarding, chat, editor, settings, export
components/preview/          themed demo app and component gallery
lib/tokens/                  schemas, importers, normalizer, exporter, lint rules
lib/agent/                   prompts, typed actions, approval/diff handling
lib/providers/               provider adapters and capability mapping
lib/storage/                 IndexedDB projects, local history, settings
presets/                     supplied Windows-inspired example as a fixture
```

### Token pipeline

```text
Prompt or imported JSON
  → parse and validate
  → normalize to internal draft
  → agent proposes typed changes (or user edits directly)
  → validate and lint
  → user reviews/applies a diff
  → preview renders the approved draft
  → deterministic export to the requested JSON format(s)
```

The model should not author arbitrary application code or directly write files. Define a small allowlist of app-owned actions, for example `setColor`, `setTypography`, `setMetric`, `setRadius`, `applyPreset`, `generatePalette`, and `validateDraft`. Validate every action and its arguments; keep undo/redo and revision snapshots. Use native provider tool calling when available and structured JSON proposals as a fallback. If a response fails schema validation, request a correction or report the problem rather than silently accepting malformed output.

### Provider and key handling

- Provide adapters for **OpenAI**, **Anthropic/Claude**, and **Gemini**, plus an **OpenAI-compatible** adapter for providers such as OpenRouter and NVIDIA NIM when their selected endpoint/model supports the required capabilities.
- Make provider capabilities explicit: tool calling, JSON/structured output, streaming, and context limits vary. Let the user choose a model or enter a model name rather than relying on a stale hard-coded model list.
- Use a Vercel Route Handler as the normalization/proxy boundary where browser CORS or provider-specific headers require it. The browser supplies the user's key for that request; the app must not write keys to a database, source code, analytics, error reports, or application logs.
- Keep the key in page memory by default; provider/model settings can persist locally without it. The opt-in “remember on this device” control stores the key in IndexedDB and clearly warns that this first version is not encrypted and should not be used on shared devices. Unchecking it or clearing local data deletes the saved copy. A passphrase-encrypted vault remains a security-hardening improvement.
- An app without login cannot provide cloud sync or reliably identify a user across devices. It also cannot promise support for literally every provider: launch with the adapters above, then add adapters through the same interface.
- Do not allow a server-side request to an arbitrary user-supplied URL without strict HTTPS, public-address, redirect, and host validation; otherwise the proxy can become an SSRF path. Start with built-in endpoints and a carefully constrained OpenAI-compatible option.

### Built-in sample website preview

The preview is a **first-party sample website shipped inside the app**. It is the canvas that receives the user's imported or generated tokens. The MVP should include one polished, responsive mini product site (for example, a SaaS dashboard/settings experience) rather than only a page of disconnected component examples. Its header/navigation, page title, cards, lists or table, form controls, status messages, and chart area should all be styled by the active token set. A component gallery alongside the sample pages can expose individual variants and states.

The template does not have to be a literal `index.html` file. Since the app is planned for Next.js, the recommended implementation is a dedicated React template/route (for example, `/preview`) with a stable template contract. A static HTML template is also viable if kept versioned and driven by the same contract. In either case, keep the sample site's structure/content fixed and apply only validated design values; do not execute or inject arbitrary HTML/CSS from imported JSON.

Create a theme adapter that maps both supported JSON formats into scoped CSS custom properties and component styles. On import, generation, or manual edit, update the local draft and re-render the sample website live. Missing values should use documented defaults, and unsupported token hints should appear as preview warnings. Include light/dark modes, responsive widths, and focus, hover, pressed, selected, and disabled states where relevant. Scope styles so the sample theme cannot restyle the studio. If it is rendered in an iframe, pass only validated theme data through a constrained message contract; do not pass executable content.

**Fidelity boundary:** the sample website will show how its supported layout and components look with the user's tokens. It can closely demonstrate the visual result within this template, but it is not a pixel-perfect rendering of the user's separate website, because the tokens do not include that site's markup, assets, or component implementation. Supporting previews of arbitrary user sites would be a separate integration/sandbox feature.

## 5. Validation and quality rules

The import/export validator should cover:

- Supported `specVersion`, required object shapes, token kinds, and unique token keys.
- Valid color values and resolved `@color/...` references in both light and dark palettes.
- Numeric ranges and supported units for typography, spacing, radii, dimensions, and motion.
- `pairsWith` consistency and output `updatedAt` format.
- Contrast checks for common foreground/background pairs, with actionable warnings and a target of WCAG AA where applicable.
- Unknown fields, unused colors, and unsupported component hints as warnings where safe; never discard them silently.

Treat imported JSON and AI output as untrusted input. Enforce file-size limits, validate before rendering, escape displayed text, and never evaluate imported strings as code.

## 6. Delivery phases

### Phase 0 — Contract and scaffold
- Add the Next.js/TypeScript/Vercel app scaffold and basic lint/test setup.
- Copy the two attached examples into versioned test fixtures.
- Define schemas, import/export round-trip tests, and a concise supported-token contract.
- **Exit:** both fixtures parse; known fields round-trip; invalid and unresolved references are reported clearly.

### Phase 1 — No-login studio foundation
- Build welcome/onboarding, app navigation, light/dark shell, settings screen, and local project storage.
- Add the Windows-inspired preset, manual theme editing, and local save/restore.
- **Exit:** a user can create a project and edit it with no account and no AI key.

### Phase 2 — Import, preview, and export
- Implement import for either JSON file (and paired files), token inspection, linting, the built-in responsive sample website plus component gallery, and deterministic JSON/ZIP export.
- Build the preview theme adapter so any imported or generated draft is applied to the sample website live, without changing the studio's own styles.
- **Exit:** importing the supplied pair gives a useful live sample-site preview; token edits update it; export passes schema and reference checks.

### Phase 3 — BYOK providers and agent
- Add provider settings/key test, adapters, serverless request handling, structured proposals/tool calls, clarifying questions, reviewable diffs, and undo/history.
- Begin with supported adapters and add provider-specific capability fallbacks rather than pretending all endpoints behave identically.
- **Exit:** a user can enter a brief, choose manual or agent-suggested colors, approve changes, and export a valid pair; invalid keys/provider responses fail safely.

### Brand Foundations v1 — implemented (19 November 2026)
- Add bounded, editable font family/body size/heading size/line-height controls and page margin/section gap/card padding/control height/row height controls.
- Apply the typography and spacing CSS variables to the built-in dashboard preview and expose the tokens in the explorer.
- Map the fields through OpenUI and foundations imports/exports, preserve unknown source fields, and include them in CSS-variable export.
- Allow the assistant to propose typed typography and spacing patches; show every field in the review diff and preview before users apply it.
- **Exit:** users can create/import a draft, edit type and spacing, observe the preview update, round-trip both supported JSON contracts, and validate assistant proposals. Validation, serialization, and assistant-route tests cover the new fields.

### Phase 4 — Hardening and Vercel release
- Add keyboard/screen-reader checks, responsive testing, provider failure states, request limits, log redaction, security headers, and Playwright end-to-end coverage.
- Deploy a preview and production build on Vercel; document local-first storage, BYOK handling, supported schemas/providers, and preview fidelity limitations.
- **Exit:** production build succeeds, the core journey works at desktop and mobile widths, no API key or project content is persisted by the app server, and sample fixtures remain regression tests.

## 7. MVP acceptance checklist

- No sign-up or login required; editing and preset preview work without a key.
- Users can import either supplied JSON format, or both as a pair, and can create a theme from a plain-language brief.
- Users can edit typography (font family, body/heading sizes, line height) and spacing (page margin, section gap, card padding, control height, row height) and see those values update the preview.
- Typography and spacing map through supported imports/exports; unknown source fields remain preserved, and assistant changes are validated, diffed, previewable, reviewable, and undoable.
- The imported or generated tokens update the built-in sample website live; light/dark modes, responsive layouts, and supported component/state variants can be inspected.
- Exports match the supplied `openui-1.0` and `openui-foundations-draft` shapes, with no unresolved color references and a correct pair filename.
- Keys are not persisted server-side or included in logs/telemetry; users can clear local projects and settings.
- Import/export, schema validation, token references, contrast warnings, responsive UI, keyboard focus, and the happy-path workflow are covered by automated tests.

## 8. Main product decisions to keep visible

1. **“Any provider” means an extensible adapter system**, not a promise that every API is interchangeable. Start with named providers plus OpenAI-compatible services.
2. **No login means local-first ownership**, not account-backed recovery or sync. Add cloud sync only as a separate opt-in product decision.
3. **The preview applies supported tokens to our built-in sample website**, not a pixel-perfect prediction of an unrelated website's implementation.
4. **The supplied schemas are the initial export contract.** If a broader design-token standard is desired later, add a separate versioned exporter instead of changing these files silently.
