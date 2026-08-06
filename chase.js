export const CHASE_PERIODS = [
  { id: "day", label: "Daily" },
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
  { id: "quarter", label: "Quarterly" },
  { id: "year", label: "Annual" },
];

function startOfPeriod(id, now) {
  const d = new Date(now);
  if (id === "day") return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (id === "week") {
    const mondayOffset = (d.getDay() + 6) % 7;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayOffset).getTime();
  }
  if (id === "quarter") return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).getTime();
  if (id === "year") return new Date(d.getFullYear(), 0, 1).getTime();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function buildChasePlan(sessions, currentUser, now = new Date()) {
  const stages = CHASE_PERIODS.map((period) => {
    const startMs = startOfPeriod(period.id, now);
    const totals = new Map();
    for (const session of sessions || []) {
      if (!session || session.type === "plank" || !session.user) continue;
      const timestamp = new Date(session.timestamp).getTime();
      if (!Number.isFinite(timestamp) || timestamp < startMs) continue;
      const score = Number(session.count) || 0;
      totals.set(session.user, (totals.get(session.user) || 0) + score);
    }
    const userBase = totals.get(currentUser) || 0;
    const rivals = Array.from(totals.entries()).filter(([name]) => name !== currentUser);
    const leaderScore = rivals.length ? Math.max(...rivals.map(([, score]) => score)) : null;
    const leaderNames = leaderScore == null
      ? []
      : rivals.filter(([, score]) => score === leaderScore).map(([name]) => name).sort();
    const pointsNeeded = leaderScore == null ? 0 : Math.max(0, leaderScore - userBase + 1);
    return {
      ...period,
      startMs,
      userBase,
      leaderScore,
      leaderNames,
      pointsNeeded,
      chaseable: pointsNeeded > 0,
    };
  });
  // A Chase is one story: lock the first board the user does not lead and
  // keep that rival/score snapshot for the whole workout.
  const target = stages.find((stage) => stage.chaseable) || null;
  return { createdAt: new Date(now).toISOString(), user: currentUser, stages, target };
}

export function chaseProgress(plan, creditedPoints) {
  const points = Math.max(0, Number(creditedPoints) || 0);
  const targetId = plan.target?.id || plan.stages.find((stage) => stage.chaseable)?.id;
  const stages = plan.stages.map((stage) => ({
    ...stage,
    status: !stage.chaseable ? "already-led" : stage.id === targetId && points >= stage.pointsNeeded ? "passed" : "pending",
    remaining: stage.id === targetId ? Math.max(0, stage.pointsNeeded - points) : stage.pointsNeeded,
    lead: stage.leaderScore == null ? 0 : stage.userBase + points - stage.leaderScore,
  }));
  const target = stages.find((stage) => stage.id === targetId) || null;
  const complete = !!target && target.status === "passed";
  return { points, stages, target, current: complete ? null : target, finalStage: target, complete };
}

export function crossedLeadMilestone(previousLead, currentLead) {
  const candidates = [1, 5, 10];
  for (let n = 20; n <= currentLead; n += 10) candidates.push(n);
  return candidates.filter((n) => previousLead < n && currentLead >= n).pop() || 0;
}
