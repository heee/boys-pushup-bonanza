export function personalStatsModel(sessions, streak) {
  if (!sessions.length) return null;
  const allTimeTotal = sessions.reduce((sum, session) => sum + session.count, 0);
  return {
    streak,
    allTimeTotal,
    personalBest: Math.max(...sessions.map((session) => session.count)),
    avgPerSession: Math.round(allTimeTotal / sessions.length),
    sessionCount: sessions.length,
  };
}
