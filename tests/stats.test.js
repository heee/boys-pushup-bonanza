import assert from "node:assert/strict";
import test from "node:test";
import { bestFor, computeStreakCore, computeUserStats, expandHollandProjections, filterByMode, periodStart, weightedMultiplier } from "../stats.js";

const session = (day, extra = {}) => ({ user: "A", count: 10, timestamp: new Date(2026, 7, day, 12).toISOString(), ...extra });

test("periods preserve Monday week and calendar boundaries", () => {
  const now = new Date(2026, 7, 16, 15);
  assert.equal(periodStart("day", now).getDate(), 16);
  assert.equal(periodStart("week", now).getDate(), 10);
  assert.equal(periodStart("quarter", now).getMonth(), 6);
});
test("mode filters keep classic, tagged pushups, and planks distinct", () => {
  const data = [session(1), session(2, { mode: "cards" }), session(3, { type: "plank" }), session(4, { type: "pullup" })];
  assert.equal(filterByMode(data, "all").length, 2);
  assert.equal(filterByMode(data, "classic").length, 1);
  assert.equal(filterByMode(data, "planks").length, 1);
  assert.equal(filterByMode(data, "pullups").length, 1);
});
test("Holland sessions project their component reps into pullup/squat/classic without vanishing from their own bucket", () => {
  const holland = session(5, { type: "holland", hollandPullups: 15, hollandPushups: 30, hollandSquats: 45 });
  const data = [session(1), session(2, { type: "pullup" }), holland];

  const expanded = expandHollandProjections(data);
  assert.equal(expanded.length, 6); // 3 originals + 3 projected components

  assert.equal(filterByMode(data, "holland").length, 1);
  assert.equal(filterByMode(data, "holland")[0], holland);

  const pullups = filterByMode(data, "pullups");
  assert.equal(pullups.length, 2); // the real pullup session + Holland's projected one
  assert.equal(pullups.reduce((sum, s) => sum + s.count, 0), 25); // 10 + 15

  const squats = filterByMode(data, "squats");
  assert.equal(squats.length, 1);
  assert.equal(squats[0].count, 45);

  const classic = filterByMode(data, "classic");
  assert.equal(classic.length, 2); // the real classic session + Holland's projected pushups
  assert.equal(classic.reduce((sum, s) => sum + s.count, 0), 40); // 10 + 30
});

test("streak forgives one established rest day", () => {
  const now = new Date(2026, 7, 16, 12);
  const result = computeStreakCore([session(16), session(14), session(13)], now);
  assert.equal(result.streak, 4);
  assert.equal(result.restDays[0].getDate(), 15);
});
test("statistics and weighted rounding inputs remain deterministic", () => {
  assert.equal(weightedMultiplier({ bodyweightLbs: 200, addedWeightLbs: 25 }), 1.25);
  assert.deepEqual(computeUserStats([session(15, { count: 9 }), session(16, { count: 10 })], new Date(2026, 7, 16, 12)), { streak: 2, allTime: 19, best: 10, avg: 10, count: 2 });
  assert.equal(bestFor([session(1, { ladderMaxRung: 4, mode: "ladder" })], "A", (s) => s.mode === "ladder", "ladderMaxRung"), 4);
});
