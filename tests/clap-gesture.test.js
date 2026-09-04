import assert from "node:assert/strict";
import test from "node:test";
import {
  armPose,
  createClapGestureDetector,
  isExtended,
  isTogether,
  CLAP_HOLD_MS,
  CLAP_STEP_TIMEOUT_MS,
  POSE_LEFT_SHOULDER,
  POSE_RIGHT_SHOULDER,
  POSE_LEFT_WRIST,
  POSE_RIGHT_WRIST,
} from "../modes/clap-gesture.js";

// Builds a minimal 33-slot landmark array with shoulders 0.3 apart (x) at
// y=0.5, and wrists placed by the caller — enough for armPose's needs.
function landmarksWithWrists(leftWristX, rightWristX, wristY = 0.5) {
  const lm = new Array(33).fill({ x: 0.5, y: 0.5, visibility: 1 });
  lm[POSE_LEFT_SHOULDER] = { x: 0.35, y: 0.5, visibility: 1 };
  lm[POSE_RIGHT_SHOULDER] = { x: 0.65, y: 0.5, visibility: 1 };
  lm[POSE_LEFT_WRIST] = { x: leftWristX, y: wristY, visibility: 1 };
  lm[POSE_RIGHT_WRIST] = { x: rightWristX, y: wristY, visibility: 1 };
  return lm;
}

const EXTENDED = landmarksWithWrists(0.0, 1.0); // spread 1.0 / shoulderWidth 0.3 ≈ 3.3x
const TOGETHER = landmarksWithWrists(0.49, 0.51, 0.5); // spread 0.02 / 0.3 ≈ 0.07x
const NEUTRAL = landmarksWithWrists(0.3, 0.7, 0.9); // spread wide but hanging down at the sides

test("armPose returns null when a required landmark is missing", () => {
  const lm = landmarksWithWrists(0, 1);
  lm[POSE_LEFT_WRIST] = undefined;
  assert.equal(armPose(lm), null);
});

test("isExtended/isTogether classify the sample poses correctly", () => {
  assert.equal(isExtended(armPose(EXTENDED)), true);
  assert.equal(isTogether(armPose(EXTENDED)), false);
  assert.equal(isTogether(armPose(TOGETHER)), true);
  assert.equal(isExtended(armPose(TOGETHER)), false);
  // Arms wide but down at the sides shouldn't count as "extended" — the
  // height tolerance rejects it even though the spread is large.
  assert.equal(isExtended(armPose(NEUTRAL)), false);
});

test("full extend-clap-extend-clap sequence completes the gesture", () => {
  const g = createClapGestureDetector();
  let t = 0;
  const hold = (landmarks, ms) => {
    let result;
    for (; ms > 0; ms -= 40, t += 40) result = g.advance(landmarks, t);
    return result;
  };

  hold(EXTENDED, CLAP_HOLD_MS + 40);
  assert.equal(g.stepIndex, 1);
  hold(TOGETHER, CLAP_HOLD_MS + 40);
  assert.equal(g.stepIndex, 2);
  hold(EXTENDED, CLAP_HOLD_MS + 40);
  assert.equal(g.stepIndex, 3);
  const final = hold(TOGETHER, CLAP_HOLD_MS + 40);
  assert.equal(g.stepIndex, 4);
  assert.equal(final.completed, true);
});

test("a single noisy frame mid-swing doesn't advance the stage", () => {
  const g = createClapGestureDetector();
  // One frame of "extended" isn't held long enough to confirm.
  const result = g.advance(EXTENDED, 0);
  assert.equal(result.stepIndex, 0);
});

test("resets if a step doesn't follow within the timeout window", () => {
  const g = createClapGestureDetector();
  let t = 0;
  for (; t <= CLAP_HOLD_MS + 40; t += 40) g.advance(EXTENDED, t);
  assert.equal(g.stepIndex, 1);

  // Let the step timeout elapse before clapping.
  t += CLAP_STEP_TIMEOUT_MS + 100;
  const afterTimeout = g.advance(TOGETHER, t);
  // The timeout reset happens on this call before the current sample is
  // classified, so it counts as a fresh extended1 attempt, not clap1.
  assert.equal(afterTimeout.stepIndex, 0);
});

test("neutral (arms down) poses never advance the gesture", () => {
  const g = createClapGestureDetector();
  let t = 0;
  for (; t <= 2000; t += 40) g.advance(NEUTRAL, t);
  assert.equal(g.stepIndex, 0);
});

test("reset() clears progress", () => {
  const g = createClapGestureDetector();
  let t = 0;
  for (; t <= CLAP_HOLD_MS + 40; t += 40) g.advance(EXTENDED, t);
  assert.equal(g.stepIndex, 1);
  g.reset();
  assert.equal(g.stepIndex, 0);
});
