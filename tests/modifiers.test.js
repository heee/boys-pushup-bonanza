import test from "node:test";
import assert from "node:assert/strict";
import { MODIFIERS, RESOLVABLE_MODIFIER_IDS, resolveModifier } from "../screens/modifiers.js";

test("resolveModifier passes concrete ids through unchanged", () => {
  assert.equal(resolveModifier("wide"), "wide");
  assert.equal(resolveModifier(null), null);
});

test("resolveModifier draws from the resolvable pool for random, never itself", () => {
  assert.equal(resolveModifier("random", () => 0), RESOLVABLE_MODIFIER_IDS[0]);
  assert.equal(resolveModifier("random", () => 0.999999), RESOLVABLE_MODIFIER_IDS.at(-1));
  assert.equal(RESOLVABLE_MODIFIER_IDS.includes("random"), false);
});

test("every MODIFIERS entry except random carries cue copy", () => {
  for (const m of MODIFIERS) {
    if (m.id === "random") continue;
    assert.equal(typeof m.cueLabel, "string");
    assert.equal(typeof m.cueSub, "string");
  }
});

test("plank and crunch modifiers resolve random within their own type", async () => {
  const { PLANK_MODIFIERS, CRUNCH_MODIFIERS, modifiersForType, findModifier } = await import("../screens/modifiers.js");
  assert.equal(modifiersForType("planks"), PLANK_MODIFIERS);
  assert.equal(modifiersForType("situps"), CRUNCH_MODIFIERS);
  assert.deepEqual(modifiersForType("squats"), []);
  for (let i = 0; i < 20; i++) {
    assert.ok(resolveModifier("random", Math.random, PLANK_MODIFIERS).startsWith("plank-"));
    assert.ok(resolveModifier("random", Math.random, CRUNCH_MODIFIERS).startsWith("crunch-"));
  }
  for (const m of [...PLANK_MODIFIERS, ...CRUNCH_MODIFIERS]) {
    if (m.id === "random") continue;
    assert.equal(findModifier(m.id), m);
    assert.equal(typeof m.cueLabel, "string");
  }
});
