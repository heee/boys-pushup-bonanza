import assert from "node:assert/strict";
import test from "node:test";
import { modeStatsModel } from "../screens/mode-stats.js";

const session = (user, count, extra = {}) => ({
  user,
  count,
  startedAt: "2026-08-02T10:00:00Z",
  timestamp: "2026-08-02T10:01:00Z",
  ...extra,
});

function metric(mode, id, sessions) {
  return modeStatsModel(sessions, mode).find((item) => item.id === id);
}

test("All and Classic aggregate timed sessions and pace", () => {
  const sessions = [session("A", 20), session("B", 10, { timestamp: "2026-08-02T10:02:00Z" })];
  assert.equal(metric("all", "sessions", sessions).value, 2);
  assert.equal(metric("all", "avgDuration", sessions).value, 90000);
  assert.equal(metric("classic", "workoutTime", sessions).value, 180000);
  assert.equal(metric("all", "avgPace", sessions).value, 10);
});

test("Countdown excludes legacy outcomes but keeps all attempts", () => {
  const sessions = [session("A", 20, { countdownBeat: true }), session("A", 10), session("B", 8, { countdownBeat: false })];
  assert.equal(metric("countdown", "attempts", sessions).value, 3);
  assert.equal(metric("countdown", "recordsBeaten", sessions).value, 1);
  assert.equal(metric("countdown", "successRate", sessions).value, 0.5);
});

test("Cards and Dice use future cleared-value metadata", () => {
  const cards = [session("A", 20, { cardsCleared: 3, cardsClearedValue: 18 }), session("B", 10)];
  assert.equal(metric("cards", "cardsCleared", cards).value, 3);
  assert.equal(metric("cards", "avgCardValue", cards).value, 6);
  const dice = [session("A", 20, { diceRollsCleared: 2, diceRollsClearedValue: 14 })];
  assert.equal(metric("dice", "rollsPerSession", dice).value, 2);
  assert.equal(metric("dice", "avgRollValue", dice).value, 7);
});

test("Poker aggregates completed hands, best hand, and premium rate", () => {
  const sessions = [
    { user: "A", pokerHandsCompleted: 4, pokerBestRank: 6, pokerPremiumHands: 2 },
    { user: "A", pokerHandsCompleted: 2, pokerBestRank: 1, pokerPremiumHands: 0 },
    { user: "B", pokerHandsCompleted: 2, pokerBestRank: 3, pokerPremiumHands: 1 },
  ];
  const metrics = modeStatsModel(sessions, "poker");
  assert.equal(metrics[0].value, 8);
  assert.equal(metrics[1].value, 6);
  assert.equal(metrics[2].value, 3 / 8);
  assert.deepEqual(metrics[1].leaders.map((entry) => entry.user), ["A"]);
});

test("Ladder reports best and average rung with tied leaders", () => {
  const sessions = [session("A", 20, { ladderMaxRung: 8 }), session("B", 20, { ladderMaxRung: 8 }), session("A", 10, { ladderMaxRung: 4 })];
  assert.equal(metric("ladder", "highestRung", sessions).value, 8);
  assert.deepEqual(metric("ladder", "highestRung", sessions).leaders.map((x) => x.user), ["A", "B"]);
  assert.equal(metric("ladder", "avgTopRung", sessions).value, 20 / 3);
});

test("Sharpshooter reports destroyed targets, best barrage, and longest shot", () => {
  const sessions = [
    session("A", 70, { sharpshooterTargetsDestroyed: 4, sharpshooterLongestShot: 24 }),
    session("A", 40, { sharpshooterTargetsDestroyed: 2, sharpshooterLongestShot: 20 }),
    session("B", 65, { sharpshooterTargetsDestroyed: 3, sharpshooterLongestShot: 28 }),
  ];
  assert.equal(metric("sharpshooter", "targetsDestroyed", sessions).value, 9);
  assert.equal(metric("sharpshooter", "bestBarrage", sessions).value, 4);
  assert.deepEqual(metric("sharpshooter", "bestBarrage", sessions).leaders.map((x) => x.user), ["A"]);
  assert.equal(metric("sharpshooter", "longestShot", sessions).value, 28);
  assert.deepEqual(metric("sharpshooter", "longestShot", sessions).leaders.map((x) => x.user), ["B"]);
});

test("Fortune reports unique challenges and average reps", () => {
  const sessions = [session("A", 20, { fortuneChallengeId: "x" }), session("A", 10, { fortuneChallengeId: "y" }), session("B", 30, { fortuneChallengeId: "x" })];
  assert.equal(metric("fortune", "unique", sessions).value, 2);
  assert.equal(metric("fortune", "avgReps", sessions).value, 20);
});

test("Chase reports overtakes and winning margin from new metadata", () => {
  const sessions = [session("A", 20, { chaseOvertaken: true, chaseFinalLead: 4 }), session("B", 10, { chaseOvertaken: false }), session("A", 30)];
  assert.equal(metric("chase", "chases", sessions).value, 3);
  assert.equal(metric("chase", "overtakes", sessions).value, 1);
  assert.equal(metric("chase", "winningMargin", sessions).value, 4);
});

test("Planks aggregate hold counts and time", () => {
  const sessions = [session("A", 60), session("B", 30)];
  assert.equal(metric("planks", "holds", sessions).value, 2);
  assert.equal(metric("planks", "totalHold", sessions).value, 90);
  assert.equal(metric("planks", "avgHold", sessions).value, 45);
});

test("Unavailable metadata yields an empty metric and no leader", () => {
  const result = metric("cards", "cardsCleared", [session("A", 20)]);
  assert.equal(result.available, false);
  assert.deepEqual(result.leaders, []);
});

test("Empty periods show unavailable stats instead of zero-value leaders", () => {
  assert.equal(metric("all", "sessions", []).available, false);
});
