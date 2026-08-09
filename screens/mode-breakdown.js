// Ranked "which mode dominates" breakdown for the Bonanza stats screen.
// Plank sessions track hold-time in seconds, not reps, so they're excluded
// to avoid mixing units into the same reps bar. Squat and Situp sessions are
// their own buckets here even though they're deliberately kept out of the
// shared leaderboard-mode index elsewhere (see docs/squat-mode-plan.md and
// docs/situp-mode-plan.md).
export const STATS_MODES = [
  { id: "classic", label: "Classic" },
  { id: "countdown", label: "Countdown" },
  { id: "cards", label: "Cards" },
  { id: "poker", label: "Poker" },
  { id: "dice", label: "Dice" },
  { id: "ladder", label: "Ladder" },
  { id: "fortune", label: "Fortune" },
  { id: "chase", label: "Chase" },
  { id: "sharpshooter", label: "Sharpshooter" },
  { id: "pyramid", label: "Pyramid" },
  { id: "wheel", label: "Wheel of pain" },
  { id: "zen", label: "Zen Mode" },
  { id: "squat", label: "Squat" },
  { id: "situp", label: "Situp" },
];

const LABEL_BY_ID = new Map(STATS_MODES.map((mode) => [mode.id, mode.label]));

export function modeBreakdownModel(sessions) {
  const byMode = new Map();
  for (const session of sessions) {
    if (session.type === "plank") continue;
    const id = session.type === "squat" ? "squat" : session.type === "situp" ? "situp" : (session.mode || "classic");
    if (!LABEL_BY_ID.has(id)) continue;
    if (!byMode.has(id)) byMode.set(id, { reps: 0, sessions: 0, users: new Set() });
    const bucket = byMode.get(id);
    bucket.reps += Number(session.count) || 0;
    bucket.sessions += 1;
    if (session.user) bucket.users.add(session.user);
  }
  return Array.from(byMode, ([id, bucket]) => ({
    id,
    label: LABEL_BY_ID.get(id),
    reps: bucket.reps,
    sessions: bucket.sessions,
    users: bucket.users.size,
  }))
    .filter((row) => row.reps > 0)
    .sort((a, b) => b.reps - a.reps);
}
