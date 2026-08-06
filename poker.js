export const POKER_HANDS = Object.freeze([
  "High Card", "Pair", "Two Pair", "Three of a Kind", "Straight",
  "Flush", "Full House", "Four of a Kind", "Straight Flush", "Royal Flush",
]);

const RANK_VALUE = { A: 14, K: 13, Q: 12, J: 11 };

export function evaluatePokerHand(cards) {
  if (!Array.isArray(cards) || cards.length !== 5) return null;
  const values = cards.map((card) => RANK_VALUE[card.label] || Number(card.label)).sort((a, b) => a - b);
  if (values.some((value) => !Number.isFinite(value))) return null;
  const counts = [...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map()).values()].sort((a, b) => b - a);
  const flush = new Set(cards.map((card) => card.suit)).size === 1;
  const unique = [...new Set(values)];
  const wheel = unique.join(",") === "2,3,4,5,14";
  const straight = unique.length === 5 && (wheel || unique[4] - unique[0] === 4);
  let rank = 0;
  if (straight && flush) rank = values[0] === 10 ? 9 : 8;
  else if (counts[0] === 4) rank = 7;
  else if (counts[0] === 3 && counts[1] === 2) rank = 6;
  else if (flush) rank = 5;
  else if (straight) rank = 4;
  else if (counts[0] === 3) rank = 3;
  else if (counts[0] === 2 && counts[1] === 2) rank = 2;
  else if (counts[0] === 2) rank = 1;
  const label = POKER_HANDS[rank];
  return { rank, id: label.toLowerCase().replaceAll(" ", "-"), label, premium: rank >= 2 };
}

export function bestPokerRank(hands) {
  return hands.reduce((best, hand) => Math.max(best, Number(hand?.rank) || 0), 0);
}

export function pokerAchievementIds(rank) {
  return rank >= 1 ? [POKER_HANDS[rank].toLowerCase().replaceAll(" ", "-")] : [];
}

export function pokerAchievementsFromSessions(sessions) {
  const ranks = new Set();
  for (const session of sessions || []) {
    for (const rank of session?.pokerHandRanks || []) {
      const value = Number(rank);
      if (value >= 1 && value <= 9) ranks.add(value);
    }
    for (const id of session?.pokerAchievementsUnlocked || []) {
      const rank = POKER_HANDS.findIndex((label) => label.toLowerCase().replaceAll(" ", "-") === id);
      if (rank >= 1) ranks.add(rank);
    }
  }
  return [...ranks].sort((a, b) => a - b);
}
