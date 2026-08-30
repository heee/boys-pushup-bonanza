// Weekly/monthly/quarterly/annual recap modals — pure, state-free computation
// (mirrors stats.js/roadtrip.js: no app.js `state` coupling), so it can be
// unit-tested and reasoned about independently of the UI layer.
import { periodStart, filterByMode, bestFor } from "./stats.js";
import { buildRoadtripTerritories } from "./roadtrip.js";

// Largest-first, matching the queueing order a lapsed user sees on open.
export const RECAP_TIERS = ["year", "quarter", "month", "week"];

export const RECAP_TIER_META = {
  week: { label: "Your Week", stripType: "dots", palette: "recap-week" },
  month: { label: "This Month", stripType: "bars", bucketCount: 4, palette: "recap-month" },
  quarter: { label: "This Quarter", stripType: "bars", bucketCount: 3, palette: "recap-quarter" },
  year: { label: "In Review", stripType: "bars", bucketCount: 12, palette: "recap-year" },
};

// Hex stops for each tier's gradient card — kept here as the single source
// of truth for the canvas share-image export; style.css's .recap-week/
// .recap-month/.recap-quarter/.recap-year classes are hand-kept in sync with
// these same values (no build step in this app, so CSS can't import them).
export const RECAP_PALETTES = {
  week: { from: "#e8853f", via: "#d9642a", to: "#a83f1c", tile: "rgba(255,255,255,0.16)", text: "#ffffff" },
  month: { from: "#f0c14b", via: "#dba02f", to: "#a86f18", tile: "rgba(30,20,0,0.18)", text: "#241a04" },
  quarter: { from: "#7fa0c2", via: "#5c7c9c", to: "#3d5570", tile: "rgba(255,255,255,0.16)", text: "#ffffff" },
  year: { from: "#4a3a24", via: "#2e2213", to: "#191108", tile: "rgba(255,255,255,0.08)", text: "#f2d98a" },
};

// Catalog of exercise "tabs" a recap can cover. `filterMode` is the value
// passed to stats.js's filterByMode — "all" there means "every pushup
// session regardless of game mode" (any session with no `type`), which is
// exactly what "PUSHUPS" should mean in a recap.
export const RECAP_EXERCISES = [
  { key: "pushup", filterMode: "all", label: "Pushups", unit: "reps" },
  { key: "situp", filterMode: "situps", label: "Crunches", unit: "reps" },
  { key: "squat", filterMode: "squats", label: "Squats", unit: "reps" },
  { key: "pullup", filterMode: "pullups", label: "Pull-ups", unit: "reps" },
  { key: "plank", filterMode: "planks", label: "Planks", unit: "seconds" },
  { key: "holland", filterMode: "holland", label: "Holland", unit: "cycles" },
];

const LEADERBOARD_GROUP_LABEL = "Boys Bonanza";

function sessionTime(session) {
  const value = Date.parse(session?.timestamp || session?.date || "");
  return Number.isFinite(value) ? value : 0;
}

function inRange(session, start, end) {
  const t = sessionTime(session);
  return t >= start.getTime() && t < end.getTime();
}

// The recap's week runs Sunday-Saturday — deliberately independent of
// stats.js's Monday-start periodStart("week", ...), which the rest of the
// app (dashboard, leaderboards, Roadtrip) keeps using unchanged.
function sundayWeekStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function recapPeriodStart(tier, date) {
  return tier === "week" ? sundayWeekStart(date) : periodStart(tier, date);
}

function nextPeriodStart(tier, date) {
  const d = new Date(date);
  if (tier === "week") { d.setDate(d.getDate() + 7); return sundayWeekStart(d); }
  if (tier === "month") return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  if (tier === "quarter") return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 1);
  return new Date(d.getFullYear() + 1, 0, 1);
}

// The period that just finished as of `now` (the one a recap should cover) —
// e.g. if a new week started today, this is last week's [Sun, Sun) range.
export function completedPeriodRange(tier, now = new Date()) {
  const currentStart = recapPeriodStart(tier, now);
  const justBefore = new Date(currentStart.getTime() - 1);
  return { start: recapPeriodStart(tier, justBefore), end: currentStart };
}

// The period before the completed one, for "vs last {period}" comparisons.
export function previousPeriodRange(tier, now = new Date()) {
  const completed = completedPeriodRange(tier, now);
  const justBefore = new Date(completed.start.getTime() - 1);
  return { start: recapPeriodStart(tier, justBefore), end: completed.start };
}

function totalFor(pool, user, start, end) {
  let total = 0;
  for (const s of pool) {
    if (s.user === user && inRange(s, start, end)) total += Number(s.count) || 0;
  }
  return total;
}

// Rank + total for `user` among everyone active in [start,end) on this pool.
export function rankForPeriod(pool, user, start, end) {
  const totals = new Map();
  for (const s of pool) {
    if (!inRange(s, start, end)) continue;
    totals.set(s.user, (totals.get(s.user) || 0) + (Number(s.count) || 0));
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const idx = ranked.findIndex(([u]) => u === user);
  return { total: totals.get(user) || 0, rank: idx === -1 ? null : idx + 1, participants: ranked.length };
}

// Which exercises this user was active in during the range, most-active first.
export function getActiveExercises(sessions, user, start, end) {
  return RECAP_EXERCISES
    .map((exercise) => ({ ...exercise, total: totalFor(filterByMode(sessions, exercise.filterMode), user, start, end) }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total);
}

// Highest total this exercise/tier has ever hit for `user`, strictly before
// `beforeEnd` — used to detect "best {period} yet" records. Bounded walk:
// steps one tier-bucket at a time from the earliest session, so cost scales
// with the user's history, not with arbitrary time.
function bestPriorPeriodTotal(pool, user, tier, beforeEnd) {
  const own = pool.filter((s) => s.user === user);
  if (!own.length) return 0;
  const earliest = Math.min(...own.map(sessionTime));
  let cursorStart = recapPeriodStart(tier, new Date(earliest));
  let best = 0;
  let guard = 0;
  while (cursorStart.getTime() < beforeEnd.getTime() && guard < 600) {
    const cursorEnd = nextPeriodStart(tier, cursorStart);
    best = Math.max(best, totalFor(pool, user, cursorStart, cursorEnd));
    cursorStart = cursorEnd;
    guard++;
  }
  return best;
}

function weekBucketIndex(date) {
  return Math.min(3, Math.floor((date.getDate() - 1) / 7));
}

function stripForRange(pool, user, tier, start, end) {
  if (tier === "week") {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);
      days.push(pool.some((s) => s.user === user && inRange(s, dayStart, dayEnd)));
    }
    return { type: "dots", days };
  }
  const bucketCount = RECAP_TIER_META[tier].bucketCount;
  const buckets = new Array(bucketCount).fill(0);
  for (const s of pool) {
    if (s.user !== user || !inRange(s, start, end)) continue;
    const d = new Date(sessionTime(s));
    const idx = tier === "month" ? weekBucketIndex(d) : tier === "quarter" ? d.getMonth() - start.getMonth() : d.getMonth();
    if (idx >= 0 && idx < bucketCount) buckets[idx] += Number(s.count) || 0;
  }
  return { type: "bars", buckets, currentIndex: bucketCount - 1 };
}

// Weeks whose start falls within [monthStart, monthEnd) — used for the
// "Held #1 for N straight weeks" monthly highlight.
function weeksWithin(monthStart, monthEnd) {
  const weeks = [];
  let cursor = sundayWeekStart(monthStart);
  while (cursor.getTime() < monthEnd.getTime()) {
    weeks.push(cursor);
    const next = new Date(cursor); next.setDate(next.getDate() + 7);
    cursor = next;
  }
  return weeks;
}

function computeHighlights({ pool, user, tier, start, end, rank, prevRank, periodBest, allTimeBestBefore, isRecordTotal, deltaPct, territory }) {
  const highlights = [];

  // Slot 1 — rank / standing.
  if (tier === "week" || tier === "quarter") {
    if (rank != null && (prevRank == null || rank < prevRank)) {
      highlights.push({ icon: "🏆", text: `Climbed to #${rank} in ${LEADERBOARD_GROUP_LABEL}` });
    } else if (rank === 1 && prevRank === 1) {
      highlights.push({ icon: "🏆", text: `Held #1 in ${LEADERBOARD_GROUP_LABEL}` });
    }
  } else if (tier === "month") {
    const weeks = weeksWithin(start, end);
    let streak1 = 0;
    for (const weekStart of weeks) {
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
      const { rank: weekRank } = rankForPeriod(pool, user, weekStart, weekEnd);
      if (weekRank === 1) streak1++;
    }
    if (streak1 >= 2) {
      highlights.push({ icon: "🏆", text: `Held #1 for ${streak1} straight weeks` });
    } else if (rank != null && (prevRank == null || rank < prevRank)) {
      highlights.push({ icon: "🏆", text: `Climbed to #${rank} in ${LEADERBOARD_GROUP_LABEL}` });
    }
  } else if (tier === "year") {
    if (rank != null) highlights.push({ icon: "🏆", text: `#${rank} finish for ${start.getFullYear()}` });
  }

  // Slot 2 — personal-best / volume-record.
  if (tier === "week") {
    if (periodBest > allTimeBestBefore) {
      highlights.push({ icon: "⭐", text: `New PR — ${periodBest} in one session` });
    }
  } else if (tier === "month") {
    if (isRecordTotal) highlights.push({ icon: "⭐", text: "New monthly volume PB" });
  } else if (tier === "quarter") {
    if (isRecordTotal) highlights.push({ icon: "🏆", text: "Best quarter yet" });
    else if (deltaPct > 0) highlights.push({ icon: "📈", text: `Reps up ${deltaPct}% quarter over quarter` });
  } else if (tier === "year") {
    if (isRecordTotal) highlights.push({ icon: "⭐", text: `Best year yet, up ${deltaPct}%` });
    else if (deltaPct > 0) highlights.push({ icon: "📈", text: `Reps up ${deltaPct}% year over year` });
  }

  // Slot 3 — territory (only ever attached to the primary/most-active tab).
  if (territory) highlights.push(territory);

  return highlights.slice(0, 3);
}

// Territory highlight is cross-exercise (Roadtrip doesn't distinguish
// pushups/situps/etc.), so it's computed once per period and only ever
// attached to the primary tab — see computeRecapTab's `isPrimaryTab`.
function computeTerritoryHighlight(sessions, user, tier, start, end) {
  const allTime = buildRoadtripTerritories(sessions, { tier: "city", period: "all", now: end });
  const heldNow = allTime.filter((t) => t.holder === user);
  const activeThisPeriod = sessions.some((s) => s.user === user && inRange(s, start, end));
  if (!activeThisPeriod || !heldNow.length) {
    if (tier === "quarter" && heldNow.length) return { icon: "🗺️", text: `Holding ${heldNow.length} territor${heldNow.length === 1 ? "y" : "ies"}` };
    return null;
  }

  if (tier === "week") {
    const spotlight = heldNow.reduce((best, t) => (t.conqueredAt < (best?.conqueredAt ?? Infinity) ? t : best), null) || heldNow[0];
    const days = Math.floor((end.getTime() - spotlight.conqueredAt) / 86400000);
    return { icon: "🗺️", text: `${spotlight.name} still yours — held ${Math.max(0, days)} day${days === 1 ? "" : "s"}` };
  }

  if (tier === "month" || tier === "year") {
    const newlyTaken = heldNow.filter((t) => t.conqueredAt >= start.getTime() && t.conqueredAt < end.getTime());
    if (newlyTaken.length) {
      const noun = tier === "month" ? "new cities" : "territories claimed this year";
      return { icon: "🗺️", text: tier === "month" ? `Conquered ${newlyTaken.length} ${noun}` : `${newlyTaken.length} ${noun}` };
    }
    return { icon: "🗺️", text: `Holding ${heldNow.length} territor${heldNow.length === 1 ? "y" : "ies"}` };
  }

  return { icon: "🗺️", text: `Holding ${heldNow.length} territor${heldNow.length === 1 ? "y" : "ies"}` };
}

// Full payload for one exercise tab within one period recap.
export function computeRecapTab(sessions, exercise, tier, now = new Date(), isPrimaryTab = false) {
  const { start, end } = completedPeriodRange(tier, now);
  const { start: prevStart, end: prevEnd } = previousPeriodRange(tier, now);
  const pool = filterByMode(sessions, exercise.filterMode);
  const user = exercise.user; // caller sets this per invocation (see below)

  const { total, rank, participants } = rankForPeriod(pool, user, start, end);
  const { rank: prevRank } = rankForPeriod(pool, user, prevStart, prevEnd);
  const prevTotal = totalFor(pool, user, prevStart, prevEnd);
  const deltaPct = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  const sessionsInPeriod = pool.filter((s) => s.user === user && inRange(s, start, end));
  const periodBest = sessionsInPeriod.reduce((max, s) => Math.max(max, Number(s.count) || 0), 0);
  const allTimeBestBefore = bestFor(pool.filter((s) => sessionTime(s) < start.getTime()), user, () => true, "count");

  const bestPrior = bestPriorPeriodTotal(pool, user, tier, start);
  const isRecordTotal = total > 0 && total > bestPrior;

  const territory = isPrimaryTab ? computeTerritoryHighlight(sessions, user, tier, start, end) : null;

  const highlights = computeHighlights({
    pool, user, tier, start, end, rank, prevRank, periodBest, allTimeBestBefore,
    isRecordTotal, deltaPct: deltaPct ?? 0, territory,
  });

  return {
    exercise: exercise.key,
    label: exercise.label,
    unit: exercise.unit,
    tier,
    start, end,
    total,
    deltaPct,
    sessionsCount: sessionsInPeriod.length,
    periodBest,
    rank,
    prevRank,
    participants,
    strip: stripForRange(pool, user, tier, start, end),
    highlights,
  };
}

// LocalStorage-key builder — kept here so app.js and this module agree on
// the shape without app.js needing to know recap.js's internals.
export function recapSeenKey(tier) {
  return `recapSeen_${tier}`;
}

// Determines which recaps (largest-first) are newly due since the caller
// last checked, using `storage` (a localStorage-like get/setItem object) to
// persist the boundary each tier was last shown at. A tier is only queued
// when the user had activity in at least one exercise that period — every
// checked tier (shown or not) is still marked seen so it never re-queues.
export function checkAndQueueRecaps(sessions, user, now, storage) {
  const due = [];
  for (const tier of RECAP_TIERS) {
    const { start, end } = completedPeriodRange(tier, now);
    const key = recapSeenKey(tier);
    const lastSeen = storage.getItem(key);
    if (lastSeen === start.toISOString()) continue;
    storage.setItem(key, start.toISOString());
    const active = getActiveExercises(sessions, user, start, end);
    if (active.length) due.push(tier);
  }
  return due;
}

// Builds every tab's payload for one tier, in most-active-first order.
export function buildRecapTier(sessions, user, tier, now = new Date()) {
  const { start, end } = completedPeriodRange(tier, now);
  const active = getActiveExercises(sessions, user, start, end);
  return active.map((exercise, index) =>
    computeRecapTab(sessions, { ...exercise, user }, tier, now, index === 0)
  );
}

function formatShareNumber(n) {
  return Math.round(n).toLocaleString("en-US");
}

function formatShareDuration(totalSeconds) {
  const s = Math.round(totalSeconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

function formatShareValue(value, unit) {
  return unit === "seconds" ? formatShareDuration(value) : formatShareNumber(value);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Renders one recap tab to a story-format (1080x1920) PNG for sharing, since
// this app has no build step (no html2canvas/etc.) — the card is redrawn by
// hand rather than captured from the live DOM.
export function exportRecapImage(tier, tab, user) {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const palette = RECAP_PALETTES[tier];
  const meta = RECAP_TIER_META[tier];

  const gradient = ctx.createLinearGradient(0, 0, W * 0.3, H);
  gradient.addColorStop(0, palette.from);
  gradient.addColorStop(0.55, palette.via);
  gradient.addColorStop(1, palette.to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = palette.text;
  ctx.textAlign = "center";

  ctx.globalAlpha = 0.8;
  ctx.font = "600 34px system-ui, sans-serif";
  ctx.fillText(meta.label.toUpperCase(), W / 2, 210);
  ctx.globalAlpha = 1;

  ctx.font = "800 150px system-ui, sans-serif";
  ctx.fillText(formatShareValue(tab.total, tab.unit), W / 2, 400);

  ctx.font = "600 40px system-ui, sans-serif";
  ctx.globalAlpha = 0.85;
  ctx.fillText(tab.label.toUpperCase(), W / 2, 460);
  ctx.globalAlpha = 1;

  if (tab.deltaPct != null) {
    const pillText = `${tab.deltaPct >= 0 ? "+" : ""}${tab.deltaPct}% vs last ${tier}`;
    ctx.font = "600 32px system-ui, sans-serif";
    const pillW = ctx.measureText(pillText).width + 64;
    ctx.fillStyle = palette.tile;
    roundRect(ctx, W / 2 - pillW / 2, 510, pillW, 68, 34);
    ctx.fill();
    ctx.fillStyle = palette.text;
    ctx.fillText(pillText, W / 2, 555);
  }

  // Stat tile row: sessions / best / rank.
  const tiles = [
    { value: formatShareNumber(tab.sessionsCount), label: "sessions" },
    { value: formatShareValue(tab.periodBest, tab.unit), label: "best (PB)" },
    { value: tab.rank ? `#${tab.rank}` : "—", label: tab.prevRank && tab.prevRank !== tab.rank ? `rank, was #${tab.prevRank}` : "rank" },
  ];
  const tileY = 660, tileH = 190, tileGap = 24;
  const tileW = (W - 120 - tileGap * 2) / 3;
  tiles.forEach((tile, i) => {
    const x = 60 + i * (tileW + tileGap);
    ctx.fillStyle = palette.tile;
    roundRect(ctx, x, tileY, tileW, tileH, 24);
    ctx.fill();
    ctx.fillStyle = palette.text;
    ctx.font = "700 52px system-ui, sans-serif";
    ctx.fillText(tile.value, x + tileW / 2, tileY + 90);
    ctx.font = "500 26px system-ui, sans-serif";
    ctx.globalAlpha = 0.75;
    ctx.fillText(tile.label, x + tileW / 2, tileY + 135);
    ctx.globalAlpha = 1;
  });

  // Highlights list.
  let hy = tileY + tileH + 90;
  ctx.textAlign = "left";
  for (const highlight of tab.highlights) {
    ctx.fillStyle = palette.tile;
    roundRect(ctx, 60, hy, W - 120, 110, 20);
    ctx.fill();
    ctx.font = "44px system-ui, sans-serif";
    ctx.fillText(highlight.icon, 90, hy + 68);
    ctx.fillStyle = palette.text;
    ctx.font = "600 32px system-ui, sans-serif";
    ctx.fillText(highlight.text, 155, hy + 68, W - 250);
    hy += 130;
  }

  ctx.textAlign = "center";
  ctx.globalAlpha = 0.6;
  ctx.font = "500 30px system-ui, sans-serif";
  ctx.fillText(`${user} · Boys Pushup Bonanza`, W / 2, H - 70);
  ctx.globalAlpha = 1;

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
