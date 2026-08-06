import test from "node:test";
import assert from "node:assert/strict";
import { PYRAMID_SIZES, pyramidRows, pyramidTotalReps, pyramidUpOnlyReps } from "../modes/pyramid.js";

test("Pyramid module preserves tiers and rep totals", () => {
  assert.deepEqual(PYRAMID_SIZES.map((tier) => tier.base), [5, 8, 10, 12, 15]);
  assert.equal(pyramidUpOnlyReps(10), 55);
  assert.equal(pyramidTotalReps(10, "updown"), 100);
});

test("Pyramid rows preserve descending and ascending states", () => {
  assert.deepEqual(pyramidRows(3, "up", 2, "descending"), [
    { row: 3, status: "cleared" },
    { row: 2, status: "active" },
    { row: 1, status: "locked" },
  ]);
  assert.deepEqual(pyramidRows(3, "updown", 2, "ascending"), [
    { row: 3, status: "locked" },
    { row: 2, status: "active" },
    { row: 1, status: "cleared" },
  ]);
});
