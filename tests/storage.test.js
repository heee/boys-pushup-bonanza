import assert from "node:assert/strict";
import test from "node:test";
import { createJsonStorage, normalizeSharedData } from "../storage.js";

test("shared data normalization preserves fields and repairs collections", () => {
  assert.deepEqual(normalizeSharedData({ sessions: null, extra: 1 }), {
    sessions: [], avatars: {}, challengeParticipants: {}, customChallenges: [], extra: 1,
  });
});

test("JSON storage survives malformed values", () => {
  const backing = new Map([["bad", "{"]]);
  const store = createJsonStorage({ getItem: (key) => backing.get(key) ?? null, setItem: (key, value) => backing.set(key, value) });
  assert.deepEqual(store.read("bad", []), []);
  store.write("ok", { value: 2 });
  assert.deepEqual(store.read("ok", {}), { value: 2 });
});
