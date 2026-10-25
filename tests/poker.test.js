import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePokerHand, pokerAchievementIds, pokerAchievementsFromSessions } from "../poker.js";
import { buildCorpus, POKER_CALLOUTS } from "../voice-lines.js";

const card = (label, suit) => ({ label, suit });

test("recognizes every poker tier including wheel and royal flush", () => {
  const hands = [
    [["A","s"],["9","h"],["7","d"],["4","c"],["2","s"]],
    [["A","s"],["A","h"],["7","d"],["4","c"],["2","s"]],
    [["A","s"],["A","h"],["7","d"],["7","c"],["2","s"]],
    [["A","s"],["A","h"],["A","d"],["7","c"],["2","s"]],
    [["A","s"],["2","h"],["3","d"],["4","c"],["5","s"]],
    [["A","s"],["9","s"],["7","s"],["4","s"],["2","s"]],
    [["A","s"],["A","h"],["A","d"],["7","c"],["7","s"]],
    [["A","s"],["A","h"],["A","d"],["A","c"],["7","s"]],
    [["5","h"],["6","h"],["7","h"],["8","h"],["9","h"]],
    [["10","s"],["J","s"],["Q","s"],["K","s"],["A","s"]],
  ].map((hand) => hand.map(([label, suit]) => card(label, suit)));
  assert.deepEqual(hands.map((hand) => evaluatePokerHand(hand).rank), [0,1,2,3,4,5,6,7,8,9]);
  assert.equal(evaluatePokerHand(hands[4]).label, "Straight");
  assert.equal(evaluatePokerHand(hands[9]).label, "Royal Flush");
});

test("achievements begin at pair and represent the completed tier", () => {
  assert.deepEqual(pokerAchievementIds(0), []);
  assert.deepEqual(pokerAchievementIds(1), ["pair"]);
  assert.deepEqual(pokerAchievementIds(9), ["royal-flush"]);
});

test("permanent achievements are recovered from current and legacy poker metadata", () => {
  const sessions = [
    { pokerHandRanks: [0, 2, 6] },
    { pokerAchievementsUnlocked: ["pair", "straight-flush"] },
    { pokerHandRanks: [99, null] },
  ];
  assert.deepEqual(pokerAchievementsFromSessions(sessions), [1, 2, 6, 8]);
});

test("every Poker callout is included in the pre-rendered voice corpus", () => {
  const corpusLines = new Set(buildCorpus().map((entry) => entry.text));
  for (const lines of Object.values(POKER_CALLOUTS)) {
    for (const line of lines) assert.ok(corpusLines.has(line));
  }
});

test("bestPokerHand picks the strongest five of seven", async () => {
  const { bestPokerHand } = await import("../poker.js");
  const c = (label, suit) => ({ label, suit });
  const flushInSeven = [c("2", "hearts"), c("K", "spades"), c("7", "hearts"), c("9", "hearts"), c("5", "clubs"), c("J", "hearts"), c("4", "hearts")];
  const flush = bestPokerHand(flushInSeven);
  assert.equal(flush.label, "Flush");
  assert.deepEqual(flush.used, [0, 2, 3, 5, 6]);
  const fullHouse = bestPokerHand([c("9", "hearts"), c("9", "spades"), c("9", "clubs"), c("4", "hearts"), c("4", "spades"), c("4", "clubs"), c("A", "hearts")]);
  assert.equal(fullHouse.label, "Full House");
  assert.equal(bestPokerHand([c("2", "hearts"), c("2", "spades"), c("5", "clubs"), c("9", "hearts"), c("J", "spades")]).label, "Pair");
  assert.equal(bestPokerHand([c("2", "hearts")]), null);
});
