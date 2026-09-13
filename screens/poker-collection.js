// Royal Flush Rush — a recurring 14-day poker-hand collection challenge
// layered onto the Challenges module, same spirit as Reps Bingo (see
// bingo.js's header comment). It alternates with Bingo in the same
// derived-challenge card slot: bingo.js's cycleIndexForDate/
// cycleStartDateForIndex are the shared clock (even index = Bingo, odd =
// this — see app.js's derivedChallengeForTab), so both modules stay in
// lockstep without duplicating epoch/cadence constants.
//
// Like Bingo, nothing new is logged: completion is derived purely from each
// poker-mode session's existing `pokerHandRanks` array (poker.js) within the
// cycle window — no server storage, no Worker changes, joining reuses the
// existing generic /join-challenge endpoint.

import { POKER_HANDS } from "../poker.js";

const CYCLE_DAYS = 14;

// The collectible set for a cycle: every real winning hand, Pair through
// Royal Flush. Rank 0 (High Card) isn't actually a win, so it's excluded.
export const POKER_COLLECTION_RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// A fixed, illustrative 5-card example per hand for the detail list's card
// art — flavor art showing what the hand looks like, not tied to any real
// session's actual cards. Each satisfies poker.js's evaluatePokerHand for
// its rank (verified by hand): mixed suits/values for the non-flush hands so
// they don't accidentally read as a better category.
export const POKER_HAND_EXAMPLES = {
  1: [{ label: "7", suit: "spades" }, { label: "7", suit: "hearts" }, { label: "K", suit: "diamonds" }, { label: "9", suit: "clubs" }, { label: "3", suit: "diamonds" }],
  2: [{ label: "J", suit: "spades" }, { label: "J", suit: "hearts" }, { label: "7", suit: "diamonds" }, { label: "7", suit: "clubs" }, { label: "3", suit: "spades" }],
  3: [{ label: "9", suit: "spades" }, { label: "9", suit: "hearts" }, { label: "9", suit: "diamonds" }, { label: "K", suit: "clubs" }, { label: "3", suit: "hearts" }],
  4: [{ label: "4", suit: "spades" }, { label: "5", suit: "hearts" }, { label: "6", suit: "diamonds" }, { label: "7", suit: "clubs" }, { label: "8", suit: "hearts" }],
  5: [{ label: "2", suit: "spades" }, { label: "6", suit: "spades" }, { label: "9", suit: "spades" }, { label: "J", suit: "spades" }, { label: "K", suit: "spades" }],
  6: [{ label: "9", suit: "spades" }, { label: "9", suit: "hearts" }, { label: "9", suit: "diamonds" }, { label: "K", suit: "clubs" }, { label: "K", suit: "hearts" }],
  7: [{ label: "9", suit: "spades" }, { label: "9", suit: "hearts" }, { label: "9", suit: "diamonds" }, { label: "9", suit: "clubs" }, { label: "K", suit: "hearts" }],
  8: [{ label: "4", suit: "spades" }, { label: "5", suit: "spades" }, { label: "6", suit: "spades" }, { label: "7", suit: "spades" }, { label: "8", suit: "spades" }],
  9: [{ label: "10", suit: "spades" }, { label: "J", suit: "spades" }, { label: "Q", suit: "spades" }, { label: "K", suit: "spades" }, { label: "A", suit: "spades" }],
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function cycleIdFor(startDate) {
  return `poker-${startDate.getFullYear()}-${pad2(startDate.getMonth() + 1)}-${pad2(startDate.getDate())}`;
}

// Builds a cycle window from its start date — the same local-midnight,
// calendar-date-arithmetic convention as bingo.js's cycleFromStart, so a
// cycle boundary can't drift across a DST transition.
export function pokerCollectionCycleFromStart(startDate) {
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + CYCLE_DAYS - 1, 23, 59, 59, 999);
  return { id: cycleIdFor(startDate), startDate, endDate };
}

// Parses a cycle id ("poker-YYYY-MM-DD") back into its window.
export function pokerCollectionCycleById(id) {
  const m = /^poker-(\d{4})-(\d{2})-(\d{2})$/.exec(id || "");
  if (!m) return null;
  const startDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return pokerCollectionCycleFromStart(startDate);
}

export function adjacentPokerCollectionCycle(cycle, deltaCycles) {
  const startDate = new Date(cycle.startDate.getFullYear(), cycle.startDate.getMonth(), cycle.startDate.getDate() + deltaCycles * CYCLE_DAYS);
  return pokerCollectionCycleFromStart(startDate);
}

export function isPokerCollectionCycleId(id) {
  return typeof id === "string" && id.startsWith("poker-");
}

function toMs(value, timestampOf) {
  if (timestampOf) return timestampOf(value);
  return value?.timestamp instanceof Date ? value.timestamp.getTime() : Date.parse(value?.timestamp);
}

function inWindow(session, window, timestampOf) {
  const t = toMs(session, timestampOf);
  return Number.isFinite(t) && t >= window.startDate.getTime() && t <= window.endDate.getTime();
}

// How many times `userName` hit each collectible rank in-window, across
// every poker-mode session's `pokerHandRanks` (one entry per round played).
export function pokerHandCountsForUser(sessions, userName, window, timestampOf) {
  const counts = Object.fromEntries(POKER_COLLECTION_RANKS.map((r) => [r, 0]));
  for (const s of sessions) {
    if (s.user !== userName || s.mode !== "poker" || !inWindow(s, window, timestampOf)) continue;
    for (const rank of s.pokerHandRanks || []) {
      if (counts[rank] !== undefined) counts[rank] += 1;
    }
  }
  return counts;
}

// Detail-list rows: one per collectible hand, in rank order, each carrying
// its illustrative example cards, label, and this user's in-window count.
export function pokerCollectionRowsForUser(sessions, userName, window, timestampOf) {
  const counts = pokerHandCountsForUser(sessions, userName, window, timestampOf);
  return POKER_COLLECTION_RANKS.map((rank) => ({
    rank,
    label: POKER_HANDS[rank],
    cards: POKER_HAND_EXAMPLES[rank],
    count: counts[rank],
    done: counts[rank] > 0,
  }));
}

export function pokerCollectionHandsCollected(rows) {
  return rows.filter((r) => r.done).length;
}

export function pokerCollectionIsFullSet(rows) {
  return rows.every((r) => r.done);
}

// Volume tiebreak: total premium (Two Pair or better) hands logged
// in-window — mirrors poker.js's own `premium: rank >= 2` definition.
export function premiumHandCount(sessions, userName, window, timestampOf) {
  const counts = pokerHandCountsForUser(sessions, userName, window, timestampOf);
  return POKER_COLLECTION_RANKS.filter((r) => r >= 2).reduce((sum, r) => sum + counts[r], 0);
}

// Hands-collected leaderboard for the detail view, tiebroken by premium
// hand volume — every joined participant, ranked richest set first.
export function pokerCollectionLeaderboard(participants, sessions, window, timestampOf) {
  return participants
    .map((name) => {
      const rows = pokerCollectionRowsForUser(sessions, name, window, timestampOf);
      return { name, hands: pokerCollectionHandsCollected(rows), fullSet: pokerCollectionIsFullSet(rows), premium: premiumHandCount(sessions, name, window, timestampOf) };
    })
    .sort((a, b) => b.hands - a.hands || b.premium - a.premium);
}

// Cycle-end result: who won and how.
//  - One or more participants collected the full 9-hand set: among just
//    those finishers, most total premium hands logged wins (ties share).
//  - Nobody finished: most hands collected wins; a tie at the max count is
//    broken by premium hand volume among just the tied participants.
export function pokerCollectionWinners(participants, sessions, window, timestampOf) {
  const standings = participants.map((name) => {
    const rows = pokerCollectionRowsForUser(sessions, name, window, timestampOf);
    return { name, hands: pokerCollectionHandsCollected(rows), fullSet: pokerCollectionIsFullSet(rows), premium: premiumHandCount(sessions, name, window, timestampOf) };
  });
  if (!standings.length) return { winners: [], premium: {}, finishers: [], mode: "none" };

  const finishers = standings.filter((s) => s.fullSet);
  if (finishers.length) {
    const maxPremium = Math.max(...finishers.map((f) => f.premium));
    const winners = finishers.filter((f) => f.premium === maxPremium).map((f) => f.name);
    return { winners, premium: Object.fromEntries(finishers.map((f) => [f.name, f.premium])), finishers: finishers.map((f) => f.name), mode: "premium" };
  }

  const maxHands = Math.max(...standings.map((s) => s.hands));
  if (maxHands <= 0) return { winners: [], premium: {}, finishers: [], mode: "none" };
  const top = standings.filter((s) => s.hands === maxHands);
  if (top.length === 1) return { winners: [top[0].name], premium: {}, finishers: [], mode: "hands" };

  const maxPremium = Math.max(...top.map((t) => t.premium));
  const winners = top.filter((t) => t.premium === maxPremium).map((t) => t.name);
  return { winners, premium: Object.fromEntries(top.map((t) => [t.name, t.premium])), finishers: [], mode: "handsTiebreak" };
}
