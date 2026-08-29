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
  assert.equal(sessionModeId(session({ type: "pullup", count: 8 })), "pullups");
  assert.equal(sessionModeLabel(session({ type: "pullup", count: 8 })), "Pull-ups");
  assert.equal(sessionModeId(session({ type: "squat", count: 15 })), "squats");
  assert.equal(sessionModeLabel(session({ type: "squat", count: 15 })), "Squats");
  assert.equal(sessionModeId(session({ type: "situp", count: 15 })), "situps");
  assert.equal(sessionModeLabel(session({ type: "situp", count: 15 })), "Crunches");
  assert.equal(sessionModeLabel(session({ mode: "ladder" })), "Ladder");
  assert.equal(sessionModeId(session({ type: "holland" })), "holland");
  assert.equal(sessionModeLabel(session({ type: "holland" })), "Holland Mode");
  assert.equal(sessionModeId(session({ mode: "pulse" })), "pulse");
  assert.equal(sessionModeLabel(session({ mode: "pulse" })), "Pulse");
});

test("Pulse sessions get their own metrics (not the generic reps-based duration/pace) and a band-width badge", () => {
  const pulseSession = session({ mode: "pulse", count: 194, pulseReps: 118, pulseBandWidth: "standard", pulseBandLow: 29, pulseBandHigh: 39, pulseEndReason: "ceiling", pulseBreakRpm: 43 });
  const metrics = sessionKeyMetrics(pulseSession);
  assert.equal(metrics.some((m) => m.id === "duration"), false);
  assert.equal(metrics.some((m) => m.id === "pace"), false);
  assert.deepEqual(metrics.find((m) => m.id === "pulseReps").value, 118);
  assert.equal(metrics.find((m) => m.id === "pulseBand").value, "29–39 rpm");
  assert.equal(metrics.find((m) => m.id === "pulseEndReason").value, "Broke ceiling");
  assert.equal(metrics.find((m) => m.id === "pulseBreakRpm").value, "43 rpm");

  const badges = sessionBadges(pulseSession);
  assert.equal(badges.find((b) => b.id === "pulse-band-width").label, "Standard band");
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

  const holland = sessionBadges(session({ type: "holland", hollandDifficulty: "hard", hollandAchievement: "holland27" }));
  assert.deepEqual(holland.map((b) => b.id), ["mode", "holland-difficulty", "holland-27"]);
  assert.equal(holland[1].label, "Hard");
  assert.equal(holland[2].label, "Holland 27");
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

  const pullups = sessionKeyMetrics(session({ type: "pullup", count: 8 }));
  assert.ok(pullups.some((m) => m.id === "duration"));
  assert.ok(pullups.some((m) => m.id === "pace"));

  const situps = sessionKeyMetrics(session({ type: "situp", count: 15 }));
  assert.ok(situps.some((m) => m.id === "duration"));
  assert.ok(situps.some((m) => m.id === "pace"));

  const poker = sessionKeyMetrics(session({ mode: "poker", pokerHandsCompleted: 3, pokerBestRank: 6 }));
  assert.deepEqual(poker.find((m) => m.id === "pokerBestHand"), { id: "pokerBestHand", label: "Best hand", format: "pokerHand", value: 6 });

  const holland = sessionKeyMetrics(session({
    type: "holland", hollandDifficulty: "hard", hollandCycles: 27, hollandCircuits: 9,
    hollandPullups: 135, hollandPushups: 270, hollandSquats: 405,
  }));
  assert.ok(holland.some((m) => m.id === "duration"));
  assert.ok(!holland.some((m) => m.id === "pace")); // time is context only, not a rate
  assert.ok(!holland.some((m) => m.id === "hollandCycles")); // cycles is already the hero number, not repeated in the table
  assert.equal(holland.find((m) => m.id === "hollandCircuits").value, 9);
  assert.equal(holland.find((m) => m.id === "hollandPullups").value, 135);
  assert.equal(holland.find((m) => m.id === "hollandPushups").value, 270);
  assert.equal(holland.find((m) => m.id === "hollandSquats").value, 405);
});

test("sessionRings compares against personal and group pools, same mode+modifier first", () => {
  const target = session({ mode: "pyramid", modifier: "wide", count: 110 });
  const all = [
    target,
    session({ id: "s2", user: "A", mode: "pyramid", modifier: "wide", count: 90 }),
    session({ id: "s3", user: "A", mode: "pyramid", modifier: "wide", count: 128 }),
    session({ id: "s4", user: "B", mode: "pyramid", modifier: "wide", count: 100 }),
  ];
  const [vsAvg, vsPrior, vsBest, vsGroup] = sessionRings(target, all);
  assert.equal(vsAvg.hasData, true);
  assert.equal(vsAvg.compareValue, 109); // avg of 90 and 128
  assert.equal(vsPrior.hasData, false); // no session in the pool precedes target's timestamp
  assert.equal(vsBest.compareValue, 128);
  assert.equal(vsBest.pct, Math.round((110 / 128) * 100));
  assert.equal(vsGroup.hasData, true);
});

test("sessionRings' vsPrior compares against the single most recent earlier session, same scope as vsAvg", () => {
  const target = session({ mode: "pyramid", modifier: "wide", count: 110, timestamp: "2026-08-05T10:00:00Z" });
  const all = [
    target,
    session({ id: "s2", user: "A", mode: "pyramid", modifier: "wide", count: 90, timestamp: "2026-08-01T10:00:00Z" }),
    session({ id: "s3", user: "A", mode: "pyramid", modifier: "wide", count: 128, timestamp: "2026-08-03T10:00:00Z" }), // most recent before target
    session({ id: "s4", user: "A", mode: "pyramid", modifier: "wide", count: 200, timestamp: "2026-08-09T10:00:00Z" }), // after target, excluded
  ];
  const [, vsPrior] = sessionRings(target, all);
  assert.equal(vsPrior.hasData, true);
  assert.equal(vsPrior.compareValue, 128);
  assert.equal(vsPrior.diffPct, Math.round(((110 - 128) / 128) * 100));
});

test("sessionRings falls back to mode-only when mode+modifier pool is empty, else reports no data", () => {
  const target = session({ mode: "cards", modifier: "close", count: 50, user: "A" });
  const all = [target, session({ id: "s2", user: "A", mode: "cards", modifier: "wide", count: 40 })];
  const [vsAvg] = sessionRings(target, all);
  assert.equal(vsAvg.hasData, true);
  assert.equal(vsAvg.compareValue, 40);

  const lonelyAll = [target];
  const [lonelyAvg, , lonelyBest, lonelyGroup] = sessionRings(target, lonelyAll);
  assert.equal(lonelyAvg.hasData, false);
  // "Best" pool isn't excluded-self: with no other sessions, this session IS the best (100%).
  assert.equal(lonelyBest.hasData, true);
  assert.equal(lonelyBest.pct, 100);
  assert.equal(lonelyGroup.hasData, false);
});
