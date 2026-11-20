// Trophy Case (docs/trophies-plan.md): tiered cards computed purely from the
// sessions/games already synced. Every card reduces to a time series of a
// non-decreasing value; a tier unlocks at the first point that reaches its
// threshold, which also gives us the unlock date for free.
import { expandHollandProjections } from "../stats.js?v=2";
import { usageByMode } from "./explore-modes.js?v=156";

export const TROPHY_TIERS = Object.freeze([
  { id: "bronze", label: "Bronze" },
  { id: "silver", label: "Silver" },
  { id: "gold", label: "Gold" },
  { id: "platinum", label: "Platinum" },
  { id: "diamond", label: "Diamond" },
]);

export const TROPHY_SECTIONS = Object.freeze([
  { id: "volume", label: "Volume" },
  { id: "feats", label: "Feats" },
  { id: "modes", label: "Modes" },
  { id: "rivals", label: "Rivals" },
]);

const PYRAMID_BASES = [5, 8, 10, 12, 15];
const PYRAMID_LABELS = { 5: "Flaccid", 8: "Semi", 10: "Firm", 12: "Rock Hard", 15: "Anaconda" };

// ---- series helpers: each returns [{ t, v }] in time order, v non-decreasing.
function cumulative(sessions, ts, amount) {
  let total = 0;
  const out = [];
  for (const s of sessions) {
    const a = Number(amount(s)) || 0;
    if (a <= 0) continue;
    total += a;
    out.push({ t: ts(s), v: total });
  }
  return out;
}
function runningMax(sessions, ts, value) {
  let best = 0;
  const out = [];
  for (const s of sessions) {
    const v = Number(value(s)) || 0;
    if (v <= best) continue;
    best = v;
    out.push({ t: ts(s), v: best });
  }
  return out;
}
function distinctCount(sessions, ts, keys) {
  const seen = new Set();
  const out = [];
  for (const s of sessions) {
    let grew = false;
    for (const k of [].concat(keys(s) ?? [])) {
      if (k == null || k === "" || seen.has(k)) continue;
      seen.add(k);
      grew = true;
    }
    if (grew) out.push({ t: ts(s), v: seen.size });
  }
  return out;
}
function eventCount(times) {
  return [...times].sort((a, b) => a - b).map((t, i) => ({ t, v: i + 1 }));
}

const isPushup = (s) => !s.type;
const pushupReps = (s) => (s.mode === "pulse" ? s.pulseReps : s.count);
const ofType = (type) => (s) => s.type === type;

// Longest streak ever, evaluated at the end of each distinct workout day.
// Mirrors computeStreakCore's walk (one rest day allowed per 7) but builds the
// day set once, since this runs for every day in the history.
function streakAt(daySet, earliest, now) {
  let streak = 0; let lastRest = null; const cursor = new Date(now);
  while (true) {
    if (daySet.has(cursor.toDateString())) { streak++; cursor.setDate(cursor.getDate() - 1); continue; }
    const start = new Date(cursor); start.setHours(0, 0, 0, 0);
    if (start.getTime() < earliest) break;
    const sinceRest = lastRest ? (lastRest - cursor.getTime()) / 86400000 : Infinity;
    if (!(streak > 0 && sinceRest >= 7)) break;
    streak++; lastRest = cursor.getTime(); cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
function streakSeries(sessions, ts) {
  if (!sessions.length) return [];
  const daySet = new Set(sessions.map((s) => new Date(ts(s)).toDateString()));
  const first = new Date(ts(sessions[0])); first.setHours(0, 0, 0, 0);
  const days = [...new Set(sessions.map((s) => { const d = new Date(ts(s)); d.setHours(12, 0, 0, 0); return d.getTime(); }))].sort((a, b) => a - b);
  let best = 0;
  const out = [];
  for (const day of days) {
    const streak = streakAt(daySet, first.getTime(), day);
    if (streak > best) { best = streak; out.push({ t: day, v: best }); }
  }
  return out;
}

function pokerRanks(s) {
  if (s.mode !== "poker") return [];
  return (s.pokerHandRanks || []).map(Number).filter((r) => r >= 1 && r <= 9);
}

function minutes(sec) {
  const v = Math.floor(sec);
  if (v >= 3600) { const h = v / 3600; return `${Number.isInteger(h) ? h : h.toFixed(1)} h`; }
  return `${Math.floor(v / 60)} min`;
}
function compact(n) {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M`;
  if (n >= 1e4) return `${+(n / 1e3).toFixed(n % 1e3 ? 1 : 0)}k`;
  return Math.round(n).toLocaleString("en-US");
}

// icon: { kind: "mode" | "type" | "stat", id }
export function trophyCards({ totalModes = 20 } = {}) {
  return [
    // Volume
    { id: "pushups", section: "volume", title: "Pushups", icon: { kind: "type", id: "pushups" }, unit: "reps", thresholds: [100, 1000, 5000, 25000, 100000], series: (c) => cumulative(c.pool.filter(isPushup), c.ts, pushupReps) },
    { id: "squats", section: "volume", title: "Squats", icon: { kind: "type", id: "squats" }, unit: "reps", thresholds: [100, 1000, 5000, 25000, 100000], series: (c) => cumulative(c.pool.filter(ofType("squat")), c.ts, (s) => s.count) },
    { id: "situps", section: "volume", title: "Situps", icon: { kind: "type", id: "situps" }, unit: "reps", thresholds: [100, 1000, 5000, 25000, 100000], series: (c) => cumulative(c.pool.filter(ofType("situp")), c.ts, (s) => s.count) },
    { id: "pullups", section: "volume", title: "Pull-ups", icon: { kind: "type", id: "pullups" }, unit: "reps", thresholds: [50, 250, 1000, 5000, 20000], series: (c) => cumulative(c.pool.filter(ofType("pullup")), c.ts, (s) => s.count) },
    { id: "plank", section: "volume", title: "Plank", icon: { kind: "type", id: "planks" }, format: "time", thresholds: [600, 3600, 18000, 72000, 180000], series: (c) => cumulative(c.pool.filter(ofType("plank")), c.ts, (s) => s.count) },
    { id: "deadhang", section: "volume", title: "Dead hang", icon: { kind: "type", id: "deadhang" }, format: "time", thresholds: [300, 1800, 7200, 36000, 90000], series: (c) => cumulative(c.pool.filter(ofType("deadhang")), c.ts, (s) => s.count) },
    { id: "grip", section: "volume", title: "Grip", icon: { kind: "type", id: "grip" }, unit: "squeezes", thresholds: [100, 1000, 5000, 25000, 100000], series: (c) => cumulative(c.pool.filter(ofType("grip")), c.ts, (s) => s.count) },
    { id: "kettlebell", section: "volume", title: "Kettlebell", icon: { kind: "type", id: "kettlebell" }, unit: "lbs", format: "compact", thresholds: [5000, 50000, 250000, 1000000, 5000000], series: (c) => cumulative(c.raw.filter(ofType("kettlebell")), c.ts, (s) => s.kettlebellVolumeLbs) },
    { id: "circuits", section: "volume", title: "Circuits", icon: { kind: "type", id: "circuits" }, unit: "rounds", thresholds: [5, 25, 100, 250, 500], series: (c) => cumulative(c.raw, c.ts, (s) => (s.type === "holland" ? s.hollandCircuits : s.type === "chainofpain" ? s.chainOfPainCycles : 0)) },
    // Feats
    { id: "best-set", section: "feats", title: "Best pushup set", icon: { kind: "stat", id: "award" }, unit: "reps", thresholds: [25, 50, 75, 100, 150], series: (c) => runningMax(c.raw.filter((s) => isPushup(s) && s.mode !== "pulse"), c.ts, (s) => s.count) },
    { id: "streak", section: "feats", title: "Streak", icon: { kind: "stat", id: "flame" }, unit: "days", thresholds: [7, 30, 90, 180, 365], series: (c) => streakSeries(c.raw, c.ts) },
    { id: "sessions", section: "feats", title: "Sessions logged", icon: { kind: "stat", id: "hash" }, unit: "sessions", thresholds: [10, 100, 500, 1000, 2500], series: (c) => cumulative(c.raw, c.ts, () => 1) },
    { id: "explorer", section: "feats", title: "Explorer", icon: { kind: "stat", id: "layers" }, unit: "modes", thresholds: [3, 6, 10, 15, totalModes], tierLabels: [null, null, null, null, "Every mode"], series: (c) => distinctCount(c.raw, c.ts, (s) => [...usageByMode([s]).keys()].filter((k) => !k.endsWith("undefined"))) },
    { id: "globetrotter", section: "feats", title: "Globetrotter", icon: { kind: "stat", id: "pin" }, unit: "cities", thresholds: [2, 5, 10, 25, 50], series: (c) => distinctCount(c.raw, c.ts, (s) => s.location?.city?.id) },
    // Modes
    { id: "ladder", section: "modes", title: "Ladder", icon: { kind: "mode", id: "ladder" }, unit: "rung", thresholds: [5, 10, 15, 20, 25], series: (c) => runningMax(c.raw.filter((s) => s.mode === "ladder"), c.ts, (s) => s.ladderMaxRung) },
    { id: "pyramid", section: "modes", title: "Pyramid", icon: { kind: "mode", id: "pyramid" }, thresholds: PYRAMID_BASES, tierLabels: PYRAMID_BASES.map((b) => PYRAMID_LABELS[b]), valueLabel: (v) => PYRAMID_LABELS[v] || "—", series: (c) => runningMax(c.raw.filter((s) => s.mode === "pyramid" && s.pyramidCompleted), c.ts, (s) => s.pyramidSize) },
    { id: "poker", section: "modes", title: "Poker", icon: { kind: "mode", id: "poker" }, unit: "hands", thresholds: [2, 4, 6, 8, 9], tierLabels: [null, null, null, null, "All 9 + Royal Flush"], series: (c) => distinctCount(c.raw, c.ts, pokerRanks) },
    { id: "sharpshooter", section: "modes", title: "Sharpshooter", icon: { kind: "mode", id: "sharpshooter" }, unit: "targets", thresholds: [5, 10, 20, 30, 50], series: (c) => runningMax(c.raw.filter((s) => s.mode === "sharpshooter"), c.ts, (s) => s.sharpshooterTargetsDestroyed) },
    { id: "pulse", section: "modes", title: "Pulse", icon: { kind: "mode", id: "pulse" }, unit: "sessions", thresholds: [1, 10, 25, 50, 100], series: (c) => cumulative(c.raw.filter((s) => s.mode === "pulse"), c.ts, () => 1) },
    { id: "cock", section: "modes", title: "Cock Mode", icon: { kind: "mode", id: "cock" }, unit: "wins", thresholds: [1, 5, 15, 30, 60], series: (c) => cumulative(c.raw.filter((s) => s.mode === "cock" && s.cockResult === "win"), c.ts, () => 1) },
    // Rivals
    { id: "horse", section: "rivals", title: "Horse", icon: { kind: "mode", id: "horse" }, unit: "wins", thresholds: [1, 5, 15, 30, 60], series: (c) => eventCount(c.horseWins) },
    { id: "tow", section: "rivals", title: "Tug of war", icon: { kind: "mode", id: "tow" }, unit: "wins", thresholds: [1, 5, 15, 30, 60], series: (c) => eventCount(c.towWins) },
    { id: "chase", section: "rivals", title: "Chase", icon: { kind: "mode", id: "chase" }, unit: "passes", thresholds: [1, 5, 15, 30, 60], series: (c) => cumulative(c.raw.filter((s) => s.mode === "chase" && Number(s.chaseFinalLead) > 0), c.ts, () => 1) },
    { id: "challenges", section: "rivals", title: "Challenges", icon: { kind: "stat", id: "target" }, unit: "wins", thresholds: [1, 3, 10, 25, 50], series: (c) => eventCount(c.challengeWins) },
  ];
}

export function formatTrophyValue(card, v) {
  if (card.valueLabel) return card.valueLabel(v);
  if (card.format === "time") return minutes(v);
  if (card.format === "compact") return compact(v);
  return Math.round(v).toLocaleString("en-US");
}

function thresholdLabel(card, i) {
  if (card.tierLabels?.[i]) return card.tierLabels[i];
  const value = formatTrophyValue(card, card.thresholds[i]);
  return card.unit && !card.valueLabel ? `${value} ${card.unit}` : value;
}

// Whole case for one user. `sessions` = that user's raw sessions;
// horseWins / towWins / challengeWins = arrays of ms timestamps.
export function trophyCaseModel({ sessions = [], ts = (s) => Date.parse(s.timestamp) || 0, horseWins = [], towWins = [], challengeWins = [], totalModes } = {}) {
  const raw = [...sessions].sort((a, b) => ts(a) - ts(b));
  const pool = expandHollandProjections(raw);
  const ctx = { raw, pool, ts, horseWins, towWins, challengeWins };
  const cards = trophyCards({ totalModes }).map((card) => {
    const series = card.series(ctx);
    const value = series.length ? series[series.length - 1].v : 0;
    const tiers = card.thresholds.map((threshold, i) => {
      const hit = series.find((p) => p.v >= threshold);
      return { ...TROPHY_TIERS[i], threshold, label: thresholdLabel(card, i), unlockedAt: hit ? hit.t : null };
    });
    const tierIndex = tiers.reduce((acc, tier, i) => (tier.unlockedAt != null ? i : acc), -1);
    const next = tiers[tierIndex + 1] || null;
    const progress = next ? Math.max(0, Math.min(1, value / next.threshold)) : 1;
    return {
      id: card.id, section: card.section, title: card.title, icon: card.icon,
      value, valueText: formatTrophyValue(card, value),
      tierIndex, tier: tierIndex >= 0 ? TROPHY_TIERS[tierIndex] : null,
      next, nextText: next ? next.label : null, progress,
      tiers,
    };
  });
  const earned = cards.reduce((n, c) => n + c.tierIndex + 1, 0);
  return { cards, earned, total: cards.length * TROPHY_TIERS.length };
}

// Tier keys ("pushups:silver") a case has earned — used to diff before/after
// a session for the unlock celebration.
export function earnedTierKeys(model) {
  return model.cards.flatMap((c) => c.tiers.filter((t) => t.unlockedAt != null).map((t) => `${c.id}:${t.id}`));
}
