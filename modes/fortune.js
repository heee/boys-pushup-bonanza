const DIFFICULTY_WEIGHTS = { 1: 50, 2: 35, 3: 15 };
const COOLDOWN_WORKOUTS = 3;

export const FORTUNE_CHALLENGES = [
  { id: "perfect_form", title: "PERFECT FORM", lines: ["Clean reps only"], category: "technique", difficulty: 1 },
  { id: "full_depth", title: "FULL DEPTH", lines: ["Chest low every rep"], category: "technique", difficulty: 1 },
  { id: "lock_it_out", title: "LOCK IT OUT", lines: ["Finish every rep"], category: "technique", difficulty: 1 },
  { id: "straight_line", title: "STRAIGHT LINE", lines: ["Brace from head to heel"], category: "technique", difficulty: 1 },
  { id: "slow_descent", title: "SLOW DESCENT", lines: ["3 seconds down", "Every rep"], category: "tempo", difficulty: 2 },
  { id: "pause_bottom", title: "PAUSE", lines: ["1 second at the bottom"], category: "tempo", difficulty: 2 },
  { id: "controlled_reps", title: "CONTROLLED REPS", lines: ["No rushing"], category: "tempo", difficulty: 1 },
  { id: "explode_up", title: "EXPLODE UP", lines: ["Control down", "Press fast"], category: "tempo", difficulty: 2 },
  { id: "wide_grip", title: "WIDE GRIP", lines: ["Hands outside shoulders"], category: "grip", difficulty: 1 },
  { id: "close_grip", title: "CLOSE GRIP", lines: ["Hands inside shoulders"], category: "grip", difficulty: 1 },
  { id: "diamond_grip", title: "DIAMOND GRIP", lines: ["Keep form clean"], category: "grip", difficulty: 2 },
  { id: "staggered_grip", title: "STAGGERED GRIP", lines: ["One hand forward"], category: "grip", difficulty: 2, staggered: true },
  { id: "no_looking", title: "NO LOOKING", lines: ["Counter stays hidden"], category: "awareness", difficulty: 2, hideCounter: true },
  { id: "silent_set", title: "SILENT SET", lines: ["No counter", "Just push"], category: "awareness", difficulty: 2, hideCounter: true, minimalFeedback: true },
  { id: "one_more", title: "ONE MORE", lines: ["Beat your last set by 1"], category: "progression", difficulty: 3, targetOffset: 1, baseline: "last" },
  { id: "beat_yesterday", title: "BEAT YESTERDAY", lines: ["One rep more"], category: "progression", difficulty: 3, targetOffset: 1, baseline: "yesterday" },
  { id: "match_your_best", title: "MATCH YOUR BEST", lines: ["Reach your current record"], category: "progression", difficulty: 3, targetOffset: 0, baseline: "best" },
  { id: "leave_one", title: "LEAVE ONE", lines: ["Stop with 1 good rep left"], category: "awareness", difficulty: 1 },
  { id: "no_long_stops", title: "KEEP MOVING", lines: ["No long pauses"], category: "tempo", difficulty: 1 },
  { id: "breathe_steady", title: "BREATHE STEADY", lines: ["No breath holding"], category: "awareness", difficulty: 1 },
];

function baselineFor(challenge, sessions, now) {
  if (!challenge.baseline) return null;
  if (challenge.baseline === "last") return sessions.length ? sessions[sessions.length - 1].count : null;
  if (challenge.baseline === "best") {
    const best = sessions.reduce((max, session) => Math.max(max, session.count), 0);
    return best || null;
  }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
  const yesterday = sessions.filter((session) => {
    const timestamp = new Date(session.timestamp);
    return timestamp >= start && timestamp <= end;
  });
  return yesterday.length ? yesterday[yesterday.length - 1].count : null;
}

function nextGripSide(sessions, random) {
  const past = sessions.filter((session) => session.mode === "fortune" && session.fortuneChallengeId === "staggered_grip" && session.fortuneGripSide);
  const left = past.filter((session) => session.fortuneGripSide === "left").length;
  const right = past.length - left;
  if (left === right) return random() < 0.5 ? "left" : "right";
  return left < right ? "left" : "right";
}

export function pickFortuneChallenge(sessions, { random = Math.random, now = new Date(), excludedCategories = [] } = {}) {
  const fortuneHistory = sessions.filter((session) => session.mode === "fortune");
  const lastId = fortuneHistory.at(-1)?.fortuneChallengeId || null;
  const recentIds = new Set(fortuneHistory.slice(-COOLDOWN_WORKOUTS).map((session) => session.fortuneChallengeId));
  const eligible = FORTUNE_CHALLENGES
    .map((challenge) => ({ challenge, baseline: baselineFor(challenge, sessions, now) }))
    .filter(({ challenge, baseline }) => (!challenge.baseline || baseline != null) && challenge.id !== lastId)
    .filter(({ challenge }) => !excludedCategories.includes(challenge.category));
  const fresh = eligible.filter(({ challenge }) => !recentIds.has(challenge.id));
  const pool = fresh.length ? fresh : eligible;
  if (!pool.length) return null;
  const tiers = [1, 2, 3].filter((difficulty) => pool.some(({ challenge }) => challenge.difficulty === difficulty));
  let weightedPick = random() * tiers.reduce((sum, difficulty) => sum + DIFFICULTY_WEIGHTS[difficulty], 0);
  let chosenTier = tiers.at(-1);
  for (const difficulty of tiers) {
    if (weightedPick < DIFFICULTY_WEIGHTS[difficulty]) { chosenTier = difficulty; break; }
    weightedPick -= DIFFICULTY_WEIGHTS[difficulty];
  }
  const tierPool = pool.filter(({ challenge }) => challenge.difficulty === chosenTier);
  const picked = tierPool[Math.floor(random() * tierPool.length)];
  return {
    challenge: picked.challenge,
    baseline: picked.baseline,
    target: picked.baseline != null ? picked.baseline + (picked.challenge.targetOffset || 0) : null,
    gripSide: picked.challenge.staggered ? nextGripSide(sessions, random) : null,
  };
}
