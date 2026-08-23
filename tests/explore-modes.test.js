import test from "node:test";
import assert from "node:assert/strict";
import { exploreModesModel } from "../screens/explore-modes.js";

const sessions = [
  { user: "A", count: 10, mode: "dice" },
  { user: "A", count: 12, mode: "dice" },
  { user: "A", count: 8, mode: "cards" },
  { user: "A", count: 30, type: "plank" },
  { user: "B", count: 20, mode: "ladder" },
];

test("Explore ordering preserves Chase priority, locks, and roadmap", () => {
  const checking = exploreModesModel({ sessions, hasPR: false, refresh: true, chasePrepared: null, chaseLeaderLabel: () => "B" });
  assert.equal(checking.find((item) => item.mode.id === "countdown").status, "Log a session first");
  assert.equal(checking.find((item) => item.mode.id === "chase").status, "Checking…");
  const ready = exploreModesModel({ sessions, hasPR: true, refresh: false, chasePrepared: { eligible: true }, chaseLeaderLabel: () => "B" });
  assert.equal(ready[0].mode.id, "chase");
  assert.equal(ready.find((item) => item.mode.id === "sharpshooter").playable, true);
  assert.equal(ready.find((item) => item.mode.id === "pyramid").playable, true);
  // Plank, Squat, Situp, and Holland sit in their own "Other exercises"
  // bucket at the very bottom, below every pushup mode including the
  // roadmap ones — tied on zero usage, Holland sorts last since it's the
  // final entry in that bucket in EXPLORE_MODES (ties break by list order).
  assert.equal(ready.at(-1).mode.id, "holland");
  const pushupIds = ready.filter((item) => item.section === "pushups").map((item) => item.mode.id);
  assert.equal(pushupIds.at(-1), "boss");
});

test("Pulse is locked with a visible progress count until enough Classic sessions are logged", () => {
  const locked = exploreModesModel({ sessions, hasPR: true, refresh: false, chasePrepared: { eligible: true }, chaseLeaderLabel: () => "B", pulseUnlock: { unlocked: false, validCount: 2, needed: 3 } });
  const pulse = locked.find((item) => item.mode.id === "pulse");
  assert.equal(pulse.playable, false);
  assert.equal(pulse.status, "2/3 Classic sessions logged");

  const unlocked = exploreModesModel({ sessions, hasPR: true, refresh: false, chasePrepared: { eligible: true }, chaseLeaderLabel: () => "B", pulseUnlock: { unlocked: true, validCount: 3, needed: 3 } });
  assert.equal(unlocked.find((item) => item.mode.id === "pulse").playable, true);
});
