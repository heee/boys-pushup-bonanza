import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCorpus,
  normalizeSpoken,
  HORSE_CLEAR_LINES,
  HORSE_ELIMINATED_LINES,
  HORSE_LETTER_LINES,
  HORSE_WIN_LINES,
  SHARPSHOOTER_HIT_LINES,
  PULLUP_CHEER_LINES,
  PULLUP_RECORD_LINE,
  PULLUP_START_LINES,
  SITUP_CHEER_LINES,
  SITUP_RECORD_LINE,
  SITUP_START_LINES,
  SQUAT_CHEER_LINES,
  SQUAT_RECORD_LINE,
  SQUAT_START_LINES,
  zenCompletionLine,
} from "../voice-lines.js";

test("Zen completion reveals the final count in its calm closing line", () => {
  assert.equal(zenCompletionLine(24), "Practice complete. You completed 24 pushups.");
  assert.equal(zenCompletionLine(undefined), "Practice complete. You completed 0 pushups.");
});

test("every Sharpshooter bullseye line is included in the pre-rendered voice corpus", () => {
  const texts = new Set(buildCorpus().map((entry) => entry.text));
  for (const line of SHARPSHOOTER_HIT_LINES) assert.equal(texts.has(line), true, line);
});

test("every Horse mode line (clear/letter/eliminated/win) is included in the pre-rendered voice corpus", () => {
  const texts = new Set(buildCorpus().map((entry) => entry.text));
  for (const pool of [HORSE_CLEAR_LINES, HORSE_LETTER_LINES, HORSE_ELIMINATED_LINES, HORSE_WIN_LINES]) {
    for (const line of pool) assert.equal(texts.has(line), true, line);
  }
});

test("Horse line pools have real variety and no duplicate lines within a pool", () => {
  for (const pool of [HORSE_CLEAR_LINES, HORSE_LETTER_LINES, HORSE_ELIMINATED_LINES, HORSE_WIN_LINES]) {
    assert.ok(pool.length >= 8, `expected at least 8 lines, got ${pool.length}`);
    assert.equal(new Set(pool).size, pool.length, "pool has a duplicate line");
  }
});

test("every squat start/cheer line and the record line are included in the pre-rendered voice corpus", () => {
  const texts = new Set(buildCorpus().map((entry) => entry.text));
  for (const line of SQUAT_START_LINES) assert.equal(texts.has(line), true, line);
  for (const line of SQUAT_CHEER_LINES) assert.equal(texts.has(line), true, line);
  assert.equal(texts.has(SQUAT_RECORD_LINE), true, SQUAT_RECORD_LINE);
});

test("every pull-up start/cheer line and record line are in the voice corpus", () => {
  const texts = new Set(buildCorpus().map((entry) => entry.text));
  for (const line of PULLUP_START_LINES) assert.equal(texts.has(line), true, line);
  for (const line of PULLUP_CHEER_LINES) assert.equal(texts.has(line), true, line);
  assert.equal(texts.has(PULLUP_RECORD_LINE), true, PULLUP_RECORD_LINE);
});

test("squat corpus entries normalize to unique, non-empty keys", () => {
  const keys = buildCorpus().map((entry) => entry.key);
  for (const line of [...SQUAT_START_LINES, ...SQUAT_CHEER_LINES, SQUAT_RECORD_LINE]) {
    const key = normalizeSpoken(line);
    assert.ok(key.length > 0, line);
    assert.equal(keys.includes(key), true, line);
  }
});

test("every situp start/cheer line and the record line are included in the pre-rendered voice corpus", () => {
  const texts = new Set(buildCorpus().map((entry) => entry.text));
  for (const line of SITUP_START_LINES) assert.equal(texts.has(line), true, line);
  for (const line of SITUP_CHEER_LINES) assert.equal(texts.has(line), true, line);
  assert.equal(texts.has(SITUP_RECORD_LINE), true, SITUP_RECORD_LINE);
});

test("situp corpus entries normalize to unique, non-empty keys", () => {
  const keys = buildCorpus().map((entry) => entry.key);
  for (const line of [...SITUP_START_LINES, ...SITUP_CHEER_LINES, SITUP_RECORD_LINE]) {
    const key = normalizeSpoken(line);
    assert.ok(key.length > 0, line);
    assert.equal(keys.includes(key), true, line);
  }
});
