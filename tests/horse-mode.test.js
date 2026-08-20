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
  horsePlayerRows,
  horseTargetLabel,
  isTimeUp,
  joinOpenPlayer,
  tallyGame,
} from "../horse.js";
import { HORSE_WORDS, randomHorseWord } from "../horse-words.js";

function game2(now = 0) {
  return createHorseGame({ id: "g1", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia"], now });
}
function game3(now = 0) {
  return createHorseGame({ id: "g2", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia", "Dev"], now });
}

// Beating an existing bar now hands the shooter a choice instead of
// finalizing the target immediately. Tests that only care about the old
// always-1-up outcome use this to fast-forward through that choice.
function applyAndResolve(g, args) {
  g = applyTurn(g, args);
  if (g.pendingChoice) g = chooseHorseTarget(g, { user: g.pendingChoice.user, mode: "match", now: args.now });
  return g;
}

test("createHorseGame normalizes the word and seeds player state", () => {
  const g = game2();
  assert.equal(g.word, "HORSE");
  assert.equal(g.turnIndex, 0);
  assert.equal(g.target, null);
  assert.equal(g.timeLimit, null);
  assert.equal(g.timerStartedAt, null);
  assert.deepEqual(g.players, {
    You: { letters: 0, out: false, outAt: null },
    Mia: { letters: 0, out: false, outAt: null },
  });
});

test("createHorseGame accepts a match time limit from HORSE_TIME_LIMITS", () => {
  const g = createHorseGame({ id: "g1", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia"], timeLimit: HORSE_TIME_LIMITS["48h"] });
  assert.equal(g.timeLimit, 48 * 60 * 60 * 1000);
  assert.equal(g.timerStartedAt, null);
});

test("createHorseGame rejects fewer than 2 players or a creator not in the list", () => {
  assert.throws(() => createHorseGame({ id: "x", word: "horse", sessionType: "live", createdBy: "You", players: ["You"] }));
  assert.throws(() => createHorseGame({ id: "x", word: "horse", sessionType: "live", createdBy: "Nobody", players: ["You", "Mia"] }));
});

test("Open Horse starts with the host alone and does not crown a solo winner", () => {
  let g = createHorseGame({ id: "open-1", word: "horse", sessionType: "open", createdBy: "You", players: ["You"], now: 1 });
  g = applyTurn(g, { user: "You", reps: 24, now: 2 });
  assert.equal(g.status, "active");
  assert.equal(g.winner, null);
  assert.equal(g.target, 24);
});

test("first Open challenger is immediately up when the host already set the bar", () => {
  let g = createHorseGame({ id: "open-1", word: "horse", sessionType: "open", createdBy: "You", players: ["You"], now: 1 });
  g = applyTurn(g, { user: "You", reps: 24, now: 2 });
  g = joinOpenPlayer(g, { user: "Mia", now: 3 });
  assert.deepEqual(g.turnOrder, ["You", "Mia"]);
  assert.equal(currentTurnPlayer(g), "Mia");
  assert.equal(g.players.Mia.joinedAt, 3);
});

test("Open challengers joining before the first set queue behind the host in arrival order", () => {
  let g = createHorseGame({ id: "open-1", word: "horse", sessionType: "open", createdBy: "You", players: ["You"], now: 1 });
  g = joinOpenPlayer(g, { user: "Mia", now: 2 });
  g = joinOpenPlayer(g, { user: "Dev", now: 3 });
  assert.equal(currentTurnPlayer(g), "You");
  assert.deepEqual(g.turnOrder, ["You", "Mia", "Dev"]);
  assert.equal(g.players.Dev.letters, 0);
});

test("Open Horse caps at eight and treats repeat joins as idempotent", () => {
  let g = createHorseGame({ id: "open-1", word: "horse", sessionType: "open", createdBy: "You", players: ["You"], now: 1 });
  for (const name of ["Mia", "Dev", "Lee", "Ann", "Bo", "Cy", "Di"]) g = joinOpenPlayer(g, { user: name });
  assert.equal(joinOpenPlayer(g, { user: "Mia" }), g);
  assert.throws(() => joinOpenPlayer(g, { user: "Sam" }), /full/);
});

test("an Open player can leave before playing and frees the slot without voiding the host", () => {
  let g = createHorseGame({ id: "open-1", word: "horse", sessionType: "open", createdBy: "You", players: ["You"], now: 1 });
  g = joinOpenPlayer(g, { user: "Mia", now: 2 });
  g = declinePlayer(g, { user: "Mia", now: 3 });
  assert.equal(g.status, "active");
  assert.deepEqual(g.turnOrder, ["You"]);
  assert.throws(() => declinePlayer(g, { user: "You" }), /cancel/);
});

test("only a solo Open host can cancel", () => {
  const solo = createHorseGame({ id: "open-1", word: "horse", sessionType: "open", createdBy: "You", players: ["You"], now: 1 });
  assert.equal(cancelOpenGame(solo, { user: "You", now: 2 }).status, "cancelled");
  const joined = joinOpenPlayer(solo, { user: "Mia", now: 3 });
  assert.throws(() => cancelOpenGame(joined, { user: "You" }), /challengers/);
  assert.throws(() => cancelOpenGame(solo, { user: "Mia" }), /host/);
});

test("opening set has no target and always sets the bar without a letter", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  assert.equal(g.target, 20);
  assert.equal(g.targetSetBy, "You");
  assert.equal(g.players.You.letters, 0);
  assert.equal(currentTurnPlayer(g), "Mia");
});

test("targetModifier tracks whatever modifier the target-setter used, regardless of outcome", () => {
  let g = game2();
  assert.equal(g.targetModifier, null);
  g = applyTurn(g, { user: "You", reps: 20, modifier: "wide", now: 1 });
  assert.equal(g.targetModifier, "wide");
  assert.equal(g.sets[0].modifier, "wide");
  // Mia fails to beat 20 (using a different modifier for her own attempt) —
  // the new target's modifier is HERS now, not You's.
  g = applyTurn(g, { user: "Mia", reps: 12, modifier: "diamond", now: 2 });
  assert.equal(g.targetModifier, "diamond");
  // You beats it, triggering the shooter's choice — picking "match" finalizes
  // it exactly like the old always-1-up behavior. No modifier passed at all
  // defaults to null (no grip requirement).
  g = applyTurn(g, { user: "You", reps: 25, now: 3 });
  g = chooseHorseTarget(g, { user: "You", mode: "match", now: 4 });
  assert.equal(g.targetModifier, null);
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
  // Beating an existing bar doesn't finalize the target right away — it
  // hands Mia the choice of what to leave the next player.
  assert.deepEqual(g.pendingChoice, { user: "Mia", reps: 20, modifier: null });
  assert.equal(g.target, 20); // still the bar Mia just beat, unchanged until she picks
  g = chooseHorseTarget(g, { user: "Mia", mode: "match", now: 3 });
  assert.equal(g.target, 20);
  assert.equal(g.pendingChoice, null);
});

test("the opening bar-setting shot never triggers a target choice", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  assert.equal(g.pendingChoice, null);
  assert.equal(g.target, 20);
});

test("a miss never triggers a target choice, even against a bar it fails to beat", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  g = applyTurn(g, { user: "Mia", reps: 12, now: 2 }); // fails
  assert.equal(g.pendingChoice, null);
  assert.equal(g.target, 12);
});

test("no one can take a turn while a target choice is pending", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  g = applyTurn(g, { user: "Mia", reps: 20, now: 2 }); // beats it, choice pending
  assert.throws(() => applyTurn(g, { user: "You", reps: 5, now: 3 }), /choice/);
  assert.throws(() => applyTurn(g, { user: "Mia", reps: 5, now: 3 }), /choice/);
});

test("chooseHorseTarget rejects anyone but the shooter from resolving the choice", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  g = applyTurn(g, { user: "Mia", reps: 20, now: 2 });
  assert.throws(() => chooseHorseTarget(g, { user: "You", mode: "match", now: 3 }), /not this player's choice/i);
});

test("chooseHorseTarget custom mode bounds the target to [1, shooter's reps]", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  g = applyTurn(g, { user: "Mia", reps: 40, now: 2 }); // beats 20 by a lot
  assert.throws(() => chooseHorseTarget(g, { user: "Mia", mode: "custom", customTarget: 0, now: 3 }), /between 1 and 40/);
  assert.throws(() => chooseHorseTarget(g, { user: "Mia", mode: "custom", customTarget: 41, now: 3 }), /between 1 and 40/);
  assert.throws(() => chooseHorseTarget(g, { user: "Mia", mode: "custom", customTarget: NaN, now: 3 }), /between 1 and 40/);
  const lowered = chooseHorseTarget(g, { user: "Mia", mode: "custom", customTarget: 25, now: 3 });
  assert.equal(lowered.target, 25);
  assert.equal(lowered.targetSetBy, "Mia");
  assert.equal(lowered.pendingChoice, null);
  assert.equal(currentTurnPlayer(lowered), "You");
});

test("chooseHorseTarget rejects an unknown mode and calling with no choice pending", () => {
  let g = game2();
  g = applyTurn(g, { user: "You", reps: 20, now: 1 }); // opening shot, no pending choice
  assert.throws(() => chooseHorseTarget(g, { user: "You", mode: "match", now: 2 }), /no target choice is pending/i);
  g = applyTurn(g, { user: "Mia", reps: 20, now: 2 }); // now one is pending
  assert.throws(() => chooseHorseTarget(g, { user: "Mia", mode: "bogus", now: 3 }), /unknown/i);
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
    g = applyAndResolve(g, { user: "You", reps: misses[i], now: i + 10 });
  }
  assert.equal(g.status, "complete");
  assert.deepEqual(g.winner, ["You"]);
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
    // Dev and You both clear the (now lower) bar to keep the loop simple —
    // each clear triggers the shooter's choice; "match" reproduces the old
    // always-1-up behavior.
    g = applyAndResolve(g, { user: "Dev", reps: bar + 10, now: 20 + i });
    bar = bar + 10;
    g = applyAndResolve(g, { user: "You", reps: bar + 10, now: 30 + i });
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
  assert.deepEqual(g.winner, ["You"]);
});

test("the match timer starts only once the second distinct player takes their first turn", () => {
  let g = createHorseGame({ id: "g1", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia"], timeLimit: HORSE_TIME_LIMITS["24h"], now: 0 });
  assert.equal(g.timerStartedAt, null);
  g = applyTurn(g, { user: "You", reps: 20, now: 1 }); // first player's first turn — clock still not running
  assert.equal(g.timerStartedAt, null);
  g = applyTurn(g, { user: "Mia", reps: 25, now: 500 }); // second player's first turn — beats the bar, so it's pending on her choice
  assert.equal(g.timerStartedAt, null);
  // The clock reflects when Mia's set actually happened (now: 500), not
  // whenever she gets around to resolving the choice.
  g = chooseHorseTarget(g, { user: "Mia", mode: "match", now: 700 });
  assert.equal(g.timerStartedAt, 500);
  g = applyTurn(g, { user: "You", reps: 30, now: 900 }); // later turns never move the start
  assert.equal(g.timerStartedAt, 500);
});

test("isTimeUp only fires once the timer has started and the limit has elapsed", () => {
  const DAY = HORSE_TIME_LIMITS["24h"];
  let g = createHorseGame({ id: "g1", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia"], timeLimit: DAY, now: 0 });
  g = applyTurn(g, { user: "You", reps: 20, now: 0 });
  g = applyTurn(g, { user: "Mia", reps: 15, now: 1000 }); // starts the clock at 1000
  assert.equal(isTimeUp(g, 1000 + DAY - 1), false);
  assert.equal(isTimeUp(g, 1000 + DAY), true);
  // Unlimited games never time out, even with a running clock.
  const unlimited = createHorseGame({ id: "g2", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia"], now: 0 });
  assert.equal(isTimeUp(unlimited, Number.MAX_SAFE_INTEGER), false);
});

test("tallyGame crowns whoever has the fewest letters once the timer expires, ties share the win", () => {
  const DAY = HORSE_TIME_LIMITS["24h"];
  let g = createHorseGame({ id: "g1", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia", "Dev"], timeLimit: DAY, now: 0 });
  g = applyTurn(g, { user: "You", reps: 20, now: 0 });
  g = applyTurn(g, { user: "Mia", reps: 25, now: 10 }); // beats the bar — pending on her choice
  g = chooseHorseTarget(g, { user: "Mia", mode: "match", now: 10 }); // starts the clock at 10
  g = { ...g, players: {
    You: { letters: 2, out: false, outAt: null },
    Mia: { letters: 0, out: false, outAt: null },
    Dev: { letters: 3, out: false, outAt: null },
  } };
  assert.throws(() => tallyGame(g, 10 + DAY - 1), /not expired/);
  const tallied = tallyGame(g, 10 + DAY);
  assert.equal(tallied.status, "complete");
  assert.deepEqual(tallied.winner, ["Mia"]);

  const tied = { ...g, players: {
    You: { letters: 1, out: false, outAt: null },
    Mia: { letters: 1, out: false, outAt: null },
    Dev: { letters: 4, out: false, outAt: null },
  } };
  assert.deepEqual(tallyGame(tied, 10 + DAY).winner, ["You", "Mia"]);
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
