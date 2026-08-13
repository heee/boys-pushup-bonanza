import test from "node:test";
import assert from "node:assert/strict";
import { horseInviteUrl, horseSummaryRows, horseTurnHeroCopy, horseWordChips, openHorseJoinModel } from "../screens/horse.js";
import { applyTurn, createHorseGame } from "../horse.js";

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
