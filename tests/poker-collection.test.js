import test from "node:test";
import assert from "node:assert/strict";
import {
  POKER_COLLECTION_RANKS,
  POKER_HAND_EXAMPLES,
  adjacentPokerCollectionCycle,
  isPokerCollectionCycleId,
  pokerCollectionCycleById,
  pokerCollectionCycleFromStart,
  pokerCollectionHandsCollected,
  pokerCollectionIsFullSet,
  pokerCollectionLeaderboard,
  pokerCollectionRowsForUser,
  pokerCollectionWinners,
  pokerHandCountsForUser,
  premiumHandCount,
} from "../screens/poker-collection.js";
import { evaluatePokerHand } from "../poker.js";

const window = { startDate: new Date(2026, 8, 21, 0, 0, 0, 0), endDate: new Date(2026, 9, 4, 23, 59, 59, 999) };
const timestampOf = (s) => s.timestamp.getTime();

function session(user, ranks, ts = new Date(2026, 8, 22)) {
  return { user, mode: "poker", pokerHandRanks: ranks, timestamp: ts };
}

test("poker collection cycle windows are 14 days, id round-trips, and steps adjacent cycles", () => {
  const cycle = pokerCollectionCycleFromStart(new Date(2026, 8, 21));
  assert.equal(cycle.id, "poker-2026-09-21");
  assert.equal(cycle.endDate.getTime(), new Date(2026, 9, 4, 23, 59, 59, 999).getTime());

  const parsed = pokerCollectionCycleById(cycle.id);
  assert.deepEqual(parsed, cycle);
  assert.equal(pokerCollectionCycleById("not-a-poker-id"), null);

  const next = adjacentPokerCollectionCycle(cycle, 1);
  assert.equal(cycle.endDate.getTime() + 1, next.startDate.getTime());
});

test("isPokerCollectionCycleId distinguishes poker-collection ids from bingo/curated ids", () => {
  assert.equal(isPokerCollectionCycleId("poker-2026-09-21"), true);
  assert.equal(isPokerCollectionCycleId("bingo-2026-09-21"), false);
  assert.equal(isPokerCollectionCycleId(undefined), false);
});

test("every illustrative hand example actually evaluates to its claimed rank", () => {
  for (const rank of POKER_COLLECTION_RANKS) {
    const evaluated = evaluatePokerHand(POKER_HAND_EXAMPLES[rank]);
    assert.equal(evaluated.rank, rank, `rank ${rank} example evaluated as ${evaluated.rank}`);
  }
});

test("pokerHandCountsForUser only counts in-window poker-mode sessions for that user", () => {
  const sessions = [
    session("A", [1, 1, 3]),
    session("A", [1], new Date(2026, 7, 1)), // out of window
    session("B", [1, 9]),
    { ...session("A", [9]), mode: "cards" }, // wrong mode
  ];
  const counts = pokerHandCountsForUser(sessions, "A", window, timestampOf);
  assert.equal(counts[1], 2);
  assert.equal(counts[3], 1);
  assert.equal(counts[9], 0);
});

test("collection rows/handsCollected/isFullSet reflect per-rank counts", () => {
  const sessions = POKER_COLLECTION_RANKS.map((rank) => session("A", [rank]));
  const rows = pokerCollectionRowsForUser(sessions, "A", window, timestampOf);
  assert.equal(rows.length, 9);
  assert.equal(pokerCollectionHandsCollected(rows), 9);
  assert.equal(pokerCollectionIsFullSet(rows), true);

  const partial = pokerCollectionRowsForUser(sessions.slice(0, 3), "A", window, timestampOf);
  assert.equal(pokerCollectionHandsCollected(partial), 3);
  assert.equal(pokerCollectionIsFullSet(partial), false);
});

test("premiumHandCount sums only Two-Pair-or-better occurrences", () => {
  const sessions = [session("A", [1, 1, 2, 6, 9])];
  assert.equal(premiumHandCount(sessions, "A", window, timestampOf), 3); // 2, 6, 9 qualify; the two 1s don't
});

test("pokerCollectionLeaderboard ranks by hands collected then premium volume", () => {
  const sessions = [session("A", [1, 2, 3]), session("B", [1, 2, 2, 2])];
  const rows = pokerCollectionLeaderboard(["A", "B"], sessions, window, timestampOf);
  assert.equal(rows[0].name, "A"); // 3 distinct hands beats B's 2
  assert.equal(rows[1].name, "B");
});

test("pokerCollectionWinners: full-set finishers are tiebroken by premium hand volume", () => {
  const full = POKER_COLLECTION_RANKS;
  const sessions = [session("A", full), session("B", [...full, 9, 9])];
  const result = pokerCollectionWinners(["A", "B"], sessions, window, timestampOf);
  assert.equal(result.mode, "premium");
  assert.deepEqual(result.winners, ["B"]);
});

test("pokerCollectionWinners: no finisher falls back to most hands collected, tiebroken by premium", () => {
  const sessions = [session("A", [1, 2, 3]), session("B", [1, 2, 9, 9])];
  const result = pokerCollectionWinners(["A", "B"], sessions, window, timestampOf);
  assert.equal(result.mode, "handsTiebreak");
  // both collected 3 distinct hands; B logged an extra premium (rank-9) occurrence
  assert.deepEqual(result.winners, ["B"]);

  const nobody = pokerCollectionWinners(["A", "B"], [], window, timestampOf);
  assert.deepEqual(nobody.winners, []);
  assert.equal(nobody.mode, "none");
});
