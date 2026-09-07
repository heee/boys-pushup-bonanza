import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";
import { CHAINOFPAIN_START_LINES, CHAINOFPAIN_CHEER_LINES, CHAINOFPAIN_PUSHUP_CHEER_LINES, CHAINOFPAIN_PLANK_LINES, CHAINOFPAIN_RECORD_LINE, CHAINOFPAIN_GO_LINE, CHAINOFPAIN_FINISH_LINE, CHAINOFPAIN_TRANSITION_LINES, VOICE_PRESETS, normalizeSpoken, buildCorpus } from "../voice-lines.js";

test("every Chain of Pain cue and setup countdown has recorded audio in every voice preset", async () => {
  const lines = [...CHAINOFPAIN_START_LINES, ...CHAINOFPAIN_CHEER_LINES, ...CHAINOFPAIN_PUSHUP_CHEER_LINES, ...CHAINOFPAIN_PLANK_LINES, CHAINOFPAIN_RECORD_LINE, CHAINOFPAIN_GO_LINE, CHAINOFPAIN_FINISH_LINE, ...Object.values(CHAINOFPAIN_TRANSITION_LINES), "five", "four", "three", "two", "one"];
  const corpus = new Set(buildCorpus().map((entry) => entry.key));
  for (const preset of VOICE_PRESETS) {
    const dir = new URL(`../assets/voice/${preset.dir ? `${preset.dir}/` : ""}`, import.meta.url);
    const manifest = JSON.parse(await readFile(new URL("manifest.json", dir), "utf8"));
    for (const line of lines) {
      const key = normalizeSpoken(line);
      assert.ok(corpus.has(key), line);
      assert.ok(manifest.clips[key], `${preset.id}: ${line}`);
      assert.ok((await stat(new URL(manifest.clips[key], dir))).size > 100, `${preset.id}: ${line}`);
    }
  }
});
