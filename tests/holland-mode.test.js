import assert from "node:assert/strict";
import test from "node:test";
import {
  HOLLAND_27_THRESHOLD,
  HOLLAND_EXERCISE_ORDER,
  HOLLAND_TARGETS,
  hollandAdvanceSegment,
  hollandApplyCorrection,
  hollandBuildSession,
  hollandComponentSessions,
  hollandCreateState,
  hollandCurrentExercise,
  hollandCyclesLabel,
  hollandFinish,
  hollandFormatCycles,
  hollandNextExercise,
  hollandNormalizedCycles,
  hollandQualifiesForHolland27,
  hollandRecordReps,
  hollandSegmentTarget,
  hollandTargets,
  hollandTotalReps,
} from "../modes/holland.js";

test("difficulty catalog matches the roadmap targets", () => {
  assert.deepEqual(HOLLAND_TARGETS.normal, { pullup: 5, pushup: 10, squat: 15 });
  assert.deepEqual(HOLLAND_TARGETS.medium, { pullup: 10, pushup: 20, squat: 30 });
  assert.deepEqual(HOLLAND_TARGETS.hard, { pullup: 15, pushup: 30, squat: 45 });
});

test("hollandTargets throws for an unknown difficulty", () => {
  assert.throws(() => hollandTargets("legendary"));
});

test("hollandCreateState starts on pull-ups with zeroed totals", () => {
  const state = hollandCreateState("normal");
  assert.equal(hollandCurrentExercise(state), "pullup");
  assert.equal(hollandSegmentTarget(state), 5);
  assert.equal(hollandNextExercise(state), "pushup");
  assert.deepEqual(state.totals, { pullup: 0, pushup: 0, squat: 0 });
  assert.equal(state.circuitsCompleted, 0);
});

test("hollandRecordReps accumulates and caps exactly at the segment target", () => {
  const state = hollandCreateState("normal");
  let result = hollandRecordReps(state, 3);
  assert.equal(result.applied, 3);
  assert.equal(result.reachedTarget, false);
  assert.equal(state.totals.pullup, 3);

  result = hollandRecordReps(state, 4); // only 2 more fit before target of 5
  assert.equal(result.applied, 2);
  assert.equal(result.overflow, 2);
  assert.equal(result.reachedTarget, true);
  assert.equal(state.totals.pullup, 5);
  assert.equal(state.segmentReps, 5);
});

test("hollandApplyCorrection clamps to [0, target] and keeps totals in sync", () => {
  const state = hollandCreateState("normal");
  hollandRecordReps(state, 5); // pull-ups maxed at target
  hollandApplyCorrection(state, -2);
  assert.equal(state.segmentReps, 3);
  assert.equal(state.totals.pullup, 3);

  hollandApplyCorrection(state, 100); // clamps up to target, not beyond
  assert.equal(state.segmentReps, 5);
  assert.equal(state.totals.pullup, 5);

  hollandApplyCorrection(state, -100); // clamps down to zero, not negative
  assert.equal(state.segmentReps, 0);
  assert.equal(state.totals.pullup, 0);
});

test("hollandAdvanceSegment walks pullup -> pushup -> squat -> pullup and counts a circuit", () => {
  const state = hollandCreateState("normal");
  assert.equal(hollandCurrentExercise(state), "pullup");
  hollandAdvanceSegment(state);
  assert.equal(hollandCurrentExercise(state), "pushup");
  assert.equal(state.circuitsCompleted, 0);
  hollandAdvanceSegment(state);
  assert.equal(hollandCurrentExercise(state), "squat");
  hollandAdvanceSegment(state);
  assert.equal(hollandCurrentExercise(state), "pullup");
  assert.equal(state.circuitsCompleted, 1);
  assert.equal(state.segmentReps, 0);
});

test("HOLLAND_EXERCISE_ORDER is pullup, pushup, squat", () => {
  assert.deepEqual(HOLLAND_EXERCISE_ORDER, ["pullup", "pushup", "squat"]);
});

test("normalized cycles: one full Normal circuit is exactly 1.0", () => {
  const totals = { pullup: 5, pushup: 10, squat: 15 };
  assert.equal(hollandNormalizedCycles(totals), 1);
  assert.equal(hollandFormatCycles(hollandNormalizedCycles(totals)), "1.0");
});

test("normalized cycles: one full Medium circuit is 2.0, one full Hard circuit is 3.0", () => {
  assert.equal(hollandNormalizedCycles({ pullup: 10, pushup: 20, squat: 30 }), 2);
  assert.equal(hollandNormalizedCycles({ pullup: 15, pushup: 30, squat: 45 }), 3);
});

test("normalized cycles: partial reps count (8 Normal circuits + 3 pull-ups = 8.1)", () => {
  const totals = { pullup: 5 * 8 + 3, pushup: 10 * 8, squat: 15 * 8 };
  assert.equal(hollandTotalReps(totals), 30 * 8 + 3);
  assert.equal(hollandFormatCycles(hollandNormalizedCycles(totals)), "8.1");
});

test("hollandCyclesLabel appends the selected difficulty", () => {
  assert.equal(hollandCyclesLabel(24.6, "hard"), "24.6 Holland cycles (Hard)");
});

test("hollandQualifiesForHolland27 gates on the 27.0 threshold", () => {
  assert.equal(HOLLAND_27_THRESHOLD, 27);
  assert.equal(hollandQualifiesForHolland27(26.9), false);
  assert.equal(hollandQualifiesForHolland27(27), true);
  assert.equal(hollandQualifiesForHolland27(27.1), true);
});

test("hollandBuildSession serializes the canonical session shape with achievement metadata", () => {
  const state = hollandCreateState("hard");
  state.startedAt = new Date("2026-08-13T10:00:00.000Z");
  state.totals = { pullup: 15 * 9, pushup: 30 * 9, squat: 45 * 9 }; // 9 full Hard circuits = 27.0 cycles
  state.circuitsCompleted = 9;
  hollandFinish(state, new Date("2026-08-13T11:00:00.000Z"));

  const session = hollandBuildSession(state, { id: "abc", user: "Boy", avatar: "🦸" });
  assert.equal(session.type, "holland");
  assert.equal(session.hollandDifficulty, "hard");
  assert.equal(session.hollandPullups, 135);
  assert.equal(session.hollandPushups, 270);
  assert.equal(session.hollandSquats, 405);
  assert.equal(session.count, 135 + 270 + 405);
  assert.equal(session.hollandCycles, 27);
  assert.equal(session.hollandCircuits, 9);
  assert.equal(session.hollandAchievement, "holland27");
  assert.equal(session.startedAt, "2026-08-13T10:00:00.000Z");
  assert.equal(session.timestamp, "2026-08-13T11:00:00.000Z");
});

test("hollandBuildSession omits achievement metadata below threshold", () => {
  const state = hollandCreateState("normal");
  state.totals = { pullup: 5, pushup: 10, squat: 15 };
  hollandFinish(state, new Date("2026-08-13T11:00:00.000Z"));
  const session = hollandBuildSession(state, { id: "abc", user: "Boy" });
  assert.equal(session.hollandAchievement, undefined);
});

test("hollandComponentSessions projects a Holland session into pullup/pushup/squat component sessions", () => {
  const session = {
    id: "abc",
    type: "holland",
    user: "Boy",
    avatar: "🦸",
    timestamp: "2026-08-13T11:00:00.000Z",
    startedAt: "2026-08-13T10:00:00.000Z",
    hollandPullups: 15,
    hollandPushups: 30,
    hollandSquats: 45,
  };
  const projected = hollandComponentSessions(session);
  assert.equal(projected.length, 3);
  assert.deepEqual(projected.map((s) => s.type), ["pullup", undefined, "squat"]);
  assert.deepEqual(projected.map((s) => s.count), [15, 30, 45]);
  for (const s of projected) {
    assert.equal(s.hollandSourceId, "abc");
    assert.equal(s.user, "Boy");
  }
});

test("hollandComponentSessions skips zero-count components and non-holland sessions", () => {
  assert.deepEqual(hollandComponentSessions({ type: "squat" }), []);
  const projected = hollandComponentSessions({
    id: "x", type: "holland", user: "Boy", hollandPullups: 0, hollandPushups: 10, hollandSquats: 0,
  });
  assert.equal(projected.length, 1);
  assert.equal(projected[0].type, undefined);
  assert.equal(projected[0].count, 10);
});
