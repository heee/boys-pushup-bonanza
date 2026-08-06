import assert from "node:assert/strict";
import test from "node:test";
import { buildLadderRivals, ladderRivalMilestones, shouldCompactLadderRivals } from "../ladder-rivals.js";

test("shows names for up to two rivals and compacts larger ties", () => {
  assert.equal(shouldCompactLadderRivals([{}, {}]), false);
  assert.equal(shouldCompactLadderRivals([{}, {}, {}]), true);
});

test("uses each rival's all-time best Ladder rung and groups ties", () => {
  const rivals = buildLadderRivals([
    { user: "Nelson", mode: "ladder", ladderMaxRung: 6 },
    { user: "Nelson", mode: "ladder", ladderMaxRung: 8 },
    { user: "Mike", mode: "ladder", ladderMaxRung: 8 },
    { user: "Me", mode: "ladder", ladderMaxRung: 99 },
    { user: "Classic", count: 100 },
  ], "Me");

  assert.deepEqual(rivals, [{ rung: 8, names: ["Mike", "Nelson"] }]);
});

test("fires approach, match, and pass milestones without dropping overlaps", () => {
  const rivals = [
    { rung: 4, names: ["A"] },
    { rung: 5, names: ["B"] },
    { rung: 7, names: ["C"] },
  ];

  assert.deepEqual(ladderRivalMilestones(rivals, 2).map((m) => m.type), ["approaching"]);
  assert.deepEqual(ladderRivalMilestones(rivals, 4).map((m) => m.type), ["matched"]);
  assert.deepEqual(ladderRivalMilestones(rivals, 5).map((m) => m.type), ["passed", "matched", "approaching"]);
  assert.deepEqual(ladderRivalMilestones(rivals, 9), []);
});
