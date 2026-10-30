import assert from "node:assert/strict";
import test from "node:test";
import { comparisonModel } from "../screens/comparison.js";

const now = new Date(2026, 7, 3, 12);
const session = (user, count, day, extra = {}) => ({ user, count, timestamp: new Date(2026, 7, day, 10).toISOString(), ...extra });

test("Overall groups rows and keeps the global streak while filtering the rest by period", () => {
  const sessions = [session("A", 20, 2), session("A", 30, 3), session("B", 10, 3)];
  const model = comparisonModel(sessions, { userA: "A", userB: "B", mode: "all", periodStartMs: new Date(2026, 7, 3).getTime(), now });
  assert.deepEqual(model.groups.map((group) => group.id), ["consistency", "volume", "peak", "variety"]);
  assert.ok(model.rows.every((row) => row.icon));
  assert.equal(model.rows.find((row) => row.id === "streak").aValue, 2);
  assert.equal(model.rows.find((row) => row.id === "total").aValue, 30);
  assert.equal(model.rows.find((row) => row.id === "sessions").aValue, 1);
});

test("mode comparisons use the approved mode-specific metrics", () => {
  const sessions = [
    session("A", 30, 3, { mode: "cards", cardsCleared: 4, cardsClearedValue: 28 }),
    session("B", 20, 3, { mode: "cards", cardsCleared: 2, cardsClearedValue: 10 }),
  ];
  const model = comparisonModel(sessions, { userA: "A", userB: "B", mode: "cards", modeLabel: "Cards", periodStartMs: 0, now });
  const modeGroup = model.groups.find((group) => group.id === "mode");
  assert.equal(modeGroup.label, "Cards");
  assert.deepEqual(modeGroup.rows.map((row) => row.id), ["cardsCleared", "cardsPerSession", "avgCardValue"]);
  assert.equal(modeGroup.rows.filter((row) => row.aWinner).length, 3);
});

test("mirrored bars scale the weaker side against the stronger side", () => {
  const sessions = [session("A", 50, 3), session("B", 25, 3)];
  const total = comparisonModel(sessions, { userA: "A", userB: "B", mode: "all", periodStartMs: 0, now }).rows.find((row) => row.id === "total");
  assert.equal(total.aPercent, 100);
  assert.equal(total.bPercent, 50);
  assert.equal(total.aWinner, true);
});

test("ties fill both halves and count for neither user", () => {
  const sessions = [session("A", 20, 3), session("B", 20, 3)];
  const total = comparisonModel(sessions, { userA: "A", userB: "B", mode: "all", periodStartMs: 0, now });
  const row = total.rows.find((item) => item.id === "total");
  assert.equal(row.tied, true);
  assert.equal(row.aPercent, 100);
  assert.equal(row.bPercent, 100);
  assert.equal(total.aWins, 0);
  assert.equal(total.bWins, 0);
});

test("legacy metadata gaps show unavailable and leave the denominator", () => {
  const sessions = [
    session("A", 20, 3, { mode: "dice", diceRollsCleared: 2, diceRollsClearedValue: 14 }),
    session("B", 20, 3, { mode: "dice" }),
  ];
  const model = comparisonModel(sessions, { userA: "A", userB: "B", mode: "dice", periodStartMs: 0, now });
  const modeRows = model.groups.find((group) => group.id === "mode").rows;
  assert.equal(modeRows.every((row) => !row.comparable), true);
  assert.equal(modeRows[0].bValue, null);
});

test("no sessions for either user in the selected period returns the empty state", () => {
  const sessions = [session("A", 20, 2), session("B", 20, 2)];
  const model = comparisonModel(sessions, { userA: "A", userB: "B", mode: "all", periodStartMs: new Date(2026, 7, 3).getTime(), now });
  assert.equal(model.empty, true);
  assert.deepEqual(model.rows, []);
});

test("Avg pace goes to whoever is closer to 37.5/min, not the faster one", () => {
  const timed = (user, count) => ({ ...session(user, count, 3), startedAt: new Date(2026, 7, 3, 9, 59).toISOString() });
  const model = comparisonModel([timed("A", 70), timed("B", 40)], { userA: "A", userB: "B", mode: "all", periodStartMs: 0, now });
  const pace = model.rows.find((row) => row.id === "pace");
  assert.equal(pace.bWinner, true);
  assert.equal(pace.aWinner, false);
});

test("Rivalry counts only head-to-head Horse and opposite-team Tug of War wins in the period", () => {
  const at = new Date(2026, 7, 3, 11).toISOString();
  const games = {
    horseGames: [
      { status: "complete", turnOrder: ["A", "B"], winner: ["A"], sets: [{ at }] },
      { status: "complete", turnOrder: ["A", "B", "C"], winner: ["B"], sets: [{ at }] },
      { status: "complete", turnOrder: ["A", "C"], winner: ["A"], sets: [{ at }] },
      { status: "active", turnOrder: ["A", "B"], winner: null, sets: [{ at }] },
    ],
    towGames: [
      { status: "complete", teams: { a: { players: ["A"] }, b: { players: ["B"] } }, winner: "b", bursts: [{ at }] },
      { status: "complete", teams: { a: { players: ["A", "B"] }, b: { players: ["C"] } }, winner: "a", bursts: [{ at }] },
    ],
  };
  const model = comparisonModel([session("A", 10, 3)], { userA: "A", userB: "B", mode: "all", periodStartMs: 0, now, games });
  const rivalry = model.groups.find((group) => group.id === "rivalry").rows;
  assert.deepEqual(rivalry.map((row) => [row.id, row.aValue, row.bValue]), [["horseWins", 1, 1], ["towWins", 0, 1]]);
});

test("Rivalry alone (no sessions) still renders instead of the empty state", () => {
  const games = { horseGames: [{ status: "complete", turnOrder: ["A", "B"], winner: ["B"], sets: [{ at: new Date(2026, 7, 3).toISOString() }] }] };
  const model = comparisonModel([], { userA: "A", userB: "B", mode: "all", periodStartMs: 0, now, games });
  assert.equal(model.empty, false);
  assert.deepEqual(model.groups.map((group) => group.id), ["rivalry"]);
});
