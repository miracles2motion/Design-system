import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";

export class ProviderError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
    this.name = "ProviderError";
  }
}

const TIMEOUT_CODES = new Set([
  "ABORT_ERR",
  "ETIMEDOUT",
  "ESOCKETTIMEDOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
]);

export function isTimeoutError(error: unknown): boolean {
  const visited = new Set<unknown>();
  let current = error;
  while ((typeof current === "object" && current !== null) || typeof current === "function") {
    if (visited.has(current)) return false;
    visited.add(current);
    const candidate = current as { name?: unknown; code?: unknown; message?: unknown; cause?: unknown };
    if (candidate.name === "TimeoutError" || candidate.name === "AbortError" || TIMEOUT_CODES.has(String(candidate.code)) ||
      (typeof candidate.message === "string" && /timed?\s*out|timeout/i.test(candidate.message))) return true;
    current = candidate.cause;
  }
  return false;
}

export function providerError(provider: string, error: unknown, signal?: AbortSignal): ProviderError {
  const timedOut = Boolean(signal?.aborted) || isTimeoutError(error);
  return new ProviderError(
    timedOut
      ? `${provider} request timed out. Try again.`
      : `${provider} could not be reached. Check your connection and provider settings.`,
    timedOut ? 504 : 502,
  );
}

export type ProviderAddress = { address: string; family: number };

/**
 * Send a request to an already-validated, DNS-pinned custom provider. The optional
 * request adapter keeps transport behavior testable without opening network access.
 */
export async function customProviderRequest(
  endpoint: string,
  addresses: ProviderAddress[],
  apiKey: string,
  payload: Record<string, unknown>,
  signal: AbortSignal,
  requestFn: typeof httpsRequest = httpsRequest,
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

  try {
    return await new Promise<Response>((resolve, reject) => {
      let settled = false;
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const upstream = requestFn(endpoint, {
        method: "POST",
        agent: false,
        lookup: pinnedLookup,
        servername: url.hostname,
        signal,
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
          try {
            resolve(new Response(Buffer.concat(chunks), {
              status: response.statusCode ?? 502,
              headers: { "content-type": response.headers["content-type"] ?? "application/json" },
            }));
          } catch (error) {
            reject(error);
          }
        });
      });
      upstream.on("timeout", () => upstream.destroy(new Error("The custom provider request timed out.")));
      upstream.on("error", fail);
      upstream.end(requestBody);
    });
  } catch (error) {
    throw providerError("Custom provider", error, signal);
  }
}
