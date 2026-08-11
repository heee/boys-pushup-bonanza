import assert from "node:assert/strict";
import test from "node:test";
import { createRepCounter } from "../rep-counter.js";
import { deriveSquatThresholds, estimateSquatRange, median, replaySquatCalibration, squatCalibrationValid, squatSwing } from "../modes/squat.js";

// Same replay harness as tests/rep-counter.test.js, but the samples are
// bboxCenterY/videoHeight readings (standing near the top of frame, squatting
// deeper into it) run through thresholds derived the way the calibration
// screen derives them, rather than raw pushup face-size ratios.
function replay(samples, config) {
  const counter = createRepCounter(config);
  return samples.map(([ratio, time]) => counter.advance(ratio, time));
}

// Stand ~0.25 of the way down the frame, squat ~0.75 — a comfortable,
// well-lit calibration a couple meters from a wall-propped phone.
const STAND_Y = 0.25;
const SQUAT_Y = 0.75;
const { down: DOWN, up: UP } = deriveSquatThresholds(STAND_Y, SQUAT_Y);

test("deriveSquatThresholds sits down/up inside the stand->squat span", () => {
  assert.ok(DOWN > UP);
  assert.ok(DOWN < SQUAT_Y);
  assert.ok(UP > STAND_Y);
});

test("squatCalibrationValid rejects a swing under the minimum frame-height fraction", () => {
  assert.equal(squatCalibrationValid(0.30, 0.36), false); // 0.06 swing, too close to the wall
  assert.equal(squatCalibrationValid(STAND_Y, SQUAT_Y), true);
  assert.equal(squatSwing(STAND_Y, SQUAT_Y), 0.5);
});

test("median is robust to an odd sample count and stray outliers", () => {
  assert.equal(median([0.24, 0.25, 0.26]), 0.25);
  assert.equal(median([0.24, 0.25, 0.26, 0.9]), (0.25 + 0.26) / 2);
  assert.equal(median([]), 0);
});

test("counts one rep for a comfortable-tempo full squat", () => {
  const results = replay([
    [STAND_Y, 0], [0.6, 200], [SQUAT_Y, 400], [0.6, 600], [STAND_Y, 800],
  ], { down: DOWN, up: UP });
  assert.equal(results.at(-1).count, 1);
  assert.equal(results.at(-1).counted, true);
});

test("counts a fast squat (sprint pace, small confirm gaps)", () => {
  const results = replay([
    [STAND_Y, 0], [SQUAT_Y, 33], [SQUAT_Y, 66], [STAND_Y, 99], [STAND_Y, 132],
  ], { down: DOWN, up: UP });
  assert.equal(results.at(-1).count, 1);
});

test("counts a slow, deliberate squat (sparse frames, wide time gaps)", () => {
  const results = replay([
    [STAND_Y, 0], [SQUAT_Y, 900], [STAND_Y, 1900],
  ], { down: DOWN, up: UP });
  assert.equal(results.at(-1).count, 1);
});

test("a shallow half-squat that never reaches the down threshold does not count", () => {
  // Dips only to the midpoint between stand and squat — short of DOWN.
  const shallow = STAND_Y + (SQUAT_Y - STAND_Y) * 0.5;
  const results = replay([
    [STAND_Y, 0], [shallow, 200], [shallow, 260], [STAND_Y, 400],
  ], { down: DOWN, up: UP });
  assert.equal(results.at(-1).count, 0);
  assert.equal(results.at(-1).phase, "up");
});

test("ignores an isolated detection glitch that spikes past the down threshold for one frame", () => {
  const results = replay([
    [STAND_Y, 0], [SQUAT_Y, 33], [STAND_Y, 66], [STAND_Y, 99],
  ], { down: DOWN, up: UP });
  assert.equal(results.at(-1).count, 0);
  assert.equal(results.at(-1).phase, "up");
});

test("tolerates a face-detection gap mid-rep (frame dropout while squatting)", () => {
  // Large gap between the down and up crossing, as if a few frames of
  // detection were lost near the bottom of the squat.
  const results = replay([
    [STAND_Y, 0], [SQUAT_Y, 100], [STAND_Y, 1400],
  ], { down: DOWN, up: UP });
  assert.equal(results.at(-1).count, 1);
});

test("debounces two implausibly fast reps back to back", () => {
  const results = replay([
    [SQUAT_Y, 0], [SQUAT_Y, 33], [STAND_Y, 66], [STAND_Y, 99],
    [SQUAT_Y, 132], [SQUAT_Y, 165], [STAND_Y, 198], [STAND_Y, 231],
  ], { down: DOWN, up: UP });
  assert.equal(results.at(-1).count, 1);
});

test("estimateSquatRange recovers stand/squat from a noisy warmup sample window", () => {
  // A boy doing a couple of real squats in front of the camera, with a
  // couple of single-frame detection glitches thrown in.
  const samples = [
    STAND_Y, STAND_Y, STAND_Y, 0.4, 0.6, SQUAT_Y, SQUAT_Y, 0.6, 0.4, STAND_Y,
    STAND_Y, 0.4, 0.6, SQUAT_Y, SQUAT_Y, 0.6, STAND_Y, 0.02 /* glitch */, 0.99 /* glitch */,
  ];
  const { standY, squatY } = estimateSquatRange(samples);
  assert.ok(Math.abs(standY - STAND_Y) < 0.05);
  assert.ok(Math.abs(squatY - SQUAT_Y) < 0.05);
  assert.equal(squatCalibrationValid(standY, squatY), true);
});

test("estimateSquatRange stays invalid when the boy barely moves", () => {
  const samples = [0.30, 0.31, 0.32, 0.30, 0.33, 0.31, 0.30, 0.32, 0.34, 0.31];
  const { standY, squatY } = estimateSquatRange(samples);
  assert.equal(squatCalibrationValid(standY, squatY), false);
});

test("timestamped calibration frames are replayed so warmup reps count", () => {
  const samples = [
    [STAND_Y, 0], [SQUAT_Y, 300], [STAND_Y, 600],
    [SQUAT_Y, 900], [STAND_Y, 1200],
  ].map(([ratio, t]) => ({ ratio, t }));
  const thresholds = deriveSquatThresholds(STAND_Y, SQUAT_Y);
  const counter = replaySquatCalibration(samples, (config) => createRepCounter(config), thresholds);
  assert.equal(counter.count, 2);
});

test("counts multiple full-depth reps in a row", () => {
  const results = replay([
    [STAND_Y, 0], [SQUAT_Y, 300], [STAND_Y, 600],
    [SQUAT_Y, 900], [STAND_Y, 1200],
    [SQUAT_Y, 1500], [STAND_Y, 1800],
  ], { down: DOWN, up: UP });
  assert.equal(results.at(-1).count, 3);
});
