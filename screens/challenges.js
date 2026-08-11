export function challengeWindow(challenge) {
  const [sy, sm, sd] = challenge.start.split("-").map(Number);
  const [ey, em, ed] = challenge.end.split("-").map(Number);
  return { startDate: new Date(sy, sm - 1, sd, 0, 0, 0, 0), endDate: new Date(ey, em - 1, ed, 23, 59, 59, 999) };
}
export function challengeStatus(challenge, now = new Date()) {
  const { startDate, endDate } = challengeWindow(challenge);
  return now < startDate ? "upcoming" : now > endDate ? "past" : "active";
}
export function daysLeft(challenge, now = new Date()) { return Math.max(0, Math.ceil((challengeWindow(challenge).endDate - now) / 86400000)); }
export function daysUntilStart(challenge, now = new Date()) { return Math.max(0, Math.ceil((challengeWindow(challenge).startDate - now) / 86400000)); }
export function formatChallengeDates(challenge, locale) {
  const { startDate, endDate } = challengeWindow(challenge);
  const fmt = (date) => date.toLocaleDateString(locale, { month: "short", day: "numeric" });
  return startDate.toDateString() === endDate.toDateString() ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}

export function challengeStatusLabel(challenge, now = new Date()) {
  const status = challengeStatus(challenge, now);
  if (status === "active") {
    const count = daysLeft(challenge, now);
    return `${count} day${count === 1 ? "" : "s"} left`;
  }
  if (status === "upcoming") {
    const count = daysUntilStart(challenge, now);
    return `Starts in ${count} day${count === 1 ? "" : "s"}`;
  }
  return "Ended";
}

export function challengeWindowProgress(challenge, now = new Date()) {
  const { startDate, endDate } = challengeWindow(challenge);
  if (now <= startDate) return 0;
  if (now >= endDate) return 100;
  return Math.round(((now - startDate) / (endDate - startDate)) * 100);
}

export function challengePrProgress(achievedCount, participantCount) {
  if (participantCount <= 0) return 0;
  return Math.min(100, Math.round((achievedCount / participantCount) * 100));
}

export function challengeOverviewStats(challenge, { participantCount, total, now = new Date(), locale, totalLabel = "Total pushups" } = {}) {
  const status = challengeStatus(challenge, now);
  const common = [
    { icon: "participants", label: "Participants", value: participantCount },
    { icon: "total", label: totalLabel, value: total },
  ];
  if (status === "active") return common;
  const overview = status === "past" ? { label: "Status", value: "Ended" } : { label: "Days until start", value: daysUntilStart(challenge, now) };
  return [
    { icon: "duration", label: "Duration", value: formatChallengeDates(challenge, locale) },
    ...common,
    { icon: "status", ...overview },
  ];
}

export function progressThermometerModel(current, goal) {
  const safeGoal = Math.max(1, goal);
  if (current <= safeGoal) return { segmented: false, percent: Math.min(100, Math.round((current / safeGoal) * 100)), won: current >= safeGoal };
  const goalPercent = Math.round((safeGoal / current) * 100);
  return { segmented: true, goalPercent, excessPercent: 100 - goalPercent };
}

export function challengeLeaderboardRows(board, goalType) {
  let nonAchieverRank = 0;
  return board.map((row, index) => ({
    ...row,
    topRank: index < 3 ? index + 1 : null,
    displayRank: goalType === "pr" ? (row.achieved ? "✓" : ++nonAchieverRank) : index + 1,
    rankIsCheck: goalType === "pr" && !!row.achieved,
  }));
}

export function recentChallengeSessions(sessions, timestampOf, limit = 5) {
  return [...sessions].sort((a, b) => timestampOf(b) - timestampOf(a)).slice(0, limit);
}

export function challengeActivityId(challenge) {
  return challenge?.goalType === "plankGauntlet" ? "planks" : (challenge?.activity || "pushups");
}

export function challengeShareContext(challenge, board, { formatNumber = String, formatDuration = String, locale, activityLabel = "pushups" } = {}) {
  const { endDate } = challengeWindow(challenge);
  const leader = board[0];
  const isRanked = challenge.goalType === "pr" || challenge.goalType === "plankGauntlet";
  const hasLeader = challenge.goalType === "pr" ? !!leader?.achieved : !!leader && leader.score > 0;
  return {
    titleWithEmoji: `${challenge.emoji} ${challenge.title}`,
    deadlineText: endDate.toLocaleDateString(locale, { month: "short", day: "numeric" }),
    goalAmountText: challenge.goalType === "streak" ? `${formatNumber(challenge.goal)}-day streak`
      : challenge.goalType === "pr" ? "a new personal record"
      : challenge.goalType === "plankGauntlet" ? "the longest plank grind"
      : `${formatNumber(challenge.goal)} ${activityLabel}`,
    hasLeader,
    leaderName: leader?.name,
    leaderScoreText: hasLeader ? (
      challenge.goalType === "streak" ? `${formatNumber(leader.score)} day${leader.score === 1 ? "" : "s"}`
        : challenge.goalType === "plankGauntlet" ? formatDuration(leader.score)
        : formatNumber(leader.score)
    ) : "",
    leaderPct: hasLeader ? (isRanked ? 100 : Math.round((leader.score / challenge.goal) * 100)) : 0,
    exceeded: !isRanked && hasLeader && leader.score >= challenge.goal,
  };
}
