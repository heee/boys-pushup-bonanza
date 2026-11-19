import assert from "node:assert/strict";
import test from "node:test";
import { goalPaceStatus, goalPeriodFraction } from "../stats.js";

test("daily pace runs over a 7am-midnight window", () => {
  assert.equal(goalPeriodFraction("daily", new Date(2026, 10, 19, 6, 0)), 0);
  assert.equal(goalPeriodFraction("daily", new Date(2026, 10, 19, 15, 30)), 0.5);
  const g = { period: "daily", target: 100 };
  assert.equal(goalPaceStatus({ ...g, current: 0 }, new Date(2026, 10, 19, 6, 30)), "on-track");
  assert.equal(goalPaceStatus({ ...g, current: 40 }, new Date(2026, 10, 19, 15, 30)), "behind");
  assert.equal(goalPaceStatus({ ...g, current: 50 }, new Date(2026, 10, 19, 15, 30)), "on-track");
  assert.equal(goalPaceStatus({ ...g, current: 157 }, new Date(2026, 10, 19, 8)), "reached");
});

test("weekly pace runs Monday to Monday; monthly by day of month; streak has none", () => {
  // Thu 2026-11-19 00:00 is 3/7 through the week starting Mon 2026-11-16.
  assert.equal(goalPeriodFraction("weekly", new Date(2026, 10, 19)), 3 / 7);
  assert.equal(goalPaceStatus({ period: "weekly", target: 300, current: 8 }, new Date(2026, 10, 19)), "behind");
  assert.equal(goalPaceStatus({ period: "weekly", target: 600, current: 398 }, new Date(2026, 10, 19)), "on-track");
  assert.equal(goalPeriodFraction("monthly", new Date(2026, 10, 16)), 0.5);
  assert.equal(goalPaceStatus({ period: "streak", target: 10, current: 3 }), null);
});
