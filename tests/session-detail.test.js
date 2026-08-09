import assert from "node:assert/strict";
import test from "node:test";
import { sessionBadges, sessionDurationMs, sessionKeyMetrics, sessionModeId, sessionModeLabel, sessionPace, sessionRings } from "../screens/session-detail.js";

const session = (overrides = {}) => ({
  id: "s1",
  user: "A",
  count: 20,
  startedAt: "2026-08-02T10:00:00Z",
  timestamp: "2026-08-02T10:01:00Z",
  ...overrides,
});

test("sessionModeId/Label fall back to classic and read plank type", () => {
  assert.equal(sessionModeId(session()), "classic");
  assert.equal(sessionModeId(session({ mode: "pyramid" })), "pyramid");
  assert.equal(sessionModeId(session({ type: "plank", count: 60 })), "planks");
  assert.equal(sessionModeId(session({ type: "squat", count: 15 })), "squats");
  assert.equal(sessionModeLabel(session({ type: "squat", count: 15 })), "Squats");
  assert.equal(sessionModeId(session({ type: "situp", count: 15 })), "situps");
  assert.equal(sessionModeLabel(session({ type: "situp", count: 15 })), "Situps");
  assert.equal(sessionModeLabel(session({ mode: "ladder" })), "Ladder");
});

test("sessionDurationMs/Pace derive from startedAt, and reject bad ranges", () => {
  assert.equal(sessionDurationMs(session()), 60000);
  assert.equal(sessionPace(session()), 20);
  assert.equal(sessionDurationMs(session({ startedAt: null })), null);
  assert.equal(sessionDurationMs(session({ timestamp: "2026-08-02T10:00:00Z" })), null); // zero-length
});

test("sessionBadges include mode, pyramid direction, modifier, and weighted", () => {
  const badges = sessionBadges(session({ mode: "pyramid", pyramidSize: 10, pyramidDirection: "updown", modifier: "wide", weightLbs: 20 }));
  assert.deepEqual(badges.map((b) => b.id), ["mode", "pyramid-direction", "modifier", "weighted"]);
  assert.equal(badges[0].label, "Pyramid");
  assert.equal(badges[1].label, "Up & Down");
  assert.equal(badges[2].label, "Wide");
  assert.equal(badges[3].label, "+20 lbs");
});

test("sessionKeyMetrics surfaces mode-specific fields and drops nulls", () => {
  const ladder = sessionKeyMetrics(session({ mode: "ladder", ladderMaxRung: 7 }));
  assert.ok(ladder.some((m) => m.id === "ladderMaxRung" && m.value === 7));
  assert.ok(ladder.some((m) => m.id === "duration"));

  const planks = sessionKeyMetrics(session({ type: "plank", count: 60 }));
  assert.ok(!planks.some((m) => m.id === "duration"));

  const squats = sessionKeyMetrics(session({ type: "squat", count: 15 }));
  assert.ok(squats.some((m) => m.id === "duration"));
  assert.ok(squats.some((m) => m.id === "pace"));

  const situps = sessionKeyMetrics(session({ type: "situp", count: 15 }));
  assert.ok(situps.some((m) => m.id === "duration"));
  assert.ok(situps.some((m) => m.id === "pace"));

  const poker = sessionKeyMetrics(session({ mode: "poker", pokerHandsCompleted: 3, pokerBestRank: 6 }));
  assert.deepEqual(poker.find((m) => m.id === "pokerBestHand"), { id: "pokerBestHand", label: "Best hand", format: "pokerHand", value: 6 });
});

test("sessionRings compares against personal and group pools, same mode+modifier first", () => {
  const target = session({ mode: "pyramid", modifier: "wide", count: 110 });
  const all = [
    target,
    session({ id: "s2", user: "A", mode: "pyramid", modifier: "wide", count: 90 }),
    session({ id: "s3", user: "A", mode: "pyramid", modifier: "wide", count: 128 }),
    session({ id: "s4", user: "B", mode: "pyramid", modifier: "wide", count: 100 }),
  ];
  const [vsAvg, vsBest, vsGroup] = sessionRings(target, all);
  assert.equal(vsAvg.hasData, true);
  assert.equal(vsAvg.compareValue, 109); // avg of 90 and 128
  assert.equal(vsBest.compareValue, 128);
  assert.equal(vsBest.pct, Math.round((110 / 128) * 100));
  assert.equal(vsGroup.hasData, true);
});

test("sessionRings falls back to mode-only when mode+modifier pool is empty, else reports no data", () => {
  const target = session({ mode: "cards", modifier: "close", count: 50, user: "A" });
  const all = [target, session({ id: "s2", user: "A", mode: "cards", modifier: "wide", count: 40 })];
  const [vsAvg] = sessionRings(target, all);
  assert.equal(vsAvg.hasData, true);
  assert.equal(vsAvg.compareValue, 40);

  const lonelyAll = [target];
  const [lonelyAvg, lonelyBest, lonelyGroup] = sessionRings(target, lonelyAll);
  assert.equal(lonelyAvg.hasData, false);
  // "Best" pool isn't excluded-self: with no other sessions, this session IS the best (100%).
  assert.equal(lonelyBest.hasData, true);
  assert.equal(lonelyBest.pct, 100);
  assert.equal(lonelyGroup.hasData, false);
});
