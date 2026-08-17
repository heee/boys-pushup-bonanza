// Tug of War mode — display-model helpers (pure). The rules engine lives in
// the root tug-of-war.js; this file turns a game object into render-ready
// shapes, mirroring screens/horse.js's conventions.
import { currentTurnPlayer, currentTurnTeam, teamOfPlayer } from "../tug-of-war.js";

export function towInviteUrl(gameId, locationLike = globalThis.location) {
  const base = `${locationLike.origin}${locationLike.pathname}`;
  return `${base}#tow=${encodeURIComponent(gameId)}`;
}

export function openTowJoinModel(game, user) {
  if (!game) return { state: "missing", title: "Session not found", canJoin: false };
  if (game.sessionType !== "open") return { state: "unavailable", title: "This isn't an Open session", canJoin: false };
  if (game.status === "cancelled") return { state: "cancelled", title: "Session cancelled", canJoin: false };
  if (game.status !== "lobby") return { state: "started", title: "This match has already started", canJoin: false };
  if (game.teams.a.players.includes(user) || game.teams.b.players.includes(user)) {
    return { state: "joined", title: "You're already in", canJoin: false };
  }
  const total = game.teams.a.players.length + game.teams.b.players.length;
  if (total >= game.rosterSize) return { state: "full", title: "This session is full", canJoin: false };
  return {
    state: "ready",
    title: `Join ${game.createdBy}'s Tug of War?`,
    canJoin: true,
    slotsLeft: game.rosterSize - total,
  };
}

// Marker position for the rope bar: 0.5 is dead center, moving toward 0
// (Team A's side) or 1 (Team B's side) as one team's progress toward the
// *shared* target outpaces the other's — normalized by target rather than
// raw score, so an uneven team split (more bodies pulling) doesn't just
// automatically win the rope regardless of who's actually closer to goal.
export function towRopeModel(game) {
  // position is on a 0 (Team A's end) .. 1 (Team B's end) axis, matching the
  // left-A/right-B column layout — the marker moves toward whichever team is
  // pulling harder, i.e. toward THEIR OWN end, not away from it.
  const diff = game.scores.b - game.scores.a;
  const position = Math.max(0, Math.min(1, 0.5 + diff / (2 * game.target)));
  const leadingSide = diff > 0 ? "b" : diff < 0 ? "a" : null;
  return { position, leadingSide };
}

export function towRemainingLabel(game, side) {
  const remaining = Math.max(0, game.target - game.scores[side]);
  return `${remaining} to go`;
}

// One row per player across both teams, in team-then-join order — used for
// the match-view mini-tile row and the summary breakdown.
export function towPlayerRows(game) {
  const row = (name, team) => ({ name, team, teamName: game.teams[team].name, reps: game.playerTotals[name] || 0 });
  return [
    ...game.teams.a.players.map((name) => row(name, "a")),
    ...game.teams.b.players.map((name) => row(name, "b")),
  ];
}

// Copy for the match-view CTA — differs by whether it's the current user's
// burst, someone else's on their team, or someone on the other team.
export function towTurnStatusCopy(game, user) {
  if (game.status !== "active") return { cta: null, waiting: null };
  const upNow = currentTurnPlayer(game);
  const upTeam = currentTurnTeam(game);
  if (upNow === user) return { cta: "It's your burst — go", waiting: null };
  const mine = teamOfPlayer(game, user);
  const teamName = game.teams[upTeam]?.name || "Their team";
  const waiting = upTeam === mine
    ? `Waiting on ${upNow} — your team's up`
    : `Waiting on ${upNow} · ${teamName}`;
  return { cta: null, waiting };
}

// Status line for the "burst complete" payoff screen — how the rope just
// moved as a result of this specific burst.
export function towBurstResultCopy(game, team) {
  const rope = towRopeModel(game);
  const remaining = towRemainingLabel(game, team);
  if (game.status === "complete") {
    return game.winner === team ? `Rope's all the way over — you won it! · ${remaining}` : `Rope settled the other way · ${remaining}`;
  }
  if (rope.leadingSide === team) return `Rope shifted your way · ${remaining}`;
  if (rope.leadingSide === null) return `Rope's dead even · ${remaining}`;
  return `Still behind · ${remaining}`;
}

// Winner-first team breakdown for the match summary screen.
export function towSummaryModel(game) {
  const sideOrder = game.winner === "b" ? ["b", "a"] : ["a", "b"];
  const teams = sideOrder.map((side) => ({
    side,
    name: game.teams[side].name,
    total: game.scores[side],
    isWinner: game.winner === side,
    players: game.teams[side].players
      .map((name) => ({ name, reps: game.playerTotals[name] || 0 }))
      .sort((x, y) => y.reps - x.reps),
  }));
  return { winnerName: game.winner ? game.teams[game.winner].name : null, teams };
}
