// Runs the same scenarios as tests/tug-of-war-mode.test.js against the
// duplicated copy of the rules engine in worker/index.js, to catch the two
// drifting apart (see the top-of-file note in worker/index.js).
import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTowBurst,
  cancelTowOpenGame,
  createTowGame,
  currentTowTurnPlayer,
  currentTowTurnTeam,
  declineTowPlayer,
  joinTowOpenPlayer,
  startTowOpenMatch,
  teamOfTowPlayer,
  turnSequenceForTowRound,
  validateTowCreate,
} from "../worker/index.js";

function liveGame(overrides = {}) {
  return createTowGame({
    id: "g1",
    target: 100,
    rounds: 3,
    sessionType: "live",
    createdBy: "You",
    teams: { a: { name: "Team A", players: ["You", "Mia"] }, b: { name: "Team B", players: ["Dev"] } },
    now: 0,
    ...overrides,
  });
}

test("createTowGame seeds team state", () => {
  const g = liveGame();
  assert.equal(g.status, "active");
  assert.deepEqual(g.scores, { a: 0, b: 0 });
  assert.deepEqual(g.playerTotals, { You: 0, Mia: 0, Dev: 0 });
});

test("turnSequenceForTowRound alternates teams, wrapping the smaller team", () => {
  const g = liveGame();
  const seq = turnSequenceForTowRound(g, 1);
  assert.deepEqual(seq.map((t) => t.team), ["a", "b", "a", "b"]);
  assert.deepEqual(seq.map((t) => t.user), ["You", "Dev", "Mia", "Dev"]);
});

test("currentTowTurnPlayer/currentTowTurnTeam/teamOfTowPlayer reflect state", () => {
  const g = liveGame();
  assert.equal(currentTowTurnPlayer(g), "You");
  assert.equal(currentTowTurnTeam(g), "a");
  assert.equal(teamOfTowPlayer(g, "Dev"), "b");
});

test("applyTowBurst adds reps and rejects out-of-turn submissions", () => {
  let g = liveGame();
  assert.throws(() => applyTowBurst(g, { user: "Dev", reps: 10, now: 1 }));
  g = applyTowBurst(g, { user: "You", reps: 12, now: 1 });
  assert.equal(g.scores.a, 12);
  assert.equal(g.playerTotals.You, 12);
  assert.equal(currentTowTurnPlayer(g), "Dev");
});

test("an instant win fires the moment a team reaches the target", () => {
  let g = liveGame({ target: 20 });
  g = applyTowBurst(g, { user: "You", reps: 20, now: 1 });
  assert.equal(g.status, "complete");
  assert.equal(g.winner, "a");
});

test("round-cap fallback crowns the higher total, exact ties trigger sudden death", () => {
  let g = liveGame({ rounds: 1, target: 10000, teams: { a: { name: "A", players: ["You"] }, b: { name: "B", players: ["Dev"] } } });
  g = applyTowBurst(g, { user: "You", reps: 10, now: 1 });
  g = applyTowBurst(g, { user: "Dev", reps: 10, now: 2 });
  assert.equal(g.status, "active");
  assert.equal(g.sudden, true);
  g = applyTowBurst(g, { user: "You", reps: 6, now: 3 });
  g = applyTowBurst(g, { user: "Dev", reps: 1, now: 4 });
  assert.equal(g.status, "complete");
  assert.equal(g.winner, "a");
});

test("Open lobby: joins auto-balance, host starts, host cancels", () => {
  let g = createTowGame({ id: "o1", target: 100, rounds: 3, sessionType: "open", createdBy: "You", rosterSize: 4, now: 1 });
  assert.equal(g.status, "lobby");
  g = joinTowOpenPlayer(g, { user: "Mia", now: 2 });
  assert.deepEqual(g.teams.b.players, ["Mia"]);
  assert.throws(() => startTowOpenMatch(g, { user: "Mia" }), /host/);
  const started = startTowOpenMatch(g, { user: "You", now: 3 });
  assert.equal(started.status, "active");

  const other = createTowGame({ id: "o2", target: 100, rounds: 3, sessionType: "open", createdBy: "You", now: 1 });
  assert.throws(() => cancelTowOpenGame(other, { user: "Mia" }), /host/);
  assert.equal(cancelTowOpenGame(other, { user: "You", now: 2 }).status, "cancelled");
});

test("declining before a first burst removes the player; emptying a team voids the game", () => {
  let g = liveGame({ teams: { a: { name: "A", players: ["You", "Mia"] }, b: { name: "B", players: ["Dev"] } } });
  g = declineTowPlayer(g, { user: "Mia", now: 5 });
  assert.deepEqual(g.teams.a.players, ["You"]);
  g = declineTowPlayer(g, { user: "Dev", now: 6 });
  assert.equal(g.status, "voided");
});

test("validateTowCreate enforces target/rounds bounds and creator team membership", () => {
  const ok = validateTowCreate({ target: 100, rounds: 3, createdBy: "You", teams: { a: { name: "A", players: ["You"] }, b: { name: "B", players: ["Mia"] } } });
  assert.equal(ok.sessionType, "live");
  assert.equal(validateTowCreate({ target: 0, rounds: 3, createdBy: "You", teams: { a: { players: ["You"] }, b: { players: ["Mia"] } } }), null);
  assert.equal(validateTowCreate({ target: 100, rounds: 3, createdBy: "Nobody", teams: { a: { players: ["You"] }, b: { players: ["Mia"] } } }), null);
  const open = validateTowCreate({ target: 100, rounds: 3, createdBy: "You", sessionType: "open" });
  assert.equal(open.sessionType, "open");
  assert.equal(open.rosterSize, 6);
  assert.deepEqual(open.teams, { a: { name: "Team A" }, b: { name: "Team B" } });
  const openNamed = validateTowCreate({ target: 100, rounds: 3, createdBy: "You", sessionType: "open", teams: { a: { name: "Sneaky Weasels" }, b: { name: "Loud Turtles" } } });
  assert.deepEqual(openNamed.teams, { a: { name: "Sneaky Weasels" }, b: { name: "Loud Turtles" } });
});
