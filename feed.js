// Activity Feed (docs/activity-feed-plan.md) — pure model, no DOM. Builds
// the Home feed's items from data /data already returns, plus reaction
// helpers. Every item id is stable across rebuilds: it's the key reactions
// are stored under.
import { expandHollandProjections, periodStart } from "./stats.js?v=2";
import { streakSeries } from "./screens/trophies.js?v=2";

export const FEED_REACTIONS = Object.freeze(["💪", "🔥", "😂", "👑", "😤", "👏", "💀", "🫡", "🐐", "🤡", "😮"]);
export const BURST_GAP_MS = 2 * 60 * 60 * 1000;
export const LIFETIME_MILESTONES = Object.freeze([1000, 5000, 10000, 25000, 50000, 100000]);
export const STREAK_MILESTONES = Object.freeze([7, 30, 50, 100, 365]);

// Same buckets as app.js sessionActivity().
export function feedExercise(s) {
  const byType = { plank: "planks", deadhang: "deadhang", grip: "grip", pullup: "pullups", squat: "squats", situp: "situps", holland: "holland", chainofpain: "chainofpain", kettlebell: "kettlebell" };
  return byType[s.type] || "pushups";
}

const PR_EXERCISES = new Set(["pushups", "squats", "situps", "pullups", "planks", "deadhang", "grip"]);
const prEligible = (s) => PR_EXERCISES.has(feedExercise(s)) && s.mode !== "pulse" && !s.chainOfPainSourceId && !s.hollandSourceId;
const pushupReps = (s) => (s.mode === "pulse" ? Number(s.pulseReps) || 0 : Number(s.count) || 0);
const MILESTONE_POOLS = {
  pushups: (s) => !s.type,
  squats: (s) => s.type === "squat",
  situps: (s) => s.type === "situp",
  pullups: (s) => s.type === "pullup",
  grip: (s) => s.type === "grip",
};

export function localDayKey(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "Today" / "Yesterday" / "Tue, Nov 24" (year added when it isn't this year).
export function feedDayLabel(t, now = Date.now()) {
  const key = localDayKey(t);
  if (key === localDayKey(now)) return "Today";
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (key === localDayKey(y)) return "Yesterday";
  const d = new Date(t);
  const opts = { weekday: "short", month: "short", day: "numeric" };
  if (d.getFullYear() !== new Date(now).getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts);
}

function byUser(sessions) {
  const map = new Map();
  for (const s of sessions) {
    if (!map.has(s.user)) map.set(s.user, []);
    map.get(s.user).push(s);
  }
  return map;
}

function lastAt(list, fallback) {
  return (list || []).reduce((max, x) => Math.max(max, Number(x?.at) || 0), Number(fallback) || 0);
}

// Per-user highlights derived from that user's own history.
function userHighlights(user, list, ts, trophyThresholds) {
  const items = [];
  const consumed = new Set();
  const best = new Map();
  for (const s of list) {
    if (s.mode === "cock" && s.cockResult === "win") {
      items.push({ id: `ck:${s.id}`, kind: "cock", at: ts(s), owners: [user], user, session: s });
      consumed.add(s);
    }
    if (!prEligible(s)) continue;
    const ex = feedExercise(s);
    const value = Number(s.count) || 0;
    const prev = best.get(ex);
    if (prev !== undefined && value > prev && !consumed.has(s)) {
      items.push({ id: `pr:${s.id}`, kind: "pr", at: ts(s), owners: [user], user, session: s, exercise: ex, value, previous: prev });
      consumed.add(s);
    }
    best.set(ex, Math.max(prev ?? 0, value));
  }

  const pool = expandHollandProjections(list);
  for (const [ex, inPool] of Object.entries(MILESTONE_POOLS)) {
    const skip = new Set(trophyThresholds?.[ex] || []);
    const targets = LIFETIME_MILESTONES.filter((m) => !skip.has(m));
    let total = 0;
    let next = 0;
    for (const s of pool) {
      if (!inPool(s)) continue;
      total += ex === "pushups" ? pushupReps(s) : Number(s.count) || 0;
      while (next < targets.length && total >= targets[next]) {
        items.push({ id: `ms:${user}:${ex}:${targets[next]}`, kind: "milestone", at: ts(s), owners: [user], user, exercise: ex, value: targets[next] });
        next++;
      }
    }
  }

  const streakSkip = new Set(trophyThresholds?.streak || []);
  const series = streakSeries(list, ts);
  for (const days of STREAK_MILESTONES) {
    if (streakSkip.has(days)) continue;
    const hit = series.find((p) => p.v >= days);
    if (hit) items.push({ id: `st:${user}:${days}`, kind: "streak", at: hit.t, owners: [user], user, value: days });
  }
  return { items, consumed };
}

// Same person + same exercise, each set within BURST_GAP_MS of the last.
function sessionBursts(sessions, ts) {
  const open = new Map();
  const bursts = [];
  for (const s of sessions) {
    const key = `${s.user}\0${feedExercise(s)}`;
    const t = ts(s);
    const current = open.get(key);
    if (current && t - current.lastAt <= BURST_GAP_MS) {
      current.sessions.push(s);
      current.lastAt = t;
      continue;
    }
    const burst = { sessions: [s], lastAt: t };
    open.set(key, burst);
    bursts.push(burst);
  }
  return bursts.map((b) => ({
    id: `s:${b.sessions[0].id}`, kind: "sessions", at: b.lastAt, owners: [b.sessions[0].user], user: b.sessions[0].user,
    exercise: feedExercise(b.sessions[0]), sessions: b.sessions,
  }));
}

// Daily / weekly #1 by pushup reps, once the period is over, ≥2 members active.
function leaderItems(sessions, ts, groupId, now) {
  const pool = expandHollandProjections(sessions).filter((s) => !s.type);
  const todayStart = periodStart("day", new Date(now)).getTime();
  const weekStart = periodStart("week", new Date(now)).getTime();
  const days = new Map();
  const weeks = new Map();
  for (const s of pool) {
    const t = ts(s);
    const reps = pushupReps(s);
    if (reps <= 0) continue;
    if (t < todayStart) {
      const key = periodStart("day", new Date(t)).getTime();
      if (!days.has(key)) days.set(key, new Map());
      days.get(key).set(s.user, (days.get(key).get(s.user) || 0) + reps);
    }
    if (t < weekStart) {
      const key = periodStart("week", new Date(t)).getTime();
      if (!weeks.has(key)) weeks.set(key, new Map());
      weeks.get(key).set(s.user, (weeks.get(key).get(s.user) || 0) + reps);
    }
  }
  const items = [];
  const emit = (map, kind, prefix, endOf) => {
    for (const [start, totals] of map) {
      if (totals.size < 2) continue;
      const top = Math.max(...totals.values());
      const winners = [...totals].filter(([, v]) => v === top).map(([name]) => name).sort();
      items.push({ id: `${prefix}:${groupId}:${localDayKey(start)}`, kind, at: endOf(start), owners: winners, winners, value: top, periodStart: start, field: totals.size });
    }
  };
  emit(days, "daily1", "d1", (start) => { const d = new Date(start); d.setDate(d.getDate() + 1); return d.getTime() - 1; });
  emit(weeks, "weekly1", "w1", (start) => { const d = new Date(start); d.setDate(d.getDate() + 7); return d.getTime() - 1; });
  return items;
}

function gameItems({ horseGames = [], towGames = [] }, names) {
  const items = [];
  for (const g of horseGames) {
    if (g?.status !== "complete") continue;
    const winners = [].concat(g.winner || []);
    const players = g.turnOrder || g.players || [];
    if (!winners.length || !players.some((n) => names.has(n))) continue;
    items.push({ id: `hg:${g.id}`, kind: "horse", at: lastAt(g.sets, g.startedAt || g.createdAt), owners: winners, winners, players, game: g });
  }
  for (const g of towGames) {
    if (g?.status !== "complete" || (g.winner !== "a" && g.winner !== "b")) continue;
    const winTeam = g.teams?.[g.winner];
    const loseTeam = g.teams?.[g.winner === "a" ? "b" : "a"];
    const players = [...(g.teams?.a?.players || []), ...(g.teams?.b?.players || [])];
    if (!players.some((n) => names.has(n))) continue;
    items.push({
      id: `tg:${g.id}`, kind: "tow", at: lastAt(g.bursts, g.startedAt || g.createdAt), owners: [...(winTeam?.players || [])],
      winTeam, loseTeam, score: [g.scores?.[g.winner] ?? 0, g.scores?.[g.winner === "a" ? "b" : "a"] ?? 0], game: g,
    });
  }
  return items;
}

/**
 * sessions: every raw session known; names: Set of in-scope user names (the
 * active group's roster, or just you when solo). trophies: [{ user, cardId,
 * title, tierId, tierLabel, goalLabel, at }]; challengeWins: [{ challenge,
 * winners, at }]; challengeJoins: [{ challenge, user, at }].
 * trophyThresholds: { pushups: [...], streak: [...] } — milestone values a
 * trophy card already announces, so they aren't repeated.
 * Returns items newest first.
 */
export function buildFeedItems({
  sessions = [], ts = (s) => Date.parse(s.timestamp) || 0, names, groupId = null,
  horseGames = [], towGames = [], trophies = [], challengeWins = [], challengeJoins = [],
  trophyThresholds = {}, now = Date.now(),
} = {}) {
  const inScope = (n) => names.has(n);
  const scoped = sessions.filter((s) => inScope(s.user)).sort((a, b) => ts(a) - ts(b));
  const items = [];
  const consumed = new Set();
  for (const [user, list] of byUser(scoped)) {
    const result = userHighlights(user, list, ts, trophyThresholds);
    items.push(...result.items);
    for (const s of result.consumed) consumed.add(s);
  }
  items.push(...sessionBursts(scoped.filter((s) => !consumed.has(s)), ts));
  if (groupId && names.size >= 2) items.push(...leaderItems(scoped, ts, groupId, now));
  items.push(...gameItems({ horseGames, towGames }, names));
  for (const t of trophies) {
    if (!inScope(t.user) || t.at == null) continue;
    items.push({ id: `tr:${t.user}:${t.cardId}:${t.tierId}`, kind: "trophy", at: t.at, owners: [t.user], user: t.user, trophy: t });
  }
  for (const w of challengeWins) {
    const winners = w.winners.filter(inScope);
    if (!winners.length) continue;
    items.push({ id: `cw:${w.challenge.id}`, kind: "challengeWin", at: w.at, owners: winners, winners, challenge: w.challenge });
  }
  for (const j of challengeJoins) {
    if (!inScope(j.user) || !j.at) continue;
    items.push({ id: `cj:${j.challenge.id}:${j.user}`, kind: "challengeJoin", at: j.at, owners: [j.user], user: j.user, challenge: j.challenge });
  }
  return items.filter((i) => Number.isFinite(i.at) && i.at <= now).sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : 1));
}

// ---------------- reactions ----------------
// Server rows + this device's queued toggles (applied in order).
export function mergeReactions(serverReactions = [], queuedOps = [], now = Date.now()) {
  const out = serverReactions.slice();
  for (const op of queuedOps) {
    const idx = out.findIndex((r) => r.itemId === op.itemId && r.user === op.user && r.emoji === op.emoji);
    if (idx !== -1) out.splice(idx, 1);
    if (op.on) out.push({ itemId: op.itemId, owners: op.owners || [], user: op.user, emoji: op.emoji, at: op.at || now });
  }
  return out;
}

// itemId → [{ emoji, users, mine }] in FEED_REACTIONS order.
export function reactionIndex(reactions = [], me = "") {
  const byItem = new Map();
  for (const r of reactions) {
    if (!FEED_REACTIONS.includes(r.emoji)) continue;
    if (!byItem.has(r.itemId)) byItem.set(r.itemId, new Map());
    const byEmoji = byItem.get(r.itemId);
    if (!byEmoji.has(r.emoji)) byEmoji.set(r.emoji, []);
    if (!byEmoji.get(r.emoji).includes(r.user)) byEmoji.get(r.emoji).push(r.user);
  }
  const out = new Map();
  for (const [itemId, byEmoji] of byItem) {
    out.set(itemId, FEED_REACTIONS.filter((e) => byEmoji.has(e)).map((emoji) => {
      const users = byEmoji.get(emoji);
      return { emoji, users, mine: users.includes(me) };
    }));
  }
  return out;
}

// Reactions by others on your items newer than `seenAt`.
export function unreadReactions(reactions = [], me, seenAt = 0) {
  return reactions.filter((r) => r.user !== me && (r.owners || []).includes(me) && Number(r.at) > seenAt);
}
