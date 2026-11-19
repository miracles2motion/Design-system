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
```

## What is included

- Overview, AI Studio, Discovery, and Settings views; no account or login is required.
- A Windows/Fluent-inspired light and dark starter theme, plus five bundled gallery designs. The gallery is discovery-only; it has no checkout or public publishing backend.
- A live sample SaaS dashboard preview with light/dark modes and desktop, tablet, and mobile layouts. Palette, radius, and density edits apply immediately to the preview.
- Local drafts and saved gallery favorites in IndexedDB, with multiple projects and a paired ZIP backup. Extract the two JSON files before importing that backup; the app’s import control accepts either contract or both files together.
- Import for either `openui-1.0` or `openui-foundations-draft`, including importing both files together. Imported source objects are retained for round-tripping unknown fields. Exports include the OpenUI file, the foundations file, a matching `pairsWith` filename in the foundations contract, and CSS variables.
- BYOK assistant adapters for OpenAI, Anthropic/Claude, Gemini, OpenRouter, NVIDIA NIM, and custom OpenAI-compatible endpoints. Proposals are validated server-side and shown for review before they are applied. Undo is available in the Studio.

## Chat with Forma

From Overview, choose **Chat with Forma**, or add a provider key in **Settings** and choose **Chat with Forma** there. This opens AI Studio and focuses the prompt box. Ask for a design change (for example, “make a calm palette for a wellness app”), then press **Send**. Forma shows a reviewable proposal; it does not change your draft until you choose **Apply changes**. Provider testing in Settings is optional.

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

This is a Next.js App Router app, pinned to Node 22, and is ready for Vercel's built-in Next.js support. After the current branch is pushed to the connected Git repository, create/import a Vercel project from it and keep the detected Next.js build settings. No database credentials or environment secrets are needed for the local-first experience; AI usage is optional and uses the key entered in Settings. The app sends standard security headers but intentionally does not set a frame-blocking header, so hosted previews can be embedded by the preview environment.

Before shipping a public deployment, run `npm ci`, `npm test`, `npm run typecheck`, and `npm run build`. Provider calls should be tested with a key that the owner is willing to use; the project does not include a provider key or make AI calls during build.
