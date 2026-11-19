# Product Research & Feature Recommendations

**Research pass:** 19 November 2026<br />
**Scope:** design-token standards, Figma interop, code generation, accessibility, provider APIs, local-first security, and AI-agent integrations.<br />
**Purpose:** recommendations to consider alongside `IMPLEMENTATION_PLAN.md`; these are not all MVP commitments.

## Executive recommendation

Keep the first release focused on one excellent workflow: **describe or import a system → edit and validate tokens → apply them live to the built-in sample website → export usable files**. The most valuable additions are not a bigger chat agent; they are interoperability, a clear token model, accessibility feedback, and a frictionless way to use the result in real code.

The strongest product shape is:

1. Preserve the supplied paired OpenUI JSON outputs exactly.
2. Add an optional, interoperable DTCG 2025.10 export/import path.
3. Turn the token editor into an understandable token graph with modes and change review.
4. Export web-ready CSS/Tailwind/TypeScript alongside JSON.
5. Treat accessibility checks, local backups, and secret handling as core product quality.
6. Add Figma, versioned publishing/Git, and AI coding-agent integrations after the core pipeline works.

## What the research changes

### 1. Make the supplied format a first-class format, not the only format

The two supplied files define this product’s initial OpenUI contract. Keep their names, fields, and paired-export behavior intact. Do **not** silently rewrite them into another schema.

There is now a useful additional interoperability target: the Design Tokens Community Group published DTCG 2025.10 as a stable format on 28 October 2025. Its announcement describes theming/multi-brand use, aliases, and modern color spaces such as Display P3 and OKLCH; the format report says it is stable but explicitly **not a W3C Standard or on the W3C Standards Track**. Be precise in product copy: call it the “DTCG 2025.10 format,” not “the W3C design-token standard.” [2](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/) · [1](https://www.designtokens.org/tr/2025.10/format/)

**Recommendation:** add DTCG as a third, optional import/export format after the supplied OpenUI import/export contract is covered by tests. Keep conversion loss visible: for example, a source file may contain native/dp-oriented component hints that do not have an exact web or DTCG equivalent.

### 2. Model tokens as a graph, not just a bag of values

Give users three understandable layers:

- **Primitive:** raw palette and scales, such as `blue.600`, `space.4`, or `radius.2`.
- **Semantic:** intent, such as `surface.canvas`, `text.primary`, or `action.primary`.
- **Component:** optional usage-specific mapping, such as `button.primary.background`.

Use aliases so changing a primitive or semantic value can flow through the system. Add a token relationship view: “this button uses this component token, which resolves to this semantic token, which resolves to this color.” Include the inverse impact view before a change is accepted. Treat light/dark, high-contrast, brand, and density as selectable modes/variants rather than duplicated projects wherever the target format supports them. The sample already has light/dark maps and `@color/...` references, so this is a natural extension rather than a replacement.

### 3. Make “use these tokens in my website” a first-class outcome

JSON remains the main deliverable, but many web users need a direct implementation bridge. Add an export bundle with:

- The two supplied OpenUI JSON files.
- Optional DTCG `.tokens.json`.
- `tokens.css` with CSS custom properties and theme selectors.
- A Tailwind theme/config option and a TypeScript theme object.
- A short integration snippet showing how to load light/dark modes.

The preview and code outputs should use the same normalized token mapping. Style Dictionary’s documented format system can generate CSS variables and preserve references in supported outputs; its platform transforms include web formats and native targets such as Android and iOS. Use it where it fits the DTCG path, while retaining a custom exporter for the supplied OpenUI schema. [2](https://styledictionary.com/reference/hooks/formats/) · [3](https://styledictionary.com/reference/enums/)

A useful later step is a downloadable npm-ready package or GitHub PR, but don’t require a repository or account to get value from the first version.

### 4. Upgrade color generation into an accessibility “palette lab”

Do more than pick a brand hex value. Let a user set or ask for a brand color, then propose a ramp and semantic roles for text, surfaces, actions, borders, and success/warning/error states in both light and dark modes. Show the actual affected components in the sample website and let the user pin/lock colors they do not want changed.

Run checks against the rendered semantic pairs, not every possible pair in isolation. WCAG 2.2 AA requires at least 4.5:1 for normal text, 3:1 for large text, and 3:1 for relevant non-text UI/graphic contrast. Report the measured ratio, the failing token pair, and a suggested correction; keep exceptions and manual overrides visible. A contrast checker is a useful lint tool, not a claim that the entire design system or website is WCAG-conformant. [1](https://www.w3.org/TR/WCAG22/)

Also add color-vision simulation and a “show focus states” mode. Preserve focus-ring, disabled, reduced-motion, and minimum-hit-area tokens in the preview and export rather than treating them as optional decoration.

### 5. Add Figma interop through files first

Figma’s variables guidance documents importing DTCG JSON and exporting variable modes, which makes a file-based workflow a practical first integration. However, its importer documents constraints: for example, color support is limited to HSL/sRGB, dimensions use px, font-family values are a single font name, and duration uses seconds. The product should show a **Figma compatibility report** before export instead of silently rounding, dropping, or coercing unsupported values. Figma’s current plan comparison lists the variables REST API under Enterprise, so avoid making a REST connection the only Figma path. [1](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) · [4](https://help.figma.com/hc/en-us/articles/360040328273-Compare-Figma-plans)

**Suggested order:** drag-and-drop DTCG import/export → compatibility report → optional Figma plugin. Consider an authenticated REST sync only if customers need continuous team synchronization and accept its plan/access requirements.

### 6. Add review, history, and publishing deliberately

Before applying an agent proposal, show a readable token diff: changed value, previous value, affected semantic/component tokens, and preview. Add snapshots, undo/redo, duplicate/branch, and a human-readable changelog. This is valuable for both solo users and teams.

Because the product’s output is JSON, a high-value follow-on feature is **Publish version**: an immutable versioned URL for the token files, plus a moving `latest` alias, checksum, and changelog. Keep download/local backup available without an account. Publishing introduces server storage, retention, deletion, access control, and abuse concerns, so make it opt-in; decide separately whether public/unlisted publishing can be anonymous or needs an optional account. Tokens Studio’s feature documentation is a useful workflow signal: it highlights theme management, color modifiers, Git branch management, and token-flow/table views as established token-tool workflows. [1](https://docs.tokens.studio/get-started/pro-licence)

### 7. Give the agent a strict contract and useful model controls

Keep the agent’s work constrained to typed proposals and app-owned actions. Use provider-native structured output/tool calling when available, then validate the result locally against the same internal schema and business rules. OpenAI distinguishes schema-constrained Structured Outputs from JSON mode and notes that refusals, incomplete responses, and business rules still need application handling; Anthropic and Gemini expose their own tool/schema request and response shapes. That is a reason to build an adapter/capability matrix—not a reason to assume one request format works everywhere. [1](https://platform.openai.com/docs/guides/structured-outputs) · [1](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use) · [1](https://ai.google.dev/gemini-api/docs/function-calling)

Add: provider connection test, model capability labels, generation-length limits, a “what will be sent to my provider?” notice, and a clear proposal/apply/undo cycle. The agent should not receive or invoke arbitrary external tools just because the user connected a model; expose a small allowlist of token operations first.

### 8. Make AI coding-agent handoff a differentiator

A low-cost first step is to generate a small `AGENTS.md`/`CLAUDE.md`/Cursor rules snippet with the token names, CSS variables, and “use tokens; don’t hard-code values” instructions. A later optional **local MCP server** could expose read-only token resources and safe tools such as `get_token`, `explain_token`, and `validate_tokens`; mutating actions should produce a proposal for user approval. The MCP spec supports resources and tools and emphasizes validation, user consent, and human review for tool actions. [2](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)

Keep MCP out of the first milestone: it is a separate integration surface, not a requirement for the website’s own agent to edit its project.

### 9. Treat local-first as a real product promise

Project drafts and backups can be stored in IndexedDB, but browser storage is best-effort by default and may be evicted; give users a visible export/backup flow and consider an opt-in persistent-storage request. Do **not** store provider API keys in localStorage or IndexedDB by default: OWASP notes that same-origin JavaScript/XSS can access browser storage. Keep the key session-only, explain that the user’s prompt/design data is sent to the chosen provider when they ask it to generate, and let them clear local projects. [1](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) · [1](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)

## Recommended priority

### Add to the first release

1. Exact OpenUI pair import/export and the built-in sample website preview.
2. A minimal semantic-token graph, token diff, and undo/history.
3. Contrast and reference validation with actionable warnings.
4. CSS variables and a framework-neutral integration snippet alongside JSON.
5. Project backup/download and clear local privacy controls.

### Add next, once the core pipeline is solid

1. DTCG 2025.10 import/export.
2. Tailwind/TypeScript bundle and Figma-ready export with compatibility warnings.
3. Optional published, versioned JSON URL and GitHub workflow.
4. Generated AI coding-agent rules; then an optional MCP integration.
5. A second sample template (for example, a marketing page) to test token behavior beyond the initial dashboard/settings template.

### Defer

- Accounts, cloud collaboration, and team permissions until a real sync/publishing need justifies them.
- Arbitrary live-website fetching or code injection. Start with user-provided JSON and, later, an explicit screenshot upload; don’t make a user-supplied URL fetch the core workflow.
- “Any provider” as an unrestricted custom server URL. Add providers through reviewed adapters and strict endpoint controls.
- Generating full production application code. Keep the product excellent at design decisions, token correctness, preview, and exports first.
