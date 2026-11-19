import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { NextResponse } from "next/server";
import { parseThemeProposal } from "../../../lib/theme";

export const runtime = "nodejs";
export const maxDuration = 30;

const PROVIDER_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  nvidia: "https://integrate.api.nvidia.com/v1/chat/completions",
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };
const MAX_REQUEST_BYTES = 20_000;

class RequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "RequestError";
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) {
      throw new RequestError("Request body has an invalid content length.");
    }
    if (declaredLength > MAX_REQUEST_BYTES) {
      throw new RequestError("The assistant request is too large.", 413);
    }
  }

  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("Request body must be valid JSON.");

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new RequestError("The assistant request is too large.", 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError("Request body could not be read.");
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new RequestError("Request body must be valid UTF-8 JSON.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestError("Request body must be valid JSON.");
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const octets = address.split(".").map(Number);
    const [a, b, c] = octets;
    if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) return false;
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    if (a === 255) return false;
    return true;
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) return false;
    if (normalized === "::" || normalized === "::1") return false;
    // Only global-unicast 2000::/3 is allowed; reject documentation and transition ranges too.
    if (!normalized.startsWith("2") && !normalized.startsWith("3")) return false;
    if (normalized.startsWith("2001:db8:") || normalized.startsWith("2001:0:") || normalized.startsWith("2001:10:") || normalized.startsWith("2002:")) return false;
    return true;
  }
  return false;
}

async function customChatEndpoint(value: unknown): Promise<{ endpoint: string; addresses: { address: string; family: number }[] }> {
  if (typeof value !== "string" || value.length > 512) throw new RequestError("Enter a valid custom provider URL.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RequestError("Enter a complete HTTPS URL for the custom provider.");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  url.hostname = hostname;
  if (url.protocol !== "https:" || !hostname || isIP(hostname) || url.username || url.password || url.search || url.hash || (url.port && url.port !== "443")) {
    throw new RequestError("Custom providers must use HTTPS on the standard port, without URL credentials, query strings, or IP addresses.");
  }
  if (!hostname.includes(".") || /\.(localhost|local|internal|test|example|invalid|onion)$/.test(hostname)) {
    throw new RequestError("Local, private, and reserved hostnames cannot be used as custom provider URLs.");
  }
  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new RequestError("The custom provider hostname could not be resolved.");
  }
  if (!addresses.length || addresses.some((entry) => !isPublicAddress(entry.address))) {
    throw new RequestError("The custom provider must resolve only to public IP addresses.");
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (path.includes("/chat/completions/")) throw new RequestError("The custom URL path is not a valid chat-completions endpoint.");
  const endpoint = path.endsWith("/chat/completions")
    ? `${url.origin}${path}`
    : `${url.origin}${path === "/" ? "" : path}/chat/completions`;
  return { endpoint, addresses };
}

function postCustomProvider(
  endpoint: string,
  addresses: { address: string; family: number }[],
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  const url = new URL(endpoint);
  const requestBody = JSON.stringify(payload);
  const pinnedLookup = ((hostname: string, options: unknown, callback: (...args: any[]) => void) => {
    if (hostname.toLowerCase().replace(/\.$/, "") !== url.hostname.toLowerCase().replace(/\.$/, "")) {
      callback(new Error("Unexpected hostname in custom provider connection."));
      return;
    }
    const all = typeof options === "object" && options !== null && "all" in options && Boolean((options as { all?: boolean }).all);
    callback(null, all ? addresses : addresses[0].address, all ? undefined : addresses[0].family);
  }) as unknown as LookupFunction;

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const upstream = httpsRequest(endpoint, {
      method: "POST",
      agent: false,
      lookup: pinnedLookup,
      servername: url.hostname,
      timeout: 25_000,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
        "content-length": Buffer.byteLength(requestBody),
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer | string) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.byteLength;
        if (size > 1_000_000) {
          upstream.destroy(new Error("The custom provider response exceeded the size limit."));
          return;
        }
        chunks.push(bytes);
      });
      response.on("error", fail);
      response.on("end", () => {
        if (settled) return;
        settled = true;
        resolve(new Response(Buffer.concat(chunks), {
          status: response.statusCode ?? 502,
          headers: { "content-type": response.headers["content-type"] ?? "application/json" },
        }));
      });
    });
    upstream.on("timeout", () => upstream.destroy(new Error("The custom provider request timed out.")));
    upstream.on("error", fail);
    upstream.end(requestBody);
  });
}

function extractOpenAiText(payload: unknown): string {
  if (!isObject(payload) || !Array.isArray(payload.choices)) return "";
  const choice = payload.choices[0];
  if (!isObject(choice) || !isObject(choice.message)) return "";
  return typeof choice.message.content === "string" ? choice.message.content : "";
}

function extractAnthropicText(payload: unknown): string {
  if (!isObject(payload) || !Array.isArray(payload.content)) return "";
  const block = payload.content.find((item) => isObject(item) && item.type === "text");
  return isObject(block) && typeof block.text === "string" ? block.text : "";
}

function extractGeminiText(payload: unknown): string {
  if (!isObject(payload) || !Array.isArray(payload.candidates)) return "";
  const candidate = payload.candidates[0];
  if (!isObject(candidate) || !isObject(candidate.content) || !Array.isArray(candidate.content.parts)) return "";
  const part = candidate.content.parts.find((item) => isObject(item) && typeof item.text === "string");
  return isObject(part) && typeof part.text === "string" ? part.text : "";
}

async function readUpstream(response: Response, provider: string) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    // Do not pass upstream request details, headers, or credentials back to the browser.
    throw new Error(`${provider} returned an error (${response.status}). Check the provider, model, and key.`);
  }
  return body;
}

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get("x-provider-api-key")?.trim();
    if (!apiKey || apiKey.length > 500) {
      return NextResponse.json({ error: "Add a valid provider API key in Settings." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const body = await readJsonBody(request);
    if (!isObject(body)) return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: NO_STORE_HEADERS });
    const provider = typeof body.provider === "string" ? body.provider : "";
    const model = typeof body.model === "string" ? body.model.trim() : "";
    if (!model || model.length > 160) return NextResponse.json({ error: "Enter a model ID in Settings." }, { status: 400, headers: NO_STORE_HEADERS });

    const userPrompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 1800) : "";
    if (!userPrompt) return NextResponse.json({ error: "Add a short design brief first." }, { status: 400, headers: NO_STORE_HEADERS });

    const current = isObject(body.current) ? body.current : {};
    const openAiEndpoint = Object.hasOwn(PROVIDER_URLS, provider) ? PROVIDER_URLS[provider] : undefined;
    const systemPrompt = [
      "You are Forma, a careful design-token assistant. Propose visual token values, not HTML, CSS, code, or arbitrary tool calls.",
      "Return one JSON object only, with no markdown. Include a short summary and any changed fields from the allowed shape.",
      "Allowed shape: {summary:string,name?:string,description?:string,radius?:number,density?:'comfortable'|'compact',light?:{background,surface,elevated,highlight,accent,accentPressed,accentSubtle,secondary,text,muted,faint,border,interactiveBorder,onAccent},dark?:{same fields},typography?:{family?:'humanist'|'system'|'serif'|'monospace',bodySize?:integer 12..18,headingSize?:integer 20..40,lineHeight?:number 1.2..1.8 in 0.1 steps},spacing?:{pageMargin?:integer 8..48,sectionGap?:integer 4..32,cardPadding?:integer 4..32,controlHeight?:integer 24..48,rowHeight?:integer 40..96}}.",
      "All color values must be six-digit hex. Do not add properties outside the allowed shape. Keep user-provided constraints. Prefer accessible text and accent pairings. The application will validate your values.",
      "Typography family must use one of the listed IDs. Only propose changed typography or spacing fields; do not invent additional token properties.",
    ].join(" ");
    const prompt = `User request: ${userPrompt}\nCurrent design system summary: ${JSON.stringify(current).slice(0, 5000)}\nReturn a JSON patch only.`;

    let text = "";
    if (provider === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 900,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      text = extractAnthropicText(await readUpstream(response, "Anthropic"));
    } else if (provider === "gemini") {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.35, maxOutputTokens: 900 },
        }),
      });
      text = extractGeminiText(await readUpstream(response, "Gemini"));
    } else if (provider === "custom") {
      const { endpoint, addresses } = await customChatEndpoint(body.baseUrl);
      const response = await postCustomProvider(endpoint, addresses, apiKey, {
        model,
        temperature: 0.35,
        max_tokens: 900,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
      });
      text = extractOpenAiText(await readUpstream(response, "Custom provider"));
    } else if (openAiEndpoint) {
      const response = await fetch(openAiEndpoint, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
          ...(provider === "openrouter" ? { "http-referer": new URL(request.url).origin, "x-title": "Forma Token Studio" } : {}),
        },
        body: JSON.stringify({
          model,
          temperature: 0.35,
          max_tokens: 900,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
        }),
      });
      text = extractOpenAiText(await readUpstream(response, provider));
    } else {
      return NextResponse.json({ error: "Choose a supported provider in Settings." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd <= jsonStart) throw new Error("The model did not return JSON. Try again or choose another model.");
    const rawPatch = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    const patch = parseThemeProposal(rawPatch);
    return NextResponse.json({ patch }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The request could not be completed.";
    const status = error instanceof RequestError ? error.status : 502;
    return NextResponse.json({ error: message }, { status, headers: NO_STORE_HEADERS });
  }
}
