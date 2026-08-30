// Cock Mode — solo pace duel against a bot ("the cock") (see docs/cock-mode-plan.md).
//
// No opponent AI/ML: the bot's pace is a deterministic ramp off the boy's own
// historical median rpm, and the outcome is decided by two mirrored "nerve"
// meters that drain/refill based on who's ahead. This module is pure calc —
// no DOM/camera dependency — shared between the live workout screen and tests.

// Reuses Pulse's own unlock gate exactly: same 3-valid-Classic-session
// requirement, same reason (a meaningful median needs some history).
export const COCK_UNLOCK_SESSIONS = 3;
export const COCK_HISTORY_WINDOW = 25;

// Rolling window is shorter than Pulse's 7s — Cock Mode only needs a
// directional ahead/behind read, not a precise band placement, so it can be
// tighter (confirmed with Henning, 2026-08-30).
export const COCK_ROLLING_WINDOW_MS = 4500;
export const COCK_GRACE_MS = 4000;

// Meter tuning: starts full (100), clamped to [0, 100]. The per-tick step is
// NOT flat — it scales with how big a relative pace margin you're actually
// running, not just whether you're ahead at all. A flat rate made "barely
// ahead" and "sprinting flat out" resolve the duel in the same ~12-15s,
// which felt like it ended out of nowhere on a hard sprint (Henning,
// 2026-08-31 feedback). Now a marginal lead grinds it out over something
// closer to a real pushup set, while a genuine all-out sprint can still
// close it out fast — that's supposed to feel earned, not instant.
export const COCK_METER_START = 100;
export const COCK_METER_BASE_STEP = 0.15;
export const COCK_METER_MARGIN_GAIN = 0.68;
// Relative margin (|rollingRpm - cockRpm| / cockRpm) beyond this is treated
// the same as exactly this much — a 3x pace blowout shouldn't drain any
// faster than a clean 2x one.
export const COCK_METER_MARGIN_CAP = 1.0;

// How much a given relative margin drains the losing side's meter this
// tick — small near zero margin, ramping up toward BASE+GAIN at the cap.
export function cockMeterStep(marginPct) {
  return COCK_METER_BASE_STEP + COCK_METER_MARGIN_GAIN * Math.min(Math.abs(marginPct), COCK_METER_MARGIN_CAP);
}

// The cock's pace ramps up linearly from the median over the run, reaching
// 1 + COCK_RAMP_PCT times the median at COCK_RAMP_DURATION_MS elapsed, then
// holds flat — a slow, steady squeeze rather than an escalating sprint.
export const COCK_RAMP_DURATION_MS = 120000;
export const COCK_RAMP_PCT = 0.35;

export function cockRampMultiplier(elapsedMs) {
  const t = Math.max(0, Math.min(1, elapsedMs / COCK_RAMP_DURATION_MS));
  return 1 + COCK_RAMP_PCT * t;
}

export function cockPaceRpm(medianRpm, elapsedMs) {
  return medianRpm * cockRampMultiplier(elapsedMs);
}

// A session only anchors the median if it's a plain Classic pushup session —
// identical rule to Pulse's pulseIsClassicSession (no type, no mode tag).
export function cockIsClassicSession(session) {
  return !!session && !session.type && !session.mode;
}

export function cockSessionRpm(session) {
  if (!cockIsClassicSession(session)) return null;
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
// (old/undated) are skipped entirely — they count toward neither the median
// nor the unlock gate.
export function cockValidHistoryRpms(sessions) {
  const rpms = [];
  for (const session of sessions || []) {
    const rpm = cockSessionRpm(session);
    if (rpm != null) rpms.push(rpm);
    if (rpms.length >= COCK_HISTORY_WINDOW) break;
  }
  return rpms;
}

export function cockMedian(values) {
  if (!values || !values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function cockUnlockStatus(sessions) {
  const validCount = cockValidHistoryRpms(sessions).length;
  return { unlocked: validCount >= COCK_UNLOCK_SESSIONS, validCount, needed: COCK_UNLOCK_SESSIONS };
}

// Median is fixed for the whole run — computed once at Start from history up
// to that point, never recalculated live (same rule as Pulse's band).
// Returns null if still locked.
export function cockMedianFromHistory(sessions) {
  const validRpms = cockValidHistoryRpms(sessions);
  if (validRpms.length < COCK_UNLOCK_SESSIONS) return null;
  return cockMedian(validRpms);
}

// Live rolling rpm from rep timestamps (ms). Recompute on every counted rep
// AND on a periodic evaluation tick, matching Pulse's rationale — pace must
// visibly decay during a stall, not just jump on the next rep.
export function cockRollingRpm(repTimestampsMs, nowMs, windowMs = COCK_ROLLING_WINDOW_MS) {
  const windowStart = nowMs - windowMs;
  let count = 0;
  for (const t of repTimestampsMs || []) {
    if (t > windowStart && t <= nowMs) count += 1;
  }
  return (count / windowMs) * 60000;
}

export function cockCreateRunState(nowMs) {
  return {
    runStartMs: nowMs,
    graceUntilMs: nowMs + COCK_GRACE_MS,
    phase: "grace", // "grace" | "ahead" | "behind"
    cockNerve: COCK_METER_START, // drains toward 0 while the boy is ahead
    boyResolve: COCK_METER_START, // drains toward 0 while the boy is behind (never rendered)
    ended: false,
    result: null, // "win" | "loss"
    endReason: null, // "nerve_zero" | "resolve_zero" | "fab_ahead" | "fab_behind"
    endedAtElapsedMs: null,
    finalCockRpm: null,
  };
}

// One evaluation tick. Pure function of (state, live inputs) -> next state,
// so the same logic drives the live screen and replay-style unit tests.
export function cockTick(state, { nowMs, rollingRpm, medianRpm }) {
  if (state.ended) return state;
  const elapsedMs = nowMs - state.runStartMs;

  if (nowMs < state.graceUntilMs) {
    return { ...state, phase: "grace" };
  }

  const cockRpm = cockPaceRpm(medianRpm, elapsedMs);
  const ahead = rollingRpm > cockRpm;
  const marginPct = cockRpm > 0 ? (rollingRpm - cockRpm) / cockRpm : 0;
  const step = cockMeterStep(marginPct);

  const cockNerve = ahead
    ? Math.max(0, state.cockNerve - step)
    : Math.min(COCK_METER_START, state.cockNerve + step);
  const boyResolve = ahead
    ? Math.min(COCK_METER_START, state.boyResolve + step)
    : Math.max(0, state.boyResolve - step);

  const next = { ...state, phase: ahead ? "ahead" : "behind", cockNerve, boyResolve };

  if (cockNerve <= 0) {
    return { ...next, ended: true, result: "win", endReason: "nerve_zero", endedAtElapsedMs: elapsedMs, finalCockRpm: Math.round(cockRpm) };
  }
  if (boyResolve <= 0) {
    return { ...next, ended: true, result: "loss", endReason: "resolve_zero", endedAtElapsedMs: elapsedMs, finalCockRpm: Math.round(cockRpm) };
  }
  return next;
}

// Manual end via the shared checkmark FAB. Resolves the CURRENT position:
// ahead of the cock's pace at this instant -> win, behind -> loss. During
// grace (phase still "grace") this records nothing, per the confirmed rule.
export function cockEndViaFab(state, { nowMs, medianRpm }) {
  if (state.ended) return state;
  const elapsedMs = nowMs - state.runStartMs;
  if (state.phase === "grace") {
    return { ...state, ended: true, result: null, endReason: null, endedAtElapsedMs: elapsedMs, finalCockRpm: null };
  }
  const cockRpm = cockPaceRpm(medianRpm, elapsedMs);
  const ahead = state.phase === "ahead";
  return {
    ...state,
    ended: true,
    result: ahead ? "win" : "loss",
    endReason: ahead ? "fab_ahead" : "fab_behind",
    endedAtElapsedMs: elapsedMs,
    finalCockRpm: Math.round(cockRpm),
  };
}
