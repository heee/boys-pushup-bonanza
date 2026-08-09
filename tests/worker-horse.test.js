// Runs the same scenarios as tests/horse-mode.test.js against the
// duplicated copy of the rules engine in worker/index.js, to catch the two
// drifting apart (see the top-of-file note in worker/index.js for why the
// duplication exists at all).
import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTurn,
  createHorseGame,
  currentTurnPlayer,
  declinePlayer,
  isTurnStalled,
  skipStalledPlayer,
  validateHorseCreate,
} from "../worker/index.js";

function game2(now = 0) {
  return createHorseGame({ id: "g1", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia"], now });
}
function game3(now = 0) {
  return createHorseGame({ id: "g2", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia", "Dev"], now });
}

test("createHorseGame normalizes the word and seeds player state", () => {
  const g = game2();
  assert.equal(g.word, "HORSE");
  assert.equal(g.target, null);
  assert.deepEqual(g.players, {
    You: { letters: 0, out: false, outAt: null },
    Mia: { letters: 0, out: false, outAt: null },
  });
});

test("opening set has no target and always sets the bar without a letter", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  assert.equal(g.target, 20);
  assert.equal(g.players.You.letters, 0);
  assert.equal(currentTurnPlayer(g), "Mia");
});

test("a failed set awards a letter and resets the bar to the new low", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  g = applyTurn(g, { user: "Mia", reps: 12, now: 2 });
  assert.equal(g.players.Mia.letters, 1);
  assert.equal(g.target, 12);
});

test("2-player game ends immediately once one player spells the whole word", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  const misses = [19, 15, 10, 8, 5];
  for (let i = 0; i < 5; i += 1) {
    g = applyTurn(g, { user: "Mia", reps: misses[i], now: i + 2 });
    if (g.status === "complete") break;
    g = applyTurn(g, { user: "You", reps: misses[i] + 5, now: i + 10 });
  }
  assert.equal(g.status, "complete");
  assert.equal(g.winner, "You");
  assert.equal(g.players.Mia.out, true);
});

test("3+ player last-one-standing wins", () => {
  let g = { ...game3(), players: {
    You: { letters: 0, out: false, outAt: null },
    Mia: { letters: 5, out: true, outAt: 1 },
    Dev: { letters: 4, out: false, outAt: null },
  } };
  g = applyTurn(g, { user: "You", reps: 10, now: 1 });
  g = { ...g, turnIndex: g.turnOrder.indexOf("Dev") };
  g = applyTurn(g, { user: "Dev", reps: 1, now: 2 });
  assert.equal(g.status, "complete");
  assert.equal(g.winner, "You");
});

test("skip awards a letter but leaves the target bar unchanged, and requires an actual stall", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  assert.throws(() => skipStalledPlayer(g, { now: 2000 }));
  const stalled = { ...g, turnStartedAt: 0 };
  assert.equal(isTurnStalled(stalled, 48 * 60 * 60 * 1000 + 1), true);
  const skipped = skipStalledPlayer(stalled, { now: 48 * 60 * 60 * 1000 + 1 });
  assert.equal(skipped.players.Mia.letters, 1);
  assert.equal(skipped.target, 20);
});

test("declining before a first set removes the player; declining to <2 voids the game", () => {
  let g = game3();
  g = declinePlayer(g, { user: "Dev", now: 5 });
  assert.deepEqual(g.turnOrder, ["You", "Mia"]);
  g = declinePlayer(g, { user: "Mia", now: 6 });
  assert.equal(g.status, "voided");
});

test("validateHorseCreate enforces a 5-letter word, 2-8 players, and creator membership", () => {
  const ok = validateHorseCreate({ word: "horse", createdBy: "You", players: ["You", "Mia"] });
  assert.equal(ok.word, "HORSE");
  assert.equal(ok.sessionType, "live");
  assert.equal(validateHorseCreate({ word: "HORS", createdBy: "You", players: ["You", "Mia"] }), null);
  assert.equal(validateHorseCreate({ word: "HORSE", createdBy: "You", players: ["You"] }), null);
  assert.equal(validateHorseCreate({ word: "HORSE", createdBy: "Nobody", players: ["You", "Mia"] }), null);
  assert.equal(validateHorseCreate({ word: "HORSE", createdBy: "You", players: ["You", "You", "Mia"] }).players.length, 2);
  assert.equal(validateHorseCreate({ word: "HORSE", createdBy: "You", players: ["You", "Mia"], sessionType: "invite" }).sessionType, "invite");
});
