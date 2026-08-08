import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTurn,
  createHorseGame,
  currentTurnPlayer,
  declinePlayer,
  horsePlayerRows,
  horseTargetLabel,
  isTurnStalled,
  skipStalledPlayer,
} from "../horse.js";
import { HORSE_WORDS, randomHorseWord } from "../horse-words.js";

function game2(now = 0) {
  return createHorseGame({ id: "g1", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia"], now });
}
function game3(now = 0) {
  return createHorseGame({ id: "g2", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia", "Dev"], now });
}

test("createHorseGame normalizes the word and seeds player state", () => {
  const g = game2();
  assert.equal(g.word, "HORSE");
  assert.equal(g.turnIndex, 0);
  assert.equal(g.target, null);
  assert.deepEqual(g.players, {
    You: { letters: 0, out: false, outAt: null },
    Mia: { letters: 0, out: false, outAt: null },
  });
});

test("createHorseGame rejects fewer than 2 players or a creator not in the list", () => {
  assert.throws(() => createHorseGame({ id: "x", word: "horse", sessionType: "live", createdBy: "You", players: ["You"] }));
  assert.throws(() => createHorseGame({ id: "x", word: "horse", sessionType: "live", createdBy: "Nobody", players: ["You", "Mia"] }));
});

test("opening set has no target and always sets the bar without a letter", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  assert.equal(g.target, 20);
  assert.equal(g.targetSetBy, "You");
  assert.equal(g.players.You.letters, 0);
  assert.equal(currentTurnPlayer(g), "Mia");
});

test("a failed set awards a letter AND resets the bar to the new low", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  g = applyTurn(g, { user: "Mia", reps: 12, now: 2 }); // fails to beat 20
  assert.equal(g.players.Mia.letters, 1);
  assert.equal(g.target, 12); // bar resets to the miss, basketball-HORSE style
  assert.equal(g.targetSetBy, "Mia");
  assert.equal(currentTurnPlayer(g), "You");
});

test("meeting or beating the target sets a new (higher or equal) bar with no letter", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  g = applyTurn(g, { user: "Mia", reps: 20, now: 2 }); // exactly matches
  assert.equal(g.players.Mia.letters, 0);
  assert.equal(g.target, 20);
});

test("2-player game ends immediately the instant one player spells the whole word", () => {
  let g = game2();
  const misses = [20, 15, 10, 8, 5]; // Mia misses every time -> H O R S E
  let turn = "You";
  let reps = 20;
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  for (let i = 0; i < 5; i += 1) {
    g = applyTurn(g, { user: "Mia", reps: misses[i] - 1 < 1 ? 1 : misses[i] - 1, now: i + 2 });
    if (g.status === "complete") break;
    g = applyTurn(g, { user: "You", reps: misses[i], now: i + 10 });
  }
  assert.equal(g.status, "complete");
  assert.equal(g.winner, "You");
  assert.equal(g.players.Mia.letters, 5);
  assert.equal(g.players.Mia.out, true);
});

test("3+ player game continues after one OUT, ends at last one standing", () => {
  let g = game3();
  g = applyTurn(g, { user: "You", reps: 30, now: 1 });
  // Mia misses 5 times in a row (against a bar that resets each miss)
  let bar = 30;
  for (let i = 0; i < 5; i += 1) {
    const miss = Math.max(1, bar - 5);
    g = applyTurn(g, { user: "Mia", reps: miss, now: 10 + i });
    bar = miss;
    if (g.players.Mia.out) break;
    // Dev and You both clear the (now lower) bar to keep the loop simple
    g = applyTurn(g, { user: "Dev", reps: bar + 10, now: 20 + i });
    bar = bar + 10;
    g = applyTurn(g, { user: "You", reps: bar + 10, now: 30 + i });
    bar = bar + 10;
  }
  assert.equal(g.players.Mia.out, true);
  assert.equal(g.status, "active"); // game keeps going with 2 players left
  assert.equal(currentTurnPlayer(g), "Dev");
});

test("last-one-standing wins a 3+ player game", () => {
  let g = { ...game3(), players: {
    You: { letters: 0, out: false, outAt: null },
    Mia: { letters: 5, out: true, outAt: 1 },
    Dev: { letters: 4, out: false, outAt: null },
  } };
  g = applyTurn(g, { user: "You", reps: 10, now: 1 }); // opening-style set, target null
  g = { ...g, turnIndex: g.turnOrder.indexOf("Dev") };
  g = applyTurn(g, { user: "Dev", reps: 1, now: 2 }); // fails, 5th letter -> OUT
  assert.equal(g.status, "complete");
  assert.equal(g.winner, "You");
});

test("skip awards a letter but leaves the target bar unchanged", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  const stalled = { ...g, turnStartedAt: 0 };
  assert.equal(isTurnStalled(stalled, 48 * 60 * 60 * 1000 + 1), true);
  assert.equal(isTurnStalled(stalled, 1000), false);
  const skipped = skipStalledPlayer(stalled, { now: 48 * 60 * 60 * 1000 + 1 });
  assert.equal(skipped.players.Mia.letters, 1);
  assert.equal(skipped.target, 20); // unchanged, unlike a played miss
  assert.equal(currentTurnPlayer(skipped), "You");
});

test("skipStalledPlayer throws if the turn is not actually stalled", () => {
  const g = game2(1000);
  assert.throws(() => skipStalledPlayer(g, { now: 2000 }));
});

test("declining before a first set removes the player from turn order", () => {
  let g = game3();
  g = declinePlayer(g, { user: "Dev", now: 5 });
  assert.deepEqual(g.turnOrder, ["You", "Mia"]);
  assert.equal(g.players.Dev, undefined);
  assert.equal(g.status, "active");
});

test("declining down to 1 remaining player voids the game", () => {
  let g = game2();
  g = declinePlayer(g, { user: "Mia", now: 5 });
  assert.equal(g.status, "voided");
});

test("declining cannot happen after the player has already taken a turn", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  g = applyTurn(g, { user: "Mia", reps: 25, now: 2 });
  assert.throws(() => declinePlayer(g, { user: "Mia" }));
});

test("horsePlayerRows reports up/waiting/out and each player's word-so-far", () => {
  let g = game3();
  g = applyTurn(g, { user: "You", reps: 30, now: 1 });
  g = applyTurn(g, { user: "Mia", reps: 5, now: 2 }); // misses -> H
  const rows = horsePlayerRows(g);
  assert.deepEqual(rows.map((r) => r.status), ["waiting", "waiting", "up"]);
  assert.deepEqual(rows.find((r) => r.name === "Mia"), { name: "Mia", letters: 1, out: false, status: "waiting", wordSoFar: "H" });
});

test("horseTargetLabel renders null before the opening set, then N+", () => {
  let g = game2();
  assert.equal(horseTargetLabel(g), null);
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  assert.equal(horseTargetLabel(g), "20+");
});

test("applyTurn rejects out-of-turn or finished-game submissions", () => {
  let g = game2();
  assert.throws(() => applyTurn(g, { user: "Mia", reps: 10, now: 1 }));
  g = { ...g, status: "complete" };
  assert.throws(() => applyTurn(g, { user: "You", reps: 10, now: 1 }));
});

test("HORSE_WORDS is a curated pool of unique 5-letter words", () => {
  assert.ok(HORSE_WORDS.length >= 30);
  assert.equal(new Set(HORSE_WORDS).size, HORSE_WORDS.length);
  for (const word of HORSE_WORDS) {
    assert.equal(word.length, 5, `${word} is not 5 letters`);
    assert.equal(word, word.toUpperCase());
  }
});

test("randomHorseWord can exclude the current word and stays in the pool", () => {
  const word = randomHorseWord("CHAOS", () => 0);
  assert.notEqual(word, "CHAOS");
  assert.ok(HORSE_WORDS.includes(word));
});
