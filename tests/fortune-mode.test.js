import test from "node:test";
import assert from "node:assert/strict";
import { FORTUNE_CHALLENGES, pickFortuneChallenge } from "../modes/fortune.js";

test("fortune module exposes the complete challenge catalog", async () => {
  assert.equal(FORTUNE_CHALLENGES.length, 20);
  const picked = pickFortuneChallenge([], { random: () => 0 });
  assert.equal(picked.challenge.id, "perfect_form");
});

test("fortune progression challenges derive their comparison target", () => {
  const sessions = [{ count: 12, timestamp: "2026-08-01T12:00:00Z" }];
  const picked = pickFortuneChallenge(sessions, { random: () => 0.999, now: new Date("2026-08-02T12:00:00") });
  assert.ok(picked.challenge);
});

test("fortune selection avoids immediately repeating a challenge", () => {
  const sessions = [{ count: 10, mode: "fortune", fortuneChallengeId: "perfect_form", timestamp: "2026-08-01T12:00:00Z" }];
  assert.notEqual(pickFortuneChallenge(sessions, { random: () => 0 }).challenge.id, "perfect_form");
});

test("active grip modifiers exclude Fortune grip challenges", () => {
  for (let step = 0; step < 20; step += 1) {
    const picked = pickFortuneChallenge([], {
      excludedCategories: ["grip"],
      random: () => step / 20,
    });
    assert.notEqual(picked.challenge.category, "grip");
  }
});
