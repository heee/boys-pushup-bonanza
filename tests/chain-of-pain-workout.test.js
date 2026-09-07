import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
// Bind only names actually imported by app.js, so missing wiring cannot be
// accidentally supplied by a test stub or a wildcard import.
const bindings = {};
for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)) {
  const path = match[2].split("?")[0];
  if (!["./voice-lines.js", "./modes/chain-of-pain.js", "./modes/squat.js", "./rep-counter.js"].includes(path)) continue;
  const exports = await import(new URL(`../${path}`, import.meta.url));
  for (const name of match[1].split(",").map((s) => s.trim()).filter(Boolean)) bindings[name] = exports[name];
}

function workout() {
  let now = 0;
  const elements = new Map();
  const timers = new Map();
  const spoken = [];
  let nextTimer = 0;
  const $ = (id) => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { textContent: "", classList: {
        add: (c) => classes.add(c), remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c),
        toggle: (c, on) => on ? classes.add(c) : classes.delete(c),
      } });
    }
    return elements.get(id);
  };
  const context = vm.createContext({ ...bindings, $, performance: { now: () => now },
    state: { chainOfPainDuration: "30s" },
    setInterval: (fn) => { timers.set(++nextTimer, fn); return nextTimer; },
    clearInterval: (id) => timers.delete(id),
    speak: (line) => spoken.push(line), pickFrom: (lines) => lines[0],
    soundIsEnabled: () => false, formatDuration: (ms) => `${ms / 1000}s`,
    squatHipY: (landmarks) => landmarks.hipY, squatBodyBBox: () => null,
    cheerProbability: () => 1, REP_SPEECH_MIN_GAP_MS: 0,
    vibrate: () => {},
  });
  const block = source.slice(source.indexOf("const CHAINOFPAIN_WARMUP_MIN_MS"), source.indexOf("function selectChainOfPainDuration"));
  vm.runInContext(block, context);
  const run = (code) => vm.runInContext(code, context);
  run("chainOfPainState.rules = chainOfPainCreateState(30); beginChainOfPainWarmup();");
  return { $, run, spoken, timers, setTime: (value) => { now = value; },
    frame: (hipY, time) => { now = time; context.sample = { hipY }; run("chainOfPainOnPoseDetection(sample)"); },
  };
}

test("Chain of Pain calibration enters counting, keeps processing poses, and starts segment/rest timers", () => {
  const w = workout();
  // Standing still must remain in calibration; real squat movement completes it.
  for (let i = 0; i < 10; i++) w.frame(0.25, i * 150);
  assert.equal(w.run("chainOfPainState.stage"), "warmup");
  for (let i = 10; i < 14; i++) w.frame(0.65, i * 150);
  assert.equal(w.run("chainOfPainState.stage"), "counting");
  assert.equal(w.$("chainofpain-cal-stage").classList.contains("hidden"), true);
  assert.equal(w.$("chainofpain-count-stage").classList.contains("hidden"), false);
  assert.ok(w.spoken.length > 0);
  w.frame(0.25, 2200);
  w.frame(0.25, 2400);
  assert.ok(w.run("chainOfPainState.rules.segmentReps") > 0);
  w.run("tickChainOfPain()");
  assert.match(w.$("chainofpain-hud-segment-timer").textContent, /s left$/);
  w.setTime(33000);
  w.run("tickChainOfPain()");
  assert.equal(w.run("chainOfPainState.stage"), "resting");
  w.setTime(34000);
  w.run("tickChainOfPain()");
  assert.equal(w.$("chainofpain-hud-segment-timer").textContent, "9s rest");
});
