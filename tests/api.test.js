import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, createWorkerApi, isRetryableError } from "../api.js";

test("API sends authenticated JSON mutations", async () => {
  let request;
  const api = createWorkerApi({ baseUrl: "https://example.test", appKey: "key", fetchImpl: async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } });
  await api.setAvatar("A", "fire");
  assert.equal(request.url, "https://example.test/set-avatar");
  assert.equal(request.init.headers["X-App-Key"], "key");
  assert.deepEqual(JSON.parse(request.init.body), { user: "A", avatar: "fire" });
});

test("API classifies conflicts as permanent and server errors as retryable", async () => {
  for (const [status, retryable] of [[409, false], [503, true]]) {
    const api = createWorkerApi({ baseUrl: "https://example.test", appKey: "key", fetchImpl: async () =>
      new Response(JSON.stringify({ error: "nope" }), { status }) });
    await assert.rejects(api.renameUser("A", "B"), (error) => error instanceof ApiError && error.retryable === retryable);
  }
  assert.equal(isRetryableError(new ApiError("bad", { status: 400, retryable: false })), false);
});

test("location requests send only transient coordinates to Worker endpoints", async () => {
  const requests = [];
  const api = createWorkerApi({ baseUrl: "https://example.test", appKey: "key", fetchImpl: async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  } });
  await api.resolveLocation({ latitude: 29.74, longitude: -95.39, accuracyM: 22 });
  await api.searchLocations("Montrose, Houston");
  assert.deepEqual(requests, [
    { url: "https://example.test/resolve-location", body: { latitude: 29.74, longitude: -95.39, accuracyM: 22 } },
    { url: "https://example.test/search-location", body: { query: "Montrose, Houston" } },
  ]);
});

test("Open Horse API sends join and cancel identities to dedicated endpoints", async () => {
  const requests = [];
  const api = createWorkerApi({ baseUrl: "https://example.test", appKey: "key", fetchImpl: async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } });
  await api.joinOpenHorseGame("hg-1", "Mia");
  await api.cancelOpenHorseGame("hg-1", "You");
  assert.deepEqual(requests, [
    { url: "https://example.test/horse-join", body: { gameId: "hg-1", user: "Mia" } },
    { url: "https://example.test/horse-cancel", body: { gameId: "hg-1", user: "You" } },
  ]);
});
