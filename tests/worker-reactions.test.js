// Reactions + dated challenge joins against real SQLite with 0001/0009/0011.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fetchData, setReaction, validateReaction } from "../worker/index.js";

function d1(sqlite) {
  const statement = (sql, params = []) => ({
    bind: (...args) => statement(sql, args),
    run: async () => sqlite.prepare(sql).run(...params),
    all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
    first: async (column) => {
      const row = sqlite.prepare(sql).get(...params);
      return column ? row?.[column] ?? null : row ?? null;
    },
    _exec: () => (/^\s*select/i.test(sql) ? { results: sqlite.prepare(sql).all(...params) } : sqlite.prepare(sql).run(...params)),
  });
  return {
    prepare: (sql) => statement(sql),
    batch: async (statements) => statements.map((s) => s._exec()),
  };
}
function freshDb(withReactions = true) {
  const sqlite = new DatabaseSync(":memory:");
  const dir = new URL("../worker/migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (!withReactions && file.startsWith("0011")) continue;
    sqlite.exec(readFileSync(new URL(file, dir), "utf8"));
  }
  return d1(sqlite);
}

test("validateReaction accepts the fixed set only", () => {
  assert.ok(validateReaction({ itemId: "s:1", user: "A", emoji: "🐐", on: true, owners: ["B"] }));
  assert.equal(validateReaction({ itemId: "s:1", user: "A", emoji: "🍕", on: true }), null);
  assert.equal(validateReaction({ itemId: "", user: "A", emoji: "🔥", on: true }), null);
  assert.equal(validateReaction({ itemId: "s:1", user: "A", emoji: "🔥" }), null);
});

test("reactions round-trip through /data; toggling off deletes; duplicates ignored", async () => {
  const db = freshDb();
  await setReaction(db, { itemId: "s:1", user: "A", emoji: "🔥", on: true, owners: ["B", "C"] });
  await setReaction(db, { itemId: "s:1", user: "A", emoji: "🔥", on: true, owners: ["B", "C"] });
  await setReaction(db, { itemId: "s:1", user: "B", emoji: "🐐", on: true, owners: ["B", "C"] });
  let data = await fetchData(db);
  assert.equal(data.reactionsEnabled, true);
  assert.equal(data.reactions.length, 2);
  assert.deepEqual(data.reactions[0].owners, ["B", "C"]);
  assert.ok(data.reactions[0].at > 0);
  await setReaction(db, { itemId: "s:1", user: "A", emoji: "🔥", on: false, owners: [] });
  data = await fetchData(db);
  assert.deepEqual(data.reactions.map((r) => r.emoji), ["🐐"]);
});

test("/data still works before 0011 runs", async () => {
  const data = await fetchData(freshDb(false));
  assert.equal(data.reactionsEnabled, false);
  assert.deepEqual(data.reactions, []);
  assert.deepEqual(data.challengeJoins, []);
});

test("joining a challenge records joined_at for the feed", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const dir = new URL("../worker/migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(file, dir), "utf8"));
  const db = d1(sqlite);
  const { default: worker } = await import("../worker/index.js");
  const res = await worker.fetch(new Request("https://w/join-challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user: "A", challengeId: "nov-grind" }) }), { DB: db });
  assert.equal(res.status, 200);
  const data = await fetchData(db);
  assert.equal(data.challengeJoins.length, 1);
  assert.equal(data.challengeJoins[0].user, "A");
  assert.ok(data.challengeJoins[0].at > 0);
});
