import test from "node:test";
import assert from "node:assert/strict";
import {
  BINGO_POOL,
  adjacentBingoCycle,
  bingoCategoryPoints,
  bingoCompletionForUser,
  bingoCycleById,
  bingoCycleForDate,
  bingoIsFullCard,
  bingoLeaderboard,
  bingoSquaresChecked,
  bingoWinners,
  generateBingoBoard,
  isBingoCycleId,
  repsForItem,
  sessionMatchesBingoItem,
} from "../screens/bingo.js";

test("bingo cycle windows are 14 days, local-midnight anchored, and non-overlapping", () => {
  const cycle = bingoCycleForDate(new Date(2026, 0, 5, 12));
  assert.equal(cycle.id, "bingo-2026-01-01");
  assert.equal(cycle.startDate.getTime(), new Date(2026, 0, 1, 0, 0, 0, 0).getTime());
  assert.equal(cycle.endDate.getTime(), new Date(2026, 0, 14, 23, 59, 59, 999).getTime());

  const next = bingoCycleForDate(new Date(2026, 0, 15, 0, 0, 0, 1));
  assert.equal(next.id, "bingo-2026-01-15");
  assert.equal(next.startDate.getTime(), cycle.endDate.getTime() + 1);
});

test("bingoCycleById round-trips a cycle's window from its id alone", () => {
  const cycle = bingoCycleForDate(new Date(2026, 2, 1));
  const parsed = bingoCycleById(cycle.id);
  assert.deepEqual(parsed, cycle);
  assert.equal(bingoCycleById("not-a-bingo-id"), null);
});

test("adjacentBingoCycle steps whole cycles forward and back", () => {
  const cycle = bingoCycleForDate(new Date(2026, 0, 5));
  const prev = adjacentBingoCycle(cycle, -1);
  const next = adjacentBingoCycle(cycle, 1);
  assert.equal(prev.endDate.getTime() + 1, cycle.startDate.getTime());
  assert.equal(cycle.endDate.getTime() + 1, next.startDate.getTime());
});

test("isBingoCycleId distinguishes bingo ids from curated challenge ids", () => {
  assert.equal(isBingoCycleId("bingo-2026-01-01"), true);
  assert.equal(isBingoCycleId("worldcup-2026"), false);
  assert.equal(isBingoCycleId(undefined), false);
});

test("generated board has 25 cells, a FREE center, and 24 filled squares drawn from the pool", () => {
  const board = generateBingoBoard("bingo-2026-01-01");
  assert.equal(board.length, 25);
  assert.equal(board[12].free, true);
  const filled = board.filter((c) => !c.free);
  assert.equal(filled.length, 24);
  for (const cell of filled) {
    assert.ok(BINGO_POOL.some((item) => item.key === cell.item.key && item.kind === cell.item.kind));
  }
});

test("board generation is deterministic per cycle id and varies across cycles", () => {
  const a = generateBingoBoard("bingo-2026-01-01");
  const b = generateBingoBoard("bingo-2026-01-01");
  assert.deepEqual(a, b);
  const c = generateBingoBoard("bingo-2026-01-15");
  assert.notDeepEqual(a, c);
});

test("pool is short of 24 so some items necessarily repeat, but not unboundedly", () => {
  const board = generateBingoBoard("bingo-2026-06-01");
  const counts = {};
  for (const cell of board) {
    if (cell.free) continue;
    counts[cell.item.key] = (counts[cell.item.key] || 0) + 1;
  }
  assert.ok(Object.keys(counts).length <= BINGO_POOL.length);
  assert.ok(Object.values(counts).every((n) => n >= 1 && n <= 2));
});

test("sessionMatchesBingoItem routes modes, exercise types, and modifiers correctly", () => {
  assert.equal(sessionMatchesBingoItem({ mode: "cards" }, { kind: "mode", key: "cards" }), true);
  assert.equal(sessionMatchesBingoItem({ mode: "dice" }, { kind: "mode", key: "cards" }), false);
  assert.equal(sessionMatchesBingoItem({}, { kind: "exercise", key: "pushups" }), true);
  assert.equal(sessionMatchesBingoItem({ mode: "cards" }, { kind: "exercise", key: "pushups" }), false);
  assert.equal(sessionMatchesBingoItem({ type: "squat" }, { kind: "exercise", key: "squats" }), true);
  assert.equal(sessionMatchesBingoItem({ type: "situp" }, { kind: "exercise", key: "situps" }), true);
  assert.equal(sessionMatchesBingoItem({ type: "plank" }, { kind: "exercise", key: "planks" }), true);
  assert.equal(sessionMatchesBingoItem({ weightLbs: 10 }, { kind: "modifier", key: "weighted" }), true);
  assert.equal(sessionMatchesBingoItem({ weightLbs: 0 }, { kind: "modifier", key: "weighted" }), false);
  assert.equal(sessionMatchesBingoItem({ location: { lat: 1, lng: 2 } }, { kind: "modifier", key: "location" }), true);
  assert.equal(sessionMatchesBingoItem({}, { kind: "modifier", key: "location" }), false);
});

const window = { startDate: new Date(2026, 0, 1, 0, 0, 0, 0), endDate: new Date(2026, 0, 14, 23, 59, 59, 999) };
const cardsItem = { kind: "mode", key: "cards", label: "Cards" };
const squatsItem = { kind: "exercise", key: "squats", label: "Squats" };
const board = [
  { index: 0, free: false, item: cardsItem },
  { index: 1, free: false, item: squatsItem },
  { index: 12, free: true, item: null },
];
const timestampOf = (s) => s.timestamp;

test("bingoCompletionForUser: FREE is always done; a matching in-window session flips a square done", () => {
  const sessions = [
    { user: "Henning", mode: "cards", count: 20, timestamp: new Date(2026, 0, 3).getTime() },
  ];
  const completed = bingoCompletionForUser(board, sessions, "Henning", window, timestampOf);
  assert.equal(completed.find((c) => c.index === 12).done, true);
  assert.equal(completed.find((c) => c.index === 0).done, true);
  assert.equal(completed.find((c) => c.index === 1).done, false);
});

test("bingoCompletionForUser ignores out-of-window and other-user sessions", () => {
  const sessions = [
    { user: "Henning", mode: "cards", count: 20, timestamp: new Date(2025, 11, 31).getTime() }, // before window
    { user: "Phil", mode: "cards", count: 20, timestamp: new Date(2026, 0, 3).getTime() }, // other user
  ];
  const completed = bingoCompletionForUser(board, sessions, "Henning", window, timestampOf);
  assert.equal(completed.find((c) => c.index === 0).done, false);
});

test("bingoSquaresChecked / bingoIsFullCard count correctly", () => {
  const sessions = [
    { user: "Henning", mode: "cards", count: 20, timestamp: new Date(2026, 0, 3).getTime() },
    { user: "Henning", type: "squat", count: 30, timestamp: new Date(2026, 0, 4).getTime() },
  ];
  const completed = bingoCompletionForUser(board, sessions, "Henning", window, timestampOf);
  assert.equal(bingoSquaresChecked(completed), 3);
  assert.equal(bingoIsFullCard(completed), true);
});

test("repsForItem sums only matching, in-window, same-user sessions", () => {
  const sessions = [
    { user: "Henning", mode: "cards", count: 20, timestamp: new Date(2026, 0, 3).getTime() },
    { user: "Henning", mode: "cards", count: 15, timestamp: new Date(2026, 0, 5).getTime() },
    { user: "Henning", mode: "dice", count: 99, timestamp: new Date(2026, 0, 5).getTime() },
    { user: "Phil", mode: "cards", count: 999, timestamp: new Date(2026, 0, 5).getTime() },
  ];
  assert.equal(repsForItem(sessions, "Henning", cardsItem, window, timestampOf), 35);
});

test("bingoCategoryPoints awards one point per square to the top logger, sharing ties", () => {
  const sessions = [
    { user: "A", mode: "cards", count: 30, timestamp: new Date(2026, 0, 3).getTime() },
    { user: "B", mode: "cards", count: 30, timestamp: new Date(2026, 0, 4).getTime() },
    { user: "A", type: "squat", count: 50, timestamp: new Date(2026, 0, 3).getTime() },
  ];
  const points = bingoCategoryPoints(board, ["A", "B"], sessions, window, timestampOf);
  assert.deepEqual(points, { A: 2, B: 1 });
});

test("bingoWinners: finishers race on category points, and ties share the win", () => {
  const sessions = [
    { user: "A", mode: "cards", count: 10, timestamp: new Date(2026, 0, 3).getTime() },
    { user: "A", type: "squat", count: 40, timestamp: new Date(2026, 0, 3).getTime() },
    { user: "B", mode: "cards", count: 50, timestamp: new Date(2026, 0, 3).getTime() },
    { user: "B", type: "squat", count: 10, timestamp: new Date(2026, 0, 3).getTime() },
  ];
  const result = bingoWinners(board, ["A", "B"], sessions, window, timestampOf);
  assert.equal(result.mode, "categoryPoints");
  assert.deepEqual(result.winners.sort(), ["A", "B"]); // A wins squats, B wins cards -> 1-1 tie, both win
});

const diceItem = { kind: "mode", key: "dice", label: "Dice" };
const threeSquareBoard = [...board, { index: 2, free: false, item: diceItem }];

test("bingoWinners: nobody finished falls back to most-squares-checked", () => {
  const sessions = [
    { user: "A", mode: "cards", count: 10, timestamp: new Date(2026, 0, 3).getTime() },
    { user: "B", mode: "cards", count: 10, timestamp: new Date(2026, 0, 3).getTime() },
    { user: "B", type: "squat", count: 10, timestamp: new Date(2026, 0, 3).getTime() },
  ];
  const result = bingoWinners(threeSquareBoard, ["A", "B"], sessions, window, timestampOf);
  assert.equal(result.mode, "squares");
  assert.deepEqual(result.winners, ["B"]);
});

test("bingoWinners: no-finisher tie at max squares breaks via category points among the tied", () => {
  const sessions = [
    { user: "A", mode: "cards", count: 40, timestamp: new Date(2026, 0, 3).getTime() },
    { user: "B", mode: "cards", count: 5, timestamp: new Date(2026, 0, 3).getTime() },
  ];
  const result = bingoWinners(board, ["A", "B"], sessions, window, timestampOf);
  assert.equal(result.mode, "squaresTiebreak");
  assert.deepEqual(result.winners, ["A"]);
});

test("bingoWinners with no participants returns an empty result", () => {
  const result = bingoWinners(board, [], [], window, timestampOf);
  assert.deepEqual(result, { winners: [], categoryPoints: {}, finishers: [], mode: "none" });
});

test("bingoLeaderboard ranks by squares checked, finishers ahead of ties", () => {
  const sessions = [
    { user: "A", mode: "cards", count: 10, timestamp: new Date(2026, 0, 3).getTime() },
    { user: "B", mode: "cards", count: 10, timestamp: new Date(2026, 0, 3).getTime() },
    { user: "B", type: "squat", count: 10, timestamp: new Date(2026, 0, 3).getTime() },
  ];
  const rows = bingoLeaderboard(board, ["A", "B"], sessions, window, timestampOf);
  assert.deepEqual(rows.map((r) => r.name), ["B", "A"]);
  assert.equal(rows[0].fullCard, true);
});
