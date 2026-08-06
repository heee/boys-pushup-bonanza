import assert from "node:assert/strict";
import test from "node:test";
import { comparisonModel } from "../screens/comparison.js";

const now = new Date(2026, 7, 3, 12);
const session = (user, count, day, extra = {}) => ({ user, count, timestamp: new Date(2026, 7, day, 10).toISOString(), ...extra });

test("Overall keeps global streak while filtering the other five-row values", () => {
  const sessions = [session("A", 20, 2), session("A", 30, 3), session("B", 10, 3)];
  const model = comparisonModel(sessions, { userA: "A", userB: "B", mode: "all", periodStartMs: new Date(2026, 7, 3).getTime(), now });
  assert.equal(model.rows.length, 5);
  assert.equal(model.rows.find((row) => row.id === "streak").aValue, 2);
  assert.equal(model.rows.find((row) => row.id === "total").aValue, 30);
  assert.equal(model.rows.find((row) => row.id === "sessions").aValue, 1);
});

test("mode comparisons use the approved mode-specific metrics", () => {
  const sessions = [
    session("A", 30, 3, { mode: "cards", cardsCleared: 4, cardsClearedValue: 28 }),
    session("B", 20, 3, { mode: "cards", cardsCleared: 2, cardsClearedValue: 10 }),
  ];
  const model = comparisonModel(sessions, { userA: "A", userB: "B", mode: "cards", periodStartMs: 0, now });
  assert.deepEqual(model.rows.map((row) => row.id), ["cardsCleared", "cardsPerSession", "avgCardValue"]);
  assert.equal(model.aWins, 3);
  assert.equal(model.denominator, 3);
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
  assert.equal(model.rows.every((row) => !row.comparable), true);
  assert.equal(model.denominator, 0);
  assert.equal(model.rows[0].bValue, null);
});

test("no sessions for either user in the selected period returns the empty state", () => {
  const sessions = [session("A", 20, 2), session("B", 20, 2)];
  const model = comparisonModel(sessions, { userA: "A", userB: "B", mode: "all", periodStartMs: new Date(2026, 7, 3).getTime(), now });
  assert.equal(model.empty, true);
  assert.deepEqual(model.rows, []);
});
