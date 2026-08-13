// Horse mode — pure rules engine. No DOM, no storage; app.js and the Worker
// both drive this same logic against a plain game-state object (see
// HORSE_PLAN.md for the shape).

// Match-length timer options for the setup screen — a whole-game deadline,
// not a per-turn one. null ("unlimited") means no deadline at all.
export const HORSE_TIME_LIMITS = {
  "24h": 24 * 60 * 60 * 1000,
  "48h": 48 * 60 * 60 * 1000,
  "72h": 72 * 60 * 60 * 1000,
  unlimited: null,
};

export function createHorseGame({ id, word, sessionType, createdBy, players, timeLimit = null, now = Date.now() }) {
  const minimumPlayers = sessionType === "open" ? 1 : 2;
  if (!Array.isArray(players) || players.length < minimumPlayers) throw new Error(`Horse needs at least ${minimumPlayers} player${minimumPlayers === 1 ? "" : "s"}`);
  if (sessionType === "open" && players.length > 4) throw new Error("Open Horse is limited to 4 players");
  if (!players.includes(createdBy)) throw new Error("Creator must be in the player list");
  const turnOrder = [...players];
  const playersState = {};
  for (const name of turnOrder) playersState[name] = {
    letters: 0,
    out: false,
    outAt: null,
    ...(sessionType === "open" ? { joinedAt: now } : {}),
  };
  return {
    id,
    word: word.toUpperCase(),
    sessionType,
    status: "active",
    createdBy,
    createdAt: now,
    turnOrder,
    turnIndex: 0,
    turnStartedAt: now,
    target: null,
    targetSetBy: null,
    targetModifier: null,
    round: 1,
    players: playersState,
    sets: [],
    winner: null,
    timeLimit: timeLimit == null ? null : timeLimit,
    timerStartedAt: null,
  };
}

function checkWinner(game) {
  const active = game.turnOrder.filter((name) => !game.players[name].out);
  // Open sessions can begin with the host alone. Their opening set establishes
  // the target but cannot make them a winner before a challenger arrives.
  if (game.turnOrder.length < 2) return null;
  // 2-player sessions end the instant either player is OUT.
  if (game.turnOrder.length === 2) {
    const outPlayer = game.turnOrder.find((name) => game.players[name].out);
    return outPlayer ? game.turnOrder.find((name) => name !== outPlayer) : null;
  }
  // 3+ player sessions play to last one standing.
  return active.length === 1 ? active[0] : null;
}

export function joinOpenPlayer(game, { user, now = Date.now() }) {
  if (game.status !== "active" || game.sessionType !== "open") throw new Error("Open game is not active");
  const name = String(user || "").trim();
  if (!name) throw new Error("Player name is required");
  if (game.turnOrder.includes(name)) return game;
  if (game.turnOrder.length >= 4) throw new Error("Open game is full");

  const turnOrder = [...game.turnOrder, name];
  const players = { ...game.players, [name]: { letters: 0, out: false, outAt: null, joinedAt: now } };
  // If the host already set the opening bar while alone, the first arrival is
  // immediately up. Otherwise they wait behind the host in normal join order.
  const hostSetBarWhileAlone = game.turnOrder.length === 1 && game.target != null;
  return {
    ...game,
    turnOrder,
    players,
    ...(hostSetBarWhileAlone ? { turnIndex: 1, turnStartedAt: now } : {}),
  };
}

export function cancelOpenGame(game, { user, now = Date.now() }) {
  if (game.status !== "active" || game.sessionType !== "open") throw new Error("Open game is not active");
  if (game.createdBy !== user) throw new Error("Only the host can cancel this game");
  if (game.turnOrder.length > 1) throw new Error("The game already has challengers");
  return { ...game, status: "cancelled", cancelledAt: now, turnStartedAt: null };
}

function advanceTurn(game, now) {
  const n = game.turnOrder.length;
  let idx = game.turnIndex;
  let round = game.round;
  for (let step = 0; step < n; step += 1) {
    idx = (idx + 1) % n;
    if (idx === 0) round += 1;
    if (!game.players[game.turnOrder[idx]].out) return { turnIndex: idx, round, turnStartedAt: now };
  }
  return { turnIndex: idx, round, turnStartedAt: now };
}

function awardLetter(players, user, now) {
  const next = { ...players, [user]: { ...players[user] } };
  const p = next[user];
  p.letters += 1;
  if (p.letters >= 5) {
    p.out = true;
    p.outAt = now;
  }
  return next;
}

export function currentTurnPlayer(game) {
  return game.turnOrder[game.turnIndex];
}

// modifier is whatever grip/hand-position (see screens/modifiers.js) the
// player actually used for this set — recorded on the game as
// targetModifier regardless of success/failure, same as the target number
// itself, so the next player has to match it (fair comparison, not just a
// number to beat). null means no modifier was in play.
// The match timer starts the moment the second distinct player to ever take
// a turn completes THEIR first set — not at game creation, and not just on
// joining. Once set it never moves again.
function computeTimerStart(game) {
  if (game.timerStartedAt != null || game.sets.length === 0) return game.timerStartedAt;
  const firstUser = game.sets[0].user;
  const secondSet = game.sets.find((set) => set.user !== firstUser);
  return secondSet ? secondSet.at : null;
}

export function applyTurn(game, { user, reps, modifier = null, now = Date.now() }) {
  if (game.status !== "active") throw new Error("Game is not active");
  if (currentTurnPlayer(game) !== user) throw new Error("Not this player's turn");

  const needed = game.target;
  const success = needed == null || reps >= needed;
  let players = game.players;
  if (!success) players = awardLetter(players, user, now);

  const sets = [...game.sets, { user, reps, needed, modifier, letter: !success, skipped: false, at: now }];
  const next = { ...game, players, sets, target: reps, targetSetBy: user, targetModifier: modifier };
  next.timerStartedAt = computeTimerStart(next);

  const winner = checkWinner(next);
  if (winner) return { ...next, status: "complete", winner: [winner], turnStartedAt: null };

  const { turnIndex, round, turnStartedAt } = advanceTurn(next, now);
  return { ...next, turnIndex, round, turnStartedAt };
}

export function isTimeUp(game, now = Date.now()) {
  return game.status === "active" && game.timeLimit != null && game.timerStartedAt != null
    && now - game.timerStartedAt >= game.timeLimit;
}

// Match deadline hit: whoever has collected the fewest letters wins, ties
// share the win. Replaces the old per-turn 48h stall-skip.
export function tallyGame(game, now = Date.now()) {
  if (!isTimeUp(game, now)) throw new Error("Timer has not expired yet");
  const minLetters = Math.min(...game.turnOrder.map((name) => game.players[name].letters));
  const winner = game.turnOrder.filter((name) => game.players[name].letters === minLetters);
  return { ...game, status: "complete", winner, turnStartedAt: null };
}

// Invited player bows out before ever taking a set. Removes them from turn
// order; if fewer than 2 players remain, the game is voided (no winner).
export function declinePlayer(game, { user, now = Date.now() }) {
  if (game.status !== "active") throw new Error("Game is not active");
  if (!game.turnOrder.includes(user)) throw new Error("Player not in game");
  if (game.sessionType === "open" && user === game.createdBy) throw new Error("The host must cancel the game");
  if (game.sets.some((set) => set.user === user)) throw new Error("Player already took a turn");

  const wasCurrentTurn = currentTurnPlayer(game) === user;
  const removedIndex = game.turnOrder.indexOf(user);
  const turnOrder = game.turnOrder.filter((name) => name !== user);
  const players = { ...game.players };
  delete players[user];

  if (turnOrder.length < 2 && game.sessionType !== "open") {
    return { ...game, turnOrder, players, status: "voided", turnStartedAt: null };
  }

  if (wasCurrentTurn) {
    return { ...game, turnOrder, players, turnIndex: removedIndex % turnOrder.length, turnStartedAt: now };
  }
  const currentName = game.turnOrder[game.turnIndex];
  return { ...game, turnOrder, players, turnIndex: turnOrder.indexOf(currentName) };
}

export function horseTargetLabel(game) {
  return game.target == null ? null : `${game.target}+`;
}

export function horsePlayerRows(game) {
  return game.turnOrder.map((name, index) => {
    const p = game.players[name];
    const status = p.out ? "out" : index === game.turnIndex ? "up" : "waiting";
    return { name, letters: p.letters, out: p.out, status, wordSoFar: game.word.slice(0, p.letters) };
  });
}
