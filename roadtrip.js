import { periodStart } from "./stats.js";
import { normalizeTerritoryLocation } from "./territory-location.js";

export const ROADTRIP_TIERS = ["neighborhood", "city", "country"];
export const ROADTRIP_PERIODS = ["day", "week", "month", "year", "all"];

const flagEmoji = (code = "") => /^[A-Z]{2}$/.test(code)
  ? [...code].map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join("")
  : "";

function sessionTime(session) {
  const value = Date.parse(session?.timestamp || session?.date || "");
  return Number.isFinite(value) ? value : 0;
}

function locationMeta(location, tier) {
  const place = location?.[tier];
  if (!place) return null;
  const countryCode = location.country?.code || "";
  const parentParts = tier === "neighborhood"
    ? [location.city?.name, countryCode || location.country?.name]
    : tier === "city"
      ? [countryCode || location.country?.name]
      : [];
  return {
    id: place.id,
    name: place.name,
    tier,
    countryCode,
    flag: tier === "country" ? flagEmoji(countryCode) : "",
    parent: parentParts.filter(Boolean).join(" · "),
  };
}

export function eligibleRoadtripSessions(sessions, period = "week", now = new Date()) {
  const start = period === "all" ? -Infinity : periodStart(period, now).getTime();
  return (sessions || []).filter((session) =>
    session?.type !== "plank" &&
    Number(session?.count) > 0 &&
    sessionTime(session) >= start &&
    normalizeTerritoryLocation(session?.location)
  );
}

export function buildRoadtripTerritories(sessions, { tier = "city", period = "week", now = new Date() } = {}) {
  if (!ROADTRIP_TIERS.includes(tier)) return [];
  const territories = new Map();
  const ordered = eligibleRoadtripSessions(sessions, period, now)
    .map((session, order) => ({ session, order, time: sessionTime(session) }))
    .sort((a, b) => a.time - b.time || a.order - b.order);

  for (const { session, time } of ordered) {
    const location = normalizeTerritoryLocation(session.location);
    const meta = locationMeta(location, tier);
    if (!meta || !session.user) continue;
    let territory = territories.get(meta.id);
    if (!territory) {
      territory = { ...meta, total: 0, users: new Map(), holder: null, claimedAt: null, conqueredAt: null };
      territories.set(meta.id, territory);
    }
    const user = territory.users.get(session.user) || { name: session.user, total: 0, avatar: session.avatar || "", firstAt: time, reachedAt: time };
    user.total += Number(session.count) || 0;
    user.reachedAt = time;
    if (session.avatar) user.avatar = session.avatar;
    territory.users.set(session.user, user);
    territory.total += Number(session.count) || 0;

    if (!territory.holder) {
      territory.holder = session.user;
      territory.claimedAt = time;
      territory.conqueredAt = time;
    } else if (territory.holder !== session.user) {
      const holderTotal = territory.users.get(territory.holder)?.total || 0;
      if (user.total > holderTotal) {
        territory.holder = session.user;
        territory.conqueredAt = time;
      }
    }
  }

  const rows = [...territories.values()].map((territory) => {
    const users = [...territory.users.values()].sort((a, b) =>
      b.total - a.total || (a.name === territory.holder ? -1 : b.name === territory.holder ? 1 : 0) || a.firstAt - b.firstAt || a.name.localeCompare(b.name)
    );
    return {
      ...territory,
      users,
      contributorCount: users.length,
      holderTotal: territory.users.get(territory.holder)?.total || 0,
    };
  });
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function roadtripOverviewRows(territories, selectedLocation, tier, limit = 10) {
  const top = territories.slice(0, limit);
  const selected = normalizeTerritoryLocation(selectedLocation)?.[tier]?.id;
  const pinned = selected && !top.some((row) => row.id === selected)
    ? territories.find((row) => row.id === selected) || null
    : null;
  return {
    top: top.map((row) => (row.id === selected ? { ...row, current: true } : row)),
    pinned: pinned ? { ...pinned, current: true } : null,
  };
}

export function roadtripDetailRows(territory, currentUser, limit = 10) {
  if (!territory) return { top: [], pinned: null };
  const ranked = territory.users.map((user, index) => ({ ...user, rank: index + 1 }));
  const top = ranked.slice(0, limit);
  const pinned = currentUser && !top.some((row) => row.name === currentUser)
    ? ranked.find((row) => row.name === currentUser) || null
    : null;
  return { top, pinned };
}

export function detectRoadtripConquests(sessions, sessionId, { now } = {}) {
  const session = (sessions || []).find((item) => item.id === sessionId);
  const location = normalizeTerritoryLocation(session?.location);
  if (!session || !location || session.type === "plank" || Number(session.count) <= 0) return [];
  const moment = now || new Date(session.timestamp);
  const before = sessions.filter((item) => item.id !== sessionId);
  const wins = [];

  for (const tier of ROADTRIP_TIERS) {
    const place = location[tier];
    if (!place) continue;
    for (const period of ROADTRIP_PERIODS) {
      const prior = buildRoadtripTerritories(before, { tier, period, now: moment }).find((row) => row.id === place.id);
      const after = buildRoadtripTerritories(sessions, { tier, period, now: moment }).find((row) => row.id === place.id);
      if (!after || after.holder !== session.user || prior?.holder === session.user) continue;
      wins.push({
        tier,
        period,
        id: place.id,
        name: after.name,
        parent: after.parent,
        flag: after.flag,
        kind: prior ? "conquered" : "claimed",
        overtaken: prior?.holder || "",
        total: after.holderTotal,
      });
    }
  }
  return groupRoadtripConquests(wins);
}

export function groupRoadtripConquests(wins) {
  const grouped = new Map();
  for (const win of wins || []) {
    const key = `${win.tier}:${win.id}:${win.kind}:${win.overtaken || ""}`;
    const existing = grouped.get(key) || { ...win, periods: [] };
    if (!existing.periods.includes(win.period)) existing.periods.push(win.period);
    grouped.set(key, existing);
  }
  return [...grouped.values()].map((win) => ({
    ...win,
    periods: ROADTRIP_PERIODS.filter((period) => win.periods.includes(period)),
  }));
}

export function roadtripConquestShareMessage(user, wins) {
  const territoryText = (wins || []).map((win) => {
    const periods = win.periods.map((period) => period.toUpperCase()).join("/");
    return win.kind === "claimed"
      ? `${win.name} (${periods}) — planted my flag before the other cowards showed up`
      : `${win.name} (${periods}) — ripped it out of ${win.overtaken}'s sweaty little hands`;
  }).join("; ");
  return `🚨 TERRITORY THEFT 🚨 ${user} just ${wins?.some((win) => win.kind === "conquered") ? "conquered" : "claimed"} ${territoryText}. The Roadtrip map has a new landlord. Pay rent in pushups, losers. 🌍👑`;
}
