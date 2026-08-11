export function weightedMultiplier(profile, bonusFactor = 2) {
  if (!profile?.bodyweightLbs || profile.bodyweightLbs <= 0) return 1;
  return (profile.bodyweightLbs + bonusFactor * Math.max(0, profile.addedWeightLbs || 0)) / profile.bodyweightLbs;
}

export function periodStart(period, now = new Date()) {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") {
    const day = dayStart.getDay();
    dayStart.setDate(dayStart.getDate() - (day === 0 ? 6 : day - 1));
  }
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "quarter") return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (period === "year") return new Date(now.getFullYear(), 0, 1);
  return dayStart;
}

export function filterByMode(sessions, mode) {
  if (mode === "planks") return sessions.filter((session) => session.type === "plank");
  if (mode === "pullups") return sessions.filter((session) => session.type === "pullup");
  if (mode === "squats") return sessions.filter((session) => session.type === "squat");
  if (mode === "situps") return sessions.filter((session) => session.type === "situp");
  if (mode === "all") return sessions.filter((session) => !session.type);
  if (mode === "classic") return sessions.filter((session) => !session.type && !session.mode);
  return sessions.filter((session) => !session.type && session.mode === mode);
}

export function computeStreakCore(sessions, now = new Date(), timestamp = (s) => Date.parse(s.timestamp)) {
  const daySet = new Set(sessions.map((session) => new Date(timestamp(session)).toDateString()));
  let earliest = null;
  for (const session of sessions) {
    const date = new Date(timestamp(session)); date.setHours(0, 0, 0, 0);
    if (earliest === null || date.getTime() < earliest) earliest = date.getTime();
  }
  let streak = 0; const restDays = []; let lastRestDay = null; const cursor = new Date(now);
  if (!daySet.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    if (daySet.has(cursor.toDateString())) { streak++; cursor.setDate(cursor.getDate() - 1); continue; }
    const start = new Date(cursor); start.setHours(0, 0, 0, 0);
    if (earliest === null || start.getTime() < earliest) break;
    const daysSinceRest = lastRestDay ? (lastRestDay.getTime() - cursor.getTime()) / 86400000 : Infinity;
    if (!(streak > 0 && daysSinceRest >= 7)) break;
    streak++; restDays.push(new Date(cursor)); lastRestDay = new Date(cursor); cursor.setDate(cursor.getDate() - 1);
  }
  return { streak, restDays };
}

export function computeUserStats(sessions, now = new Date(), timestamp) {
  if (!sessions.length) return { streak: 0, allTime: 0, best: 0, avg: 0, count: 0 };
  const allTime = sessions.reduce((sum, session) => sum + session.count, 0);
  return { streak: computeStreakCore(sessions, now, timestamp).streak, allTime, best: Math.max(...sessions.map((s) => s.count)), avg: Math.round(allTime / sessions.length), count: sessions.length };
}

export function bestFor(sessions, user, predicate = () => true, field = "count") {
  return sessions.filter((s) => s.user === user && predicate(s)).reduce((max, s) => Math.max(max, s[field] || 0), 0);
}
