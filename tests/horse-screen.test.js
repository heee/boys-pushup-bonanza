import test from "node:test";
import assert from "node:assert/strict";
import { horseChoiceCopy, horseInviteUrl, horseSummaryRows, horseSummaryStats, horseTargetWasLowered, horseTurnHeroCopy, horseWordChips, openHorseJoinModel } from "../screens/horse.js";
import { applyTurn, chooseHorseTarget, createHorseGame } from "../horse.js";

test("horseWordChips marks the collected prefix filled", () => {
  assert.deepEqual(horseWordChips("HORSE", 2), [
    { letter: "H", filled: true },
    { letter: "O", filled: true },
    { letter: "R", filled: false },
    { letter: "S", filled: false },
    { letter: "E", filled: false },
  ]);
});

test("horseTurnHeroCopy shows SET THE BAR before any target exists, then BEAT <name>'S N+", () => {
  let g = createHorseGame({ id: "g", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia"] });
  assert.deepEqual(horseTurnHeroCopy(g), { kicker: null, value: "SET THE BAR", sub: "Your set decides the number everyone else has to beat." });
  g = applyTurn(g, { user: "You", reps: 32, now: 1 });
  assert.deepEqual(horseTurnHeroCopy(g), { kicker: "BEAT YOU'S", value: "32+", sub: null });
});

test("horseTurnHeroCopy surfaces the modifier the next player has to match", () => {
  let g = createHorseGame({ id: "g", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia"] });
  g = applyTurn(g, { user: "You", reps: 32, modifier: "wide", now: 1 });
  assert.deepEqual(horseTurnHeroCopy(g), { kicker: "BEAT YOU'S", value: "32+", sub: "Match required: Wide Grip" });
});

test("horseSummaryRows puts the winner first, then eliminated players by longest survival", () => {
  const game = {
    word: "HORSE",
    winner: ["Dev"],
    turnOrder: ["You", "Mia", "Dev", "Priya"],
    players: {
      You: { letters: 4, out: true, outAt: 300 },
      Mia: { letters: 5, out: true, outAt: 100 },
      Dev: { letters: 0, out: false, outAt: null },
      Priya: { letters: 5, out: true, outAt: 200 },
    },
  };
  const rows = horseSummaryRows(game);
  assert.deepEqual(rows.map((r) => r.name), ["Dev", "You", "Priya", "Mia"]);
  assert.equal(rows[0].isWinner, true);
  assert.equal(rows[1].wordSoFar, "HORS");
});

test("horseSummaryRows supports a shared (co-winner) match-timer tally", () => {
  const game = {
    word: "HORSE",
    winner: ["You", "Mia"],
    turnOrder: ["You", "Mia", "Dev"],
    players: {
      You: { letters: 1, out: false, outAt: null },
      Mia: { letters: 1, out: false, outAt: null },
      Dev: { letters: 3, out: false, outAt: null },
    },
  };
  const rows = horseSummaryRows(game);
  assert.deepEqual(rows.map((r) => r.name), ["You", "Mia", "Dev"]);
  assert.equal(rows[0].isWinner, true);
  assert.equal(rows[1].isWinner, true);
  assert.equal(rows[2].isWinner, false);
  assert.equal(rows[2].out, false);
});

test("horseSummaryRows sums each player's reps across every set they took", () => {
  const game = {
    word: "HORSE",
    winner: ["Dev"],
    turnOrder: ["You", "Dev"],
    players: {
      You: { letters: 5, out: true, outAt: 300 },
      Dev: { letters: 0, out: false, outAt: null },
    },
    sets: [
      { user: "Dev", reps: 30, at: 1 },
      { user: "You", reps: 10, at: 2 },
      { user: "Dev", reps: 32, at: 3 },
      { user: "You", reps: 12, at: 4 },
    ],
  };
  const rows = horseSummaryRows(game);
  assert.equal(rows.find((r) => r.name === "Dev").totalReps, 62);
  assert.equal(rows.find((r) => r.name === "You").totalReps, 22);
});

test("horseSummaryStats reports rounds and elapsed time from creation to the last recorded event", () => {
  const game = {
    round: 4,
    createdAt: 1000,
    players: {
      You: { outAt: 5000 },
      Dev: { outAt: null },
    },
    sets: [{ user: "Dev", reps: 30, at: 4000 }],
  };
  assert.deepEqual(horseSummaryStats(game), { rounds: 4, durationMs: 4000 });
});

test("horseSummaryStats returns a null duration when createdAt is unavailable", () => {
  assert.deepEqual(horseSummaryStats({ round: 2, players: {} }), { rounds: 2, durationMs: null });
});

test("horseChoiceCopy reflects the pending shooter choice and clears once resolved", () => {
  let g = createHorseGame({ id: "g", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia"] });
  assert.equal(horseChoiceCopy(g), null);
  g = applyTurn(g, { user: "You", reps: 20, now: 1 });
  assert.equal(horseChoiceCopy(g), null); // opening shot never triggers a choice
  g = applyTurn(g, { user: "Mia", reps: 32, modifier: "wide", now: 2 });
  assert.deepEqual(horseChoiceCopy(g), { user: "Mia", reps: 32, modifierLabel: "Wide Grip" });
  g = chooseHorseTarget(g, { user: "Mia", mode: "match", now: 3 });
  assert.equal(horseChoiceCopy(g), null);
});

test("horseTargetWasLowered flags a custom pick below the shooter's reps, not a match/miss/opening bar", () => {
  let g = createHorseGame({ id: "g", word: "horse", sessionType: "live", createdBy: "You", players: ["You", "Mia"] });
  g = applyTurn(g, { user: "You", reps: 20, now: 1 }); // opening bar — never "lowered"
  assert.equal(horseTargetWasLowered(g), null);
  g = applyTurn(g, { user: "Mia", reps: 12, now: 2 }); // miss — target snaps to exactly the miss
  assert.equal(horseTargetWasLowered(g), null);
  g = applyTurn(g, { user: "You", reps: 40, now: 3 }); // beats 12 by a lot
  g = chooseHorseTarget(g, { user: "You", mode: "match", now: 4 });
  assert.equal(horseTargetWasLowered(g), null); // forced the full number — nothing to call out
  g = applyTurn(g, { user: "Mia", reps: 60, now: 5 }); // beats 40
  g = chooseHorseTarget(g, { user: "Mia", mode: "custom", customTarget: 45, now: 6 });
  assert.equal(horseTargetWasLowered(g), 60); // could've forced 60, went with 45
});

test("Open Horse share links preserve the app path and identify the game", () => {
  assert.equal(horseInviteUrl("hg-123", { origin: "https://example.com", pathname: "/bonanza/" }), "https://example.com/bonanza/#horse=hg-123");
});

test("Open Horse join model handles ready, joined, full, and inactive links", () => {
  const game = { sessionType: "open", status: "active", createdBy: "You", turnOrder: ["You"], players: { You: {} } };
  assert.deepEqual(openHorseJoinModel(game, "Mia"), { state: "ready", title: "Join You's Horse game?", canJoin: true, slotsLeft: 3 });
  assert.equal(openHorseJoinModel(game, "You").state, "joined");
  assert.equal(openHorseJoinModel({ ...game, turnOrder: ["You", "A", "B", "C"] }, "Mia").state, "full");
  assert.equal(openHorseJoinModel({ ...game, status: "cancelled" }, "Mia").state, "cancelled");
});
