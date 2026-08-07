import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCorpus,
  normalizeSpoken,
  SHARPSHOOTER_HIT_LINES,
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

test("every squat start/cheer line and the record line are included in the pre-rendered voice corpus", () => {
  const texts = new Set(buildCorpus().map((entry) => entry.text));
  for (const line of SQUAT_START_LINES) assert.equal(texts.has(line), true, line);
  for (const line of SQUAT_CHEER_LINES) assert.equal(texts.has(line), true, line);
  assert.equal(texts.has(SQUAT_RECORD_LINE), true, SQUAT_RECORD_LINE);
});

test("squat corpus entries normalize to unique, non-empty keys", () => {
  const keys = buildCorpus().map((entry) => entry.key);
  for (const line of [...SQUAT_START_LINES, ...SQUAT_CHEER_LINES, SQUAT_RECORD_LINE]) {
    const key = normalizeSpoken(line);
    assert.ok(key.length > 0, line);
    assert.equal(keys.includes(key), true, line);
  }
});
