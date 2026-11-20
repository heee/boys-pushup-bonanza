import test from "node:test";
import assert from "node:assert/strict";
import { trophyCaseModel, earnedTierKeys } from "../screens/trophies.js";

const day = (n, h = 9) => new Date(2026, 0, n, h).toISOString();
const card = (model, id) => model.cards.find((c) => c.id === id);

test("pushup volume unlocks tiers with dates and progress to next", () => {
  const sessions = [
    { user: "A", count: 60, timestamp: day(1) },
    { user: "A", count: 50, timestamp: day(2) },
    { user: "A", count: 900, timestamp: day(3) },
    { user: "A", count: 30, type: "squat", timestamp: day(3) },
  ];
  const c = card(trophyCaseModel({ sessions }), "pushups");
  assert.equal(c.value, 1010);
  assert.equal(c.tier.id, "silver");
  assert.equal(c.tiers[0].unlockedAt, Date.parse(day(2)));
  assert.equal(c.tiers[1].unlockedAt, Date.parse(day(3)));
  assert.equal(c.next.id, "gold");
  assert.equal(card(trophyCaseModel({ sessions }), "squats").tierIndex, -1);
});

test("pulse counts its reps, not seconds; plank is time", () => {
  const sessions = [
    { count: 600, mode: "pulse", pulseReps: 80, timestamp: day(1) },
    { count: 30, timestamp: day(2) },
    { count: 700, type: "plank", timestamp: day(2) },
  ];
  const m = trophyCaseModel({ sessions });
  assert.equal(card(m, "pushups").value, 110);
  assert.equal(card(m, "best-set").value, 30);
  assert.equal(card(m, "plank").tier.id, "bronze");
  assert.equal(card(m, "plank").valueText, "11 min");
});

test("streak, pyramid, poker, rivals", () => {
  const sessions = Array.from({ length: 8 }, (_, i) => ({ count: 10, timestamp: day(i + 1) }));
  sessions.push({ count: 50, mode: "pyramid", pyramidSize: 10, pyramidCompleted: true, timestamp: day(9) });
  sessions.push({ count: 70, mode: "pyramid", pyramidSize: 12, pyramidCompleted: false, timestamp: day(9) });
  sessions.push({ count: 20, mode: "poker", pokerHandRanks: [1, 1, 2, 9], timestamp: day(9) });
  const m = trophyCaseModel({ sessions, horseWins: [Date.parse(day(4))], challengeWins: [] });
  assert.equal(card(m, "streak").value, 9);
  assert.equal(card(m, "streak").tier.id, "bronze");
  assert.equal(card(m, "pyramid").tier.id, "gold");
  assert.equal(card(m, "pyramid").valueText, "Firm");
  assert.equal(card(m, "poker").value, 3);
  assert.equal(card(m, "horse").tier.id, "bronze");
  assert.ok(earnedTierKeys(m).includes("horse:bronze"));
  assert.equal(m.earned, earnedTierKeys(m).length);
});

test("empty case has nothing earned", () => {
  const m = trophyCaseModel({ sessions: [] });
  assert.equal(m.earned, 0);
  assert.equal(m.total, m.cards.length * 5);
});
