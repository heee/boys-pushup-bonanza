import { sessionModeId } from "./session-detail.js";

const VALID_SESSION_MAX_MS = 30 * 60 * 1000;

function durationMs(session) {
  if (!session?.startedAt) return null;
  const ms = new Date(session.timestamp) - new Date(session.startedAt);
  return ms > 0 && ms < VALID_SESSION_MAX_MS ? ms : null;
}

function sum(items, get = (value) => value) {
  return items.reduce((total, item) => total + get(item), 0);
}

function average(values) {
  return values.length ? sum(values) / values.length : null;
}

function eligible(sessions, field) {
  return sessions.filter((session) => Number.isFinite(Number(session[field])));
}

const SPECS = {
  all: [
    { id: "sessions", label: "Sessions logged", format: "integer", qualifier: "total", value: (s) => s.length },
    { id: "avgDuration", label: "Avg session time", format: "duration", qualifier: "group avg", value: (s) => average(s.map(durationMs).filter((v) => v != null)) },
    { id: "avgPace", label: "Avg pace", format: "pace", qualifier: "group avg", value: (s) => { const timed = s.map((x) => [x, durationMs(x)]).filter(([, ms]) => ms != null); const minutes = sum(timed, ([, ms]) => ms) / 60000; return minutes ? sum(timed, ([x]) => Number(x.count) || 0) / minutes : null; } },
  ],
  classic: [
    { id: "sessions", label: "Classic sessions", format: "integer", qualifier: "total", value: (s) => s.length },
    { id: "workoutTime", label: "Total workout time", format: "duration", qualifier: "total", value: (s) => { const values = s.map(durationMs).filter((v) => v != null); return values.length ? sum(values) : null; } },
    { id: "avgPace", label: "Avg pace", format: "pace", qualifier: "group avg", value: (s) => SPECS.all[2].value(s) },
  ],
  countdown: [
    { id: "attempts", label: "Attempts", format: "integer", qualifier: "total", value: (s) => s.length },
    { id: "recordsBeaten", label: "Records beaten", format: "integer", qualifier: "total", value: (s) => { const e = s.filter((x) => typeof x.countdownBeat === "boolean"); return e.length ? e.filter((x) => x.countdownBeat).length : null; } },
    { id: "successRate", label: "Success rate", format: "percent", qualifier: "group rate", value: (s) => { const e = s.filter((x) => typeof x.countdownBeat === "boolean"); return e.length ? e.filter((x) => x.countdownBeat).length / e.length : null; } },
  ],
  cards: [
    { id: "cardsCleared", label: "Cards cleared", format: "integer", qualifier: "total", value: (s) => { const e = eligible(s, "cardsCleared"); return e.length ? sum(e, (x) => Number(x.cardsCleared)) : null; } },
    { id: "cardsPerSession", label: "Avg cards/session", format: "decimal", qualifier: "group avg", value: (s) => { const e = eligible(s, "cardsCleared"); return e.length ? sum(e, (x) => Number(x.cardsCleared)) / e.length : null; } },
    { id: "avgCardValue", label: "Avg card value", format: "decimal", qualifier: "group avg", value: (s) => { const e = eligible(s, "cardsClearedValue").filter((x) => Number(x.cardsCleared) > 0); const count = sum(e, (x) => Number(x.cardsCleared)); return count ? sum(e, (x) => Number(x.cardsClearedValue)) / count : null; } },
  ],
  poker: [
    { id: "handsCompleted", label: "Hands completed", format: "integer", qualifier: "total", value: (s) => { const e = eligible(s, "pokerHandsCompleted"); return e.length ? sum(e, (x) => Number(x.pokerHandsCompleted)) : null; } },
    { id: "bestHand", label: "Best hand", format: "pokerHand", qualifier: "group best", value: (s) => { const e = eligible(s, "pokerBestRank"); return e.length ? Math.max(...e.map((x) => Number(x.pokerBestRank))) : null; } },
    { id: "premiumRate", label: "Premium-hand rate", format: "percent", qualifier: "group rate", value: (s) => { const e = eligible(s, "pokerHandsCompleted"); const hands = sum(e, (x) => Number(x.pokerHandsCompleted)); return hands ? sum(e, (x) => Number(x.pokerPremiumHands) || 0) / hands : null; } },
  ],
  dice: [
    { id: "rollsCleared", label: "Rolls cleared", format: "integer", qualifier: "total", value: (s) => { const e = eligible(s, "diceRollsCleared"); return e.length ? sum(e, (x) => Number(x.diceRollsCleared)) : null; } },
    { id: "rollsPerSession", label: "Avg rolls/session", format: "decimal", qualifier: "group avg", value: (s) => { const e = eligible(s, "diceRollsCleared"); return e.length ? sum(e, (x) => Number(x.diceRollsCleared)) / e.length : null; } },
    { id: "avgRollValue", label: "Avg roll value", format: "decimal", qualifier: "group avg", value: (s) => { const e = eligible(s, "diceRollsClearedValue").filter((x) => Number(x.diceRollsCleared) > 0); const count = sum(e, (x) => Number(x.diceRollsCleared)); return count ? sum(e, (x) => Number(x.diceRollsClearedValue)) / count : null; } },
  ],
  ladder: [
    { id: "climbs", label: "Climbs logged", format: "integer", qualifier: "total", value: (s) => s.length },
    { id: "highestRung", label: "Highest rung", format: "integer", qualifier: "group best", value: (s) => { const e = eligible(s, "ladderMaxRung"); return e.length ? Math.max(...e.map((x) => Number(x.ladderMaxRung))) : null; } },
    { id: "avgTopRung", label: "Avg top rung", format: "decimal", qualifier: "group avg", value: (s) => { const e = eligible(s, "ladderMaxRung"); return e.length ? average(e.map((x) => Number(x.ladderMaxRung))) : null; } },
  ],
  pyramid: [
    { id: "pyramids", label: "Pyramids logged", format: "integer", qualifier: "total", value: (s) => s.length },
    { id: "completed", label: "Pyramids completed", format: "integer", qualifier: "total", value: (s) => { const e = s.filter((x) => typeof x.pyramidCompleted === "boolean"); return e.length ? e.filter((x) => x.pyramidCompleted).length : null; } },
    { id: "biggestSize", label: "Biggest size cleared", format: "integer", qualifier: "group best", value: (s) => { const e = s.filter((x) => x.pyramidCompleted && Number.isFinite(Number(x.pyramidSize))); return e.length ? Math.max(...e.map((x) => Number(x.pyramidSize))) : null; } },
  ],
  sharpshooter: [
    { id: "targetsDestroyed", label: "Targets destroyed", format: "integer", qualifier: "total", value: (s) => { const e = eligible(s, "sharpshooterTargetsDestroyed"); return e.length ? sum(e, (x) => Number(x.sharpshooterTargetsDestroyed)) : null; } },
    { id: "bestBarrage", label: "Best barrage", format: "integer", qualifier: "group best", value: (s) => { const e = eligible(s, "sharpshooterTargetsDestroyed"); return e.length ? Math.max(...e.map((x) => Number(x.sharpshooterTargetsDestroyed))) : null; } },
    { id: "longestShot", label: "Longest shot", format: "integer", qualifier: "group best", value: (s) => { const e = eligible(s, "sharpshooterLongestShot"); return e.length ? Math.max(...e.map((x) => Number(x.sharpshooterLongestShot))) : null; } },
  ],
  fortune: [
    { id: "fortunes", label: "Fortunes completed", format: "integer", qualifier: "total", value: (s) => s.length },
    { id: "unique", label: "Unique challenges", format: "integer", qualifier: "group unique", value: (s) => { const ids = s.map((x) => x.fortuneChallengeId).filter(Boolean); return ids.length ? new Set(ids).size : null; } },
    { id: "avgReps", label: "Avg reps/fortune", format: "decimal", qualifier: "group avg", value: (s) => s.length ? average(s.map((x) => Number(x.count) || 0)) : null },
  ],
  chase: [
    { id: "chases", label: "Chases logged", format: "integer", qualifier: "total", value: (s) => s.length },
    { id: "overtakes", label: "Overtakes", format: "integer", qualifier: "total", value: (s) => { const e = s.filter((x) => typeof x.chaseOvertaken === "boolean"); return e.length ? e.filter((x) => x.chaseOvertaken).length : null; } },
    { id: "winningMargin", label: "Avg winning margin", format: "decimalPoints", qualifier: "group avg", value: (s) => { const wins = s.filter((x) => x.chaseOvertaken && Number.isFinite(Number(x.chaseFinalLead))); return wins.length ? average(wins.map((x) => Number(x.chaseFinalLead))) : null; } },
  ],
  planks: [
    { id: "holds", label: "Holds logged", format: "integer", qualifier: "total", value: (s) => s.length },
    { id: "totalHold", label: "Total hold time", format: "seconds", qualifier: "total", value: (s) => s.length ? sum(s, (x) => Number(x.count) || 0) : null },
    { id: "avgHold", label: "Avg hold time", format: "seconds", qualifier: "group avg", value: (s) => s.length ? average(s.map((x) => Number(x.count) || 0)) : null },
  ],
  pullups: [
    { id: "sets", label: "Pull-up sets", format: "integer", qualifier: "total", value: (s) => s.length },
    { id: "totalReps", label: "Total pull-ups", format: "integer", qualifier: "total", value: (s) => s.length ? sum(s, (x) => Number(x.count) || 0) : null },
    { id: "avgReps", label: "Avg pull-ups / set", format: "decimal", qualifier: "group avg", value: (s) => s.length ? average(s.map((x) => Number(x.count) || 0)) : null },
  ],
  squats: [
    { id: "sets", label: "Squat sets", format: "integer", qualifier: "total", value: (s) => s.length },
    { id: "totalReps", label: "Total squats", format: "integer", qualifier: "total", value: (s) => s.length ? sum(s, (x) => Number(x.count) || 0) : null },
    { id: "avgReps", label: "Avg squats / set", format: "decimal", qualifier: "group avg", value: (s) => s.length ? average(s.map((x) => Number(x.count) || 0)) : null },
  ],
  situps: [
    { id: "sets", label: "Crunch sets", format: "integer", qualifier: "total", value: (s) => s.length },
    { id: "totalReps", label: "Total crunches", format: "integer", qualifier: "total", value: (s) => s.length ? sum(s, (x) => Number(x.count) || 0) : null },
    { id: "avgReps", label: "Avg crunches / set", format: "decimal", qualifier: "group avg", value: (s) => s.length ? average(s.map((x) => Number(x.count) || 0)) : null },
  ],
  // `count` is seconds held in band for Pulse (Plank's overload), not reps —
  // see docs/pulse-mode-plan.md. Falling through to SPECS.all here would
  // compute a nonsense "avg pace" treating that seconds value as a rep count.
  pulse: [
    { id: "runs", label: "Runs logged", format: "integer", qualifier: "total", value: (s) => s.length },
    { id: "totalHeld", label: "Total time in band", format: "seconds", qualifier: "total", value: (s) => s.length ? sum(s, (x) => Number(x.count) || 0) : null },
    { id: "bestHeld", label: "Best time in band", format: "seconds", qualifier: "group best", value: (s) => { const e = eligible(s, "count"); return e.length ? Math.max(...e.map((x) => Number(x.count))) : null; } },
  ],
  // Cock Mode's meaningful stat is the win/loss record, not reps — falling
  // through to SPECS.all would show a real avg pace (harmless, since count
  // is genuine reps here) but bury the actual point of the mode.
  cock: [
    { id: "duels", label: "Duels logged", format: "integer", qualifier: "total", value: (s) => s.length },
    { id: "wins", label: "Wins", format: "integer", qualifier: "total", value: (s) => { const e = s.filter((x) => x.cockResult === "win" || x.cockResult === "loss"); return e.length ? e.filter((x) => x.cockResult === "win").length : null; } },
    { id: "winRate", label: "Win rate", format: "percent", qualifier: "group rate", value: (s) => { const e = s.filter((x) => x.cockResult === "win" || x.cockResult === "loss"); return e.length ? e.filter((x) => x.cockResult === "win").length / e.length : null; } },
  ],
  holland: [
    { id: "workouts", label: "Holland workouts", format: "integer", qualifier: "total", value: (s) => s.length },
    { id: "totalCycles", label: "Total Holland cycles", format: "decimal", qualifier: "total", value: (s) => s.length ? sum(s, (x) => Number(x.hollandCycles) || 0) : null },
    { id: "bestCycles", label: "Best Holland cycles", format: "decimal", qualifier: "group best", value: (s) => s.length ? Math.max(...s.map((x) => Number(x.hollandCycles) || 0)) : null },
    { id: "holland27", label: "Holland 27 unlocked", format: "integer", qualifier: "total", value: (s) => s.filter((x) => x.hollandAchievement === "holland27").length },
  ],
};

export function modeStatsModel(sessions, mode) {
  const specs = SPECS[mode] || SPECS.all;
  const byUser = new Map();
  for (const session of sessions) {
    if (!session?.user) continue;
    if (!byUser.has(session.user)) byUser.set(session.user, []);
    byUser.get(session.user).push(session);
  }
  return specs.map((spec) => {
    const value = sessions.length ? spec.value(sessions) : null;
    const userValues = Array.from(byUser, ([user, userSessions]) => ({ user, value: spec.value(userSessions) }))
      .filter((entry) => entry.value != null && Number.isFinite(entry.value));
    const best = userValues.length ? Math.max(...userValues.map((entry) => entry.value)) : null;
    const leaders = best == null ? [] : userValues.filter((entry) => Math.abs(entry.value - best) < 1e-9).sort((a, b) => a.user.localeCompare(b.user));
    return { id: spec.id, label: spec.label, format: spec.format, qualifier: spec.qualifier, value, leaders, available: value != null && Number.isFinite(value) };
  });
}

function topByCount(counts) {
  const entries = Array.from(counts, ([user, value]) => ({ user, value }));
  const best = entries.length ? Math.max(...entries.map((e) => e.value)) : null;
  return best == null ? [] : entries.filter((e) => e.value === best).sort((a, b) => a.user.localeCompare(b.user));
}

// Cross-mode: how many logged sessions (within whatever mode+period slice is
// already on screen) carry a grip/incline modifier — hidden entirely when
// nobody's used one, same as any other spec whose value comes back null.
export function modifiersUsedStat(sessions) {
  const tagged = sessions.filter((s) => s?.user && s.modifier);
  const byUser = new Map();
  for (const s of tagged) byUser.set(s.user, (byUser.get(s.user) || 0) + 1);
  return {
    id: "modifiersUsed", label: "Modifiers used", format: "integer", qualifier: "total",
    value: tagged.length || null, leaders: topByCount(byUser), available: tagged.length > 0,
  };
}

// Cross-mode diversity: distinct exercise modes (pushup sub-modes, planks,
// squats, pull-ups, crunches, Holland) touched by the group, independent of
// whichever single leaderboard mode is currently selected — callers pass the
// full period-filtered session list (not the mode-filtered one) for this.
export function modesUsedStat(sessions) {
  const allModes = new Set();
  const byUser = new Map();
  for (const s of sessions) {
    if (!s?.user) continue;
    const modeId = sessionModeId(s);
    allModes.add(modeId);
    if (!byUser.has(s.user)) byUser.set(s.user, new Set());
    byUser.get(s.user).add(modeId);
  }
  const userCounts = new Map(Array.from(byUser, ([user, set]) => [user, set.size]));
  return {
    id: "modesUsed", label: "Modes used", format: "integer", qualifier: "group unique",
    value: allModes.size || null, leaders: topByCount(userCounts), available: allModes.size > 0,
  };
}
