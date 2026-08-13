// Holland mode — continuous pull-up/pushup/squat endurance circuit, inspired
// by the reported superhero workout. Pure rules/state module: difficulty
// catalog, circuit ordering, segment/circuit transitions, correction rules,
// normalized-cycle math, and session serialization. No DOM/camera/storage —
// see modes/pullup.js, modes/squat.js and app.js for detection/calibration
// reuse, which stays in each existing mode's own module.

export const HOLLAND_EXERCISE_ORDER = ["pullup", "pushup", "squat"];

// Normal is the baseline workload: normalized cycles are raw total reps
// (across all three exercises, any circuit) divided by this sum.
export const HOLLAND_TARGETS = {
  normal: { pullup: 5, pushup: 10, squat: 15 },
  medium: { pullup: 10, pushup: 20, squat: 30 },
  hard: { pullup: 15, pushup: 30, squat: 45 },
};

export const HOLLAND_DIFFICULTIES = Object.keys(HOLLAND_TARGETS);

const HOLLAND_NORMAL_TOTAL =
  HOLLAND_TARGETS.normal.pullup + HOLLAND_TARGETS.normal.pushup + HOLLAND_TARGETS.normal.squat;

// Normalized cycles at which the playful "Holland 27" achievement unlocks.
export const HOLLAND_27_THRESHOLD = 27;

export function hollandDifficultyLabel(difficulty) {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

export function hollandTargets(difficulty) {
  const targets = HOLLAND_TARGETS[difficulty];
  if (!targets) throw new Error(`unknown Holland difficulty: ${difficulty}`);
  return targets;
}

export function hollandCreateState(difficulty) {
  const targets = hollandTargets(difficulty);
  return {
    difficulty,
    targets,
    segmentIndex: 0,
    segmentReps: 0,
    circuitsCompleted: 0,
    totals: { pullup: 0, pushup: 0, squat: 0 },
    startedAt: null,
    finishedAt: null,
  };
}

export function hollandCurrentExercise(state) {
  return HOLLAND_EXERCISE_ORDER[state.segmentIndex];
}

export function hollandSegmentTarget(state) {
  return state.targets[hollandCurrentExercise(state)];
}

export function hollandNextExercise(state) {
  const nextIndex = (state.segmentIndex + 1) % HOLLAND_EXERCISE_ORDER.length;
  return HOLLAND_EXERCISE_ORDER[nextIndex];
}

// Records rep(s) counted for the current segment's exercise, capping at the
// segment target so a burst of camera-counted reps can't overshoot — the
// segment freezes exactly at target. Returns whether the target was reached
// and how many reps (if any) overflowed past it.
export function hollandRecordReps(state, count = 1) {
  const exercise = hollandCurrentExercise(state);
  const target = hollandSegmentTarget(state);
  const applied = Math.max(0, Math.min(count, target - state.segmentReps));
  state.segmentReps += applied;
  state.totals[exercise] += applied;
  return {
    exercise,
    applied,
    overflow: count - applied,
    reachedTarget: state.segmentReps >= target,
  };
}

// Manual correction (the discreet -/+ controls). Clamped to [0, target] for
// the active segment; totals move by the same clamped delta so the
// normalized-cycle math never drifts out of sync with what's on screen.
export function hollandApplyCorrection(state, delta) {
  const exercise = hollandCurrentExercise(state);
  const target = hollandSegmentTarget(state);
  const next = Math.max(0, Math.min(target, state.segmentReps + delta));
  const appliedDelta = next - state.segmentReps;
  state.segmentReps = next;
  state.totals[exercise] += appliedDelta;
  return state;
}

// Advances past the completed segment. Wrapping past squat back to pull-up
// closes out one physical circuit.
export function hollandAdvanceSegment(state) {
  state.segmentIndex += 1;
  state.segmentReps = 0;
  if (state.segmentIndex >= HOLLAND_EXERCISE_ORDER.length) {
    state.segmentIndex = 0;
    state.circuitsCompleted += 1;
  }
  return state;
}

export function hollandTotalReps(totals) {
  return totals.pullup + totals.pushup + totals.squat;
}

// Normalized to the Normal workload (30 reps/circuit): partial reps count,
// so this is a continuous value, not just circuitsCompleted * per-difficulty
// multiplier.
export function hollandNormalizedCycles(totals) {
  return hollandTotalReps(totals) / HOLLAND_NORMAL_TOTAL;
}

export function hollandFormatCycles(cycles) {
  return cycles.toFixed(1);
}

export function hollandCyclesLabel(cycles, difficulty) {
  return `${hollandFormatCycles(cycles)} Holland cycles (${hollandDifficultyLabel(difficulty)})`;
}

export function hollandQualifiesForHolland27(cycles) {
  return cycles >= HOLLAND_27_THRESHOLD;
}

export function hollandFinish(state, finishedAt = new Date()) {
  state.finishedAt = finishedAt;
  return state;
}

// Canonical session shape (AGENTS.md "Canonical session model"): one record
// per Holland workout, raw aggregate `count`, and per-exercise component
// counts other aggregation paths project into the existing pull-up/pushup/
// squat totals.
export function hollandBuildSession(state, { id, user, avatar, location } = {}) {
  const cycles = hollandNormalizedCycles(state.totals);
  const startedAt = state.startedAt instanceof Date ? state.startedAt.toISOString() : state.startedAt;
  const finishedAt = state.finishedAt instanceof Date ? state.finishedAt.toISOString() : state.finishedAt;
  return {
    id,
    user,
    avatar,
    type: "holland",
    count: hollandTotalReps(state.totals),
    hollandDifficulty: state.difficulty,
    hollandPullups: state.totals.pullup,
    hollandPushups: state.totals.pushup,
    hollandSquats: state.totals.squat,
    hollandCycles: cycles,
    hollandCircuits: state.circuitsCompleted,
    hollandAchievement: hollandQualifiesForHolland27(cycles) ? "holland27" : undefined,
    startedAt,
    timestamp: finishedAt || new Date().toISOString(),
    ...(location ? { location } : {}),
  };
}

// Shared projection: makes a Holland session's component reps visible to the
// existing pull-up/pushup/squat aggregations (mode-stats, mode-breakdown,
// leaderboards, totals) without creating extra visible history records. Every
// aggregation path that walks sessions by `type`/`mode` should also call this
// for `type === "holland"` sessions rather than reading hollandPullups/etc.
// directly, so the mapping only lives in one place.
export function hollandComponentSessions(session) {
  if (!session || session.type !== "holland") return [];
  const base = {
    user: session.user,
    avatar: session.avatar,
    timestamp: session.timestamp,
    startedAt: session.startedAt,
    hollandSourceId: session.id,
  };
  return [
    { ...base, type: "pullup", count: session.hollandPullups || 0 },
    // Pushup has no dedicated `type` in this app (a bare session is the
    // Classic pushup bucket), so the projection matches that convention.
    { ...base, count: session.hollandPushups || 0 },
    { ...base, type: "squat", count: session.hollandSquats || 0 },
  ].filter((s) => s.count > 0);
}
