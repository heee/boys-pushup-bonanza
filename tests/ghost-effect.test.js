import assert from "node:assert/strict";
import test from "node:test";
import { createGhostSwarm, nextGhostCueAt, randomGhostCueInterval } from "../ghost-effect.js";

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

test("recurring rep cues use an inclusive random 15-30 rep interval", () => {
  assert.equal(randomGhostCueInterval("reps", () => 0), 15);
  assert.equal(randomGhostCueInterval("reps", () => 0.999), 30);
  assert.equal(nextGhostCueAt(22, "reps", () => 0.5), 45);
});

test("recurring plank cues use an inclusive random 45-60 second interval", () => {
  assert.equal(randomGhostCueInterval("seconds", () => 0), 45);
  assert.equal(randomGhostCueInterval("seconds", () => 0.999), 60);
  assert.equal(nextGhostCueAt(60, "seconds", () => 0.5), 113);
});

test("rejects an unknown recurring cue unit", () => {
  assert.throws(() => randomGhostCueInterval("minutes"), /Unknown ghost cue unit/);
});

test("standard pushup workout wires Ghost mode into its state, HUD, and effect layer", async () => {
  const { readFile } = await import("node:fs/promises");
  const [app, html] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
  ]);

  assert.match(app, /function getPushupLast\(name\)/);
  assert.match(app, /state\.pushupMode === "classic" && ghostModeEnabled\(\)/);
  assert.match(app, /function pushupInGhostPhase\(\)/);
  assert.match(app, /playGhostSurpassEffect\(\$\("pushup-ghost-transition"\)/);
  assert.match(html, /id="pushup-ghost-transition" class="ghost-transition"/);
});
