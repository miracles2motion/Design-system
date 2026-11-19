import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { customProviderRequest, isTimeoutError, ProviderError } from "../lib/provider-transport";

type Handlers = Record<string, ((...args: unknown[]) => void) | undefined>;

interface FakeRequest {
  response: EventEmitter & {
    statusCode?: number;
    headers?: Record<string, string | undefined>;
  };
  on(event: string, callback: (...args: unknown[]) => void): FakeRequest;
  destroy(error?: Error): void;
  end(): void;
}

function createTransport() {
  const handlers: Handlers = {};
  let request: FakeRequest | undefined;

  const requestFn = ((
    _url: string,
    _options: unknown,
    callback?: (response: FakeRequest["response"]) => void,
  ) => {
    const response = new EventEmitter() as FakeRequest["response"];
    response.statusCode = 200;
    response.headers = { "content-type": "application/json" };
    callback?.(response);
    request = {
      response,
      on(event: string, callback: (...args: unknown[]) => void) {
        handlers[event] = callback;
        return this;
      },
      destroy(error?: Error) {
        if (error && handlers.error) handlers.error(error);
      },
      end() {},
    };
    return request;
  }) as unknown as Parameters<typeof customProviderRequest>[5];

  return {
    requestFn,
    complete(status: number, body: string) {
      if (!request) throw new Error("The fake request was not created.");
      request.response.statusCode = status;
      request.response.emit("data", Buffer.from(body));
      request.response.emit("end");
    },
    fail(error: Error) {
      handlers.error?.(error);
    },
    timeout() {
      handlers.timeout?.();
    },
  };
}

test("provider transport detects timeouts in nested error causes", () => {
  const timeoutError = Object.assign(new Error("upstream closed"), {
    cause: Object.assign(new Error("request timed out"), { code: "UND_ERR_BODY_TIMEOUT" }),
  });
  assert.equal(isTimeoutError(timeoutError), true);
  assert.equal(isTimeoutError(new TypeError("connection refused")), false);
});

test("custom provider transport normalizes timeout failures", async () => {
  const transport = createTransport();
  const promise = customProviderRequest(
    "https://provider.example/v1/chat/completions",
    [{ address: "203.0.113.10", family: 4 }],
    "test-only-key",
    { model: "example-model", messages: [] },
    AbortSignal.timeout(25_000),
    transport.requestFn,
  ).then(() => ({ status: 200 })).catch((error: unknown) => error);

  transport.timeout();
  const error = (await promise) as unknown as ProviderError;
  assert.ok(error instanceof ProviderError);
  assert.equal(error.status, 504);
  assert.match(error.message, /custom provider request timed out/i);
});

test("custom provider transport normalizes transport failures", async () => {
  const transport = createTransport();
  const promise = customProviderRequest(
    "https://provider.example/v1/chat/completions",
    [{ address: "203.0.113.10", family: 4 }],
    "test-only-key",
    { model: "example-model", messages: [] },
    AbortSignal.timeout(25_000),
    transport.requestFn,
  ).then(() => ({ status: 200 })).catch((error: unknown) => error);

  transport.fail(new TypeError(`connection failed with ${"test-only-key"}`));
  const error = (await promise) as unknown as ProviderError;
  assert.ok(error instanceof ProviderError);
  assert.equal(error.status, 502);
  assert.match(error.message, /custom provider could not be reached/i);
  assert.doesNotMatch(error.message, /test-only-key|connection failed/i);
});
