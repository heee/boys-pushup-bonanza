import assert from "node:assert/strict";
import test from "node:test";
import {
  PULSE_GRACE_MS,
  PULSE_RECOVERY_MS,
  PULSE_UNLOCK_SESSIONS,
  pulseBandFromHistory,
  pulseBandWidthById,
  pulseBankRun,
  pulseCreateRunState,
  pulseIsClassicSession,
  pulseMedian,
  pulseRecoveryRemainingMs,
  pulseRollingRpm,
  pulseSessionRpm,
  pulseStatus,
  pulseTick,
  pulseUnlockStatus,
  pulseValidHistoryRpms,
} from "../modes/pulse.js";

function classicSession({ count, minutes, timestamp = "2026-08-20T12:10:00.000Z" }) {
  const endedMs = new Date(timestamp).getTime();
  return {
    count,
    timestamp,
    startedAt: new Date(endedMs - minutes * 60000).toISOString(),
  };
}

test("pulseIsClassicSession only accepts sessions with no type and no mode", () => {
  assert.equal(pulseIsClassicSession(classicSession({ count: 30, minutes: 1 })), true);
  assert.equal(pulseIsClassicSession({ count: 30, mode: "poker" }), false);
  assert.equal(pulseIsClassicSession({ count: 30, type: "plank" }), false);
});

test("pulseSessionRpm computes reps-per-minute from startedAt/timestamp", () => {
  const s = classicSession({ count: 68, minutes: 2 });
  assert.equal(pulseSessionRpm(s), 34);
});

test("pulseSessionRpm returns null for game modes, missing duration, or zero count", () => {
  assert.equal(pulseSessionRpm({ count: 30, mode: "poker", startedAt: "2026-08-20T12:09:00.000Z", timestamp: "2026-08-20T12:10:00.000Z" }), null);
  assert.equal(pulseSessionRpm({ count: 30, timestamp: "2026-08-20T12:10:00.000Z" }), null);
  assert.equal(pulseSessionRpm(classicSession({ count: 0, minutes: 1 })), null);
});

test("pulseValidHistoryRpms skips invalid sessions and caps at the history window", () => {
  const sessions = [
    classicSession({ count: 30, minutes: 1 }),
    { count: 30, mode: "poker", startedAt: "x", timestamp: "y" },
    classicSession({ count: 32, minutes: 1 }),
  ];
  assert.deepEqual(pulseValidHistoryRpms(sessions), [30, 32]);
});

test("pulseMedian handles odd and even counts", () => {
  assert.equal(pulseMedian([30, 32, 34]), 32);
  assert.equal(pulseMedian([30, 32, 34, 36]), 33);
  assert.equal(pulseMedian([]), null);
});

test("pulseUnlockStatus requires 3 valid Classic sessions", () => {
  const two = [classicSession({ count: 30, minutes: 1 }), classicSession({ count: 32, minutes: 1 })];
  const three = [...two, classicSession({ count: 34, minutes: 1 })];
  assert.equal(pulseUnlockStatus(two).unlocked, false);
  assert.equal(pulseUnlockStatus(two).validCount, 2);
  assert.equal(pulseUnlockStatus(three).unlocked, true);
  assert.equal(pulseUnlockStatus(three).needed, PULSE_UNLOCK_SESSIONS);
});

test("pulseBandFromHistory applies the width multiplier around the median", () => {
  const sessions = [30, 32, 34].map((count) => classicSession({ count, minutes: 1 }));
  const band = pulseBandFromHistory(sessions, "standard");
  assert.equal(band.medianRpm, 32);
  assert.equal(band.low, 32 * 0.85);
  assert.equal(band.high, 32 * 1.15);
});

test("pulseBandFromHistory returns null while locked", () => {
  const sessions = [classicSession({ count: 30, minutes: 1 })];
  assert.equal(pulseBandFromHistory(sessions, "standard"), null);
});

test("pulseBandWidthById falls back to standard for an unknown id", () => {
  assert.equal(pulseBandWidthById("razor").pct, 0.07);
  assert.equal(pulseBandWidthById("nonsense").id, "standard");
});

test("pulseRollingRpm counts reps within the trailing window", () => {
  const reps = [0, 1000, 2000, 3000, 4000, 5000, 6000, 8000]; // 8000ms is outside a 7000ms window from now=8000
  const rpm = pulseRollingRpm(reps, 8000, 7000);
  // reps at 1000..8000 inclusive of (now-window, now] = (1000, 8000] -> 2000..8000 = 6 reps... verify by count
  const inWindow = reps.filter((t) => t > 1000 && t <= 8000).length;
  assert.equal(rpm, (inWindow / 7000) * 60000);
});

test("pulseStatus classifies hot/cold/in-band", () => {
  assert.equal(pulseStatus(40, 29, 39), "hot");
  assert.equal(pulseStatus(20, 29, 39), "cold");
  assert.equal(pulseStatus(34, 29, 39), "in-band");
});

test("pulseTick stays in grace until the window fills, no breach possible", () => {
  const state = pulseCreateRunState(0);
  const during = pulseTick(state, { nowMs: PULSE_GRACE_MS - 1, rollingRpm: 999, bandLow: 29, bandHigh: 39 });
  assert.equal(during.phase, "grace");
  assert.equal(during.ended, false);
});

test("pulseTick transitions to hot and starts a 5s recovery countdown", () => {
  let state = pulseCreateRunState(0);
  state = pulseTick(state, { nowMs: PULSE_GRACE_MS + 100, rollingRpm: 45, bandLow: 29, bandHigh: 39 });
  assert.equal(state.phase, "hot");
  assert.equal(state.breachEnteredElapsedMs, PULSE_GRACE_MS + 100);
  assert.equal(state.breachEnteredRpm, 45);
  assert.equal(pulseRecoveryRemainingMs(state, PULSE_GRACE_MS + 100), PULSE_RECOVERY_MS);
});

test("pulseTick returning inside band cancels and fully resets the countdown", () => {
  let state = pulseCreateRunState(0);
  state = pulseTick(state, { nowMs: 8000, rollingRpm: 45, bandLow: 29, bandHigh: 39 });
  assert.equal(state.phase, "hot");
  state = pulseTick(state, { nowMs: 10000, rollingRpm: 34, bandLow: 29, bandHigh: 39 });
  assert.equal(state.phase, "in-band");
  assert.equal(state.recoveryDeadlineMs, null);
  assert.equal(state.breachEnteredElapsedMs, null);
});

test("pulseTick ends the run on recovery timeout, scored at the moment of the original crossing", () => {
  let state = pulseCreateRunState(0);
  state = pulseTick(state, { nowMs: 8000, rollingRpm: 45, bandLow: 29, bandHigh: 39 }); // breach enters at elapsed 8000
  assert.equal(state.ended, false);
  // Still sprinting through the last instant of the countdown shouldn't help —
  // the score is fixed at breach entry, not at timeout.
  state = pulseTick(state, { nowMs: 8000 + PULSE_RECOVERY_MS, rollingRpm: 60, bandLow: 29, bandHigh: 39 });
  assert.equal(state.ended, true);
  assert.equal(state.endReason, "ceiling");
  assert.equal(state.endedAtElapsedMs, 8000);
  assert.equal(state.endedAtRpm, 45);
});

test("pulseTick handles a floor breach (too slow) the same way, symmetrically", () => {
  let state = pulseCreateRunState(0);
  state = pulseTick(state, { nowMs: 8000, rollingRpm: 20, bandLow: 29, bandHigh: 39 });
  assert.equal(state.phase, "cold");
  state = pulseTick(state, { nowMs: 8000 + PULSE_RECOVERY_MS, rollingRpm: 20, bandLow: 29, bandHigh: 39 });
  assert.equal(state.endReason, "floor");
  assert.equal(state.endedAtElapsedMs, 8000);
});

test("pulseTick treats a full stop (0 rpm) as an ordinary floor breach, no special-casing", () => {
  let state = pulseCreateRunState(0);
  state = pulseTick(state, { nowMs: 8000, rollingRpm: 0, bandLow: 29, bandHigh: 39 });
  assert.equal(state.phase, "cold");
  assert.equal(state.recoveryDeadlineMs, 8000 + PULSE_RECOVERY_MS);
});

test("pulseTick switching breach direction restarts the countdown from full", () => {
  let state = pulseCreateRunState(0);
  state = pulseTick(state, { nowMs: 8000, rollingRpm: 45, bandLow: 29, bandHigh: 39 });
  assert.equal(state.phase, "hot");
  state = pulseTick(state, { nowMs: 9000, rollingRpm: 20, bandLow: 29, bandHigh: 39 });
  assert.equal(state.phase, "cold");
  assert.equal(state.breachEnteredElapsedMs, 9000);
  assert.equal(state.recoveryDeadlineMs, 9000 + PULSE_RECOVERY_MS);
});

test("pulseBankRun ends the run immediately at the current elapsed time", () => {
  const state = pulseCreateRunState(0);
  const banked = pulseBankRun(state, 12345);
  assert.equal(banked.ended, true);
  assert.equal(banked.endReason, "banked");
  assert.equal(banked.endedAtElapsedMs, 12345);
  assert.equal(banked.endedAtRpm, null);
});

test("pulseBankRun mid-recovery still banks at the current time, not the breach-entry time", () => {
  let state = pulseCreateRunState(0);
  state = pulseTick(state, { nowMs: 8000, rollingRpm: 45, bandLow: 29, bandHigh: 39 });
  const banked = pulseBankRun(state, 9500);
  assert.equal(banked.endedAtElapsedMs, 9500);
  assert.equal(banked.endReason, "banked");
});

test("pulseTick and pulseBankRun are no-ops once the run has ended", () => {
  let state = pulseCreateRunState(0);
  state = pulseBankRun(state, 5000);
  const stillEnded = pulseTick(state, { nowMs: 6000, rollingRpm: 999, bandLow: 29, bandHigh: 39 });
  assert.equal(stillEnded, state);
  const bankedAgain = pulseBankRun(state, 7000);
  assert.equal(bankedAgain, state);
});
