// Chain of Pain mode — continuous squat -> pushup -> plank circuit, TIME-
// driven per segment (unlike Holland, which is rep-target-driven). Pure
// rules/state module: duration catalog, segment/rest transitions, forced
// timer-expiry advance, segment-granular fractional cycle math, and session
// serialization. No DOM/camera/storage — see modes/holland-adapter.js for
// squat/pushup camera-counting reuse and app.js for the plank timer-only
// segment and screen wiring (see docs/chain-of-pain-mode-plan.md).

export const CHAIN_OF_PAIN_EXERCISE_ORDER = ["squat", "pushup", "plank"];

// Fixed duration picker — one duration applies to every segment equally.
export const CHAIN_OF_PAIN_DURATIONS = [
  { id: "30s", seconds: 30, label: "30 sec" },
  { id: "1min", seconds: 60, label: "1 min" },
  { id: "2.5min", seconds: 150, label: "2.5 min" },
  { id: "5min", seconds: 300, label: "5 min" },
];

// Fixed rest/transition buffer between every segment, including the wrap
// from plank back to squat, so the boy can reposition the phone.
export const CHAIN_OF_PAIN_REST_SECONDS = 10;

export function chainOfPainSetupRemainingSeconds(elapsedMs) {
  return Math.max(0, Math.ceil((5000 - Math.max(0, elapsedMs)) / 1000));
}

export function chainOfPainPushupVoiceCue({ count, elapsedMs, durationMs, lastCheerMs = 0, lastNumberMs = 0, quietUntilMs = 0 }) {
  if (elapsedMs < quietUntilMs) return null;
  if (count >= 8 && elapsedMs - lastCheerMs >= 20000 && durationMs - elapsedMs > 6000) return "cheer";
  if (count > 0 && count % 5 === 0 && elapsedMs - lastNumberMs >= 2500) return "number";
  return null;
}

export function chainOfPainPlankCueIndex(durationMs, elapsedMs) {
  if (elapsedMs < durationMs / 4 || elapsedMs >= durationMs) return -1;
  return Math.min(2, Math.floor(elapsedMs * 4 / durationMs) - 1);
}

export function chainOfPainDurationOptions() {
  return CHAIN_OF_PAIN_DURATIONS;
}

export function chainOfPainDurationById(id) {
  return CHAIN_OF_PAIN_DURATIONS.find((d) => d.id === id) || CHAIN_OF_PAIN_DURATIONS[0];
}

export function chainOfPainCreateState(durationSeconds) {
  return {
    durationSeconds,
    segmentIndex: 0, // index into CHAIN_OF_PAIN_EXERCISE_ORDER
    phase: "segment", // "segment" | "rest"
    segmentsCompleted: 0, // full-duration segments finished by timer expiry
    segmentReps: 0, // current segment's reps (squat/pushup) or seconds (plank)
    totals: { squat: 0, pushup: 0, plankSeconds: 0 },
    lastSegment: null, // { exercise, count } snapshot for the transition screen
    startedAt: null,
    finishedAt: null,
  };
}

export function chainOfPainCurrentExercise(state) {
  return CHAIN_OF_PAIN_EXERCISE_ORDER[state.segmentIndex];
}

// During rest the current index still identifies the completed exercise.
export function chainOfPainNextExercise(state) {
  return CHAIN_OF_PAIN_EXERCISE_ORDER[(state.segmentIndex + 1) % CHAIN_OF_PAIN_EXERCISE_ORDER.length];
}

export function chainOfPainCountdown(msRemaining) {
  const seconds = Math.max(0, Math.ceil(msRemaining / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function chainOfPainIsPlankSegment(state) {
  return chainOfPainCurrentExercise(state) === "plank";
}

function totalsKeyFor(exercise) {
  return exercise === "plank" ? "plankSeconds" : exercise;
}

// Camera-counted reps for the squat/pushup segments. No target/cap — the
// segment runs until its timer expires, so reps just accumulate.
export function chainOfPainRecordReps(state, count = 1) {
  if (state.phase !== "segment") return state;
  const exercise = chainOfPainCurrentExercise(state);
  if (exercise === "plank") return state; // plank uses chainOfPainTickPlank instead
  const applied = Math.max(0, count);
  state.segmentReps += applied;
  state.totals[totalsKeyFor(exercise)] += applied;
  return state;
}

// Plank's timer-only hold: no rep counting, just seconds ticked like Plank
// mode's own setInterval (see startPlank in app.js).
export function chainOfPainTickPlank(state, seconds = 1) {
  if (state.phase !== "segment" || !chainOfPainIsPlankSegment(state)) return state;
  const applied = Math.max(0, seconds);
  state.segmentReps += applied;
  state.totals.plankSeconds += applied;
  return state;
}

// Manual correction (+/- adjuster), squat/pushup only — planks have nothing
// to miscount. Clamped at 0; no upper cap since segments are time-driven.
export function chainOfPainApplyCorrection(state, delta) {
  if (state.phase !== "segment") return state;
  const exercise = chainOfPainCurrentExercise(state);
  if (exercise === "plank") return state;
  const next = Math.max(0, state.segmentReps + delta);
  const appliedDelta = next - state.segmentReps;
  state.segmentReps = next;
  state.totals[totalsKeyFor(exercise)] += appliedDelta;
  return state;
}

export function chainOfPainSegmentDurationMs(state) {
  return state.durationSeconds * 1000;
}

export function chainOfPainRestDurationMs() {
  return CHAIN_OF_PAIN_REST_SECONDS * 1000;
}

export function chainOfPainSegmentExpired(state, elapsedMs) {
  return state.phase === "segment" && elapsedMs >= chainOfPainSegmentDurationMs(state);
}

export function chainOfPainRestExpired(state, elapsedMs) {
  return state.phase === "rest" && elapsedMs >= chainOfPainRestDurationMs();
}

// Timer expiry force-advances regardless of current rep count — whatever
// was counted stands. Moves to the rest/transition phase and credits one
// fully-completed segment.
export function chainOfPainCompleteSegment(state) {
  if (state.phase !== "segment") return state;
  const exercise = chainOfPainCurrentExercise(state);
  state.lastSegment = { exercise, count: state.segmentReps };
  state.segmentsCompleted += 1;
  state.phase = "rest";
  return state;
}

// Rest expiry (or the boy tapping "ready") moves to the next exercise,
// wrapping plank -> squat to start a new cycle.
export function chainOfPainAdvanceFromRest(state) {
  if (state.phase !== "rest") return state;
  state.segmentIndex = (state.segmentIndex + 1) % CHAIN_OF_PAIN_EXERCISE_ORDER.length;
  state.segmentReps = 0;
  state.phase = "segment";
  return state;
}

// Segment-granular fractional cycle credit: each fully-completed segment is
// 1/3 of a cycle. Continuous, like Holland's normalized cycles, but
// segment-granular rather than rep-granular.
export function chainOfPainCycles(state) {
  return state.segmentsCompleted / CHAIN_OF_PAIN_EXERCISE_ORDER.length;
}

export function chainOfPainFormatCycles(cycles) {
  return cycles.toFixed(1);
}

export function chainOfPainCyclesLabel(cycles) {
  return `${chainOfPainFormatCycles(cycles)} cycles`;
}

export function chainOfPainFinish(state, finishedAt = new Date()) {
  state.finishedAt = finishedAt;
  return state;
}

// Canonical session shape (AGENTS.md "Canonical session model"), mirroring
// Holland's convention: raw aggregate `count`, per-exercise component
// totals, and the continuous fractional cycle value plus the raw segment
// count for anything that wants integer granularity.
export function chainOfPainBuildSession(state, { id, user, avatar, location } = {}) {
  const cycles = chainOfPainCycles(state);
  const startedAt = state.startedAt instanceof Date ? state.startedAt.toISOString() : state.startedAt;
  const finishedAt = state.finishedAt instanceof Date ? state.finishedAt.toISOString() : state.finishedAt;
  return {
    id,
    user,
    avatar,
    type: "chainofpain",
    count: state.totals.squat + state.totals.pushup,
    chainOfPainDurationSeconds: state.durationSeconds,
    chainOfPainSquats: state.totals.squat,
    chainOfPainPushups: state.totals.pushup,
    chainOfPainPlankSeconds: state.totals.plankSeconds,
    chainOfPainCycles: cycles,
    chainOfPainSegments: state.segmentsCompleted,
    startedAt,
    timestamp: finishedAt || new Date().toISOString(),
    ...(location ? { location } : {}),
  };
}

// Shared projection: makes a Chain of Pain session's component reps/seconds
// visible to the existing squat/pushup/plank aggregations (mode-stats,
// mode-breakdown, leaderboards, personal bests) without creating extra
// visible history records — mirrors hollandComponentSessions
// (modes/holland.js). Every aggregation path that walks sessions by
// `type`/`mode` should also call this for `type === "chainofpain"` sessions.
export function chainOfPainComponentSessions(session) {
  if (!session || session.type !== "chainofpain") return [];
  const base = {
    user: session.user,
    avatar: session.avatar,
    timestamp: session.timestamp,
    startedAt: session.startedAt,
    chainOfPainSourceId: session.id,
  };
  return [
    { ...base, type: "squat", count: session.chainOfPainSquats || 0 },
    // Pushup has no dedicated `type` in this app (a bare session is the
    // Classic pushup bucket), so the projection matches that convention.
    { ...base, count: session.chainOfPainPushups || 0 },
    { ...base, type: "plank", count: session.chainOfPainPlankSeconds || 0 },
  ].filter((s) => s.count > 0);
}
