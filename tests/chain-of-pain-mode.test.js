import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAIN_OF_PAIN_DURATIONS,
  CHAIN_OF_PAIN_EXERCISE_ORDER,
  CHAIN_OF_PAIN_REST_SECONDS,
  chainOfPainAdvanceFromRest,
  chainOfPainApplyCorrection,
  chainOfPainBuildSession,
  chainOfPainCompleteSegment,
  chainOfPainComponentSessions,
  chainOfPainCreateState,
  chainOfPainCurrentExercise,
  chainOfPainNextExercise,
  chainOfPainCountdown,
  chainOfPainSetupRemainingSeconds,
  chainOfPainCycles,
  chainOfPainCyclesLabel,
  chainOfPainDurationById,
  chainOfPainFinish,
  chainOfPainFormatCycles,
  chainOfPainIsPlankSegment,
  chainOfPainRecordReps,
  chainOfPainRestExpired,
  chainOfPainSegmentExpired,
  chainOfPainTickPlank,
} from "../modes/chain-of-pain.js";

test("exercise order is squat, pushup, plank", () => {
  assert.deepEqual(CHAIN_OF_PAIN_EXERCISE_ORDER, ["squat", "pushup", "plank"]);
});

test("rest previews the upcoming exercise without advancing or losing completed reps", () => {
  const state = chainOfPainCreateState(30);
  for (const [current, next] of [["squat", "pushup"], ["pushup", "plank"], ["plank", "squat"]]) {
    chainOfPainRecordReps(state, 4);
    chainOfPainCompleteSegment(state);
    const snapshot = structuredClone(state);
    assert.equal(chainOfPainCurrentExercise(state), current);
    assert.equal(chainOfPainNextExercise(state), next);
    assert.deepEqual(state, snapshot);
    chainOfPainAdvanceFromRest(state);
    assert.equal(chainOfPainCurrentExercise(state), next);
  }
});

test("countdowns round up partial seconds and stop at zero for every duration", () => {
  for (const [ms, expected] of [[30000, "0:30"], [60000, "1:00"], [150000, "2:30"], [300000, "5:00"], [1001, "0:02"], [1, "0:01"], [0, "0:00"], [-200, "0:00"]]) {
    assert.equal(chainOfPainCountdown(ms), expected);
  }
});

test("duration catalog has the four fixed picker options", () => {
  assert.deepEqual(CHAIN_OF_PAIN_DURATIONS.map((d) => d.seconds), [30, 60, 150, 300]);
  assert.equal(chainOfPainDurationById("2.5min").seconds, 150);
  assert.equal(chainOfPainDurationById("nope").seconds, 30); // falls back to first
});

test("rest buffer is a fixed 10 seconds", () => {
  assert.equal(CHAIN_OF_PAIN_REST_SECONDS, 10);
});

test("setup countdown waits five complete seconds and clamps delayed callbacks", () => {
  for (const [elapsed, remaining] of [[0, 5], [999, 5], [1000, 4], [4999, 1], [5000, 0], [7000, 0]]) {
    assert.equal(chainOfPainSetupRemainingSeconds(elapsed), remaining);
  }
});

test("chainOfPainCreateState starts on squat with zeroed totals", () => {
  const state = chainOfPainCreateState(60);
  assert.equal(chainOfPainCurrentExercise(state), "squat");
  assert.equal(state.phase, "segment");
  assert.deepEqual(state.totals, { squat: 0, pushup: 0, plankSeconds: 0 });
  assert.equal(state.segmentsCompleted, 0);
});

test("chainOfPainRecordReps accumulates without any cap (time-driven, not target-driven)", () => {
  const state = chainOfPainCreateState(30);
  chainOfPainRecordReps(state, 5);
  chainOfPainRecordReps(state, 40);
  assert.equal(state.segmentReps, 45);
  assert.equal(state.totals.squat, 45);
});

test("chainOfPainApplyCorrection clamps at zero but has no upper cap", () => {
  const state = chainOfPainCreateState(30);
  chainOfPainRecordReps(state, 5);
  chainOfPainApplyCorrection(state, -2);
  assert.equal(state.segmentReps, 3);
  chainOfPainApplyCorrection(state, -100);
  assert.equal(state.segmentReps, 0);
  assert.equal(state.totals.squat, 0);
  chainOfPainApplyCorrection(state, 50);
  assert.equal(state.segmentReps, 50);
});

test("plank segment has no rep counting or correction — only tick", () => {
  const state = chainOfPainCreateState(30);
  chainOfPainCompleteSegment(state); // finish squat
  chainOfPainAdvanceFromRest(state); // -> pushup
  chainOfPainCompleteSegment(state); // finish pushup
  chainOfPainAdvanceFromRest(state); // -> plank
  assert.equal(chainOfPainCurrentExercise(state), "plank");
  assert.ok(chainOfPainIsPlankSegment(state));

  chainOfPainRecordReps(state, 5); // no-op on plank
  chainOfPainApplyCorrection(state, 5); // no-op on plank
  assert.equal(state.segmentReps, 0);

  chainOfPainTickPlank(state, 1);
  chainOfPainTickPlank(state, 1);
  assert.equal(state.segmentReps, 2);
  assert.equal(state.totals.plankSeconds, 2);
});

test("segment timer expiry force-advances regardless of rep count and credits 1/3 cycle", () => {
  const state = chainOfPainCreateState(30);
  chainOfPainRecordReps(state, 12);
  assert.equal(chainOfPainSegmentExpired(state, 29999), false);
  assert.equal(chainOfPainSegmentExpired(state, 30000), true);

  chainOfPainCompleteSegment(state);
  assert.equal(state.phase, "rest");
  assert.equal(state.segmentsCompleted, 1);
  assert.deepEqual(state.lastSegment, { exercise: "squat", count: 12 });
  assert.equal(chainOfPainFormatCycles(chainOfPainCycles(state)), "0.3");
});

test("rest expiry gates on the fixed 10s buffer and advance wraps plank back to squat", () => {
  const state = chainOfPainCreateState(30);
  chainOfPainCompleteSegment(state);
  assert.equal(chainOfPainRestExpired(state, 9999), false);
  assert.equal(chainOfPainRestExpired(state, 10000), true);

  chainOfPainAdvanceFromRest(state);
  assert.equal(chainOfPainCurrentExercise(state), "pushup");
  assert.equal(state.segmentReps, 0);
  assert.equal(state.phase, "segment");

  chainOfPainCompleteSegment(state);
  chainOfPainAdvanceFromRest(state);
  assert.equal(chainOfPainCurrentExercise(state), "plank");
  chainOfPainCompleteSegment(state);
  chainOfPainAdvanceFromRest(state);
  assert.equal(chainOfPainCurrentExercise(state), "squat"); // wrapped, cycle 2 begins
  assert.equal(state.segmentsCompleted, 3);
  assert.equal(chainOfPainFormatCycles(chainOfPainCycles(state)), "1.0");
});

test("partial-cycle credit is segment-granular: 2/3 after squat+pushup, mid-plank stop", () => {
  const state = chainOfPainCreateState(60);
  chainOfPainRecordReps(state, 20);
  chainOfPainCompleteSegment(state);
  chainOfPainAdvanceFromRest(state);
  chainOfPainRecordReps(state, 15);
  chainOfPainCompleteSegment(state);
  chainOfPainAdvanceFromRest(state);
  // now mid-plank, stop without completing it
  assert.equal(chainOfPainCurrentExercise(state), "plank");
  assert.equal(chainOfPainFormatCycles(chainOfPainCycles(state)), "0.7"); // 2/3 = 0.667 -> 0.7
});

test("stopping mid-squat on cycle 2 after one full cycle earns exactly 1.0, no credit for the in-progress segment", () => {
  const state = chainOfPainCreateState(30);
  for (let i = 0; i < 3; i++) {
    chainOfPainRecordReps(state, 10);
    chainOfPainCompleteSegment(state);
    chainOfPainAdvanceFromRest(state);
  }
  assert.equal(chainOfPainCurrentExercise(state), "squat");
  assert.equal(chainOfPainFormatCycles(chainOfPainCycles(state)), "1.0");
  chainOfPainRecordReps(state, 4); // in-progress cycle-2 squat, no timer expiry yet
  assert.equal(chainOfPainFormatCycles(chainOfPainCycles(state)), "1.0");
});

test("chainOfPainBuildSession serializes the canonical session shape", () => {
  const state = chainOfPainCreateState(60);
  state.startedAt = new Date("2026-09-07T10:00:00.000Z");
  state.totals = { squat: 40, pushup: 35, plankSeconds: 62 };
  state.segmentsCompleted = 5;
  chainOfPainFinish(state, new Date("2026-09-07T10:20:00.000Z"));

  const session = chainOfPainBuildSession(state, { id: "abc", user: "Boy", avatar: "⛓️" });
  assert.equal(session.type, "chainofpain");
  assert.equal(session.chainOfPainSquats, 40);
  assert.equal(session.chainOfPainPushups, 35);
  assert.equal(session.chainOfPainPlankSeconds, 62);
  assert.equal(session.count, 75);
  assert.equal(session.chainOfPainCycles, 5 / 3);
  assert.equal(session.chainOfPainSegments, 5);
  assert.equal(session.chainOfPainDurationSeconds, 60);
  assert.equal(session.startedAt, "2026-09-07T10:00:00.000Z");
  assert.equal(session.timestamp, "2026-09-07T10:20:00.000Z");
});

test("chainOfPainCyclesLabel formats to one decimal", () => {
  assert.equal(chainOfPainCyclesLabel(3.666), "3.7 cycles");
});

test("chainOfPainComponentSessions projects into squat/pushup/plank component sessions", () => {
  const session = {
    id: "abc",
    type: "chainofpain",
    user: "Boy",
    avatar: "⛓️",
    timestamp: "2026-09-07T11:00:00.000Z",
    startedAt: "2026-09-07T10:40:00.000Z",
    chainOfPainSquats: 40,
    chainOfPainPushups: 35,
    chainOfPainPlankSeconds: 62,
  };
  const projected = chainOfPainComponentSessions(session);
  assert.equal(projected.length, 3);
  assert.deepEqual(projected.map((s) => s.type), ["squat", undefined, "plank"]);
  assert.deepEqual(projected.map((s) => s.count), [40, 35, 62]);
  for (const s of projected) {
    assert.equal(s.chainOfPainSourceId, "abc");
    assert.equal(s.user, "Boy");
  }
});

test("chainOfPainComponentSessions skips zero-count components and non-chainofpain sessions", () => {
  assert.deepEqual(chainOfPainComponentSessions({ type: "squat" }), []);
  const projected = chainOfPainComponentSessions({
    id: "x", type: "chainofpain", user: "Boy", chainOfPainSquats: 0, chainOfPainPushups: 10, chainOfPainPlankSeconds: 0,
  });
  assert.equal(projected.length, 1);
  assert.equal(projected[0].type, undefined);
  assert.equal(projected[0].count, 10);
});
