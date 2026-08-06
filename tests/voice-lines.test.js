import test from "node:test";
import assert from "node:assert/strict";
import { buildCorpus, SHARPSHOOTER_HIT_LINES, zenCompletionLine } from "../voice-lines.js";

test("Zen completion reveals the final count in its calm closing line", () => {
  assert.equal(zenCompletionLine(24), "Practice complete. You completed 24 pushups.");
  assert.equal(zenCompletionLine(undefined), "Practice complete. You completed 0 pushups.");
});

test("every Sharpshooter bullseye line is included in the pre-rendered voice corpus", () => {
  const texts = new Set(buildCorpus().map((entry) => entry.text));
  for (const line of SHARPSHOOTER_HIT_LINES) assert.equal(texts.has(line), true, line);
});
