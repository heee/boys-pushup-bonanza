export function personalStatsModel(sessions, streak, metricOf = (session) => session.count, round = true) {
  if (!sessions.length) return null;
  const allTimeTotal = sessions.reduce((sum, session) => sum + (Number(metricOf(session)) || 0), 0);
  const avg = allTimeTotal / sessions.length;
  return {
    streak,
    allTimeTotal,
    personalBest: Math.max(...sessions.map((session) => Number(metricOf(session)) || 0)),
    avgPerSession: round ? Math.round(avg) : avg,
    sessionCount: sessions.length,
  };
}
