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
    updateModeCounterBadge: (id, count) => { $(id).textContent = String(count); $(id).classList.add("pop"); },
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
  assert.equal(w.run("chainOfPainState.rules.segmentReps"), 0, "calibration movement is not workout reps");
  w.frame(0.25, 2200);
  w.frame(0.65, 2350);
  w.frame(0.25, 2500);
  assert.ok(w.run("chainOfPainState.rules.segmentReps") > 0);
  w.run("tickChainOfPain()");
  assert.equal(w.$("chainofpain-timer").textContent, "0:30");
  assert.equal(w.$("chainofpain-counter-badge").textContent, String(w.run("chainOfPainState.rules.segmentReps")));
  w.setTime(33000);
  w.run("tickChainOfPain()");
  assert.equal(w.run("chainOfPainState.stage"), "resting");
  assert.match(w.$("chainofpain-rest-body").textContent, /^Next up: PUSHUPS/);
  assert.equal(w.$("btn-chainofpain-cancel").classList.contains("hidden"), true);
  w.setTime(34000);
  w.run("tickChainOfPain()");
  assert.equal(w.$("chainofpain-rest-countdown").textContent, "9");
});

test("phone setup ignores motion, speaks five through one, then starts fresh calibration", () => {
  const w = workout();
  w.run("beginChainOfPainSetup()");
  for (let i = 0; i < 5; i++) {
    w.frame(i % 2 ? 0.7 : 0.2, i * 1000);
    w.run("tickChainOfPain()");
    assert.equal(w.run("chainOfPainState.stage"), "setup");
    assert.equal(w.run("chainOfPainState.calSamples.length"), 0);
    assert.equal(w.run("chainOfPainState.rules.segmentReps"), 0);
  }
  w.setTime(5000);
  w.run("tickChainOfPain()");
  assert.equal(w.run("chainOfPainState.stage"), "warmup");
  assert.deepEqual(w.spoken, ["five", "four", "three", "two", "one", "Start!"]);
  assert.equal(w.$("chainofpain-setup-stage").classList.contains("hidden"), true);
  assert.equal(w.run("chainOfPainState.segmentStartedAt"), 0);
});

test("pushups use the countdown and rep overlay; plank counts down without a rep overlay", () => {
  const w = workout();
  w.run("chainOfPainCompleteSegment(chainOfPainState.rules); chainOfPainAdvanceFromRest(chainOfPainState.rules); beginChainOfPainCounting({down: 0.6, up: 0.3})");
  assert.equal(w.$("chainofpain-timer").textContent, "0:30");
  w.setTime(1000);
  w.run("onChainOfPainRepCounted(1); tickChainOfPain()");
  assert.equal(w.$("chainofpain-timer").textContent, "0:29");
  assert.equal(w.$("chainofpain-counter-badge").textContent, "1");
  assert.equal(w.spoken.at(-1), "one");
  w.run("onChainOfPainRepCounted(2)");
  assert.equal(w.spoken.at(-1), "two");
  w.run("triggerChainOfPainRest()");
  assert.match(w.$("chainofpain-rest-body").textContent, /^Next up: PLANK HOLD/);
  w.run("chainOfPainAdvanceFromRest(chainOfPainState.rules); beginChainOfPainPlankHold()");
  assert.equal(w.$("chainofpain-timer").textContent, "0:30");
  assert.equal(w.$("chainofpain-counter-badge").classList.contains("hidden"), true);
  assert.equal(w.$("chainofpain-correction-row").classList.contains("hidden"), true);
  w.setTime(35000); // delayed timer callback must never over-credit the hold
  w.run("tickChainOfPain()");
  assert.equal(w.run("chainOfPainState.rules.totals.plankSeconds"), 30);
  assert.match(w.$("chainofpain-rest-body").textContent, /^Next up: SQUATS/);
});

test("plank cues play once per milestone without bursts on delayed callbacks", () => {
  const w = workout();
  w.run("chainOfPainState.rules.segmentIndex=2; beginChainOfPainPlankHold()");
  for(const time of [7500,7600,15000,15100,22500,22600]) {w.setTime(time);w.run("tickChainOfPain()");}
  assert.equal(w.spoken.length,3);
  assert.match(w.spoken[0],/Brace/); assert.match(w.spoken[1],/Halfway/); assert.match(w.spoken[2],/Last stretch/);
});
