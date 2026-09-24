import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { KETTLEBELL_EXERCISES, KETTLEBELL_WORKOUTS, kettlebellWorkoutById } from "../modes/kettlebell-workouts.js";
import {
  kettlebellBuildSession,
  kettlebellClampWeight,
  kettlebellDecodeSets,
  kettlebellExerciseRollup,
  kettlebellExpandSets,
  kettlebellNudges,
  kettlebellPaceFor,
  kettlebellSetDurationSec,
  kettlebellStepWeight,
  kettlebellSuggestedReps,
  kettlebellTargetLabel,
  kettlebellTotals,
  kettlebellUpdatePace,
} from "../modes/kettlebell.js";
import { insertSession, sessionFromRow, validateSession } from "../worker/index.js";
import { filterByMode } from "../stats.js";

test("every preset references known exercises with a usable target", () => {
  for (const workout of KETTLEBELL_WORKOUTS) {
    assert.match(workout.id, /^[a-z0-9-]{1,40}$/);
    for (const entry of workout.exercises) {
      assert.ok(KETTLEBELL_EXERCISES[entry.exerciseId], `${workout.id}: ${entry.exerciseId}`);
      if (entry.kind === "max" || entry.kind === "hold") assert.ok(entry.windowSec > 0);
      else assert.ok(entry.reps > 0);
      if (entry.perSide && entry.reps) assert.equal(entry.reps % 2, 0, "per-side reps count both sides");
    }
  }
});

test("circuit expands round-robin with round rest at the boundary and none after the last set", () => {
  const sets = kettlebellExpandSets(kettlebellWorkoutById("five-alive"));
  assert.equal(sets.length, 25);
  assert.deepEqual(sets.slice(0, 5).map((s) => s.exerciseId), ["kb-pushup", "kb-halo", "kb-curl", "row-clean-press", "goblet-march"]);
  assert.equal(sets[5].round, 2);
  assert.equal(sets[0].restAfterSec, 15);
  assert.equal(sets[4].restAfterSec, 60, "round boundary");
  assert.equal(sets.at(-1).restAfterSec, 0);
  assert.equal(sets[0].kind, "max");
  assert.equal(sets[1].targetReps, 16);
});

test("straight format runs each exercise's rounds back to back", () => {
  const sets = kettlebellExpandSets({ format: "straight", rounds: 2, restSec: 30, roundRestSec: 90, exercises: [{ exerciseId: "kb-halo", reps: 10 }, { exerciseId: "kb-curl", reps: 8 }] });
  assert.deepEqual(sets.map((s) => `${s.exerciseId}:${s.round}`), ["kb-halo:1", "kb-halo:2", "kb-curl:1", "kb-curl:2"]);
  assert.deepEqual(sets.map((s) => s.restAfterSec), [30, 30, 30, 0]);
});

test("Core Ten is ten one-minute windows with 10 s transitions and two holds", () => {
  const sets = kettlebellExpandSets(kettlebellWorkoutById("core-ten"));
  assert.equal(sets.length, 10);
  assert.ok(sets.every((s) => s.windowSec === 60));
  assert.deepEqual(sets.filter((s) => s.kind === "hold").map((s) => s.exerciseId), ["kb-high-plank", "hollow-flutter"]);
  assert.deepEqual(sets.slice(0, -1).map((s) => s.restAfterSec), Array(9).fill(10));
});

test("countdown = target × pace with buffer; max/hold use the window", () => {
  assert.equal(kettlebellSetDurationSec({ kind: "reps", targetReps: 16 }, 2.5), 44);
  assert.equal(kettlebellSetDurationSec({ kind: "reps", targetReps: 2 }, 1), 10, "floor");
  assert.equal(kettlebellSetDurationSec({ kind: "max", windowSec: 45 }, 2), 45);
  assert.equal(kettlebellSuggestedReps({ kind: "max", windowSec: 45 }, 2), 23);
  assert.equal(kettlebellSuggestedReps({ kind: "reps", targetReps: 12 }, 3), 12);
  assert.equal(kettlebellSuggestedReps({ kind: "hold", windowSec: 60 }, 1), null);
});

test("pace learning: EMA per exercise × weight, nearest-weight fallback, skips uninformative timeouts", () => {
  let paces = {};
  assert.equal(kettlebellPaceFor(paces, "kb-halo", 25), 2.5, "default seed");
  paces = kettlebellUpdatePace(paces, { exerciseId: "kb-halo", kind: "reps", weightLbs: 25, elapsedSec: 32, actualReps: 16, targetReps: 16, timedOut: false });
  assert.equal(kettlebellPaceFor(paces, "kb-halo", 25), 2);
  paces = kettlebellUpdatePace(paces, { exerciseId: "kb-halo", kind: "reps", weightLbs: 25, elapsedSec: 48, actualReps: 16, targetReps: 16, timedOut: false });
  assert.equal(kettlebellPaceFor(paces, "kb-halo", 25), 2.3);
  assert.equal(kettlebellPaceFor(paces, "kb-halo", 30), 2.3, "nearest known weight");
  const before = kettlebellPaceFor(paces, "kb-halo", 25);
  paces = kettlebellUpdatePace(paces, { exerciseId: "kb-halo", kind: "reps", weightLbs: 25, elapsedSec: 44, actualReps: 16, targetReps: 16, timedOut: true });
  assert.equal(kettlebellPaceFor(paces, "kb-halo", 25), before, "timed out at target is only an upper bound");
  paces = kettlebellUpdatePace(paces, { exerciseId: "kb-high-plank", kind: "hold", weightLbs: 0, elapsedSec: 60, actualReps: null });
  assert.equal(paces["kb-high-plank"], undefined);
});

test("weights step in 5 lb and nudge +5 only when every rep set hit target", () => {
  assert.equal(kettlebellStepWeight(25, 1), 30);
  assert.equal(kettlebellStepWeight(0, -1), 0);
  assert.equal(kettlebellClampWeight(27), 25);
  const log = [
    { exerciseId: "kb-halo", kind: "reps", targetReps: 16, actualReps: 16, weightLbs: 25 },
    { exerciseId: "kb-halo", kind: "reps", targetReps: 16, actualReps: 17, weightLbs: 25 },
    { exerciseId: "kb-curl", kind: "reps", targetReps: 12, actualReps: 11, weightLbs: 20 },
    { exerciseId: "kb-pushup", kind: "max", targetReps: null, actualReps: 30, weightLbs: 0 },
  ];
  assert.deepEqual(kettlebellNudges(log), { "kb-halo": 30 });
});

test("totals: volume = reps × weight × bells; bodyweight and holds add none", () => {
  const log = [
    { exerciseId: "row-clean-press", kind: "reps", targetReps: 6, actualReps: 6, weightLbs: 35, elapsedSec: 30 },
    { exerciseId: "kb-pushup", kind: "max", actualReps: 20, weightLbs: 0, elapsedSec: 45 },
    { exerciseId: "kb-halo", kind: "reps", targetReps: 16, actualReps: 16, weightLbs: 25, elapsedSec: 40 },
    { exerciseId: "kb-high-plank", kind: "hold", actualReps: null, weightLbs: 0, elapsedSec: 60 },
  ];
  assert.deepEqual(kettlebellTotals(log), { reps: 42, volumeLbs: 6 * 35 * 2 + 16 * 25, holdSec: 60 });
  const rollup = kettlebellExerciseRollup(log);
  assert.equal(rollup.find((r) => r.exerciseId === "kb-high-plank").holdSec, 60);
  assert.equal(kettlebellTargetLabel({ kind: "reps", targetReps: 12, perSide: true }), "6/side");
});

test("session round-trips through Worker validation and D1 persistence", async () => {
  const log = [
    { exerciseId: "kb-halo", round: 1, kind: "reps", targetReps: 16, suggestedReps: 16, actualReps: 15, weightLbs: 25, elapsedSec: 38 },
    { exerciseId: "row-clean-press", round: 1, kind: "reps", targetReps: 6, suggestedReps: 6, actualReps: 6, weightLbs: 35, elapsedSec: 31 },
    { exerciseId: "kb-high-plank", round: 1, kind: "hold", targetReps: null, suggestedReps: null, actualReps: null, weightLbs: 0, elapsedSec: 60 },
  ];
  const built = kettlebellBuildSession({ workout: { id: "five-alive" }, setLog: log, startedAt: new Date("2026-09-24T10:00:00Z"), finishedAt: new Date("2026-09-24T10:03:00Z") });
  assert.equal(built.count, 21);
  assert.equal(built.kettlebellDurationSeconds, 180);
  const session = validateSession({ id: "kb-1", user: "Henning", timestamp: "2026-09-24T10:03:00.000Z", ...built, kettlebellVolumeLbs: 999999 });
  assert.ok(session);
  assert.equal(session.type, "kettlebell");
  assert.equal(session.kettlebellVolumeLbs, 15 * 25 + 6 * 35 * 2, "server-derived volume");
  assert.equal(validateSession({ user: "H", ...built, count: 22 }), null, "count must equal logged reps");
  assert.equal(validateSession({ user: "H", ...built, kettlebellWorkoutId: "Bad Id!" }), null);
  assert.equal(validateSession({ user: "H", ...built, kettlebellSets: [{ ...built.kettlebellSets[0], k: "nope" }] }), null);

  const sqlite = new DatabaseSync(":memory:");
  try {
    for (const migration of ["0001_initial_schema.sql", "0003_holland_mode.sql", "0005_pulse_mode.sql", "0006_session_progression.sql", "0007_chain_of_pain.sql", "0008_kettlebell.sql"]) {
      sqlite.exec(readFileSync(new URL(`../worker/migrations/${migration}`, import.meta.url), "utf8"));
    }
    for (const column of ["cock_result", "cock_end_reason", "cock_median_rpm", "cock_final_cock_rpm"]) sqlite.exec(`ALTER TABLE sessions ADD COLUMN ${column}`);
    const db = { prepare(sql) {
      const statement = sqlite.prepare(sql);
      return { bind(...args) { return {
        async run() { return statement.run(...args); },
        async first(column) { const row = statement.get(...args); return column ? row?.[column] : row; },
      }; } };
    } };
    await insertSession(db, session);
    const [saved] = sqlite.prepare("SELECT s.*, u.name AS user FROM sessions s JOIN users u ON u.id=s.user_id").all().map(sessionFromRow);
    assert.equal(saved.kettlebellWorkoutId, "five-alive");
    assert.equal(saved.kettlebellVolumeLbs, session.kettlebellVolumeLbs);
    assert.deepEqual(kettlebellDecodeSets(saved.kettlebellSets).map((s) => s.actualReps), [15, 6, null]);
    assert.equal(filterByMode([saved], "all").length, 0, "kettlebell reps never land in pushup totals");
    assert.equal(filterByMode([saved], "kettlebell").length, 1);
  } finally { sqlite.close(); }
});

test("one outlier set moves a learned pace only partway", () => {
  let paces = { "kb-halo": { 25: 2.5 } };
  paces = kettlebellUpdatePace(paces, { exerciseId: "kb-halo", kind: "reps", weightLbs: 25, elapsedSec: 3, actualReps: 16, targetReps: 16, timedOut: false });
  assert.equal(kettlebellPaceFor(paces, "kb-halo", 25), 2.2, "sample clamped to 60% of 2.5 (1.5) before the 0.3 EMA");
});
