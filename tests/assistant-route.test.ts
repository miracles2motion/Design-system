import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../app/api/assistant/route";

const endpoint = "https://forma.example/api/assistant";
const apiKey = "test-only-key";

function makeRequest(body: string, headers: Record<string, string> = { "content-type": "application/json" }) {
  return new Request(endpoint, {
    method: "POST",
    headers: { ...headers, "x-provider-api-key": apiKey },
    body,
  });
}

async function responseError(response: Response) {
  return (await response.json()) as { error: string };
}

test("assistant route rejects missing API keys without reading or forwarding the request", async () => {
  const request = new Request(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "openai", model: "test", prompt: "hello" }),
  });
  const response = await POST(request);

  assert.equal(response.status, 400);
  assert.match((await responseError(response)).error, /API key/i);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
});

test("assistant route reports malformed JSON as a client error", async () => {
  const response = await POST(makeRequest("{"));
  assert.equal(response.status, 400);
  assert.match((await responseError(response)).error, /valid JSON/i);
});

test("assistant route enforces its body limit while streaming", async () => {
  const oversized = JSON.stringify({
    provider: "openai",
    model: "example-model",
    prompt: "x".repeat(21_000),
  });
  const response = await POST(makeRequest(oversized));

  assert.equal(response.status, 413);
  assert.match((await responseError(response)).error, /too large/i);
});

test("assistant route rejects a private custom endpoint as invalid input", async () => {
  const response = await POST(makeRequest(JSON.stringify({
    provider: "custom",
    model: "example-model",
    prompt: "Make the palette warmer",
    baseUrl: "https://127.0.0.1/v1",
  })));

  assert.equal(response.status, 400);
  assert.match((await responseError(response)).error, /HTTPS.*IP addresses/i);
});

test("assistant route rejects unsupported providers without making an upstream request", async () => {
  const response = await POST(makeRequest(JSON.stringify({
    provider: "unknown-provider",
    model: "example-model",
    prompt: "Make the palette warmer",
  })));

  assert.equal(response.status, 400);
  assert.match((await responseError(response)).error, /supported provider/i);
});

test("assistant route redacts upstream error bodies and disables caching on failures", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { message: `Invalid API key: ${apiKey}`, request_id: "provider-private-request-id" },
  }), { status: 401, headers: { "content-type": "application/json" } });

  try {
    const response = await POST(makeRequest(JSON.stringify({
      provider: "openai",
      model: "example-model",
      prompt: "Make the palette warmer",
    })));
    const data = await responseError(response);
    assert.equal(response.status, 502);
    assert.match(data.error, /openai returned an error \(401\)/i);
    assert.doesNotMatch(data.error, /Invalid API key|test-only-key|provider-private-request-id/i);
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("assistant route normalizes upstream timeouts without reflecting raw errors", async () => {
  const originalFetch = globalThis.fetch;
  const timeoutError = new Error(`Timed out while sending ${apiKey}`);
  timeoutError.name = "TimeoutError";
  globalThis.fetch = async (_input, init) => {
    assert.ok(init?.signal instanceof AbortSignal);
    throw timeoutError;
  };

  try {
    const response = await POST(makeRequest(JSON.stringify({
      provider: "openai",
      model: "example-model",
      prompt: "Make the palette warmer",
    })));
    const data = await responseError(response);
    assert.equal(response.status, 504);
    assert.match(data.error, /openai request timed out/i);
    assert.doesNotMatch(data.error, /test-only-key|Timed out while sending/i);
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("assistant route normalizes upstream transport errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError(`Connection failed for ${apiKey}`);
  };

  try {
    const response = await POST(makeRequest(JSON.stringify({
      provider: "openai",
      model: "example-model",
      prompt: "Make the palette warmer",
    })));
    const data = await responseError(response);
    assert.equal(response.status, 502);
    assert.match(data.error, /openai could not be reached/i);
    assert.doesNotMatch(data.error, /test-only-key|Connection failed/i);
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("assistant route normalizes malformed upstream JSON without exposing raw content", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("not-json-content", {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  try {
    const response = await POST(makeRequest(JSON.stringify({
      provider: "openai",
      model: "example-model",
      prompt: "Make the palette warmer",
    })));
    const data = await responseError(response);
    assert.equal(response.status, 502);
    assert.match(data.error, /invalid json/i);
    assert.doesNotMatch(data.error, /not-json-content/i);
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("assistant route returns validated typography and spacing proposals", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          summary: "A calmer, more editorial foundation.",
          typography: { family: "serif", bodySize: 16, headingSize: 32, lineHeight: 1.6 },
          spacing: { pageMargin: 32, sectionGap: 20, cardPadding: 24, controlHeight: 42, rowHeight: 80 },
        }),
      },
    }],
  }), { status: 200, headers: { "content-type": "application/json" } });

  try {
    const response = await POST(makeRequest(JSON.stringify({
      provider: "openai",
      model: "example-model",
      prompt: "Use serif typography and more generous spacing.",
      current: { typography: { family: "humanist", bodySize: 14 }, spacing: { pageMargin: 24 } },
    })));
    assert.equal(response.status, 200);
    const data = await response.json() as { patch: Record<string, unknown> };
    assert.deepEqual(data.patch.typography, { family: "serif", bodySize: 16, headingSize: 32, lineHeight: 1.6 });
    assert.deepEqual(data.patch.spacing, { pageMargin: 32, sectionGap: 20, cardPadding: 24, controlHeight: 42, rowHeight: 80 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
