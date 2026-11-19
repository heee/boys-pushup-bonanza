import assert from "node:assert/strict";
import test from "node:test";
import { buildLadderMarkers, buildLadderRivals, groupLadderMarkers, ladderMarkerMilestones, ladderRivalMilestones, shouldCompactLadderRivals } from "../ladder-rivals.js";

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

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-19T12:00:00Z");
const ago = (days) => new Date(NOW - days * DAY).toISOString();

test("markers split a rival's best and recent latest onto separate rungs", () => {
  const markers = buildLadderMarkers([
    { user: "Matt", mode: "ladder", ladderMaxRung: 9, timestamp: ago(20) },
    { user: "Matt", mode: "ladder", ladderMaxRung: 5, timestamp: ago(2) },
  ], "Me", NOW);
  assert.deepEqual(markers, [
    { name: "Matt", rung: 9, kind: "best", ageDays: null, freshPB: false, self: false },
    { name: "Matt", rung: 5, kind: "latest", ageDays: 2, freshPB: false, self: false },
  ]);
});

test("a latest climb older than the window shows only the best", () => {
  const markers = buildLadderMarkers([
    { user: "Matt", mode: "ladder", ladderMaxRung: 9, timestamp: ago(60) },
    { user: "Matt", mode: "ladder", ladderMaxRung: 5, timestamp: ago(31) },
  ], "Me", NOW);
  assert.deepEqual(markers.map((m) => [m.rung, m.kind]), [[9, "best"]]);
});

test("latest on the best rung merges, flagged freshPB only when it set the best", () => {
  const fresh = buildLadderMarkers([
    { user: "A", mode: "ladder", ladderMaxRung: 4, timestamp: ago(10) },
    { user: "A", mode: "ladder", ladderMaxRung: 7, timestamp: ago(1) },
  ], "Me", NOW);
  assert.deepEqual(fresh.map((m) => [m.rung, m.kind, m.freshPB]), [[7, "both", true]]);
  const tied = buildLadderMarkers([
    { user: "A", mode: "ladder", ladderMaxRung: 7, timestamp: ago(10) },
    { user: "A", mode: "ladder", ladderMaxRung: 7, timestamp: ago(1) },
  ], "Me", NOW);
  assert.deepEqual(tied.map((m) => [m.rung, m.kind, m.freshPB]), [[7, "both", false]]);
});

test("the player's own markers are included and flagged self", () => {
  const markers = buildLadderMarkers([
    { user: "Me", mode: "ladder", ladderMaxRung: 8, timestamp: ago(9) },
    { user: "Me", mode: "ladder", ladderMaxRung: 3, timestamp: ago(1) },
  ], "Me", NOW);
  assert.deepEqual(markers.map((m) => [m.rung, m.kind, m.self]), [[8, "best", true], [3, "latest", true]]);
});

test("marker milestones separate best and latest names; best wins on a shared rung", () => {
  const groups = groupLadderMarkers([
    { name: "A", rung: 5, kind: "best", self: false },
    { name: "B", rung: 5, kind: "latest", self: false },
    { name: "Me", rung: 4, kind: "latest", self: true },
    { name: "C", rung: 7, kind: "latest", self: false },
  ]);
  assert.deepEqual(ladderMarkerMilestones(groups, 5), [
    { type: "passed", best: [], latest: [], selfLatest: true },
    { type: "matched", best: ["A"], latest: ["B"], selfLatest: false },
    { type: "approaching", best: [], latest: ["C"], selfLatest: false },
  ]);
  assert.deepEqual(ladderMarkerMilestones(groups, 3), [
    { type: "approaching", best: ["A"], latest: ["B"], selfLatest: false },
  ]);
});
