import assert from "node:assert/strict";
import test from "node:test";
import { createRepCounter } from "../rep-counter.js";

function replay(samples, config) {
  const counter = createRepCounter(config);
  return samples.map(([ratio, time]) => counter.advance(ratio, time));
}

test("counts one rep after confirmed down and up crossings", () => {
  const results = replay([[0.2, 0], [0.56, 33], [0.57, 66], [0.31, 99], [0.3, 132]]);
  assert.equal(results.at(-1).count, 1);
  assert.equal(results.at(-1).counted, true);
});

test("ignores isolated threshold glitches", () => {
  const results = replay([[0.2, 0], [0.6, 33], [0.2, 66], [0.2, 99]]);
  assert.equal(results.at(-1).count, 0);
  assert.equal(results.at(-1).phase, "up");
});

test("accepts threshold crossings after sparse frame gaps", () => {
  const results = replay([[0.2, 0], [0.6, 100], [0.2, 200]]);
  assert.equal(results.at(-1).count, 1);
});

test("debounces implausibly fast repeated reps", () => {
  const results = replay([
    [0.6, 0], [0.6, 33], [0.2, 66], [0.2, 99],
    [0.6, 132], [0.6, 165], [0.2, 198], [0.2, 231],
  ]);
  assert.equal(results.at(-1).count, 1);
});

test("applies threshold changes without resetting progress", () => {
  const counter = createRepCounter();
  counter.advance(0.56, 0);
  counter.advance(0.56, 33);
  counter.setThresholds(0.6, 0.4);
  counter.advance(0.39, 66);
  const result = counter.advance(0.39, 99);
  assert.equal(result.count, 1);
});
