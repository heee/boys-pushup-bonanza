import assert from "node:assert/strict";
import test from "node:test";
import {
  COCK_GRACE_MS,
  COCK_METER_START,
  COCK_METER_STEP,
  COCK_RAMP_DURATION_MS,
  COCK_RAMP_PCT,
  COCK_UNLOCK_SESSIONS,
  cockCreateRunState,
  cockEndViaFab,
  cockIsClassicSession,
  cockMedian,
  cockMedianFromHistory,
  cockPaceRpm,
  cockRampMultiplier,
  cockRollingRpm,
  cockSessionRpm,
  cockTick,
  cockUnlockStatus,
  cockValidHistoryRpms,
} from "../modes/cock.js";

function classicSession({ count, minutes, timestamp = "2026-08-30T12:10:00.000Z" }) {
  const endedMs = new Date(timestamp).getTime();
  return {
    count,
    timestamp,
    startedAt: new Date(endedMs - minutes * 60000).toISOString(),
  };
}

test("cockIsClassicSession only accepts sessions with no type and no mode", () => {
  assert.equal(cockIsClassicSession(classicSession({ count: 30, minutes: 1 })), true);
  assert.equal(cockIsClassicSession({ count: 30, mode: "poker" }), false);
  assert.equal(cockIsClassicSession({ count: 30, type: "plank" }), false);
});

test("cockSessionRpm computes reps-per-minute from startedAt/timestamp", () => {
  assert.equal(cockSessionRpm(classicSession({ count: 68, minutes: 2 })), 34);
});

test("cockSessionRpm returns null for game modes, missing duration, or zero count", () => {
  assert.equal(cockSessionRpm({ count: 30, mode: "poker", startedAt: "2026-08-20T12:09:00.000Z", timestamp: "2026-08-20T12:10:00.000Z" }), null);
  assert.equal(cockSessionRpm({ count: 30, timestamp: "2026-08-20T12:10:00.000Z" }), null);
  assert.equal(cockSessionRpm(classicSession({ count: 0, minutes: 1 })), null);
});

test("cockValidHistoryRpms skips invalid sessions and caps at the history window", () => {
  const sessions = [
    classicSession({ count: 30, minutes: 1 }),
    { count: 30, mode: "poker", startedAt: "x", timestamp: "y" },
    classicSession({ count: 32, minutes: 1 }),
  ];
  assert.deepEqual(cockValidHistoryRpms(sessions), [30, 32]);
});

test("cockMedian handles odd and even counts", () => {
  assert.equal(cockMedian([30, 32, 34]), 32);
  assert.equal(cockMedian([30, 32, 34, 36]), 33);
  assert.equal(cockMedian([]), null);
});

test("cockUnlockStatus requires 3 valid Classic sessions", () => {
  const two = [classicSession({ count: 30, minutes: 1 }), classicSession({ count: 32, minutes: 1 })];
  const three = [...two, classicSession({ count: 34, minutes: 1 })];
  assert.equal(cockUnlockStatus(two).unlocked, false);
  assert.equal(cockUnlockStatus(two).validCount, 2);
  assert.equal(cockUnlockStatus(three).unlocked, true);
  assert.equal(cockUnlockStatus(three).needed, COCK_UNLOCK_SESSIONS);
});

test("cockMedianFromHistory returns the median once unlocked, null while locked", () => {
  const sessions = [30, 32, 34].map((count) => classicSession({ count, minutes: 1 }));
  assert.equal(cockMedianFromHistory(sessions), 32);
  assert.equal(cockMedianFromHistory(sessions.slice(0, 1)), null);
});

test("cockRollingRpm counts reps within the trailing window", () => {
  const reps = [0, 1000, 2000, 3000, 4000];
  const rpm = cockRollingRpm(reps, 4500, 4500);
  const inWindow = reps.filter((t) => t > 0 && t <= 4500).length;
  assert.equal(rpm, (inWindow / 4500) * 60000);
});

test("cockRampMultiplier is 1 at t=0, ramps linearly, and holds flat past the ramp duration", () => {
  assert.equal(cockRampMultiplier(0), 1);
  assert.equal(cockRampMultiplier(COCK_RAMP_DURATION_MS / 2), 1 + COCK_RAMP_PCT / 2);
  assert.equal(cockRampMultiplier(COCK_RAMP_DURATION_MS), 1 + COCK_RAMP_PCT);
  assert.equal(cockRampMultiplier(COCK_RAMP_DURATION_MS * 2), 1 + COCK_RAMP_PCT);
});

test("cockPaceRpm scales the median by the ramp multiplier", () => {
  assert.equal(cockPaceRpm(30, 0), 30);
  assert.equal(cockPaceRpm(30, COCK_RAMP_DURATION_MS), 30 * (1 + COCK_RAMP_PCT));
});

test("cockTick stays in grace until the window fills, no meter movement possible", () => {
  const state = cockCreateRunState(0);
  const during = cockTick(state, { nowMs: COCK_GRACE_MS - 1, rollingRpm: 999, medianRpm: 30 });
  assert.equal(during.phase, "grace");
  assert.equal(during.cockNerve, COCK_METER_START);
  assert.equal(during.boyResolve, COCK_METER_START);
  assert.equal(during.ended, false);
});

test("cockTick drains the cock's nerve and refills the boy's resolve while ahead", () => {
  let state = cockCreateRunState(0);
  state = cockTick(state, { nowMs: COCK_GRACE_MS + 100, rollingRpm: 50, medianRpm: 30 });
  assert.equal(state.phase, "ahead");
  assert.equal(state.cockNerve, COCK_METER_START - COCK_METER_STEP);
  assert.equal(state.boyResolve, COCK_METER_START);
});

test("cockTick drains the boy's resolve and refills the cock's nerve while behind", () => {
  let state = cockCreateRunState(0);
  state = cockTick(state, { nowMs: COCK_GRACE_MS + 100, rollingRpm: 5, medianRpm: 30 });
  assert.equal(state.phase, "behind");
  assert.equal(state.boyResolve, COCK_METER_START - COCK_METER_STEP);
  assert.equal(state.cockNerve, COCK_METER_START);
});

test("cockTick ends in a win once the cock's nerve hits zero", () => {
  let state = cockCreateRunState(0);
  state.cockNerve = COCK_METER_STEP; // one tick from zero
  state = cockTick(state, { nowMs: COCK_GRACE_MS + 100, rollingRpm: 50, medianRpm: 30 });
  assert.equal(state.ended, true);
  assert.equal(state.result, "win");
  assert.equal(state.endReason, "nerve_zero");
  assert.equal(state.endedAtElapsedMs, COCK_GRACE_MS + 100);
  assert.equal(state.finalCockRpm, 30);
});

test("cockTick ends in a loss once the boy's resolve hits zero", () => {
  let state = cockCreateRunState(0);
  state.boyResolve = COCK_METER_STEP;
  state = cockTick(state, { nowMs: COCK_GRACE_MS + 100, rollingRpm: 5, medianRpm: 30 });
  assert.equal(state.ended, true);
  assert.equal(state.result, "loss");
  assert.equal(state.endReason, "resolve_zero");
});

test("cockTick and cockEndViaFab are no-ops once the run has ended", () => {
  let state = cockCreateRunState(0);
  state.cockNerve = COCK_METER_STEP;
  state = cockTick(state, { nowMs: COCK_GRACE_MS + 100, rollingRpm: 50, medianRpm: 30 });
  assert.equal(state.ended, true);
  const stillEnded = cockTick(state, { nowMs: COCK_GRACE_MS + 200, rollingRpm: 0, medianRpm: 30 });
  assert.equal(stillEnded, state);
  const stillFab = cockEndViaFab(state, { nowMs: COCK_GRACE_MS + 300, medianRpm: 30 });
  assert.equal(stillFab, state);
});

test("cockEndViaFab during grace records no result", () => {
  const state = cockCreateRunState(0);
  const ended = cockEndViaFab(state, { nowMs: COCK_GRACE_MS - 1, medianRpm: 30 });
  assert.equal(ended.ended, true);
  assert.equal(ended.result, null);
  assert.equal(ended.endReason, null);
  assert.equal(ended.finalCockRpm, null);
});

test("cockEndViaFab while ahead resolves as a win with fab_ahead", () => {
  let state = cockCreateRunState(0);
  state = cockTick(state, { nowMs: COCK_GRACE_MS + 100, rollingRpm: 50, medianRpm: 30 });
  assert.equal(state.phase, "ahead");
  const ended = cockEndViaFab(state, { nowMs: COCK_GRACE_MS + 500, medianRpm: 30 });
  assert.equal(ended.ended, true);
  assert.equal(ended.result, "win");
  assert.equal(ended.endReason, "fab_ahead");
  assert.equal(ended.endedAtElapsedMs, COCK_GRACE_MS + 500);
});

test("cockEndViaFab while behind resolves as a loss with fab_behind", () => {
  let state = cockCreateRunState(0);
  state = cockTick(state, { nowMs: COCK_GRACE_MS + 100, rollingRpm: 5, medianRpm: 30 });
  assert.equal(state.phase, "behind");
  const ended = cockEndViaFab(state, { nowMs: COCK_GRACE_MS + 500, medianRpm: 30 });
  assert.equal(ended.ended, true);
  assert.equal(ended.result, "loss");
  assert.equal(ended.endReason, "fab_behind");
});
