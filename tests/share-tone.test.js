import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SHARE_POOLS } from "../share-messages.js";
import { SHARE_TONE_RATINGS } from "../share-tone-ratings.js";
import { APP_SHARE_EXTRA_LINES } from "../share-lines-app.js";
import { addTonedLines, concatToned, pickToned, punchlineKey, tonedChoices } from "../share-tone.js";

// Any field a template reads gets a plausible value, so a typo'd field
// shows up as "undefined" in the rendered text.
const TEXT_FIELD = /text|label|display|name|title|word|hand|team|createdby|user|letter|rival|leader|trailer|turf|scope|ruler|ordinal|emoji|deadline|amount|urgency|stage|remaining$/i;
const BOOL_FIELD = /^(has|is|exceeded|won|winnerIsPlural)/;
const fakeCtx = () => new Proxy({}, {
  get(_, key) {
    if (key === "plural") return (n, w) => `${n} ${w}s`;
    if (typeof key !== "string") return undefined;
    if (BOOL_FIELD.test(key)) return true;
    if (TEXT_FIELD.test(key)) return `[${key}]`;
    return 3;
  },
  has: () => true,
});
// (n)/(t) take a count or time, (names)/(team) a string, anything else a context.
const argFor = (param) => (param === "n" || param === "t" ? 12 : param === "names" || param === "team" ? "[names]" : fakeCtx());
const render = (template) => {
  const params = (template.toString().match(/^\s*\(([^)]*)\)/)?.[1] || "").split(",").map((p) => p.trim()).filter(Boolean);
  return template(...params.map(argFor));
};

test("every share pool is fully rated and has at least 5 lines per tone", () => {
  for (const [name, pool] of Object.entries(SHARE_POOLS)) {
    assert.equal(pool.tones?.length, pool.length, `${name} ratings out of sync`);
    for (const code of "csu") {
      assert.ok([...pool.tones].filter((t) => t === code).length >= 5, `${name} has fewer than 5 "${code}" lines`);
    }
  }
});

test("every share line renders without undefined fields", () => {
  for (const [name, pool] of Object.entries(SHARE_POOLS)) {
    pool.forEach((template, i) => {
      const text = String(render(template));
      assert.doesNotMatch(text, /undefined|NaN|\[object/, `${name}#${i}: ${text}`);
    });
  }
});

test("app.js pools: ratings match their length and every tone has 5+ lines", () => {
  const src = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  for (const [name, extras] of Object.entries(APP_SHARE_EXTRA_LINES)) {
    const start = src.indexOf(`const ${name} = [\n`);
    assert.ok(start >= 0, `${name} not found in app.js`);
    const body = src.slice(start, src.indexOf("\n];", start));
    const count = (body.match(/^ {2}\(\w*\) =>/gm) || []).length;
    const pool = Array.from({ length: count }, () => () => "");
    addTonedLines({ [name]: Object.assign(pool, { tones: SHARE_TONE_RATINGS[name] }) }, { [name]: extras });
    assert.equal(SHARE_TONE_RATINGS[name].length, count, `${name} ratings out of sync with app.js`);
    for (const code of "csu") assert.ok([...pool.tones].filter((t) => t === code).length >= 5, `${name} short on "${code}"`);
    for (const code of "csu") for (const t of extras[code] || []) assert.doesNotMatch(String(render(t)), /undefined|NaN/);
  }
});

test("picking stays inside the chosen tone", () => {
  const pool = Object.assign(["a", "b", "c", "d"], { tones: "csuc" });
  assert.deepEqual(tonedChoices(pool, "chill"), ["a", "d"]);
  assert.deepEqual(tonedChoices(pool, "spicy"), ["b"]);
  assert.deepEqual(tonedChoices(["x"], "chill"), ["x"], "untagged arrays pass through");
  const joined = concatToned(Object.assign(["a"], { tones: "c" }), Object.assign(["b"], { tones: "u" }));
  assert.equal(joined.tones, "cu");
});

test("a punchline repeated behind several lead-ins counts once when picking", () => {
  const a1 = (n) => `Did ${n} pushups. Your move, cowards.`;
  const a2 = (n) => `Kept it classic: ${n} reps. Your move, cowards.`;
  const a3 = (n) => `${n} reps in the original flavor. Your move, cowards. 😤`;
  const b = (n) => `${n} pushups. Pay rent in reps, losers.`;
  assert.equal(punchlineKey(a1), punchlineKey(a3), "trailing emoji doesn't split a group");
  const pool = Object.assign([a1, a2, a3, b], { tones: "ssss" });
  let hitsB = 0;
  for (let i = 0; i < 400; i++) if (pickToned(pool, "spicy", () => (i % 2 ? 0.75 : 0.25)) === b) hitsB++;
  assert.equal(hitsB, 200, "the one-off joke gets half the picks, not a quarter");
});
