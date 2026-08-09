import assert from "node:assert/strict";
import test from "node:test";
import { createRepCounter } from "../rep-counter.js";
import {
  deriveSitupThresholds,
  estimateSitupRange,
  median,
  situpCalibrationValid,
  situpFrameRatio,
  situpRatio,
  situpSwing,
  SITUP_DROPOUT_DEBOUNCE_MS,
  SITUP_LOST_RATIO,
} from "../modes/situp.js";

// Same replay harness as tests/squat-counter.test.js, but the samples are the
// INVERTED ratio (1 - faceBBox.height/videoHeight) situps feed the counter —
// see docs/situp-mode-plan.md and modes/situp.js's header comment. Because
// the signal is inverted, the counter's "down" phase corresponds to lying
// back (ratio high) and the counted down->up transition fires at the crunch
// top (ratio low) — the mirror image of squat's stand/squat roles. Wherever
// tests/squat-counter.test.js used its low "STAND_Y" value, these use
// CRUNCH_RATIO (the counter-math role is the same: the low extreme that
// phase="up" already matches); wherever it used the high "SQUAT_Y" value,
// these use LIE_RATIO (the high extreme that triggers the "down" phase).
function replay(samples, config) {
  const counter = createRepCounter(config);
  return samples.map(([ratio, time]) => counter.advance(ratio, time));
}

const CRUNCH_RATIO = 0.25;
const LIE_RATIO = 0.75;
const { down: DOWN, up: UP } = deriveSitupThresholds(CRUNCH_RATIO, LIE_RATIO);

test("situpRatio inverts normalized face size", () => {
  assert.equal(situpRatio(0), 1);
  assert.equal(situpRatio(1), 0);
  assert.equal(situpRatio(0.4), 0.6);
});

test("deriveSitupThresholds sits down/up inside the crunch->lie span", () => {
  assert.ok(DOWN > UP);
  assert.ok(DOWN < LIE_RATIO);
  assert.ok(UP > CRUNCH_RATIO);
});

test("situpCalibrationValid rejects a swing under the minimum frame-height fraction", () => {
  assert.equal(situpCalibrationValid(0.30, 0.36), false); // 0.06 swing, phone too far from his feet
  assert.equal(situpCalibrationValid(CRUNCH_RATIO, LIE_RATIO), true);
  assert.equal(situpSwing(CRUNCH_RATIO, LIE_RATIO), 0.5);
});

test("median is robust to an odd sample count and stray outliers", () => {
  assert.equal(median([0.24, 0.25, 0.26]), 0.25);
  assert.equal(median([0.24, 0.25, 0.26, 0.9]), (0.25 + 0.26) / 2);
  assert.equal(median([]), 0);
});

test("counts one rep for a comfortable-tempo full situp, fired at the crunch top", () => {
  const results = replay([
    [CRUNCH_RATIO, 0], [0.6, 200], [LIE_RATIO, 400], [0.6, 600], [CRUNCH_RATIO, 800],
  ], { down: DOWN, up: UP });
  assert.equal(results.at(-1).count, 1);
  assert.equal(results.at(-1).counted, true);
});

test("counts a fast situp (sprint pace, small confirm gaps)", () => {
  const results = replay([
    [CRUNCH_RATIO, 0], [LIE_RATIO, 33], [LIE_RATIO, 66], [CRUNCH_RATIO, 99], [CRUNCH_RATIO, 132],
  ], { down: DOWN, up: UP });
  assert.equal(results.at(-1).count, 1);
});

test("counts a slow, deliberate situp (sparse frames, wide time gaps)", () => {
  const results = replay([
    [CRUNCH_RATIO, 0], [LIE_RATIO, 900], [CRUNCH_RATIO, 1900],
  ], { down: DOWN, up: UP });
  assert.equal(results.at(-1).count, 1);
});

test("a shallow head-lift that never reaches lying back does not count", () => {
  // Only lifts halfway toward lying flat — short of the down threshold, so
  // the "confirmed lying" phase is never entered and no crunch can count.
  const shallow = CRUNCH_RATIO + (LIE_RATIO - CRUNCH_RATIO) * 0.5;
  const results = replay([
    [CRUNCH_RATIO, 0], [shallow, 200], [shallow, 260], [CRUNCH_RATIO, 400],
  ], { down: DOWN, up: UP });
  assert.equal(results.at(-1).count, 0);
  assert.equal(results.at(-1).phase, "up");
});

test("ignores an isolated detection glitch that spikes past the down threshold for one frame", () => {
  const results = replay([
    [CRUNCH_RATIO, 0], [LIE_RATIO, 33], [CRUNCH_RATIO, 66], [CRUNCH_RATIO, 99],
  ], { down: DOWN, up: UP });
  assert.equal(results.at(-1).count, 0);
  assert.equal(results.at(-1).phase, "up");
});

test("tolerates a face-detection gap mid-rep (dropout while lying flat)", () => {
  // Large gap between confirming "lying" and the eventual crunch, as if
  // frames were lost while the face was tilted at the ceiling.
  const results = replay([
    [CRUNCH_RATIO, 0], [LIE_RATIO, 100], [CRUNCH_RATIO, 1400],
  ], { down: DOWN, up: UP });
  assert.equal(results.at(-1).count, 1);
});

test("debounces two implausibly fast reps back to back", () => {
  const results = replay([
    [LIE_RATIO, 0], [LIE_RATIO, 33], [CRUNCH_RATIO, 66], [CRUNCH_RATIO, 99],
    [LIE_RATIO, 132], [LIE_RATIO, 165], [CRUNCH_RATIO, 198], [CRUNCH_RATIO, 231],
  ], { down: DOWN, up: UP });
  assert.equal(results.at(-1).count, 1);
});

test("estimateSitupRange recovers crunch/lie from a noisy warmup sample window", () => {
  // A boy doing a couple of real situps in front of the camera, with a
  // couple of single-frame detection glitches thrown in.
  const samples = [
    CRUNCH_RATIO, CRUNCH_RATIO, CRUNCH_RATIO, 0.4, 0.6, LIE_RATIO, LIE_RATIO, 0.6, 0.4, CRUNCH_RATIO,
    CRUNCH_RATIO, 0.4, 0.6, LIE_RATIO, LIE_RATIO, 0.6, CRUNCH_RATIO, 0.02 /* glitch */, 0.99 /* glitch */,
  ];
  const { crunchRatio, lieRatio } = estimateSitupRange(samples);
  assert.ok(Math.abs(crunchRatio - CRUNCH_RATIO) < 0.05);
  assert.ok(Math.abs(lieRatio - LIE_RATIO) < 0.05);
  assert.equal(situpCalibrationValid(crunchRatio, lieRatio), true);
});

test("estimateSitupRange stays invalid when the boy barely moves", () => {
  const samples = [0.30, 0.31, 0.32, 0.30, 0.33, 0.31, 0.30, 0.32, 0.34, 0.31];
  const { crunchRatio, lieRatio } = estimateSitupRange(samples);
  assert.equal(situpCalibrationValid(crunchRatio, lieRatio), false);
});

test("counts multiple full-depth reps in a row", () => {
  // An extra leading "confirmed lying" sample versus the squat equivalent:
  // the counter's phase inits to "up" (the crunch-math side here), so the
  // very first lying observation only sets prev — a second one is needed to
  // actually enter the "down"/lying phase before the first crunch can count.
  const results = replay([
    [CRUNCH_RATIO, 0], [LIE_RATIO, 300], [CRUNCH_RATIO, 600],
    [LIE_RATIO, 900], [CRUNCH_RATIO, 1200],
    [LIE_RATIO, 1500], [CRUNCH_RATIO, 1800],
  ], { down: DOWN, up: UP });
  assert.equal(results.at(-1).count, 3);
});

// ------------------- face-dropout clamp/debounce (situp-specific) -------------------
// Squats pause the whole session when the body leaves frame (a real signal
// something's wrong); situps expect the face to vanish every rep, while
// lying flat and tilted at the ceiling — see docs/situp-mode-plan.md's
// "Face dropout is signal, not noise". situpFrameRatio is the pure function
// that turns each detection/no-detection frame into the ratio fed to the
// counter (and, during warmup, into the calibration sample window).

test("situpFrameRatio reports the inverted ratio on detected frames and tracks it", () => {
  const trackState = {};
  const r1 = situpFrameRatio({ detected: true, normalizedFaceSize: 0.3, nowMs: 0, trackState });
  assert.equal(r1, 0.7);
  assert.equal(trackState.lastRatio, 0.7);
  const r2 = situpFrameRatio({ detected: true, normalizedFaceSize: 0.65, nowMs: 33, trackState });
  assert.equal(r2, 0.35);
});

test("situpFrameRatio holds the last known ratio through a brief single-frame dropout", () => {
  const trackState = {};
  situpFrameRatio({ detected: true, normalizedFaceSize: 0.7, nowMs: 0, trackState }); // ratio 0.3, crunched
  const held = situpFrameRatio({ detected: false, nowMs: 20, trackState }); // one glitchy frame
  assert.ok(Math.abs(held - 0.3) < 1e-9, "a single dropped frame should not read as lying back yet");
  assert.ok(20 < SITUP_DROPOUT_DEBOUNCE_MS);
});

test("situpFrameRatio clamps to the lying-back ceiling once a dropout outlasts the debounce", () => {
  const trackState = {};
  situpFrameRatio({ detected: true, normalizedFaceSize: 0.7, nowMs: 0, trackState }); // ratio 0.3
  situpFrameRatio({ detected: false, nowMs: 20, trackState }); // still within debounce
  const clamped = situpFrameRatio({ detected: false, nowMs: SITUP_DROPOUT_DEBOUNCE_MS + 50, trackState });
  assert.equal(clamped, SITUP_LOST_RATIO);
});

test("situpFrameRatio resumes real tracking as soon as the face is seen again", () => {
  const trackState = {};
  situpFrameRatio({ detected: true, normalizedFaceSize: 0.7, nowMs: 0, trackState });
  situpFrameRatio({ detected: false, nowMs: SITUP_DROPOUT_DEBOUNCE_MS + 50, trackState });
  const resumed = situpFrameRatio({ detected: true, normalizedFaceSize: 0.72, nowMs: SITUP_DROPOUT_DEBOUNCE_MS + 80, trackState });
  assert.equal(resumed, 0.28);
});

test("a synthetic trace with realistic lying-flat dropouts counts once per rep, no double-count from the dropout itself", () => {
  // normalizedFaceSize per frame: large near the crunch top, undetected
  // (null) while flat on the floor — exactly the pattern the phone-at-feet
  // capture design expects.
  const frames = [
    { t: 0, size: 0.75 },     // crunched, thrown-away first sample
    { t: 150, size: null },   // lying back, briefly undetected...
    { t: 300, size: null },   // ...for long enough to clamp
    { t: 450, size: null },
    { t: 900, size: 0.72 },   // crunching back up, detected again
    { t: 950, size: 0.78 },   // crunch top
    { t: 1100, size: null },  // lying back again...
    { t: 1250, size: null },
    { t: 1400, size: null },  // ...for long enough to clamp again
    { t: 1700, size: 0.74 },  // second crunch
    { t: 1750, size: 0.79 },
  ];
  const trackState = {};
  const counter = createRepCounter({ down: DOWN, up: UP });
  let last;
  for (const frame of frames) {
    const ratio = situpFrameRatio({
      detected: frame.size != null,
      normalizedFaceSize: frame.size,
      nowMs: frame.t,
      trackState,
    });
    last = counter.advance(ratio, frame.t);
  }
  assert.equal(last.count, 2);
});
