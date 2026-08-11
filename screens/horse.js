// Horse mode — display-model helpers (pure). The rules engine lives in the
// root horse.js; this file turns a game object into render-ready shapes.
import { MODIFIERS } from "./modifiers.js";

export function horseWordChips(word, lettersCollected) {
  return word.split("").map((letter, index) => ({ letter, filled: index < lettersCollected }));
}

function modifierCueLabel(id) {
  return MODIFIERS.find((m) => m.id === id)?.cueLabel || null;
}

// A target set with a modifier (grip/hand position) has to be matched, not
// just the number — beating 32 with Wide Grip when the bar was set Diamond
// Grip isn't actually beating it. sub carries that requirement so the UI
// can put it right under the number.
export function horseTurnHeroCopy(game) {
  if (game.target == null) return { kicker: null, value: "SET THE BAR", sub: "Your set decides the number everyone else has to beat." };
  const label = modifierCueLabel(game.targetModifier);
  return {
    kicker: `BEAT ${game.targetSetBy?.toUpperCase()}'S`,
    value: `${game.target}+`,
    sub: label ? `Match required: ${label}` : null,
  };
}

// Winner first, then eliminated players ordered by how long they survived
// (most recently OUT ranks just below the winner).
export function horseSummaryRows(game) {
  const winner = game.winner;
  const others = game.turnOrder
    .filter((name) => name !== winner)
    .sort((a, b) => (game.players[b].outAt || 0) - (game.players[a].outAt || 0));
  const row = (name, isWinner) => ({
    name,
    isWinner,
    letters: game.players[name].letters,
    wordSoFar: game.word.slice(0, game.players[name].letters),
  });
  return winner ? [row(winner, true), ...others.map((name) => row(name, false))] : others.map((name) => row(name, false));
}

export function horseInviteUrl(gameId, locationLike = globalThis.location) {
  const base = `${locationLike.origin}${locationLike.pathname}`;
  return `${base}#horse=${encodeURIComponent(gameId)}`;
}

export function openHorseJoinModel(game, user) {
  if (!game) return { state: "missing", title: "Session not found", canJoin: false };
  if (game.sessionType !== "open") return { state: "unavailable", title: "This isn't an Open session", canJoin: false };
  if (game.status === "cancelled") return { state: "cancelled", title: "Session cancelled", canJoin: false };
  if (game.status !== "active") return { state: "finished", title: "This Horse game has ended", canJoin: false };
  if (game.turnOrder.includes(user)) return { state: "joined", title: "You're already in", canJoin: false };
  if (game.turnOrder.length >= 4) return { state: "full", title: "This session is full", canJoin: false };
  return {
    state: "ready",
    title: `Join ${game.createdBy}'s Horse game?`,
    canJoin: true,
    slotsLeft: 4 - game.turnOrder.length,
  };
}
