// Group Monthly recap — "Boys Bonanza" collective report (docs: see the
// group-recap plan). Pure, state-free module (mirrors recap.js/roadtrip.js —
// no app.js `state` coupling): everything here is a plain function over a
// `sessions` array plus whatever small extras (current user, city
// coordinates) the caller resolved ahead of time.
//
// Unlike the personal recap tiers, this card is identical for every viewer —
// it's gated behind one shared localStorage key (see groupRecapSeenKey)
// rather than a per-user one, and it always covers the month, never week/
// quarter/year.
import { completedPeriodRange, RECAP_EXERCISES, sessionDurationMs, sessionTime, inRange, LEADERBOARD_GROUP_LABEL, roundRect } from "./recap.js?v=2";
import { buildRoadtripTerritories } from "./roadtrip.js";
import { filterByMode } from "./stats.js";

// Hex stops for the canvas share-image export — style.css's `.recap-group`
// class is hand-kept in sync with these same values (no build step in this
// app, so CSS can't import them; same convention as recap.js's RECAP_PALETTES).
export const GROUP_RECAP_PALETTE = {
  from: "#2f6b45", via: "#1f4d30", to: "#122e1c", tile: "rgba(255,255,255,0.16)", text: "#ffffff",
};

export function groupRecapSeenKey() {
  return "recapSeen_group-month";
}

// Fixed reference point for the miles tile — Houston is the group's home
// base, not something detected from whichever territories happen to be held
// right now, so its coordinates are a constant rather than a geocoded lookup.
export const HOUSTON_COORDS = { lat: 29.7604, lon: -95.3698 };

const EARTH_RADIUS_MILES = 3958.8;

// Great-circle distance between two {lat,lon} points, in miles.
export function haversineMiles(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function nextMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function totalForAllUsers(sessions, start, end) {
  let total = 0;
  for (const s of sessions) {
    if (inRange(s, start, end)) total += Number(s.count) || 0;
  }
  return total;
}

// Highest combined (all-users, all-exercises) monthly total the group has
// ever hit strictly before `beforeStart` — bounded walk from the earliest
// session, same technique as recap.js's bestPriorPeriodTotal.
function bestPriorGroupMonthTotal(sessions, beforeStart) {
  if (!sessions.length) return 0;
  const earliest = Math.min(...sessions.map(sessionTime));
  let cursor = monthStart(new Date(earliest));
  let best = 0;
  let guard = 0;
  while (cursor.getTime() < beforeStart.getTime() && guard < 600) {
    const cursorEnd = nextMonthStart(cursor);
    best = Math.max(best, totalForAllUsers(sessions, cursor, cursorEnd));
    cursor = cursorEnd;
    guard++;
  }
  return best;
}

// A "game" is any session logged under a named mode other than Classic —
// Holland/Chain of Pain (their own `type`, always multi-exercise circuits)
// or a pushup session with a `mode` set (dice/ladder/pyramid/cock/etc.).
// Horse and Tug of War live in separate cached game records, not the
// sessions pool, so they aren't counted here.
function isGameSession(session) {
  return session.type === "holland" || session.type === "chainofpain" || !!session.mode;
}

export function computeGroupBreakdown(sessions, start, end, currentUser) {
  return RECAP_EXERCISES.map((exercise) => {
    const pool = filterByMode(sessions, exercise.filterMode);
    let groupTotal = 0;
    let yourTotal = 0;
    for (const s of pool) {
      if (!inRange(s, start, end)) continue;
      const count = Number(s.count) || 0;
      groupTotal += count;
      if (s.user === currentUser) yourTotal += count;
    }
    return { key: exercise.key, label: exercise.label, unit: exercise.unit, groupTotal, yourTotal };
  })
    .filter((row) => row.groupTotal > 0)
    .sort((a, b) => b.groupTotal - a.groupTotal);
}

export function computeGroupStats(sessions, start, end) {
  const inPeriod = sessions.filter((s) => inRange(s, start, end));
  const hoursDown = inPeriod.reduce((sum, s) => sum + sessionDurationMs(s), 0) / 3600000;
  const sessionsCount = inPeriod.length;
  const gamesPlayed = inPeriod.filter(isGameSession).length;
  return { hoursDown, sessionsCount, gamesPlayed };
}

// Sums round-trip great-circle miles from Houston to every other city the
// group has ever logged in Roadtrip (period: "all" — this is a running
// cumulative total, not something that resets month to month). A city with
// no entry in `cityCoords` (not yet geocoded, or the lookup failed/offline)
// simply contributes 0 rather than blocking the rest of the tile.
export function computeGroupMilesLogged(sessions, cityCoords = {}) {
  const territories = buildRoadtripTerritories(sessions, { tier: "city", period: "all" });
  let miles = 0;
  for (const territory of territories) {
    if (territory.name.trim().toLowerCase() === "houston") continue;
    const coords = cityCoords[territory.id];
    if (!coords) continue;
    miles += haversineMiles(HOUSTON_COORDS, coords) * 2;
  }
  return miles;
}

// "Biggest month the group has ever had" — this month's combined total beat
// every earlier month's.
export function computeGroupVolumeRecordBadge(sessions, start, end) {
  const total = totalForAllUsers(sessions, start, end);
  if (total <= 0) return null;
  const priorBest = bestPriorGroupMonthTotal(sessions, start);
  if (total <= priorBest) return null;
  return { icon: "🔥", text: "Biggest month the group has ever had" };
}

// Fires only in the month a multiple of `incrementSize` is actually crossed —
// names the highest threshold crossed if more than one falls in the month.
export function computeGroupMilestoneBadge(sessions, start, end, incrementSize = 50000) {
  const totalBefore = totalForAllUsers(sessions, new Date(0), start);
  const totalAfter = totalBefore + totalForAllUsers(sessions, start, end);
  const crossedBefore = Math.floor(totalBefore / incrementSize);
  const crossedAfter = Math.floor(totalAfter / incrementSize);
  if (crossedAfter <= crossedBefore) return null;
  const milestone = crossedAfter * incrementSize;
  return { icon: "🏅", text: `Crossed ${milestone.toLocaleString("en-US")} lifetime reps together` };
}

export function buildGroupMonthRecap(sessions, now = new Date(), currentUser, cityCoords = {}) {
  const { start, end } = completedPeriodRange("month", now);
  const prevMonthStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const heroTotal = totalForAllUsers(sessions, start, end);
  const prevTotal = totalForAllUsers(sessions, prevMonthStart, start);
  const deltaPct = prevTotal > 0 ? Math.round(((heroTotal - prevTotal) / prevTotal) * 100) : null;

  const badges = [
    computeGroupVolumeRecordBadge(sessions, start, end),
    computeGroupMilestoneBadge(sessions, start, end),
  ].filter(Boolean);

  return {
    start, end,
    heroTotal,
    deltaPct,
    breakdown: computeGroupBreakdown(sessions, start, end, currentUser),
    stats: {
      ...computeGroupStats(sessions, start, end),
      milesLogged: computeGroupMilesLogged(sessions, cityCoords),
    },
    badges,
  };
}

function formatShareNumber(n) {
  return Math.round(n).toLocaleString("en-US");
}

// Renders the group card to a story-format (1080x1920) PNG for sharing —
// same hand-drawn canvas approach as recap.js's exportRecapImage (no
// html2canvas/etc. dependency in this repo).
export function exportGroupRecapImage(payload) {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const palette = GROUP_RECAP_PALETTE;

  const gradient = ctx.createLinearGradient(0, 0, W * 0.3, H);
  gradient.addColorStop(0, palette.from);
  gradient.addColorStop(0.55, palette.via);
  gradient.addColorStop(1, palette.to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = palette.text;
  ctx.textAlign = "center";

  const monthLabel = payload.start.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
  ctx.globalAlpha = 0.8;
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillText(`${LEADERBOARD_GROUP_LABEL.toUpperCase()} · ${monthLabel}`, W / 2, 190);
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.fillText("The boys moved", W / 2, 250);
  ctx.globalAlpha = 1;

  ctx.font = "800 140px system-ui, sans-serif";
  ctx.fillText(formatShareNumber(payload.heroTotal), W / 2, 420);

  ctx.font = "600 34px system-ui, sans-serif";
  ctx.globalAlpha = 0.85;
  ctx.fillText("TOGETHER THIS MONTH", W / 2, 470);
  ctx.globalAlpha = 1;

  if (payload.deltaPct != null) {
    const pillText = `${payload.deltaPct >= 0 ? "+" : ""}${payload.deltaPct}% vs last month`;
    ctx.font = "600 30px system-ui, sans-serif";
    const pillW = ctx.measureText(pillText).width + 64;
    ctx.fillStyle = palette.tile;
    roundRect(ctx, W / 2 - pillW / 2, 520, pillW, 66, 33);
    ctx.fill();
    ctx.fillStyle = palette.text;
    ctx.fillText(pillText, W / 2, 563);
  }

  const tiles = [
    { value: payload.stats.hoursDown.toFixed(1), label: "hours down" },
    { value: formatShareNumber(payload.stats.sessionsCount), label: "sessions" },
    { value: formatShareNumber(payload.stats.milesLogged), label: "mi round-trip" },
    { value: formatShareNumber(payload.stats.gamesPlayed), label: "games played" },
  ];
  const tileY = 650, tileH = 180, tileGap = 20;
  const tileW = (W - 120 - tileGap * 3) / 4;
  tiles.forEach((tile, i) => {
    const x = 60 + i * (tileW + tileGap);
    ctx.fillStyle = palette.tile;
    roundRect(ctx, x, tileY, tileW, tileH, 24);
    ctx.fill();
    ctx.fillStyle = palette.text;
    ctx.font = "700 40px system-ui, sans-serif";
    ctx.fillText(tile.value, x + tileW / 2, tileY + 85);
    ctx.font = "500 24px system-ui, sans-serif";
    ctx.globalAlpha = 0.75;
    ctx.fillText(tile.label, x + tileW / 2, tileY + 128);
    ctx.globalAlpha = 1;
  });

  let by = tileY + tileH + 70;
  ctx.textAlign = "left";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.globalAlpha = 0.75;
  ctx.fillText("WHERE IT CAME FROM", 60, by);
  ctx.globalAlpha = 1;
  by += 50;
  const trackW = W - 120;
  for (const row of payload.breakdown) {
    ctx.font = "600 32px system-ui, sans-serif";
    ctx.fillStyle = palette.text;
    ctx.fillText(row.label, 60, by);
    ctx.textAlign = "right";
    ctx.font = "500 26px system-ui, sans-serif";
    ctx.globalAlpha = 0.85;
    ctx.fillText(`${formatShareNumber(row.groupTotal)} · you ${formatShareNumber(row.yourTotal)}`, W - 60, by);
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
    by += 20;
    ctx.fillStyle = palette.tile;
    roundRect(ctx, 60, by, trackW, 22, 11);
    ctx.fill();
    const fillW = row.groupTotal > 0 ? Math.max(4, (row.yourTotal / row.groupTotal) * trackW) : 0;
    ctx.fillStyle = palette.text;
    roundRect(ctx, 60, by, fillW, 22, 11);
    ctx.fill();
    by += 60;
  }

  for (const badge of payload.badges) {
    ctx.fillStyle = palette.tile;
    roundRect(ctx, 60, by, trackW, 100, 20);
    ctx.fill();
    ctx.font = "40px system-ui, sans-serif";
    ctx.fillStyle = palette.text;
    ctx.fillText(badge.icon, 90, by + 62);
    ctx.font = "600 30px system-ui, sans-serif";
    ctx.fillText(badge.text, 155, by + 62, W - 250);
    by += 120;
  }

  ctx.textAlign = "center";
  ctx.globalAlpha = 0.6;
  ctx.font = "500 28px system-ui, sans-serif";
  ctx.fillText("Boys Pushup Bonanza", W / 2, H - 60);
  ctx.globalAlpha = 1;

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
