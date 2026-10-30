import test from "node:test";
import assert from "node:assert/strict";
import { createHangTimer, deadhangFrameHanging, DEADHANG_GRACE_MS, DEADHANG_START_HOLD_MS } from "../modes/deadhang.js";

// Minimal MediaPipe-style landmark set: hands on a bar at y=0.1, head below.
// `elbowBend` pushes the elbows sideways to bend the arms.
function pose({ handsAboveShoulders = true, elbowBend = 0, chinOverBar = false } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  const barY = 0.1;
  const shoulderY = handsAboveShoulders ? (chinOverBar ? 0.14 : 0.4) : 0.05;
  lm[15] = { x: 0.4, y: barY, visibility: 1 };
  lm[16] = { x: 0.6, y: barY, visibility: 1 };
  lm[11] = { x: 0.4, y: shoulderY, visibility: 1 };
  lm[12] = { x: 0.6, y: shoulderY, visibility: 1 };
  const elbowY = (barY + shoulderY) / 2;
  lm[13] = { x: 0.4 - elbowBend, y: elbowY, visibility: 1 };
  lm[14] = { x: 0.6 + elbowBend, y: elbowY, visibility: 1 };
  const headY = chinOverBar ? 0.02 : shoulderY - 0.08;
  lm[0] = { x: 0.5, y: headY, visibility: 1 };
  lm[9] = { x: 0.48, y: headY + 0.02, visibility: 1 };
  lm[10] = { x: 0.52, y: headY + 0.02, visibility: 1 };
  return lm;
}

test("straight-arm hang reads as hanging; bent arms, chin over bar, or hands down don't", () => {
  assert.equal(deadhangFrameHanging(pose()), true);
  assert.equal(deadhangFrameHanging(pose({ elbowBend: 0.15 })), false);
  assert.equal(deadhangFrameHanging(pose({ chinOverBar: true })), false);
  assert.equal(deadhangFrameHanging(pose({ handsAboveShoulders: false })), false);
  assert.equal(deadhangFrameHanging(null), false);
});

test("clock starts only after the hang holds, timed from its first frame", () => {
  const timer = createHangTimer();
  assert.equal(timer.advance(true, 0).phase, "waiting");
  assert.equal(timer.advance(false, 200).phase, "waiting"); // reach that didn't hold
  timer.advance(true, 1000);
  const r = timer.advance(true, 1000 + DEADHANG_START_HOLD_MS);
  assert.equal(r.phase, "hanging");
  assert.equal(r.elapsedMs, DEADHANG_START_HOLD_MS);
});

test("a wobble inside the grace window doesn't end the hang", () => {
  const timer = createHangTimer();
  timer.advance(true, 0);
  timer.advance(true, 500);
  timer.advance(true, 3000);
  timer.advance(false, 3100);
  timer.advance(false, 3000 + DEADHANG_GRACE_MS - 100);
  const r = timer.advance(true, 3000 + DEADHANG_GRACE_MS - 50);
  assert.equal(r.phase, "hanging");
});

test("dropping off ends the hang at the last hanging frame, excluding the grace window", () => {
  const timer = createHangTimer();
  timer.advance(true, 0);
  timer.advance(true, 500);
  timer.advance(true, 30000);
  timer.advance(false, 30100);
  const r = timer.advance(false, 30000 + DEADHANG_GRACE_MS + 1);
  assert.equal(r.phase, "done");
  assert.equal(r.elapsedMs, 30000);
  assert.equal(timer.advance(true, 40000).phase, "done");
});
