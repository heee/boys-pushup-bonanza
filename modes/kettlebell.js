// Kettlebell workouts — pure rules module (see docs/kettlebell-mode-plan.md).
// Timer-driven, no camera: the app suggests reps from a learned per-user pace,
// the user confirms/adjusts actual reps on the rest screen, and those actuals
// feed the pace model. No DOM/storage here — app.js owns screens, timers,
// voice, and localStorage.

import { kettlebellExercise } from "./kettlebell-workouts.js";

export const KETTLEBELL_WEIGHT_STEP_LBS = 5;
export const KETTLEBELL_MAX_WEIGHT_LBS = 200;
// Countdown for a rep-target set = reps × pace × buffer, so a boy moving at
// his usual pace finishes with a few seconds to spare (and taps Done).
export const KETTLEBELL_PACE_BUFFER = 1.1;
export const KETTLEBELL_MIN_SET_SECONDS = 10;
const PACE_EMA_ALPHA = 0.3;
const MIN_PACE_SEC = 0.5;
const MAX_PACE_SEC = 15;

export function kettlebellSetKind(entry) {
  return entry.kind === "max" || entry.kind === "hold" ? entry.kind : "reps";
}

// Flattens a workout into its ordered list of sets. Circuit = round-robin
// through every exercise per round; straight = all rounds of one exercise
// before the next. restAfterSec is the rest following that set (0 after the
// final set); a circuit's round boundary uses roundRestSec.
export function kettlebellExpandSets(workout) {
  const rounds = Math.max(1, Math.floor(workout.rounds) || 1);
  const exercises = workout.exercises || [];
  const sets = [];
  const push = (entry, exerciseIndex, round) => {
    const kind = kettlebellSetKind(entry);
    sets.push({
      exerciseId: entry.exerciseId,
      exerciseIndex,
      round,
      kind,
      targetReps: kind === "reps" ? entry.reps : null,
      windowSec: kind === "reps" ? null : entry.windowSec,
      perSide: !!entry.perSide,
      restAfterSec: 0,
    });
  };
  if (workout.format === "straight") {
    exercises.forEach((entry, exerciseIndex) => {
      for (let round = 1; round <= rounds; round += 1) push(entry, exerciseIndex, round);
    });
  } else {
    for (let round = 1; round <= rounds; round += 1) {
      exercises.forEach((entry, exerciseIndex) => push(entry, exerciseIndex, round));
    }
  }
  sets.forEach((set, index) => {
    if (index === sets.length - 1) return;
    const roundBoundary = workout.format !== "straight" && sets[index + 1].round !== set.round;
    set.restAfterSec = roundBoundary ? (workout.roundRestSec ?? workout.restSec) : workout.restSec;
  });
  return sets;
}

// ---- pace model ----------------------------------------------------------
// paces: { [exerciseId]: { [weightLbs]: secondsPerRep } }, per user.

export function kettlebellPaceFor(paces, exerciseId, weightLbs) {
  const fallback = kettlebellExercise(exerciseId).paceSec;
  const byWeight = paces?.[exerciseId];
  if (!byWeight || typeof byWeight !== "object") return fallback;
  const exact = Number(byWeight[String(weightLbs)]);
  if (Number.isFinite(exact) && exact > 0) return exact;
  // Nearest known weight — a heavier bell is usually a bit slower, but the
  // closest sample beats the generic default.
  let best = null;
  for (const [key, value] of Object.entries(byWeight)) {
    const pace = Number(value);
    if (!Number.isFinite(pace) || pace <= 0) continue;
    const distance = Math.abs(Number(key) - weightLbs);
    if (!best || distance < best.distance) best = { distance, pace };
  }
  return best ? best.pace : fallback;
}

export function kettlebellSetDurationSec(set, paceSec) {
  if (set.kind !== "reps") return set.windowSec;
  return Math.max(KETTLEBELL_MIN_SET_SECONDS, Math.ceil(set.targetReps * paceSec * KETTLEBELL_PACE_BUFFER));
}

// What the rest screen prefills: the target for rep sets (the plan collapses
// rep ranges to their max), a pace-based estimate for Max windows, nothing
// for holds (time only).
export function kettlebellSuggestedReps(set, paceSec) {
  if (set.kind === "hold") return null;
  if (set.kind === "reps") return set.targetReps;
  return Math.max(1, Math.round(set.windowSec / Math.max(MIN_PACE_SEC, paceSec)));
}

// One completed set → updated paces (returns a new object). A rep set whose
// timer ran out with the target met only says "at most this slow", so it's
// skipped rather than dragging the pace slower every session.
export function kettlebellUpdatePace(paces, { exerciseId, kind, weightLbs, elapsedSec, actualReps, targetReps, timedOut }) {
  const next = { ...(paces || {}) };
  if (kind === "hold" || !(actualReps > 0) || !(elapsedSec > 0)) return next;
  if (kind === "reps" && timedOut && actualReps >= targetReps) return next;
  const byWeight = { ...(next[exerciseId] || {}) };
  const key = String(weightLbs);
  const previous = Number(byWeight[key]);
  let sample = Math.min(MAX_PACE_SEC, Math.max(MIN_PACE_SEC, elapsedSec / actualReps));
  // One fat-fingered early Done (or a set left running) shouldn't wreck a
  // learned pace — each sample can move it at most ~40–60% either way.
  if (Number.isFinite(previous) && previous > 0) sample = Math.min(previous * 1.6, Math.max(previous * 0.6, sample));
  byWeight[key] = Number.isFinite(previous) && previous > 0
    ? Math.round((previous + PACE_EMA_ALPHA * (sample - previous)) * 100) / 100
    : Math.round(sample * 100) / 100;
  next[exerciseId] = byWeight;
  return next;
}

// ---- weights -------------------------------------------------------------

export function kettlebellClampWeight(lbs) {
  const n = Math.round(Number(lbs) / KETTLEBELL_WEIGHT_STEP_LBS) * KETTLEBELL_WEIGHT_STEP_LBS;
  if (!Number.isFinite(n)) return 0;
  return Math.min(KETTLEBELL_MAX_WEIGHT_LBS, Math.max(0, n));
}

export function kettlebellStepWeight(lbs, direction) {
  return kettlebellClampWeight((Number(lbs) || 0) + Math.sign(direction) * KETTLEBELL_WEIGHT_STEP_LBS);
}

// "Go heavier" nudges: every rep-target set of a weighted exercise hit its
// target → suggest +5 lb next time. Returns { [exerciseId]: suggestedLbs }.
export function kettlebellNudges(setLog) {
  const byExercise = new Map();
  for (const set of setLog) {
    if (set.kind !== "reps" || kettlebellExercise(set.exerciseId).bodyweight) continue;
    if (!byExercise.has(set.exerciseId)) byExercise.set(set.exerciseId, []);
    byExercise.get(set.exerciseId).push(set);
  }
  const nudges = {};
  for (const [exerciseId, sets] of byExercise) {
    if (!sets.every((set) => set.actualReps >= set.targetReps)) continue;
    const heaviest = Math.max(...sets.map((set) => set.weightLbs || 0));
    if (heaviest <= 0) continue;
    nudges[exerciseId] = kettlebellStepWeight(heaviest, 1);
  }
  return nudges;
}

// ---- results -------------------------------------------------------------

export function kettlebellSetVolume(set) {
  const exercise = kettlebellExercise(set.exerciseId);
  if (exercise.bodyweight || set.kind === "hold") return 0;
  return (set.actualReps || 0) * (set.weightLbs || 0) * (exercise.bells || 1);
}

export function kettlebellTotals(setLog) {
  let reps = 0;
  let volumeLbs = 0;
  let holdSec = 0;
  for (const set of setLog) {
    if (set.kind === "hold") holdSec += set.elapsedSec || 0;
    else reps += set.actualReps || 0;
    volumeLbs += kettlebellSetVolume(set);
  }
  return { reps, volumeLbs, holdSec };
}

// Per-exercise rollup in workout order, for the summary table and the
// comparison against the previous run of the same workout.
export function kettlebellExerciseRollup(setLog) {
  const rows = new Map();
  for (const set of setLog) {
    if (!rows.has(set.exerciseId)) {
      rows.set(set.exerciseId, { exerciseId: set.exerciseId, kind: set.kind, sets: 0, reps: 0, holdSec: 0, weightLbs: 0, volumeLbs: 0 });
    }
    const row = rows.get(set.exerciseId);
    row.sets += 1;
    if (set.kind === "hold") row.holdSec += set.elapsedSec || 0;
    else row.reps += set.actualReps || 0;
    row.weightLbs = Math.max(row.weightLbs, set.weightLbs || 0);
    row.volumeLbs += kettlebellSetVolume(set);
  }
  return [...rows.values()];
}

// Compact wire format for the session's set log (kept short since every
// client downloads every session): e exercise, r round, k kind, t target,
// s suggested, a actual, w weight, b bells, d elapsed seconds.
export function kettlebellEncodeSets(setLog) {
  return setLog.map((set) => ({
    e: set.exerciseId,
    r: set.round,
    k: set.kind,
    t: set.targetReps ?? null,
    s: set.suggestedReps ?? null,
    a: set.kind === "hold" ? null : (set.actualReps ?? 0),
    w: set.weightLbs || 0,
    b: kettlebellExercise(set.exerciseId).bells || 1,
    d: Math.max(0, Math.round(set.elapsedSec || 0)),
  }));
}

export function kettlebellDecodeSets(encoded) {
  if (!Array.isArray(encoded)) return [];
  return encoded.map((set) => ({
    exerciseId: set.e,
    round: set.r,
    kind: set.k,
    targetReps: set.t,
    suggestedReps: set.s,
    actualReps: set.a,
    weightLbs: set.w,
    elapsedSec: set.d,
  }));
}

export function kettlebellBuildSession({ workout, setLog, startedAt, finishedAt }) {
  const { reps, volumeLbs } = kettlebellTotals(setLog);
  const durationSeconds = startedAt && finishedAt
    ? Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000))
    : setLog.reduce((sum, set) => sum + (set.elapsedSec || 0), 0);
  return {
    type: "kettlebell",
    count: reps,
    kettlebellWorkoutId: workout.id,
    kettlebellVolumeLbs: volumeLbs,
    kettlebellDurationSeconds: durationSeconds,
    kettlebellSets: kettlebellEncodeSets(setLog),
  };
}

export function kettlebellFormatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function kettlebellTargetLabel(set) {
  if (set.kind === "hold") return `Hold ${set.windowSec}s`;
  if (set.kind === "max") return set.perSide ? "Max reps · switch halfway" : "Max reps";
  return set.perSide ? `${set.targetReps / 2}/side` : `${set.targetReps} reps`;
}

// Whole-workout time estimate for the preview screen.
export function kettlebellEstimateSeconds(sets, paceForSet) {
  return sets.reduce((sum, set) => sum + kettlebellSetDurationSec(set, paceForSet(set)) + set.restAfterSec, 0);
}
