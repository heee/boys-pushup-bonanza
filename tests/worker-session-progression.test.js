import assert from "node:assert/strict";
import test from "node:test";
import { validateSession } from "../worker/index.js";

test("Worker accepts compact rep, plank, Pulse, and Holland progression", () => {
  const reps = validateSession({ user: "A", count: 5, sessionProgression: { v: 1, i: 10, k: "reps", b: [2, 0, 3] } });
  assert.deepEqual(reps.sessionProgression.b, [2, 0, 3]);

  const plank = validateSession({ user: "A", count: 25, type: "plank", sessionProgression: { v: 1, i: 10, k: "plank", b: [10, 10, 5] } });
  assert.equal(plank.sessionProgression.k, "plank");

  const pulse = validateSession({
    user: "A", count: 20, mode: "pulse", pulseBandWidth: "standard", pulseBandLow: 20, pulseBandHigh: 40,
    pulseEndReason: "banked", pulseReps: 11, sessionProgression: { v: 1, i: 10, k: "pulse", b: [5, 6] },
  });
  assert.equal(pulse.sessionProgression.k, "pulse");

  const holland = validateSession({
    user: "A", count: 9, type: "holland", hollandDifficulty: "normal", hollandPullups: 2, hollandPushups: 3, hollandSquats: 4,
    sessionProgression: { v: 1, i: 10, k: "holland", b: [[2, 0, 0], [0, 3, 0], [0, 0, 4]] },
  });
  assert.deepEqual(holland.sessionProgression.b[2], [0, 0, 4]);
});

test("Worker rejects mismatched, malformed, or wrong-kind progression", () => {
  assert.equal(validateSession({ user: "A", count: 5, sessionProgression: { v: 1, i: 10, k: "reps", b: [2, 2] } }), null);
  assert.equal(validateSession({ user: "A", count: 5, sessionProgression: { v: 1, i: 5, k: "reps", b: [5] } }), null);
  assert.equal(validateSession({ user: "A", count: 5, sessionProgression: { v: 1, i: 10, k: "plank", b: [5] } }), null);
});

test("Worker compares weighted progression with physical raw reps", () => {
  const session = validateSession({
    user: "A", count: 8, rawCount: 5, weightLbs: 20,
    sessionProgression: { v: 1, i: 10, k: "reps", b: [2, 3] },
  });
  assert.equal(session.rawCount, 5);
  assert.deepEqual(session.sessionProgression.b, [2, 3]);
});
