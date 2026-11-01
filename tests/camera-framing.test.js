import assert from "node:assert/strict";
import test from "node:test";
import { computeFraming, createFramingTracker, mapRect, robustBodyBox, IDENTITY_FRAMING } from "../camera-framing.js";

// 960×1280 portrait camera filling a 480×640 window: scale 0.5, no crop.
const dims = { vw: 960, vh: 1280, cw: 480, ch: 640 };

test("Body in the top half of the frame zooms in and pans up to it", () => {
  // Body fills the upper-middle of the frame; the floor fills the rest.
  const f = computeFraming({ originX: 330, originY: 200, width: 300, height: 500 }, dims);
  assert.ok(f.zoom > 1.5 && f.zoom <= 2, `zoom ${f.zoom}`);
  const center = mapRect({ left: 240, top: 225, width: 0, height: 0 }, f); // body center in element px
  assert.ok(Math.abs(center.left - 240) < 1, `x ${center.left}`);
  assert.ok(Math.abs(center.top - 320) < 1, `y ${center.top}`);
});

test("A body near the top edge pans as far as the frame allows, not past it", () => {
  const f = computeFraming({ originX: 330, originY: 0, width: 300, height: 500 }, dims);
  assert.equal(f.ty, 0);
});

test("Zoom is capped and the video never pulls away from the window edges", () => {
  const f = computeFraming({ originX: 0, originY: 0, width: 40, height: 60 }, dims);
  assert.equal(f.zoom, 2);
  assert.ok(f.tx <= 0 && f.tx >= dims.cw - dims.cw * f.zoom);
  assert.ok(f.ty <= 0 && f.ty >= dims.ch - dims.ch * f.zoom);
});

test("A body that already fills the frame is left unzoomed", () => {
  assert.deepEqual(computeFraming({ originX: 50, originY: 40, width: 860, height: 1200 }, dims), IDENTITY_FRAMING);
  assert.deepEqual(computeFraming(null, dims), IDENTITY_FRAMING);
});

test("A single stray box doesn't blow the pooled body box open", () => {
  const samples = Array.from({ length: 20 }, () => ({ originX: 300, originY: 100, width: 200, height: 500 }));
  samples.push({ originX: 0, originY: 0, width: 960, height: 1280 });
  assert.deepEqual(robustBodyBox(samples), { originX: 300, originY: 100, width: 200, height: 500 });
  assert.equal(robustBodyBox(samples.slice(0, 3)), null);
});

test("Tracker only frames after a warmup and resets cleanly", () => {
  const t = createFramingTracker();
  const box = { originX: 330, originY: 60, width: 300, height: 560 };
  t.sample("v", box); // ignored: not collecting
  assert.deepEqual(t.lock("v", dims), IDENTITY_FRAMING);
  t.begin("v");
  for (let i = 0; i < 10; i += 1) t.sample("v", box);
  const locked = t.lock("v", dims);
  assert.ok(locked.zoom > 1);
  t.sample("v", { originX: 0, originY: 0, width: 960, height: 1280 }); // ignored once locked
  assert.deepEqual(t.framing("v"), locked);
  t.reset("v");
  assert.deepEqual(t.framing("v"), IDENTITY_FRAMING);
});
