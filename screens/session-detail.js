import { MODIFIERS } from "./modifiers.js";

const MODIFIERS_BY_ID = Object.fromEntries(MODIFIERS.map((m) => [m.id, m]));

const VALID_SESSION_MAX_MS = 30 * 60 * 1000;

export const MODE_META = {
  classic: { label: "Classic", icon: "💪" },
  countdown: { label: "Countdown", icon: "⏱️" },
  cards: { label: "Cards", icon: "🃏" },
  poker: { label: "Poker", icon: "🂡" },
  dice: { label: "Dice", icon: "🎲" },
  ladder: { label: "Ladder", icon: "🪜" },
  pyramid: { label: "Pyramid", icon: "▲" },
  pulse: { label: "Pulse", icon: "❤️‍🔥" },
  cock: { label: "Cock Mode", icon: "🐓" },
  sharpshooter: { label: "Sharpshooter", icon: "🎯" },
  fortune: { label: "Fortune", icon: "🥠" },
  chase: { label: "Chase", icon: "🏃" },
  planks: { label: "Planks", icon: "🪵" },
  squats: { label: "Squats", icon: "🦵" },
  pullups: { label: "Pull-ups", icon: "💪" },
  situps: { label: "Crunches", icon: "🙇" },
  holland: { label: "Holland Mode", icon: "🇳🇱" },
};

export function sessionModeId(session) {
  if (session?.type === "plank") return "planks";
  if (session?.type === "squat") return "squats";
  if (session?.type === "pullup") return "pullups";
  if (session?.type === "situp") return "situps";
  if (session?.type === "holland") return "holland";
  return session?.mode || "classic";
}

export function sessionModeLabel(session) {
  return MODE_META[sessionModeId(session)]?.label || "Classic";
}

export function sessionDurationMs(session) {
  if (!session?.startedAt) return null;
  const ms = new Date(session.timestamp) - new Date(session.startedAt);
  return ms > 0 && ms < VALID_SESSION_MAX_MS ? ms : null;
}

export function sessionPace(session) {
  const ms = sessionDurationMs(session);
  if (!ms || !session.count) return null;
  return session.count / (ms / 60000);
}

// Chips shown under the hero total — mode, pyramid shape, grip modifier, weighted.
export function sessionBadges(session) {
  const modeId = sessionModeId(session);
  const meta = MODE_META[modeId] || MODE_META.classic;
  const badges = [{ id: "mode", icon: meta.icon, label: meta.label, tone: "mode" }];

  if (modeId === "pyramid" && session.pyramidSize) {
    badges.push({ id: "pyramid-direction", icon: "↕️", label: session.pyramidDirection === "updown" ? "Up & Down" : "Ascending" });
  }
  if (modeId === "pulse" && session.pulseBandWidth) {
    const label = session.pulseBandWidth.charAt(0).toUpperCase() + session.pulseBandWidth.slice(1);
    badges.push({ id: "pulse-band-width", icon: "📶", label: `${label} band` });
  }
  if (modeId === "cock" && session.cockResult) {
    badges.push({ id: "cock-result", icon: session.cockResult === "win" ? "🏆" : "🐓", label: session.cockResult === "win" ? "Win" : "Loss", tone: session.cockResult === "win" ? "achievement" : "mode" });
  }
  if (modeId === "holland" && session.hollandDifficulty) {
    const label = session.hollandDifficulty.charAt(0).toUpperCase() + session.hollandDifficulty.slice(1);
    badges.push({ id: "holland-difficulty", icon: "🕸️", label });
  }
  if (modeId === "holland" && session.hollandAchievement === "holland27") {
    badges.push({ id: "holland-27", icon: "🕷️", label: "Holland 27", tone: "achievement" });
  }
  if (session.modifier) {
    const modifierMeta = MODIFIERS_BY_ID[session.modifier];
    badges.push({ id: "modifier", icon: modifierMeta?.icon || "🤲", label: modifierMeta?.title || session.modifier, tone: "modifier" });
  }
  if (session.weightLbs) {
    badges.push({ id: "weighted", icon: "🏋️", label: `+${session.weightLbs} lbs`, tone: "weighted" });
  }
  return badges;
}

// Per-mode key metrics for the detail table — reuses the raw fields already
// saved on the session (see the session object built in app.js's completeWorkout).
export function sessionKeyMetrics(session) {
  const modeId = sessionModeId(session);
  const metrics = [];

  if (modeId !== "planks" && modeId !== "pulse") {
    metrics.push({ id: "duration", label: "Duration", format: "duration", value: sessionDurationMs(session) });
    if (modeId !== "holland") metrics.push({ id: "pace", label: "Pace", format: "pace", value: sessionPace(session) });
  }

  // Pulse's `count` is seconds held in band, not reps — the generic
  // duration/pace metrics above would be nonsense (dividing a seconds
  // value by minutes elapsed), so it gets its own metric set instead.
  if (modeId === "pulse") {
    if (session.pulseReps != null) metrics.push({ id: "pulseReps", label: "Reps", format: "integer", value: session.pulseReps });
    if (session.pulseBandLow != null && session.pulseBandHigh != null) {
      metrics.push({ id: "pulseBand", label: "Band", format: "text", value: `${session.pulseBandLow}–${session.pulseBandHigh} rpm` });
    }
    const endLabel = session.pulseEndReason === "banked" ? "Banked" : session.pulseEndReason === "ceiling" ? "Broke ceiling" : session.pulseEndReason === "floor" ? "Broke floor" : null;
    if (endLabel) metrics.push({ id: "pulseEndReason", label: "Ended by", format: "text", value: endLabel });
    if (session.pulseBreakRpm != null) metrics.push({ id: "pulseBreakRpm", label: "Pace at break", format: "text", value: `${session.pulseBreakRpm} rpm` });
  }

  if (modeId === "cock" && session.cockResult) {
    metrics.push({ id: "cockResult", label: "Result", format: "text", value: session.cockResult === "win" ? "Win" : "Loss" });
    if (session.cockFinalCockRpm != null) metrics.push({ id: "cockFinalCockRpm", label: "Cock's pace at end", format: "text", value: `${session.cockFinalCockRpm} rpm` });
  }
  if (modeId === "pyramid" && session.pyramidSize != null) {
    metrics.push({ id: "pyramidSize", label: "Pyramid size", format: "integer", value: session.pyramidSize });
    metrics.push({ id: "pyramidCompleted", label: "Completed", format: "boolean", value: session.pyramidCompleted });
  }
  if (modeId === "ladder" && session.ladderMaxRung != null) {
    metrics.push({ id: "ladderMaxRung", label: "Highest rung", format: "integer", value: session.ladderMaxRung });
  }
  if (modeId === "countdown" && session.countdownTarget != null) {
    metrics.push({ id: "countdownTarget", label: "Target", format: "integer", value: session.countdownTarget });
    metrics.push({ id: "countdownBeat", label: "Beat target", format: "boolean", value: session.countdownBeat });
  }
  if (modeId === "cards" && session.cardsCleared != null) {
    metrics.push({ id: "cardsCleared", label: "Cards cleared", format: "integer", value: session.cardsCleared });
  }
  if (modeId === "poker") {
    if (session.pokerHandsCompleted != null) metrics.push({ id: "pokerHandsCompleted", label: "Hands completed", format: "integer", value: session.pokerHandsCompleted });
    if (session.pokerBestRank != null) metrics.push({ id: "pokerBestHand", label: "Best hand", format: "pokerHand", value: session.pokerBestRank });
  }
  if (modeId === "dice" && session.diceRollsCleared != null) {
    metrics.push({ id: "diceRollsCleared", label: "Rolls cleared", format: "integer", value: session.diceRollsCleared });
  }
  if (modeId === "sharpshooter") {
    if (session.sharpshooterTargetsDestroyed != null) metrics.push({ id: "sharpshooterTargets", label: "Targets destroyed", format: "integer", value: session.sharpshooterTargetsDestroyed });
    if (session.sharpshooterLongestShot != null) metrics.push({ id: "sharpshooterLongestShot", label: "Longest shot", format: "integer", value: session.sharpshooterLongestShot });
  }
  if (modeId === "holland") {
    if (session.hollandCircuits != null) metrics.push({ id: "hollandCircuits", label: "Full circuits", format: "integer", value: session.hollandCircuits });
    if (session.hollandPullups != null) metrics.push({ id: "hollandPullups", label: "Pull-ups", format: "integer", value: session.hollandPullups });
    if (session.hollandPushups != null) metrics.push({ id: "hollandPushups", label: "Pushups", format: "integer", value: session.hollandPushups });
    if (session.hollandSquats != null) metrics.push({ id: "hollandSquats", label: "Squats", format: "integer", value: session.hollandSquats });
  }
  if (modeId === "chase") {
    metrics.push({ id: "chaseResult", label: session.chaseOvertaken ? "Overtook" : "Chasing", format: "text", value: session.chaseRival || "rival" });
    if (session.chaseOvertaken && session.chaseFinalLead != null) metrics.push({ id: "chaseFinalLead", label: "Final lead", format: "integer", value: session.chaseFinalLead });
  }
  if (session.weightLbs) {
    metrics.push({ id: "rawCount", label: "Raw reps", format: "integer", value: session.rawCount ?? session.count });
  }

  return metrics.filter((m) => m.value != null);
}

function isSameSession(a, b) {
  return a === b || (a?.id != null && a.id === b?.id);
}

// mode+modifier is the tight scope; falls back to mode-only when that scope
// (after excluding this session, when asked) has no other sessions in it.
function scopedPool(allSessions, session, { ownerFilter, excludeSelf }) {
  const modeId = sessionModeId(session);
  const base = (allSessions || []).filter(ownerFilter);
  const keep = (s) => !excludeSelf || !isSameSession(s, session);
  const strict = base.filter((s) => sessionModeId(s) === modeId && s.modifier === session.modifier && keep(s));
  if (strict.length) return strict;
  return base.filter((s) => sessionModeId(s) === modeId && keep(s));
}

function countOf(session) {
  return Number(session.count) || 0;
}

function avgRing(id, label, pool, session) {
  if (!pool.length) return { id, label, hasData: false };
  const avg = pool.reduce((sum, s) => sum + countOf(s), 0) / pool.length;
  if (!avg) return { id, label, hasData: false };
  const value = countOf(session);
  const diffPct = Math.round(((value - avg) / avg) * 100);
  const fill = Math.max(0, Math.min(1, value / (avg * 2)));
  return { id, label, hasData: true, diffPct, fill, value, compareValue: Math.round(avg) };
}

function bestRing(id, label, pool, session) {
  if (!pool.length) return { id, label, hasData: false };
  const value = countOf(session);
  const best = Math.max(...pool.map(countOf));
  if (!best) return { id, label, hasData: false };
  const fill = Math.max(0, Math.min(1, value / best));
  return { id, label, hasData: true, pct: Math.round(fill * 100), fill, value, compareValue: best };
}

// Compares against the single most recent session (same scoped pool as
// vsAvg — mode+modifier — so it's an apples-to-apples "last time" rather
// than whatever session happened to be logged right before this one).
function priorRing(id, label, pool, session) {
  if (!pool.length) return { id, label, hasData: false };
  const sessionTime = new Date(session.timestamp).getTime();
  const priorCandidates = pool.filter((s) => new Date(s.timestamp).getTime() < sessionTime);
  if (!priorCandidates.length) return { id, label, hasData: false };
  const prior = priorCandidates.reduce((latest, s) => (new Date(s.timestamp) > new Date(latest.timestamp) ? s : latest));
  const priorCount = countOf(prior);
  if (!priorCount) return { id, label, hasData: false };
  const value = countOf(session);
  const diffPct = Math.round(((value - priorCount) / priorCount) * 100);
  const fill = Math.max(0, Math.min(1, value / (priorCount * 2)));
  return { id, label, hasData: true, diffPct, fill, value, compareValue: priorCount };
}

// Four comparison rings: this user's own average, their immediately prior
// session, their best, and the average across everyone — all in this mode
// (+modifier when there's enough data).
export function sessionRings(session, allSessions) {
  const personalPool = scopedPool(allSessions, session, { ownerFilter: (s) => s.user === session.user, excludeSelf: true });
  const personalBestPool = scopedPool(allSessions, session, { ownerFilter: (s) => s.user === session.user, excludeSelf: false });
  const groupPool = scopedPool(allSessions, session, { ownerFilter: () => true, excludeSelf: true });
  return [
    avgRing("vsAvg", "vs avg", personalPool, session),
    priorRing("vsPrior", "vs prior", personalPool, session),
    bestRing("vsBest", "vs best", personalBestPool, session),
    avgRing("vsGroup", "vs group avg", groupPool, session),
  ];
}
