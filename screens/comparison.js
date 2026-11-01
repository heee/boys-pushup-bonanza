import { modeStatsModel, modesUsedStat, exerciseTypesUsedStat, PACE_TARGET } from "./mode-stats.js?v=147";
import { computeStreakCore, filterByMode } from "../stats.js";

// Head-to-head: two people's numbers for the same mode + period, grouped
// (Consistency / Volume / Peak / Variety on "All"; Consistency + the mode's
// own stats otherwise; Rivalry whenever they've played Horse or Tug of War
// against each other). Each row carries an icon id for challengeStatIconHTML.

const VALID_SESSION_MAX_MS = 30 * 60 * 1000;

function total(sessions) {
  return sessions.reduce((sum, session) => sum + (Number(session.count) || 0), 0);
}

function durationMs(session) {
  if (!session?.startedAt) return null;
  const ms = new Date(session.timestamp) - new Date(session.startedAt);
  return ms > 0 && ms < VALID_SESSION_MAX_MS ? ms : null;
}

function activeDays(sessions) {
  return new Set(sessions.map((session) => new Date(session.timestamp).toDateString())).size;
}

function toMs(value) {
  if (typeof value === "number") return value;
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function lastActivityAt(game, list) {
  const items = game[list];
  return toMs(items?.length ? items[items.length - 1].at : game.startedAt ?? game.createdAt);
}

// Completed Horse/Tug of War games the two played against each other (Tug of
// War only counts when they were on opposite teams), won inside the period.
export function rivalryRecord({ horseGames = [], towGames = [] }, userA, userB, periodStartMs = 0) {
  const horse = { a: 0, b: 0, played: 0 };
  for (const game of horseGames) {
    if (game?.status !== "complete" || !game.turnOrder?.includes(userA) || !game.turnOrder.includes(userB)) continue;
    if (lastActivityAt(game, "sets") < periodStartMs) continue;
    horse.played++;
    const winners = Array.isArray(game.winner) ? game.winner : [];
    const aWon = winners.includes(userA);
    const bWon = winners.includes(userB);
    if (aWon && !bWon) horse.a++;
    if (bWon && !aWon) horse.b++;
  }
  const tow = { a: 0, b: 0, played: 0 };
  for (const game of towGames) {
    if (game?.status !== "complete" || !game.teams) continue;
    const teamOf = (user) => (game.teams.a?.players?.includes(user) ? "a" : game.teams.b?.players?.includes(user) ? "b" : null);
    const aTeam = teamOf(userA);
    const bTeam = teamOf(userB);
    if (!aTeam || !bTeam || aTeam === bTeam) continue;
    if (lastActivityAt(game, "bursts") < periodStartMs) continue;
    tow.played++;
    if (game.winner === aTeam) tow.a++;
    if (game.winner === bTeam) tow.b++;
  }
  return { horse, tow };
}

function consistencyMetrics(allSessions, typedPeriod, user, now) {
  const mine = typedPeriod.filter((session) => session.user === user);
  const careerMine = filterByMode(allSessions, "all").filter((session) => session.user === user);
  return [
    { id: "streak", label: "Current streak", icon: "flame", format: "integer", value: computeStreakCore(careerMine, now).streak, available: true },
    { id: "activeDays", label: "Active days", icon: "duration", format: "integer", value: activeDays(mine), available: mine.length > 0 },
    { id: "sessions", label: "Sessions", icon: "hash", format: "integer", value: mine.length, available: mine.length > 0 },
  ];
}

function volumeMetrics(typedPeriod, user) {
  const mine = typedPeriod.filter((session) => session.user === user);
  const sum = total(mine);
  const times = mine.map(durationMs).filter((ms) => ms != null);
  return [
    { id: "total", label: "Total reps", icon: "total", format: "integer", value: sum, available: mine.length > 0 },
    { id: "avg", label: "Avg / session", icon: "trend", format: "integer", value: mine.length ? sum / mine.length : null, available: mine.length > 0 },
    { id: "time", label: "Workout time", icon: "time", format: "duration", value: times.length ? times.reduce((a, b) => a + b, 0) : null, available: times.length > 0 },
  ];
}

function peakMetrics(typedPeriod, user) {
  const mine = typedPeriod.filter((session) => session.user === user);
  const pace = modeStatsModel(mine, "all").find((metric) => metric.id === "avgPace");
  return [
    { id: "best", label: "Best set", icon: "award", format: "integer", value: mine.length ? Math.max(...mine.map((session) => Number(session.count) || 0)) : null, available: mine.length > 0 },
    { id: "pace", label: pace.label, icon: "pace", format: "pace", value: pace.value, available: pace.available, target: PACE_TARGET },
  ];
}

function varietyMetrics(allPeriod, user) {
  const mine = allPeriod.filter((session) => session.user === user);
  const modes = modesUsedStat(mine);
  const types = exerciseTypesUsedStat(mine);
  return [
    { id: "modesUsed", label: "Pushup modes used", icon: "shuffle", format: "integer", value: modes.value, available: modes.available },
    { id: "exerciseTypes", label: "Exercise types", icon: "layers", format: "integer", value: types.value, available: types.available },
  ];
}

const ICON_BY_FORMAT = { integer: "total", duration: "time", seconds: "time", pace: "pace", percent: "percent", decimal: "trend", decimalPoints: "trend", pokerHand: "award" };

function modeMetrics(typedPeriod, mode, user) {
  return modeStatsModel(typedPeriod.filter((session) => session.user === user), mode)
    .map(({ id, label, format, value, available, qualifier, leaderTarget }) => ({
      id, label, format, value, available,
      icon: qualifier === "group best" ? "award" : ICON_BY_FORMAT[format] || "total",
      target: leaderTarget,
    }));
}

// a/b metric lists (same order) → comparison rows. A row with a target
// (pace) is won by whoever is closer to it, not the bigger number.
function compareRows(aMetrics, bMetrics) {
  return aMetrics.map((aMetric, index) => {
    const bMetric = bMetrics[index];
    const comparable = aMetric.available && bMetric.available;
    const aValue = aMetric.available ? aMetric.value : null;
    const bValue = bMetric.available ? bMetric.value : null;
    const score = aMetric.target == null ? (v) => v : (v) => -Math.abs(v - aMetric.target);
    const tied = comparable && Math.abs(score(aValue) - score(bValue)) < 1e-9;
    const aWinner = comparable && !tied && score(aValue) > score(bValue);
    const bWinner = comparable && !tied && score(bValue) > score(aValue);
    const max = Math.max(aValue || 0, bValue || 0);
    return {
      id: aMetric.id,
      label: aMetric.label,
      icon: aMetric.icon,
      format: aMetric.format,
      aValue,
      bValue,
      comparable,
      tied,
      aWinner,
      bWinner,
      aPercent: max > 0 && aValue != null ? (aValue / max) * 100 : 0,
      bPercent: max > 0 && bValue != null ? (bValue / max) * 100 : 0,
    };
  });
}

function rivalryRows(record) {
  const rows = [];
  for (const [id, label, r] of [["horse", "Horse wins", record.horse], ["tow", "Tug of War wins", record.tow]]) {
    if (!r.played) continue;
    rows.push(...compareRows(
      [{ id: `${id}Wins`, label, icon: "award", format: "integer", value: r.a, available: true }],
      [{ id: `${id}Wins`, label, icon: "award", format: "integer", value: r.b, available: true }],
    ));
  }
  return rows;
}

export function comparisonModel(allSessions, { userA, userB, mode = "all", modeLabel = "", periodStartMs = 0, now = new Date(), games = {} }) {
  const inPeriod = (session) => new Date(session.timestamp).getTime() >= periodStartMs;
  const allPeriod = allSessions.filter(inPeriod);
  const typedPeriod = filterByMode(allSessions, mode).filter(inPeriod);
  const hasSessions = typedPeriod.some((session) => session.user === userA || session.user === userB);
  const rivalry = rivalryRows(rivalryRecord(games, userA, userB, periodStartMs));
  if (!hasSessions && !rivalry.length) return { empty: true, groups: [], rows: [], aWins: 0, bWins: 0, denominator: 0 };

  const pair = (build) => compareRows(build(userA), build(userB));
  const groups = [];
  if (hasSessions) {
    groups.push({ id: "consistency", label: "Consistency", rows: pair((user) => consistencyMetrics(allSessions, typedPeriod, user, now)) });
    if (mode === "all") {
      groups.push({ id: "volume", label: "Volume", rows: pair((user) => volumeMetrics(typedPeriod, user)) });
      groups.push({ id: "peak", label: "Peak", rows: pair((user) => peakMetrics(typedPeriod, user)) });
      groups.push({ id: "variety", label: "Variety", rows: pair((user) => varietyMetrics(allPeriod, user)) });
    } else {
      groups.push({ id: "mode", label: modeLabel || "Mode", rows: pair((user) => modeMetrics(typedPeriod, mode, user)) });
    }
  }
  if (rivalry.length) groups.push({ id: "rivalry", label: "Rivalry", rows: rivalry });

  // Rows neither person has a value for add nothing — drop them, then any
  // group left empty.
  for (const group of groups) group.rows = group.rows.filter((row) => row.aValue != null || row.bValue != null);
  const visible = groups.filter((group) => group.rows.length);
  const rows = visible.flatMap((group) => group.rows);
  const aWins = rows.filter((row) => row.aWinner).length;
  const bWins = rows.filter((row) => row.bWinner).length;
  const denominator = rows.filter((row) => row.comparable).length;
  return { empty: false, groups: visible, rows, aWins, bWins, denominator };
}
