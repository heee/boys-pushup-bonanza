// Runs the same scenarios as tests/horse-mode.test.js against the
// duplicated copy of the rules engine in worker/index.js, to catch the two
// drifting apart (see the top-of-file note in worker/index.js for why the
// duplication exists at all).
import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTurn,
  cancelOpenGame,
  chooseHorseTarget,
  createHorseGame,
  currentTurnPlayer,
  declinePlayer,
  HORSE_TIME_LIMITS,
  isTimeUp,
  joinOpenPlayer,
  startOpenGame,
  tallyGame,
  validateHorseCreate,
} from "../worker/index.js";

function game2(now = 0) {
  return createHorseGame({ id: "g1", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia"], now });
}
function game3(now = 0) {
  return createHorseGame({ id: "g2", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia", "Dev"], now });
}

// Beating an existing bar hands the shooter a choice instead of finalizing
// the target immediately (see tests/horse-mode.test.js). Fast-forward
// through it for tests that only care about the old always-1-up outcome.
function applyAndResolve(g, args) {
  g = applyTurn(g, args);
  if (g.pendingChoice) g = chooseHorseTarget(g, { user: g.pendingChoice.user, mode: "match", now: args.now });
  return g;
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

test("targetModifier tracks whoever set the target's modifier, mirroring horse.js", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, modifier: "wide", now: 1 });
  assert.equal(g.targetModifier, "wide");
  assert.equal(g.sets[0].modifier, "wide");
  g = applyTurn(g, { user: "Mia", reps: 25, now: 2 });
  g = chooseHorseTarget(g, { user: "Mia", mode: "match", now: 3 });
  assert.equal(g.targetModifier, null);
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
    g = applyAndResolve(g, { user: "You", reps: misses[i] + 5, now: i + 10 });
  }
  assert.equal(g.status, "complete");
  assert.deepEqual(g.winner, ["You"]);
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
  assert.deepEqual(g.winner, ["You"]);
});

test("match timer starts on the second player's first turn and tallyGame crowns the fewest letters", () => {
  const DAY = HORSE_TIME_LIMITS["24h"];
  let g = createHorseGame({ id: "g1", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia"], timeLimit: DAY, now: 0 });
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  assert.equal(g.timerStartedAt, null);
  assert.throws(() => tallyGame(g, DAY), /not expired/);
  g = applyTurn(g, { user: "Mia", reps: 25, now: 2 });
  g = chooseHorseTarget(g, { user: "Mia", mode: "match", now: 3 });
  assert.equal(g.timerStartedAt, 2);
  assert.equal(isTimeUp(g, 2 + DAY - 1), false);
  assert.equal(isTimeUp(g, 2 + DAY), true);
  g = { ...g, players: { You: { letters: 3, out: false, outAt: null }, Mia: { letters: 1, out: false, outAt: null } } };
  const tallied = tallyGame(g, 2 + DAY);
  assert.equal(tallied.status, "complete");
  assert.deepEqual(tallied.winner, ["Mia"]);
});

test("chooseHorseTarget mirrors horse.js: match/custom paths, bounds, and authorization", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  g = applyTurn(g, { user: "Mia", reps: 40, now: 2 }); // beats 20 by a lot, choice pending
  assert.throws(() => applyTurn(g, { user: "You", reps: 5, now: 3 }), /choice/);
  assert.throws(() => chooseHorseTarget(g, { user: "You", mode: "match", now: 3 }), /not this player's choice/i);
  assert.throws(() => chooseHorseTarget(g, { user: "Mia", mode: "custom", customTarget: 41, now: 3 }), /between 1 and 40/);
  const lowered = chooseHorseTarget(g, { user: "Mia", mode: "custom", customTarget: 25, now: 3 });
  assert.equal(lowered.target, 25);
  assert.equal(lowered.pendingChoice, null);
  assert.equal(currentTurnPlayer(lowered), "You");
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

test("Worker Open rules: joining waits for an explicit start, and declining/cancelling still work", () => {
  const input = validateHorseCreate({ word: "HORSE", createdBy: "You", players: ["You"], sessionType: "open" });
  assert.equal(input.sessionType, "open");
  let g = createHorseGame({ ...input, now: 1 });
  g = applyTurn(g, { user: "You", reps: 20, now: 2 });
  assert.equal(g.status, "active");
  g = joinOpenPlayer(g, { user: "Mia", now: 3 });
  assert.equal(currentTurnPlayer(g), "You");
  g = declinePlayer(g, { user: "Mia", now: 4 });
  assert.equal(g.status, "active");
  assert.equal(cancelOpenGame(g, { user: "You", now: 5 }).status, "cancelled");
});

test("Worker startOpenGame mirrors horse.js: hands off if the bar's already set, locks the roster", () => {
  const input = validateHorseCreate({ word: "HORSE", createdBy: "You", players: ["You"], sessionType: "open" });
  let g = createHorseGame({ ...input, now: 1 });
  g = joinOpenPlayer(g, { user: "Mia", now: 2 });
  assert.throws(() => startOpenGame(g, { user: "Mia", now: 3 }), /host/);
  g = applyTurn(g, { user: "You", reps: 20, now: 3 });
  const started = startOpenGame(g, { user: "You", now: 4 });
  assert.equal(started.startedAt, 4);
  assert.equal(currentTurnPlayer(started), "Mia");
  assert.throws(() => joinOpenPlayer(started, { user: "Dev", now: 5 }), /started/);
  assert.throws(() => cancelOpenGame(started, { user: "You", now: 5 }), /started/);
});

test("validateHorseCreate caps Open sessions at eight players", () => {
  assert.ok(validateHorseCreate({ word: "HORSE", createdBy: "A", players: ["A"], sessionType: "open" }));
  assert.equal(validateHorseCreate({ word: "HORSE", createdBy: "A", players: ["A", "B", "C", "D", "E", "F", "G", "H", "I"], sessionType: "open" }), null);
});
