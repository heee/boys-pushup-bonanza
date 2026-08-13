import test from "node:test";
import assert from "node:assert/strict";
import {
  createPullupCounter,
  derivePullupThresholds,
  estimatePullupRange,
  pullupCalibrationValid,
  pullupFrameMetrics,
  replayPullupSamples,
} from "../modes/pullup.js";

const HANG = { shoulderDistance: 0.30, elbowAngle: 178, chinClearsBar: false };
const TOP = { shoulderDistance: 0.08, elbowAngle: 80, chinClearsBar: true };
const MID = { shoulderDistance: 0.19, elbowAngle: 120, chinClearsBar: false };
const WARMUP = [HANG, HANG, MID, TOP, TOP, MID, HANG, HANG];

test("calibration learns a meaningful top-to-hang range", () => {
  assert.equal(pullupCalibrationValid(WARMUP), true);
  const range = estimatePullupRange(WARMUP);
  assert.ok(range.topDistance < range.hangDistance);
  const thresholds = derivePullupThresholds(WARMUP);
  assert.ok(thresholds.topDistance > range.topDistance);
  assert.ok(thresholds.hangDistance < range.hangDistance);
});

test("buffered calibration rep is replayed and counted", () => {
  const counter = replayPullupSamples(WARMUP);
  assert.equal(counter.count, 1);
});

test("counts only a dead-hang to chin-over-bar to dead-hang cycle", () => {
  const counter = createPullupCounter(derivePullupThresholds(WARMUP));
  for (const sample of [HANG, MID, TOP, MID, HANG]) counter.advance(sample);
  assert.equal(counter.count, 1);
});

test("rejects a shallow top and a bent-arm bottom", () => {
  const thresholds = derivePullupThresholds(WARMUP);
  const shallow = { ...TOP, chinClearsBar: false };
  const bentBottom = { ...HANG, elbowAngle: 135 };
  const counter = createPullupCounter(thresholds);
  for (const sample of [HANG, shallow, HANG, TOP, bentBottom]) counter.advance(sample);
  assert.equal(counter.count, 0);
});

test("a tracking dropout does not invent or erase a partial rep", () => {
  const counter = createPullupCounter(derivePullupThresholds(WARMUP));
  for (const sample of [HANG, MID, TOP]) counter.advance(sample);
  // The live controller skips missing frames, then resumes here.
  counter.advance(HANG);
  assert.equal(counter.count, 1);
});

function pose({ shoulderY, elbowY, wristY, noseY, mouthY }) {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  points[0] = { x: 0.5, y: noseY, visibility: 1 };
  points[9] = { x: 0.48, y: mouthY, visibility: 1 };
  points[10] = { x: 0.52, y: mouthY, visibility: 1 };
  for (const [shoulder, elbow, wrist, x] of [[11, 13, 15, 0.4], [12, 14, 16, 0.6]]) {
    points[shoulder] = { x, y: shoulderY, visibility: 1 };
    points[elbow] = { x, y: elbowY, visibility: 1 };
    points[wrist] = { x, y: wristY, visibility: 1 };
  }
  return points;
}

test("pose geometry infers the wrist bar line, full hang, and chin clearance", () => {
  const hang = pullupFrameMetrics(pose({ shoulderY: 0.50, elbowY: 0.35, wristY: 0.20, noseY: 0.40, mouthY: 0.44 }));
  assert.ok(hang.elbowAngle > 170);
  assert.equal(hang.chinClearsBar, false);
  assert.ok(Math.abs(hang.shoulderDistance - 0.30) < 1e-9);

  const top = pullupFrameMetrics(pose({ shoulderY: 0.28, elbowY: 0.30, wristY: 0.20, noseY: 0.10, mouthY: 0.15 }));
  assert.equal(top.chinClearsBar, true);
});

test("standing with arms at the sides is not mistaken for chin-over-bar", () => {
  const standing = pullupFrameMetrics(pose({ shoulderY: 0.30, elbowY: 0.55, wristY: 0.75, noseY: 0.12, mouthY: 0.18 }));
  assert.equal(standing, null);
});
