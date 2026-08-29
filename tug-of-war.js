// Tug of War mode — pure rules engine. No DOM, no storage; app.js and the
// Worker both drive this same logic against a plain game-state object. See
// the design doc for the full screen spec; this file only owns the rules:
// team setup (Live/Online fixed at creation, Open fills via join), strict
// team-alternating turn order with the smaller-team-repeats wraparound,
// instant win the moment either team reaches the target, round-cap fallback
// to the higher total, and sudden-death rounds on an exact tie.

// Default max roster size for an Open game (join-link session) — any split
// up to this many total players, auto-balanced onto whichever team has room.
export const TOW_OPEN_ROSTER_SIZE = 6;

export function createTugOfWarGame({ id, target, rounds, sessionType, createdBy, teams, rosterSize, now = Date.now() }) {
  const targetReps = Math.floor(Number(target));
  const roundCount = Math.floor(Number(rounds));
  if (!Number.isFinite(targetReps) || targetReps <= 0) throw new Error("Target reps must be a positive whole number");
  if (!Number.isFinite(roundCount) || roundCount <= 0) throw new Error("Round count must be a positive whole number");
  if (sessionType !== "live" && sessionType !== "online" && sessionType !== "open") throw new Error("Unknown session type");
  const createdByName = String(createdBy || "").trim();
  if (!createdByName) throw new Error("Creator is required");

  const base = {
    id,
    target: targetReps,
    rounds: roundCount,
    sessionType,
    createdBy: createdByName,
    createdAt: now,
    status: sessionType === "open" ? "lobby" : "active",
    round: 1,
    turnIndex: 0,
    turnStartedAt: sessionType === "open" ? null : now,
    sudden: false,
    scores: { a: 0, b: 0 },
    playerTotals: {},
    bursts: [],
    winner: null,
  };

  if (sessionType === "open") {
    return {
      ...base,
      rosterSize: Number.isFinite(Number(rosterSize)) && Number(rosterSize) >= 2 ? Math.floor(Number(rosterSize)) : TOW_OPEN_ROSTER_SIZE,
      teams: {
        a: { name: teams?.a?.name || "Team A", players: [createdByName] },
        b: { name: teams?.b?.name || "Team B", players: [] },
      },
    };
  }

  const a = Array.isArray(teams?.a?.players) ? [...new Set(teams.a.players)] : [];
  const b = Array.isArray(teams?.b?.players) ? [...new Set(teams.b.players)] : [];
  if (a.length < 1 || b.length < 1) throw new Error("Each team needs at least one player");
  if (!a.includes(createdByName) && !b.includes(createdByName)) throw new Error("Creator must be on a team");
  const playerTotals = {};
  for (const name of [...a, ...b]) playerTotals[name] = 0;
  return {
    ...base,
    playerTotals,
    teams: {
      a: { name: teams.a.name || "Team A", players: a },
      b: { name: teams.b.name || "Team B", players: b },
    },
  };
}

export function teamOfPlayer(game, user) {
  if (game.teams.a.players.includes(user)) return "a";
  if (game.teams.b.players.includes(user)) return "b";
  return null;
}

export function joinOpenPlayer(game, { user, now = Date.now() }) {
  if (game.sessionType !== "open") throw new Error("Not an Open game");
  if (game.status !== "lobby") throw new Error("This game is no longer accepting players");
  const name = String(user || "").trim();
  if (!name) throw new Error("Player name is required");
  if (game.teams.a.players.includes(name) || game.teams.b.players.includes(name)) return game;
  const total = game.teams.a.players.length + game.teams.b.players.length;
  if (total >= game.rosterSize) throw new Error("This game is full");
  // Strictly-smaller-side wins; a tie goes to b (never the host's own side,
  // since the host always starts alone on a) so joiners land on the
  // opposing team instead of stacking up behind whoever created the game.
  const side = game.teams.a.players.length < game.teams.b.players.length ? "a" : "b";
  const teams = { ...game.teams, [side]: { ...game.teams[side], players: [...game.teams[side].players, name] } };
  return { ...game, teams };
}

export function cancelOpenGame(game, { user, now = Date.now() }) {
  if (game.sessionType !== "open") throw new Error("Not an Open game");
  if (game.status !== "lobby") throw new Error("Game already started");
  if (game.createdBy !== user) throw new Error("Only the host can cancel this game");
  return { ...game, status: "cancelled", cancelledAt: now };
}

// Host starts an Open game early (or once full) — locks the roster (whoever
// has joined so far; any still-empty slots simply never existed as data) and
// kicks the match off exactly like Live/Online's creation-time start.
export function startOpenMatch(game, { user, now = Date.now() }) {
  if (game.sessionType !== "open") throw new Error("Not an Open game");
  if (game.status !== "lobby") throw new Error("Game already started");
  if (game.createdBy !== user) throw new Error("Only the host can start this game");
  if (game.teams.a.players.length < 1 || game.teams.b.players.length < 1) throw new Error("Each team needs at least one player");
  const playerTotals = {};
  for (const name of [...game.teams.a.players, ...game.teams.b.players]) playerTotals[name] = 0;
  return { ...game, status: "active", playerTotals, round: 1, turnIndex: 0, turnStartedAt: now };
}

// Invited/joined player bows out before ever taking a burst. Voids the game
// if that empties their team entirely (nobody left to pull that side).
export function declinePlayer(game, { user, now = Date.now() }) {
  if (game.status !== "active" && game.status !== "lobby") throw new Error("Game is not active");
  const side = teamOfPlayer(game, user);
  if (!side) throw new Error("Player not in game");
  if (game.bursts.some((b) => b.user === user)) throw new Error("Player already took a burst");

  const teams = { ...game.teams, [side]: { ...game.teams[side], players: game.teams[side].players.filter((n) => n !== user) } };
  if (teams[side].players.length === 0) {
    return { ...game, teams, status: "voided", turnStartedAt: null };
  }
  const playerTotals = { ...game.playerTotals };
  delete playerTotals[user];
  let next = { ...game, teams, playerTotals };
  if (next.status === "active") {
    const seq = turnSequenceForRound(next, next.round);
    if (next.turnIndex >= seq.length) next = { ...next, round: next.round + 1, turnIndex: 0, turnStartedAt: now };
  }
  return next;
}

// Rotates a team's own player order by one slot per round (Horse-style) so
// the same person isn't always leading or always last.
function rotatedOrder(players, round) {
  const n = players.length;
  if (n === 0) return [];
  const offset = (round - 1) % n;
  return players.map((_, i) => players[(i + offset) % n]);
}

// The alternating burst order for a given round: Team A, Team B, Team A, ...
// If one team is smaller, its order wraps back to the start once exhausted
// so it keeps alternating with the larger team rather than sitting out —
// round length is therefore 2 * max(sizeA, sizeB).
export function turnSequenceForRound(game, round) {
  const a = rotatedOrder(game.teams.a.players, round);
  const b = rotatedOrder(game.teams.b.players, round);
  const maxLen = Math.max(a.length, b.length);
  const seq = [];
  for (let i = 0; i < maxLen; i += 1) {
    if (a.length) seq.push({ team: "a", user: a[i % a.length] });
    if (b.length) seq.push({ team: "b", user: b[i % b.length] });
  }
  return seq;
}

export function currentTurnPlayer(game) {
  return turnSequenceForRound(game, game.round)[game.turnIndex]?.user ?? null;
}

export function currentTurnTeam(game) {
  return turnSequenceForRound(game, game.round)[game.turnIndex]?.team ?? null;
}

// Applies one player's completed burst: adds their reps to their team's
// running total, checks the instant-win condition (either team reaching the
// target, even mid-round), then either advances to the next burst, rolls
// into the next round, or — if the configured round count is exhausted —
// either crowns the higher total or (on an exact tie) kicks off a
// sudden-death round and repeats until the tie breaks.
export function applyBurst(game, { user, reps, now = Date.now() }) {
  if (game.status !== "active") throw new Error("Game is not active");
  const seq = turnSequenceForRound(game, game.round);
  const turn = seq[game.turnIndex];
  if (!turn || turn.user !== user) throw new Error("Not this player's turn");

  const addedReps = Math.max(0, Math.floor(Number(reps)) || 0);
  const team = turn.team;
  const scores = { ...game.scores, [team]: game.scores[team] + addedReps };
  const playerTotals = { ...game.playerTotals, [user]: (game.playerTotals[user] || 0) + addedReps };
  const bursts = [...game.bursts, { user, team, reps: addedReps, round: game.round, sudden: game.sudden, at: now }];
  const next = { ...game, scores, playerTotals, bursts };

  if (scores[team] >= next.target) {
    return { ...next, status: "complete", winner: team, turnStartedAt: null };
  }

  const nextIndex = game.turnIndex + 1;
  if (nextIndex < seq.length) {
    return { ...next, turnIndex: nextIndex, turnStartedAt: now };
  }

  // Round just finished.
  const cappedOut = next.sudden || game.round >= next.rounds;
  if (!cappedOut) {
    return { ...next, round: game.round + 1, turnIndex: 0, turnStartedAt: now };
  }
  if (scores.a === scores.b) {
    return { ...next, round: game.round + 1, turnIndex: 0, sudden: true, turnStartedAt: now };
  }
  const winner = scores.a > scores.b ? "a" : "b";
  return { ...next, status: "complete", winner, turnStartedAt: null };
}

// --- Setup-time helpers (operate on plain {a: [names], b: [names]} shapes,
// before a game object exists) ---

export function autoBalanceTeams(players, rng = Math.random) {
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const a = [];
  const b = [];
  shuffled.forEach((name, i) => (i % 2 === 0 ? a : b).push(name));
  return { a, b };
}

export function swapPlayerSide(teams, name) {
  if (teams.a.includes(name)) return { a: teams.a.filter((n) => n !== name), b: [...teams.b, name] };
  if (teams.b.includes(name)) return { a: [...teams.a, name], b: teams.b.filter((n) => n !== name) };
  return teams;
}
