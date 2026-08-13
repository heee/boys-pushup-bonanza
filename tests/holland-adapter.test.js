import assert from "node:assert/strict";
import test from "node:test";
import {
  hollandAdapterFor,
  hollandCalibrationValid,
  hollandCreateCounter,
  hollandDeriveThresholds,
  hollandReplayCalibration,
  hollandShouldFreezeSegment,
} from "../modes/holland-adapter.js";
import { hollandCreateState, hollandRecordReps } from "../modes/holland.js";

test("hollandAdapterFor throws for an unknown exercise", () => {
  assert.throws(() => hollandAdapterFor("burpee"));
});

test("squat adapter derives thresholds and calibrates from ratio samples, matching modes/squat.js directly", () => {
  const samples = [0.25, 0.25, 0.25, 0.75, 0.75, 0.75, 0.25, 0.75, 0.25];
  assert.equal(hollandCalibrationValid("squat", samples), true);
  const thresholds = hollandDeriveThresholds("squat", samples);
  assert.ok(thresholds.down > thresholds.up);
  const counter = hollandCreateCounter("squat", thresholds);
  const r1 = counter.advance(0.25, 0);
  const r2 = counter.advance(0.75, 200);
  const r3 = counter.advance(0.25, 400);
  assert.equal(r3.count, 1);
  assert.equal(r1.counted, false);
  assert.equal(r2.counted, false);
});

test("squat adapter rejects a too-shallow calibration swing", () => {
  const samples = [0.30, 0.31, 0.30, 0.32, 0.31];
  assert.equal(hollandCalibrationValid("squat", samples), false);
});

test("squat adapter replays warmup samples so early reps count", () => {
  const samples = [
    { ratio: 0.25, t: 0 }, { ratio: 0.75, t: 300 }, { ratio: 0.25, t: 600 },
  ];
  const thresholds = hollandDeriveThresholds("squat", samples);
  const counter = hollandReplayCalibration("squat", samples, thresholds);
  assert.equal(counter.count, 1);
});

test("pushup adapter is always calibration-valid and passes settings thresholds straight through", () => {
  const settingsThresholds = { down: 0.7, up: 0.4 };
  assert.equal(hollandCalibrationValid("pushup", [], settingsThresholds), true);
  const thresholds = hollandDeriveThresholds("pushup", [], settingsThresholds);
  assert.deepEqual(thresholds, settingsThresholds);
  const counter = hollandCreateCounter("pushup", thresholds);
  assert.equal(counter.count, 0);
});

test("pushup adapter has no replay step and just creates an empty counter", () => {
  const counter = hollandReplayCalibration("pushup", [], { down: 0.7, up: 0.4 });
  assert.equal(counter.count, 0);
  assert.equal(counter.phase, "up");
});

test("hollandShouldFreezeSegment mirrors hollandRecordReps's reachedTarget flag", () => {
  const state = hollandCreateState("normal");
  const before = hollandRecordReps(state, 4);
  assert.equal(hollandShouldFreezeSegment(before), false);
  const after = hollandRecordReps(state, 1);
  assert.equal(hollandShouldFreezeSegment(after), true);
});
