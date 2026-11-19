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
