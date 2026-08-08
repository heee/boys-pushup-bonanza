export const EXPLORE_MODES = [
  { id: "classic", icon: "💪", title: "Classic", tagline: "Straight sets, no gimmicks", live: true },
  { id: "countdown", icon: "⏱️", title: "Countdown", tagline: "Beat your own personal best", live: true },
  { id: "cards", icon: "🃏", title: "Cards", tagline: "Flip a card, match the move", live: true },
  { id: "dice", icon: "🎲", title: "Dice roll", tagline: "Hit the number before next roll", live: true },
  { id: "plank", icon: "🪵", title: "Plank", tagline: "Hold your ground, beat your own time", live: true },
  { id: "squat", icon: "🦵", title: "Squat", tagline: "Camera-counted squats, beat your own reps", live: true },
  { id: "ladder", icon: "🪜", title: "Ladder", tagline: "Climb the ladder, cash out anytime", live: true },
  { id: "fortune", icon: "🥠", title: "Fortune cookie", tagline: "One set, one revealed challenge", live: true },
  { id: "chase", icon: "👑", title: "Chase the leader", tagline: "Hunt the first board you don't already lead", live: true },
  { id: "poker", icon: "♠️", title: "Poker hands", tagline: "Clear five cards, reveal your hand", live: true },
  { id: "wheel", icon: "🎯", title: "Wheel of pain", tagline: "Spin after every set for your next number", live: true },
  { id: "boss", icon: "⚔️", title: "Boss battle", tagline: "Fight progressively harder bosses", live: false },
  { id: "sharpshooter", icon: "🏹", title: "Sharpshooter", tagline: "Destroy adaptive targets, one bullseye at a time", live: true },
  { id: "pyramid", icon: "🔺", title: "Pyramid", tagline: "Descend the base, conquer the apex", live: true },
  { id: "zen", icon: "🧘", title: "Zen Mode", tagline: "No counters, no noise — just push", live: true },
];

function usageByMode(sessions) {
  const counts = new Map();
  for (const session of sessions) {
    const id = session.type === "plank" ? "plank" : session.type === "squat" ? "squat" : (session.mode || "classic");
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
}

// Plank and Squat are whole separate activities, not pushup modes — they get
// their own "Other exercises" bucket below the "Pushups" bucket.
const OTHER_EXERCISE_IDS = new Set(["plank", "squat"]);

function orderBucket(bucket) {
  const playable = bucket.filter((item) => item.playable).sort((a, b) => {
    if (a.mode.id === "chase") return -1;
    if (b.mode.id === "chase") return 1;
    return b.usage - a.usage || a.index - b.index;
  });
  const locked = bucket.filter((item) => item.mode.live && !item.playable).sort((a, b) => a.index - b.index);
  const roadmap = bucket.filter((item) => !item.mode.live).sort((a, b) => a.index - b.index);
  return [...playable, ...locked, ...roadmap];
}

export function exploreModesModel({ sessions, hasPR, refresh, chasePrepared, chaseLeaderLabel }) {
  const usage = usageByMode(sessions);
  const decorated = EXPLORE_MODES.map((mode, index) => {
    const lockedForPR = (mode.id === "countdown" || mode.id === "wheel") && !hasPR;
    const checkingChase = mode.id === "chase" && refresh;
    const lockedForChase = mode.id === "chase" && chasePrepared && !chasePrepared.eligible;
    const playable = mode.live && !lockedForPR && !lockedForChase && !checkingChase;
    let tagline = mode.tagline;
    if (mode.id === "chase" && chasePrepared?.first) {
      const first = chasePrepared.first;
      tagline = `${first.pointsNeeded} point${first.pointsNeeded === 1 ? "" : "s"} to pass ${chaseLeaderLabel(first)} on ${first.label.toLowerCase()}${chasePrepared.offline ? " · offline target" : ""}`;
    }
    const status = checkingChase ? "Checking…" : lockedForChase ? "You’re leading every board" : lockedForPR ? "Log a session first" : "Coming soon";
    const section = OTHER_EXERCISE_IDS.has(mode.id) ? "other" : "pushups";
    return { mode, index, playable, tagline, status, section, usage: usage.get(mode.id) || 0 };
  });
  const pushups = orderBucket(decorated.filter((item) => item.section === "pushups"));
  const other = orderBucket(decorated.filter((item) => item.section === "other"));
  return [...pushups, ...other];
}
