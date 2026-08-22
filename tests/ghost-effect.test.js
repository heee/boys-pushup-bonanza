import assert from "node:assert/strict";
import test from "node:test";
import { createGhostSwarm } from "../ghost-effect.js";

function sequenceRandom(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

test("creates between two and four ghosts", () => {
  assert.equal(createGhostSwarm(() => 0).length, 2);
  assert.equal(createGhostSwarm(() => 0.5).length, 3);
  assert.equal(createGhostSwarm(() => 0.999).length, 4);
});

test("varies ghost sizes, positions, timing, and direction within safe bounds", () => {
  const ghosts = createGhostSwarm(sequenceRandom([
    0.5,
    0, 0, 0, 0, 0, 0,
    0.5, 0.5, 0.5, 0.5, 0.75, 0.5,
    0.999, 0.999, 0.999, 0.999, 0.999, 0.999,
  ]));

  assert.equal(ghosts.length, 3);
  assert.ok(ghosts.every((ghost) => ghost.sizeRem >= 2.7 && ghost.sizeRem <= 6.3));
  assert.ok(ghosts.every((ghost) => ghost.topPercent >= 5 && ghost.topPercent <= 70));
  assert.ok(ghosts.every((ghost) => ghost.delayMs >= 0 && ghost.delayMs <= 220));
  assert.ok(ghosts.every((ghost) => ghost.durationMs >= 900 && ghost.durationMs <= 1250));
  assert.notEqual(ghosts[0].sizeRem, ghosts[1].sizeRem);
  assert.notEqual(ghosts[0].reverse, ghosts[1].reverse);
});
