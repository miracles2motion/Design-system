import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { clearLocal, readLocal, removeLocal, writeLocal } from "../lib/storage";

test("remembered provider keys persist locally and can be forgotten or cleared", async () => {
  await clearLocal();
  await writeLocal("provider-key", { provider: "openai", key: "test-key-not-a-real-secret" });
  await writeLocal("provider-config", { provider: "openai", model: "example-model" });

  assert.deepEqual(await readLocal("provider-key"), { provider: "openai", key: "test-key-not-a-real-secret" });
  assert.deepEqual(await readLocal("provider-config"), { provider: "openai", model: "example-model" });

  await removeLocal("provider-key");
  assert.equal(await readLocal<string>("provider-key"), null);
  assert.deepEqual(await readLocal("provider-config"), { provider: "openai", model: "example-model" });

  await clearLocal();
  assert.equal(await readLocal("provider-config"), null);
});
