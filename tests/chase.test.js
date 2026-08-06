import assert from "node:assert/strict";
import test from "node:test";
import { buildChasePlan, chaseProgress, crossedLeadMilestone } from "../chase.js";

const now = new Date(2026, 7, 15, 12);
const session = (user, count, day, extra = {}) => ({
  user,
  count,
  timestamp: new Date(2026, 7, day, 8).toISOString(),
  ...extra,
});

test("locks the first board not already led and does not advance mid-session", () => {
  const plan = buildChasePlan([
    session("Me", 20, 15),
    session("Rival", 18, 15),
    session("Rival", 15, 12),
    session("Rival", 40, 3),
  ], "Me", now);

  assert.equal(plan.stages[0].chaseable, false);
  assert.equal(plan.stages[1].pointsNeeded, 14);
  assert.equal(plan.stages[2].pointsNeeded, 54);
  assert.equal(plan.target.id, "week");
  assert.equal(chaseProgress(plan, 13).current.id, "week");
  assert.equal(chaseProgress(plan, 14).complete, true);
  assert.equal(chaseProgress(plan, 54).finalStage.id, "week");
});

test("includes quarterly and annual boards in escalation order", () => {
  const plan = buildChasePlan([
    session("Me", 100, 15),
    session("Rival", 90, 15),
    session("Rival", 20, 3),
    { user: "Rival", count: 20, timestamp: new Date(2026, 5, 1).toISOString() },
  ], "Me", now);
  assert.deepEqual(plan.stages.map((stage) => stage.id), ["day", "week", "month", "quarter", "year"]);
});

test("a tie requires one more point and names all tied rivals", () => {
  const plan = buildChasePlan([
    session("Me", 10, 15),
    session("A", 10, 15),
    session("B", 10, 15),
    session("Planker", 999, 15, { type: "plank" }),
  ], "Me", now);

  assert.equal(plan.stages[0].pointsNeeded, 1);
  assert.deepEqual(plan.stages[0].leaderNames, ["A", "B"]);
});

test("lead callouts report the largest crossed milestone", () => {
  assert.equal(crossedLeadMilestone(4, 7), 5);
  assert.equal(crossedLeadMilestone(9, 20), 20);
  assert.equal(crossedLeadMilestone(21, 29), 0);
});
