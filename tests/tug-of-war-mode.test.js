import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBurst,
  autoBalanceTeams,
  cancelOpenGame,
  createTugOfWarGame,
  currentTurnPlayer,
  currentTurnTeam,
  declinePlayer,
  joinOpenPlayer,
  startOpenMatch,
  swapPlayerSide,
  teamOfPlayer,
  turnSequenceForRound,
  TOW_OPEN_ROSTER_SIZE,
} from "../tug-of-war.js";
import { randomTeamName, randomTeamNames, TOW_NAME_PREFIXES, TOW_NAME_SUFFIXES } from "../tug-of-war-words.js";

function liveGame(overrides = {}) {
  return createTugOfWarGame({
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

test("createTugOfWarGame seeds team state and rejects bad input", () => {
  const g = liveGame();
  assert.equal(g.status, "active");
  assert.equal(g.round, 1);
  assert.equal(g.turnIndex, 0);
  assert.deepEqual(g.scores, { a: 0, b: 0 });
  assert.deepEqual(g.playerTotals, { You: 0, Mia: 0, Dev: 0 });
  assert.throws(() => createTugOfWarGame({ id: "x", target: 0, rounds: 3, sessionType: "live", createdBy: "You", teams: { a: { players: ["You"] }, b: { players: ["Dev"] } } }));
  assert.throws(() => createTugOfWarGame({ id: "x", target: 100, rounds: 3, sessionType: "live", createdBy: "Nobody", teams: { a: { players: ["You"] }, b: { players: ["Dev"] } } }));
  assert.throws(() => createTugOfWarGame({ id: "x", target: 100, rounds: 3, sessionType: "live", createdBy: "You", teams: { a: { players: ["You"] }, b: { players: [] } } }));
});

test("turnSequenceForRound alternates teams and wraps the smaller team's order", () => {
  const g = liveGame(); // A: You, Mia (2)   B: Dev (1)
  const seq = turnSequenceForRound(g, 1);
  // Round length = 2 * max(2,1) = 4, strictly alternating A,B,A,B with B repeating Dev.
  assert.deepEqual(seq.map((t) => t.team), ["a", "b", "a", "b"]);
  assert.deepEqual(seq.map((t) => t.user), ["You", "Dev", "Mia", "Dev"]);
});

test("turn order rotates each team's own order round to round", () => {
  const g = liveGame({ teams: { a: { name: "A", players: ["You", "Mia", "Ann"] }, b: { name: "B", players: ["Dev"] } } });
  assert.deepEqual(turnSequenceForRound(g, 1).map((t) => t.user), ["You", "Dev", "Mia", "Dev", "Ann", "Dev"]);
  assert.deepEqual(turnSequenceForRound(g, 2).map((t) => t.user), ["Mia", "Dev", "Ann", "Dev", "You", "Dev"]);
  assert.deepEqual(turnSequenceForRound(g, 3).map((t) => t.user), ["Ann", "Dev", "You", "Dev", "Mia", "Dev"]);
});

test("currentTurnPlayer/currentTurnTeam and teamOfPlayer reflect turnIndex", () => {
  const g = liveGame();
  assert.equal(currentTurnPlayer(g), "You");
  assert.equal(currentTurnTeam(g), "a");
  assert.equal(teamOfPlayer(g, "Dev"), "b");
  assert.equal(teamOfPlayer(g, "Nobody"), null);
});

test("applyBurst rejects out-of-turn submissions and inactive games", () => {
  const g = liveGame();
  assert.throws(() => applyBurst(g, { user: "Dev", reps: 10, now: 1 }));
  const done = { ...g, status: "complete" };
  assert.throws(() => applyBurst(done, { user: "You", reps: 10, now: 1 }));
});

test("applyBurst adds reps to the team score and the player's own total, then advances", () => {
  let g = liveGame();
  g = applyBurst(g, { user: "You", reps: 12, now: 1 });
  assert.equal(g.scores.a, 12);
  assert.equal(g.playerTotals.You, 12);
  assert.equal(currentTurnPlayer(g), "Dev");
  g = applyBurst(g, { user: "Dev", reps: 8, now: 2 });
  assert.equal(g.scores.b, 8);
  assert.equal(currentTurnPlayer(g), "Mia");
});

test("an instant win fires the moment a team reaches the target, even mid-round", () => {
  let g = liveGame({ target: 20 });
  g = applyBurst(g, { user: "You", reps: 20, now: 1 }); // Team A hits the target on the very first burst
  assert.equal(g.status, "complete");
  assert.equal(g.winner, "a");
  assert.equal(g.turnStartedAt, null);
});

test("round completes and rolls over once the whole alternating sequence has gone", () => {
  let g = liveGame({ rounds: 5, target: 10000 });
  g = applyBurst(g, { user: "You", reps: 1, now: 1 });
  g = applyBurst(g, { user: "Dev", reps: 1, now: 2 });
  g = applyBurst(g, { user: "Mia", reps: 1, now: 3 });
  assert.equal(g.round, 1);
  g = applyBurst(g, { user: "Dev", reps: 1, now: 4 }); // last slot of round 1 (Dev repeats)
  assert.equal(g.round, 2);
  assert.equal(g.turnIndex, 0);
});

test("round-cap with no instant win crowns whoever has the higher total", () => {
  let g = liveGame({ rounds: 1, target: 10000, teams: { a: { name: "A", players: ["You"] }, b: { name: "B", players: ["Dev"] } } });
  g = applyBurst(g, { user: "You", reps: 15, now: 1 });
  g = applyBurst(g, { user: "Dev", reps: 9, now: 2 });
  assert.equal(g.status, "complete");
  assert.equal(g.winner, "a");
});

test("an exact tie at the round cap triggers sudden death, repeating until broken", () => {
  let g = liveGame({ rounds: 1, target: 10000, teams: { a: { name: "A", players: ["You"] }, b: { name: "B", players: ["Dev"] } } });
  g = applyBurst(g, { user: "You", reps: 10, now: 1 });
  g = applyBurst(g, { user: "Dev", reps: 10, now: 2 }); // tied at the cap -> sudden death round
  assert.equal(g.status, "active");
  assert.equal(g.sudden, true);
  assert.equal(g.round, 2);
  g = applyBurst(g, { user: "You", reps: 5, now: 3 });
  g = applyBurst(g, { user: "Dev", reps: 5, now: 4 }); // tied again -> another sudden round
  assert.equal(g.status, "active");
  assert.equal(g.round, 3);
  g = applyBurst(g, { user: "You", reps: 6, now: 5 });
  g = applyBurst(g, { user: "Dev", reps: 1, now: 6 }); // finally breaks
  assert.equal(g.status, "complete");
  assert.equal(g.winner, "a");
});

test("Open games start in lobby, auto-balance joins onto the smaller side, and cap at rosterSize", () => {
  let g = createTugOfWarGame({ id: "o1", target: 100, rounds: 3, sessionType: "open", createdBy: "You", rosterSize: 4, now: 1 });
  assert.equal(g.status, "lobby");
  assert.deepEqual(g.teams.a.players, ["You"]);
  g = joinOpenPlayer(g, { user: "Mia", now: 2 }); // a has 1, b has 0 -> joins b
  assert.deepEqual(g.teams.b.players, ["Mia"]);
  g = joinOpenPlayer(g, { user: "Dev", now: 3 }); // tied 1-1 -> joins b (never the host's own side)
  assert.deepEqual(g.teams.b.players, ["Mia", "Dev"]);
  g = joinOpenPlayer(g, { user: "Ann", now: 4 }); // a:1 b:2 -> joins a, now full at 4
  assert.deepEqual(g.teams.a.players, ["You", "Ann"]);
  assert.throws(() => joinOpenPlayer(g, { user: "Sam" }), /full/);
  assert.equal(joinOpenPlayer(g, { user: "Mia" }), g); // already in -> idempotent
});

test("startOpenMatch locks the roster and only the host may call it", () => {
  let g = createTugOfWarGame({ id: "o1", target: 100, rounds: 3, sessionType: "open", createdBy: "You", now: 1 });
  g = joinOpenPlayer(g, { user: "Mia", now: 2 });
  assert.throws(() => startOpenMatch(g, { user: "Mia", now: 3 }), /host/);
  g = startOpenMatch(g, { user: "You", now: 3 });
  assert.equal(g.status, "active");
  assert.throws(() => startOpenMatch(g, { user: "You", now: 4 }), /already started/);
});

test("only a lobby-stage Open host can cancel", () => {
  let g = createTugOfWarGame({ id: "o1", target: 100, rounds: 3, sessionType: "open", createdBy: "You", now: 1 });
  assert.throws(() => cancelOpenGame(g, { user: "Mia" }), /host/);
  const cancelled = cancelOpenGame(g, { user: "You", now: 2 });
  assert.equal(cancelled.status, "cancelled");
});

test("declining before a first burst removes the player; emptying a team voids the game", () => {
  let g = liveGame({ teams: { a: { name: "A", players: ["You", "Mia"] }, b: { name: "B", players: ["Dev"] } } });
  g = declinePlayer(g, { user: "Mia", now: 5 });
  assert.deepEqual(g.teams.a.players, ["You"]);
  assert.equal(g.status, "active");
  g = declinePlayer(g, { user: "Dev", now: 6 });
  assert.equal(g.status, "voided");
});

test("declining cannot happen after the player has already taken a burst", () => {
  let g = liveGame();
  g = applyBurst(g, { user: "You", reps: 5, now: 1 });
  assert.throws(() => declinePlayer(g, { user: "You" }));
});

test("autoBalanceTeams splits evenly with an injected rng", () => {
  const { a, b } = autoBalanceTeams(["A", "B", "C", "D"], () => 0);
  assert.equal(a.length + b.length, 4);
  assert.equal(new Set([...a, ...b]).size, 4);
});

test("swapPlayerSide moves a player to the other team", () => {
  const teams = { a: ["You", "Mia"], b: ["Dev"] };
  const swapped = swapPlayerSide(teams, "Mia");
  assert.deepEqual(swapped, { a: ["You"], b: ["Dev", "Mia"] });
});

test("team name vocab is non-empty and randomTeamNames returns two distinct names", () => {
  assert.ok(TOW_NAME_PREFIXES.length > 5);
  assert.ok(TOW_NAME_SUFFIXES.length > 5);
  const name = randomTeamName(() => 0);
  assert.equal(typeof name, "string");
  // Force the very first candidate pair to collide (both calls to
  // randomTeamName return the same prefix+suffix), then let the retry loop
  // pick something else on the 3rd/4th draw.
  const values = [0, 0, 0, 0, 0.9, 0.9];
  let i = 0;
  const scriptedRng = () => values[Math.min(i++, values.length - 1)];
  const { a, b } = randomTeamNames(scriptedRng);
  assert.notEqual(a, b);
});

test("TOW_OPEN_ROSTER_SIZE is a sane default cap", () => {
  assert.ok(TOW_OPEN_ROSTER_SIZE >= 4);
});
