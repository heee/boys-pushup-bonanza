import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPlankProgression,
  buildPulseProgression,
  createHollandProgression,
  createRepProgression,
  finalizeHollandProgression,
  finalizeRepProgression,
  progressionTotals,
  progressionChartModel,
  reconcileSavedRepProgression,
  recordProgression,
  validProgression,
} from "../session-progression.js";

test("rep progression records fixed ten-second buckets including rests", () => {
  const runtime = createRepProgression();
  recordProgression(runtime, 1000);
  recordProgression(runtime, 9999);
  recordProgression(runtime, 21000);
  assert.deepEqual(finalizeRepProgression(runtime, 30000, 3).b, [2, 0, 1]);
});

test("rep progression reconciles manual corrections into the latest buckets", () => {
  const runtime = createRepProgression();
  recordProgression(runtime, 1000, 2);
  recordProgression(runtime, 12000, 2);
  assert.deepEqual(finalizeRepProgression(runtime, 20000, 5).b, [2, 3]);
  assert.deepEqual(finalizeRepProgression(runtime, 20000, 1).b, [1, 0]);
  assert.deepEqual(reconcileSavedRepProgression({ v: 1, i: 10, k: "reps", b: [2, 2] }, 3).b, [2, 1]);
});

test("Holland progression preserves color-coded exercise channels", () => {
  const runtime = createHollandProgression();
  recordProgression(runtime, 1000, 2, "pullup");
  recordProgression(runtime, 12000, 3, "pushup");
  recordProgression(runtime, 22000, 4, "squat");
  const result = finalizeHollandProgression(runtime, 30000, { pullup: 2, pushup: 3, squat: 4 });
  assert.deepEqual(result.b, [[2, 0, 0], [0, 3, 0], [0, 0, 4]]);
  assert.deepEqual(progressionTotals(result), { pullup: 2, pushup: 3, squat: 4 });
});

test("Plank stores seconds held and Pulse buckets detected reps", () => {
  assert.deepEqual(buildPlankProgression(25).b, [10, 10, 5]);
  const pulse = buildPulseProgression([1000, 9000, 11000, 26000], 0, 30);
  assert.equal(pulse.k, "pulse");
  assert.deepEqual(pulse.b, [2, 1, 1]);
});

test("progression validation rejects malformed or oversized values", () => {
  assert.equal(validProgression({ v: 1, i: 10, k: "reps", b: [1, 0, 3] }), true);
  assert.equal(validProgression({ v: 1, i: 5, k: "reps", b: [1] }), false);
  assert.equal(validProgression({ v: 1, i: 10, k: "holland", b: [[1, -1, 0]] }), false);
});

test("chart model exposes stacked Holland bars and Pulse rpm", () => {
  const base = { startedAt: "2026-08-29T10:00:00Z", timestamp: "2026-08-29T10:00:20Z" };
  const holland = progressionChartModel({ ...base, sessionProgression: { v: 1, i: 10, k: "holland", b: [[2, 3, 0], [0, 0, 4]] } });
  assert.equal(holland.available, true);
  assert.deepEqual(holland.series.map((item) => item.id), ["pullup", "pushup", "squat"]);
  assert.deepEqual(holland.buckets.map((bucket) => bucket.total), [5, 4]);

  const pulse = progressionChartModel({ ...base, pulseBandLow: 20, pulseBandHigh: 40, sessionProgression: { v: 1, i: 10, k: "pulse", b: [5, 6] } });
  assert.deepEqual(pulse.values, [[30], [36]]);
  assert.deepEqual(pulse.band, { low: 20, high: 40 });
});
