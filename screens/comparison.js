import { modeStatsModel } from "./mode-stats.js?v=138";
import { computeStreakCore, filterByMode } from "../stats.js";

function total(sessions) {
  return sessions.reduce((sum, session) => sum + (Number(session.count) || 0), 0);
}

function overallMetrics(allSessions, periodSessions, user, now) {
  const globalMine = filterByMode(allSessions, "all").filter((session) => session.user === user);
  const mine = periodSessions.filter((session) => session.user === user);
  const sum = total(mine);
  return [
    { id: "streak", label: "Streak", format: "integer", value: computeStreakCore(globalMine, now).streak, available: true },
    { id: "total", label: "Total", format: "integer", value: sum, available: mine.length > 0 },
    { id: "best", label: "Best set", format: "integer", value: mine.length ? Math.max(...mine.map((session) => Number(session.count) || 0)) : null, available: mine.length > 0 },
    { id: "avg", label: "Avg / session", format: "integer", value: mine.length ? sum / mine.length : null, available: mine.length > 0 },
    { id: "sessions", label: "Sessions", format: "integer", value: mine.length, available: mine.length > 0 },
  ];
}

function userModeMetrics(periodSessions, mode, user) {
  return modeStatsModel(periodSessions.filter((session) => session.user === user), mode)
    .map(({ id, label, format, value, available }) => ({ id, label, format, value, available }));
}

export function comparisonModel(allSessions, { userA, userB, mode = "all", periodStartMs = 0, now = new Date() }) {
  const typed = filterByMode(allSessions, mode);
  const periodSessions = typed.filter((session) => new Date(session.timestamp).getTime() >= periodStartMs);
  const hasSessions = periodSessions.some((session) => session.user === userA || session.user === userB);
  if (!hasSessions) return { empty: true, rows: [], aWins: 0, bWins: 0, denominator: 0 };

  const aMetrics = mode === "all"
    ? overallMetrics(allSessions, periodSessions, userA, now)
    : userModeMetrics(periodSessions, mode, userA);
  const bMetrics = mode === "all"
    ? overallMetrics(allSessions, periodSessions, userB, now)
    : userModeMetrics(periodSessions, mode, userB);

  let aWins = 0;
  let bWins = 0;
  let denominator = 0;
  const rows = aMetrics.map((aMetric, index) => {
    const bMetric = bMetrics[index];
    const comparable = aMetric.available && bMetric.available;
    const aValue = aMetric.available ? aMetric.value : null;
    const bValue = bMetric.available ? bMetric.value : null;
    const tied = comparable && Math.abs(aValue - bValue) < 1e-9;
    const aWinner = comparable && !tied && aValue > bValue;
    const bWinner = comparable && !tied && bValue > aValue;
    if (comparable) denominator++;
    if (aWinner) aWins++;
    if (bWinner) bWins++;
    const max = comparable ? Math.max(aValue, bValue) : Math.max(aValue || 0, bValue || 0);
    return {
      id: aMetric.id,
      label: aMetric.label,
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
  return { empty: false, rows, aWins, bWins, denominator };
}
