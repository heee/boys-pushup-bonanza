import test from "node:test";
import assert from "node:assert/strict";
import { ladderRungRows, workoutHeroModel, workoutHudModel } from "../workout-modes.js";
import { sharpshooterTargetForBest } from "../modes/sharpshooter.js";

test("hero models preserve classic and countdown presentation", () => {
  assert.deepEqual(workoutHeroModel("classic", 8), { kind: "hero", display: "8", label: "PUSHUPS", over: false, spokenValue: 8, spokenPrefix: "" });
  assert.deepEqual(workoutHeroModel("countdown", 8, { countdownTarget: 10 }), { kind: "hero", display: "2", label: "TO BEAT YOUR RECORD", over: false, spokenValue: 2, spokenPrefix: "" });
  assert.deepEqual(workoutHeroModel("countdown", 11, { countdownTarget: 10 }), { kind: "hero", display: "+1", label: "OVER YOUR RECORD", over: true, spokenValue: 1, spokenPrefix: "plus " });
});

test("specialized modes expose their remaining focal count", () => {
  assert.equal(workoutHeroModel("cards", 10, { cardTarget: 8, cardRepsDone: 3 }).remaining, 5);
  assert.equal(workoutHeroModel("poker", 10, { pokerCardTarget: 12, pokerCardRepsDone: 4 }).remaining, 8);
  assert.equal(workoutHeroModel("dice", 10, { diceTarget: 7, diceRepsDone: 7 }).remaining, 0);
  assert.equal(workoutHeroModel("ladder", 10, { ladderRung: 4, ladderRepsDone: 1 }).remaining, 3);
  assert.equal(workoutHeroModel("sharpshooter", 10, { sharpshooterTarget: 18, sharpshooterRepsDone: 7 }).remaining, 11);
});

test("Sharpshooter targets span 50-90% of a personal best and 5-15 without history", () => {
  assert.equal(sharpshooterTargetForBest(40, () => 0), 20);
  assert.equal(sharpshooterTargetForBest(40, () => 0.999999), 36);
  assert.equal(sharpshooterTargetForBest(0, () => 0), 5);
  assert.equal(sharpshooterTargetForBest(0, () => 0.999999), 15);
  assert.equal(sharpshooterTargetForBest(3, () => 0), 2);
});

test("Sharpshooter replaces the generic hero and high-score callout", () => {
  const hud = workoutHudModel("sharpshooter", 40);
  assert.equal(hud.sharpshooter, true);
  assert.equal(hud.hideHero, true);
  assert.equal(hud.hideHighscore, true);
});

test("Horse hero exposes the live count, not a remaining-vs-target number", () => {
  assert.deepEqual(workoutHeroModel("horse", 27), { kind: "horse", count: 27, spokenValue: 27, spokenPrefix: "" });
  const hud = workoutHudModel("horse", 40);
  assert.equal(hud.horse, true);
  assert.equal(hud.hideHero, true);
  assert.equal(hud.hideHighscore, true);
  assert.equal(hud.hideThermometer, true);
});

test("HUD visibility remains mode-specific", () => {
  assert.equal(workoutHudModel("zen", 20).hideHero, true);
  assert.equal(workoutHudModel("chase", 20).hideHighscore, true);
  assert.equal(workoutHudModel("fortune", 20, { hideCounter: true }).hideHero, true);
  assert.equal(workoutHudModel("classic", 0).hideThermometer, true);
});

test("Pulse hides the generic hero/highscore/thermometer for its own pace visualization", () => {
  const hud = workoutHudModel("pulse", 40);
  assert.equal(hud.pulse, true);
  assert.equal(hud.hideHero, true);
  assert.equal(hud.hideHighscore, true);
  assert.equal(hud.hideThermometer, true);
});

test("ladder rows keep five-rung pages ordered top to bottom", () => {
  const rows = ladderRungRows(6, [{ rung: 7, users: [1, 2, 3] }], (users) => users.length > 2);
  assert.deepEqual(rows.map(({ rung, status }) => [rung, status]), [[10, "locked"], [9, "locked"], [8, "locked"], [7, "locked"], [6, "active"]]);
  assert.equal(rows.find((row) => row.rung === 7).compactRivals, true);
});

test("the active rung folds the current player in alongside any rivals tied there", () => {
  const self = { name: "Dev", avatar: { emoji: "🐯" } };
  const rows = ladderRungRows(6, [{ rung: 7, names: ["Mia"], users: [{ name: "Mia" }] }], () => false, self);
  const active = rows.find((row) => row.rung === 6);
  assert.deepEqual(active.rival.users, [{ ...self, self: true }]);
  const untouched = rows.find((row) => row.rung === 7);
  assert.deepEqual(untouched.rival.users, [{ name: "Mia" }]);
});
