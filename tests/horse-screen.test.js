import test from "node:test";
import assert from "node:assert/strict";
import { horseSummaryRows, horseTurnHeroCopy, horseWordChips } from "../screens/horse.js";
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

test("horseSummaryRows puts the winner first, then eliminated players by longest survival", () => {
  const game = {
    word: "HORSE",
    winner: "Dev",
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
