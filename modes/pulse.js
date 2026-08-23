// Pulse mode — solo pacing endurance mode (see docs/pulse-mode-plan.md).
//
// The score is time held inside a pace band drawn from the boy's own recent
// history, not reps or strength. This module is pure calc: band derivation
// from session history, live rolling-pace math, and the breach/recovery
// state machine. No DOM/camera dependency, so it's fully unit-testable and
// shared between the live workout screen and tests.

export const PULSE_BAND_WIDTHS = [
  { id: "wide", label: "Wide", pct: 0.25 },
  { id: "standard", label: "Standard", pct: 0.15 },
  { id: "razor", label: "Razor", pct: 0.07 },
];

// How many of the most recent valid Classic sessions feed the median, and
// how many are required before Pulse unlocks at all.
export const PULSE_HISTORY_WINDOW = 10;
export const PULSE_UNLOCK_SESSIONS = 3;

// Live pace is a rolling window average, not per-rep — this is what makes
// "one fast rep nudges it, four seconds of sprinting sends it over" true
// without any extra debounce layer on top.
export const PULSE_ROLLING_WINDOW_MS = 7000;

// Same duration used as the startup grace period: the rolling window can't
// mean anything until a full window of run time has elapsed, so breach
// detection is disabled until then.
export const PULSE_GRACE_MS = PULSE_ROLLING_WINDOW_MS;

// Flat across all band widths — Razor's difficulty comes from the tighter
// band itself, not a shorter fuse (confirmed with Henning, 2026-08-23).
export const PULSE_RECOVERY_MS = 5000;

export function pulseBandWidthById(id) {
  return PULSE_BAND_WIDTHS.find((width) => width.id === id) || PULSE_BAND_WIDTHS[1];
}

// A session only anchors the band if it's a plain Classic pushup session —
// the server never tags Classic with a `mode` value (see the Worker's
// VALID_MODES / doc comment), so "no type, no mode" is exactly Classic.
// Game modes (Poker/Wheel/Ladder/etc.) have bursty, non-representative
// cadence and are deliberately excluded.
export function pulseIsClassicSession(session) {
  return !!session && !session.type && !session.mode;
}

// rpm for one session, or null if it's not a Classic session or doesn't
// carry enough data to compute a duration (missing/invalid startedAt).
export function pulseSessionRpm(session) {
  if (!pulseIsClassicSession(session)) return null;
  const count = Number(session.count);
  if (!Number.isFinite(count) || count <= 0) return null;
  if (!session.startedAt || !session.timestamp) return null;
  const startedMs = new Date(session.startedAt).getTime();
  const endedMs = new Date(session.timestamp).getTime();
  if (!Number.isFinite(startedMs) || !Number.isFinite(endedMs)) return null;
  const durationMin = (endedMs - startedMs) / 60000;
  if (durationMin <= 0) return null;
  return count / durationMin;
}

// `sessions` expected most-recent-first. Sessions without a computable rpm
// (old/undated) are skipped entirely rather than backfilled — they count
// toward neither the median nor the unlock gate.
export function pulseValidHistoryRpms(sessions) {
  const rpms = [];
  for (const session of sessions || []) {
    const rpm = pulseSessionRpm(session);
    if (rpm != null) rpms.push(rpm);
    if (rpms.length >= PULSE_HISTORY_WINDOW) break;
  }
  return rpms;
}

export function pulseMedian(values) {
  if (!values || !values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function pulseUnlockStatus(sessions) {
  const validCount = pulseValidHistoryRpms(sessions).length;
  return { unlocked: validCount >= PULSE_UNLOCK_SESSIONS, validCount, needed: PULSE_UNLOCK_SESSIONS };
}

// Band is fixed for the whole run — computed once at Start from history up
// to that point, never recalculated live. Returns null if still locked.
export function pulseBandFromHistory(sessions, widthId) {
  const validRpms = pulseValidHistoryRpms(sessions);
  if (validRpms.length < PULSE_UNLOCK_SESSIONS) return null;
  const medianRpm = pulseMedian(validRpms);
  const width = pulseBandWidthById(widthId);
  return {
    medianRpm,
    low: medianRpm * (1 - width.pct),
    high: medianRpm * (1 + width.pct),
  };
}

// Live rolling rpm from rep timestamps (ms). Recompute on every counted rep
// AND on a periodic evaluation tick — pace must visibly decay during a
// stall, not just jump on the next rep.
export function pulseRollingRpm(repTimestampsMs, nowMs, windowMs = PULSE_ROLLING_WINDOW_MS) {
  const windowStart = nowMs - windowMs;
  let count = 0;
  for (const t of repTimestampsMs || []) {
    if (t > windowStart && t <= nowMs) count += 1;
  }
  return (count / windowMs) * 60000;
}

export function pulseStatus(rollingRpm, bandLow, bandHigh) {
  if (rollingRpm > bandHigh) return "hot";
  if (rollingRpm < bandLow) return "cold";
  return "in-band";
}

export function pulseCreateRunState(nowMs) {
  return {
    runStartMs: nowMs,
    graceUntilMs: nowMs + PULSE_GRACE_MS,
    phase: "grace", // "grace" | "in-band" | "hot" | "cold"
    breachEnteredElapsedMs: null,
    breachEnteredRpm: null,
    recoveryDeadlineMs: null,
    ended: false,
    endReason: null, // "ceiling" | "floor" | "banked"
    endedAtElapsedMs: null,
    endedAtRpm: null,
  };
}

// One evaluation tick. Pure function of (state, live inputs) -> next state,
// so the same logic drives the live screen and replay-style unit tests.
//
// The elapsed "Holding for" clock never pauses, including mid-recovery —
// but the *recorded* score on a timeout is the elapsed time at the moment
// of the original crossing, not the moment the countdown expired, so
// sprinting/dying through the last second earns nothing. That's why entry
// into a breach snapshots `breachEnteredElapsedMs`/`breachEnteredRpm`
// instead of reading them fresh at timeout.
export function pulseTick(state, { nowMs, rollingRpm, bandLow, bandHigh }) {
  if (state.ended) return state;
  const elapsedMs = nowMs - state.runStartMs;

  if (nowMs < state.graceUntilMs) {
    return { ...state, phase: "grace" };
  }

  const status = pulseStatus(rollingRpm, bandLow, bandHigh);

  if (status === "in-band") {
    if (state.phase === "in-band") return state;
    return { ...state, phase: "in-band", breachEnteredElapsedMs: null, breachEnteredRpm: null, recoveryDeadlineMs: null };
  }

  if (state.phase === status) {
    if (nowMs >= state.recoveryDeadlineMs) {
      return {
        ...state,
        ended: true,
        endReason: status === "hot" ? "ceiling" : "floor",
        endedAtElapsedMs: state.breachEnteredElapsedMs,
        endedAtRpm: state.breachEnteredRpm,
      };
    }
    return state;
  }

  // Freshly entering this breach direction (from in-band or from the other
  // direction) — (re)start the 5s countdown from full.
  return {
    ...state,
    phase: status,
    breachEnteredElapsedMs: elapsedMs,
    breachEnteredRpm: rollingRpm,
    recoveryDeadlineMs: nowMs + PULSE_RECOVERY_MS,
  };
}

export function pulseBankRun(state, nowMs) {
  if (state.ended) return state;
  return {
    ...state,
    ended: true,
    endReason: "banked",
    endedAtElapsedMs: nowMs - state.runStartMs,
    endedAtRpm: null,
  };
}

export function pulseRecoveryRemainingMs(state, nowMs) {
  if (!state.recoveryDeadlineMs) return null;
  return Math.max(0, state.recoveryDeadlineMs - nowMs);
}
