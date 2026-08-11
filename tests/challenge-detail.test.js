import test from "node:test";
import assert from "node:assert/strict";
import {
  challengeActivityId,
  challengeLeaderboardRows,
  challengeOverviewStats,
  challengeShareContext,
  challengeStatusLabel,
  progressThermometerModel,
  recentChallengeSessions,
} from "../screens/challenges.js";

test("challenge activity routing recognizes future pull-up challenges", () => {
  assert.equal(challengeActivityId({ activity: "pullups" }), "pullups");
  assert.equal(challengeActivityId({}), "pushups");
});

const challenge = { start: "2026-08-01", end: "2026-08-10", goal: 100, goalType: "individual", emoji: "💪", title: "August Flex" };
const now = new Date(2026, 7, 2, 12);

test("challenge detail status and overview preserve active display", () => {
  assert.equal(challengeStatusLabel(challenge, now), "9 days left");
  assert.deepEqual(challengeOverviewStats(challenge, { participantCount: 3, total: 75, now }), [
    { icon: "participants", label: "Participants", value: 3 },
    { icon: "total", label: "Total pushups", value: 75 },
  ]);
});

test("challenge overview assigns stroke-icon ids to every stat type", () => {
  const upcoming = challengeOverviewStats(
    { ...challenge, start: "2026-08-20", end: "2026-08-25" },
    { participantCount: 3, total: 75, now, locale: "en-US" }
  );
  assert.deepEqual(upcoming.map(({ icon, label }) => [icon, label]), [
    ["duration", "Duration"],
    ["participants", "Participants"],
    ["total", "Total pushups"],
    ["status", "Days until start"],
  ]);
});

test("thermometer preserves normal, completed, and exceeded states", () => {
  assert.deepEqual(progressThermometerModel(25, 100), { segmented: false, percent: 25, won: false });
  assert.deepEqual(progressThermometerModel(100, 100), { segmented: false, percent: 100, won: true });
  assert.deepEqual(progressThermometerModel(125, 100), { segmented: true, goalPercent: 80, excessPercent: 20 });
});

test("PR leaderboard checks achievers and restarts numeric ranks", () => {
  const rows = challengeLeaderboardRows([
    { name: "A", score: 30, achieved: true },
    { name: "B", score: 25, achieved: true },
    { name: "C", score: 20, achieved: false },
    { name: "D", score: 10, achieved: false },
  ], "pr");
  assert.deepEqual(rows.map(({ displayRank, rankIsCheck }) => [displayRank, rankIsCheck]), [["✓", true], ["✓", true], [1, false], [2, false]]);
});

test("recent sessions are newest-first without mutating source", () => {
  const sessions = [{ timestamp: 1 }, { timestamp: 3 }, { timestamp: 2 }];
  assert.deepEqual(recentChallengeSessions(sessions, (s) => s.timestamp, 2).map((s) => s.timestamp), [3, 2]);
  assert.deepEqual(sessions.map((s) => s.timestamp), [1, 3, 2]);
});

test("share context preserves numeric and PR leader semantics", () => {
  const numeric = challengeShareContext(challenge, [{ name: "A", score: 125 }], { formatNumber: String, locale: "en-US" });
  assert.equal(numeric.leaderPct, 125);
  assert.equal(numeric.exceeded, true);
  const pr = challengeShareContext({ ...challenge, goalType: "pr" }, [{ name: "A", score: 30, achieved: false }], { locale: "en-US" });
  assert.equal(pr.hasLeader, false);
});

test("plank gauntlet share context formats scores as durations and never 'exceeds' a goal", () => {
  const plankChallenge = { ...challenge, goalType: "plankGauntlet", goal: undefined };
  const ctx = challengeShareContext(plankChallenge, [{ name: "A", score: 320, cumulative: 260, longest: 60 }], {
    formatNumber: String,
    formatDuration: (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
    locale: "en-US",
  });
  assert.equal(ctx.hasLeader, true);
  assert.equal(ctx.leaderScoreText, "5:20");
  assert.equal(ctx.leaderPct, 100);
  assert.equal(ctx.exceeded, false);
  assert.equal(ctx.goalAmountText, "the longest plank grind");
});

test("plank gauntlet overview stats accept a custom total label", () => {
  assert.deepEqual(
    challengeOverviewStats({ ...challenge, goalType: "plankGauntlet" }, { participantCount: 2, total: "5:20", now, totalLabel: "Total plank time" }),
    [
      { icon: "participants", label: "Participants", value: 2 },
      { icon: "total", label: "Total plank time", value: "5:20" },
    ]
  );
});

test("plank gauntlet leaderboard rows rank generically like a numeric goal type", () => {
  const rows = challengeLeaderboardRows([
    { name: "A", score: 320 },
    { name: "B", score: 200 },
  ], "plankGauntlet");
  assert.deepEqual(rows.map((r) => [r.displayRank, r.rankIsCheck]), [[1, false], [2, false]]);
});
