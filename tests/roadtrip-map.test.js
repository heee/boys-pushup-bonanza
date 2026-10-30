import test from "node:test";
import assert from "node:assert/strict";
import { compactCount, cullLabels, fitTransform, heatLevel, ISO2_TO_NUMERIC, shouldShowWorld, unionBounds } from "../roadtrip-map.js";

test("ISO-2 maps to world-atlas numeric ids", () => {
  assert.equal(ISO2_TO_NUMERIC.US, "840");
  assert.equal(ISO2_TO_NUMERIC.DE, "276");
  assert.equal(ISO2_TO_NUMERIC.MX, "484");
  assert.ok(Object.keys(ISO2_TO_NUMERIC).length > 170);
});

test("heat is 0 when idle, 0.4–1 sqrt-scaled when active", () => {
  assert.equal(heatLevel(0, 100), 0);
  assert.equal(heatLevel(100, 100), 1);
  assert.ok(Math.abs(heatLevel(25, 100) - 0.7) < 1e-9);
  assert.ok(heatLevel(1, 10000) >= 0.4);
});

test("fitTransform centres bounds and caps the zoom", () => {
  const { k, tx, ty } = fitTransform([[100, 100], [200, 150]], 1000, 500, { pad: 0 });
  assert.equal(k, 10);
  assert.equal(tx, 500 - 10 * 150);
  assert.equal(ty, 250 - 10 * 125);
  assert.equal(fitTransform([[0, 0], [1, 1]], 1000, 500).k, 12);
});

test("world view only when activity spans most of the map", () => {
  assert.equal(shouldShowWorld(null, 1000), true);
  assert.equal(shouldShowWorld([[100, 0], [300, 10]], 1000), false);
  assert.equal(shouldShowWorld([[50, 0], [800, 10]], 1000), true);
  assert.deepEqual(unionBounds([[[1, 2], [3, 4]], null, [[0, 5], [2, 9]]]), [[0, 2], [3, 9]]);
});

test("label culling keeps the bigger of two overlapping pills", () => {
  const kept = cullLabels([
    { id: "a", x: 100, y: 100, w: 40, h: 16, total: 10 },
    { id: "b", x: 110, y: 104, w: 40, h: 16, total: 50 },
    { id: "c", x: 300, y: 100, w: 40, h: 16, total: 5 },
  ]);
  assert.deepEqual(kept.map((l) => l.id), ["b", "c"]);
});

test("compact counts", () => {
  assert.equal(compactCount(950), "950");
  assert.equal(compactCount(5009), "5k");
  assert.equal(compactCount(5400), "5.4k");
  assert.equal(compactCount(14421), "14k");
  assert.equal(compactCount(1250000), "1.3M");
});
