# Forma — Design Token Studio

Forma is a no-login, local-first studio for editing design tokens, trying them on a built-in sample dashboard, and exporting the result. It starts from the supplied Windows 11 Pro examples while preserving their separate OpenUI contracts.

## Run locally

```bash
npm ci
npm run dev
```

The development server listens on `0.0.0.0:3000`. Open `http://localhost:3000` in your browser. For validation:

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
```

`npm run test:e2e` starts or reuses the local Next.js server on port 3000 and runs the saved Playwright browser suite. It uses Chromium bundled as an npm dev dependency, so it does not download a browser at test time and does not need an AI provider key. To use an installed browser instead, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its executable path. GitHub Actions runs the unit tests, type-check, production build, and browser suite on pushes and pull requests with Node 22.

## What is included

- Overview, AI Studio, Discovery, and Settings views; no account or login is required.
- A Windows/Fluent-inspired light and dark starter theme, plus five bundled gallery designs. The gallery is discovery-only; it has no checkout or public publishing backend.
- A live sample SaaS dashboard preview with light/dark modes and desktop, tablet, and mobile layouts. Palette, typography, spacing, radius, and density edits apply immediately to the preview.
- Editable Brand Foundations v1 controls for font family, body and heading sizes, line height, page margin, section gap, card padding, control height, and row height. Foundation values are validated, included in token examples, and exported to both supported JSON contracts and CSS variables.
- Local drafts and saved gallery favorites in IndexedDB, with multiple projects and a paired ZIP backup. Extract the two JSON files before importing that backup; the app’s import control accepts either contract or both files together.
- Import for either `openui-1.0` or `openui-foundations-draft`, including importing both files together. Imported source objects are retained for round-tripping unknown fields. Exports include the OpenUI file, the foundations file, a matching `pairsWith` filename in the foundations contract, and CSS variables.
- Studio **Validate** reports imported/generated contract errors, range issues, pairing issues, contrast guidance, and non-blocking advisories. Errors block JSON exports that include the invalid contract; advisory warnings do not.
- BYOK assistant adapters for OpenAI, Anthropic/Claude, Gemini, OpenRouter, NVIDIA NIM, and custom OpenAI-compatible endpoints. Proposals may include validated typography and spacing fields as well as palette and shape changes; the Studio shows a diff and temporary preview for review before applying them. Undo is available in the Studio.

## Chat with Forma

From Overview, choose **Chat with Forma**, or add a provider key in **Settings** and choose **Chat with Forma** there. This opens AI Studio and focuses the prompt box. Ask for a design change (for example, “make a calm palette for a wellness app”), then press **Send**. Forma shows a reviewable proposal; it does not change your draft until you choose **Apply changes**. Provider testing in Settings is optional.

## Agent capability and preview boundary

The current assistant is a constrained **design-token proposer**, not a website inspector or code-writing agent. Each request sends your prompt plus the active theme's name, description, light/dark color palettes, corner radius, density, typography, and spacing. It does not receive your website URL, page markup, repository, screenshots, images, or raw imported source documents, and it cannot call arbitrary tools. Its validated patch can change the theme name/description, palette roles, radius, density, font family, body and heading sizes, line height, and the five supported spacing values; it cannot author HTML/CSS, change a logo or assets, or design a new page/component layout.

Those supported tokens shape the built-in SaaS dashboard's surfaces, text, accents, typography, spacing, corner treatment, and density in light and dark modes. The sample website is a fixed Forma template, not your own website. Imported fields that the editor does not map are retained in the original source data for export, but are not independently editable or rendered in the preview. Use exported tokens/CSS in your own website to apply the supported foundation there.

## AI provider privacy

Provider/model settings and a custom provider base URL may be saved in this browser. **By default, the API key stays in page memory** and is cleared when you close or refresh the tab. Settings includes an optional “Remember provider key on this device” checkbox; opting in stores the key in this browser’s IndexedDB so it survives refreshes. This local copy is not encrypted by Forma, so do not enable it on shared devices. Uncheck the option or use Clear local data to delete it. Keys are not included in project exports or sent to Forma analytics/logs. When you test or use the assistant, Forma forwards the key with your prompt and current token draft to the provider you selected; review that provider's privacy and data-retention terms before sending sensitive material.

Custom endpoints must use HTTPS on the standard port, resolve only to public IP addresses, and implement the OpenAI-compatible chat-completions API. Local/private addresses and redirects are blocked. “Any provider” does not mean every API protocol is interchangeable.

## Local data and sharing

Projects and favorites stay in this browser; Forma does not sync them to a server. Browser storage may be cleared or evicted, so use the paired ZIP backup to keep an independent copy. The bundled gallery is static. Community publishing is intentionally not implemented; personal drafts are never uploaded to a public gallery.

## Supplied contracts

- `data/windows_11_pro_foundations.json` — `openui-foundations-draft` foundations data.
- `data/windows_11_pro_ui.json` — `openui-1.0` theme and component-token data.

The files remain distinct. The app maps supported theme values into the preview and exports each format separately; unsupported fields stay in the imported source document where possible. The sample website demonstrates this app's supported token mapping and is not a pixel-perfect rendering of an unrelated site.

## Deployment

This is a Next.js App Router app, pinned to Node 22, and supports Vercel's built-in Next.js settings. The merged PRs #6 and #8 passed hosted GitHub Actions CI and Vercel preview checks, but that does not establish the current production deployment or domain status; verify those in Vercel before treating production as confirmed. For a new deployment, import the repository into Vercel and keep the detected Next.js build settings. No database credentials or environment secrets are needed for the local-first experience; AI usage is optional and uses the key entered in Settings. The app sends standard security headers but intentionally does not set a frame-blocking header, so hosted previews can be embedded by the preview environment. Screen-reader accessibility is hardened: focus-trapped dialogs, a skip link, an ARIA tablist with arrow-key navigation, a keyboard-navigable export menu, and an assistant-chat live region.

Before shipping a public deployment, run `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`. The browser suite does not make live provider calls. Provider calls should be tested separately with a key that the owner is willing to use; the project does not include a provider key or make AI calls during build.
