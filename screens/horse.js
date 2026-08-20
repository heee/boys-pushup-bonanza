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

function totalRepsFor(game, name) {
  return (game.sets || []).filter((set) => set.user === name).reduce((sum, set) => sum + (set.reps || 0), 0);
}

// Copy for the shooter's target-choice screen — game.pendingChoice is set
// right after a set that meets or beats an existing bar (see horse.js's
// applyTurn). Returns null when there's nothing pending.
export function horseChoiceCopy(game) {
  const choice = game.pendingChoice;
  if (!choice) return null;
  return { user: choice.user, reps: choice.reps, modifierLabel: modifierCueLabel(choice.modifier) };
}

// The current target came from the shooter deliberately setting something
// lower than what they actually did (chooseHorseTarget's "custom" mode) —
// returns the reps they could've forced instead, or null for a straight
// match/opening bar/miss (all of which always finalize at exactly what
// happened, so there's nothing to call out).
export function horseTargetWasLowered(game) {
  const lastSet = game.sets[game.sets.length - 1];
  if (!lastSet || game.target == null || lastSet.user !== game.targetSetBy) return null;
  return lastSet.reps > game.target ? lastSet.reps : null;
}

// Winner(s) first (a match-timer tally can end in a shared win), then
// eliminated players ordered by how long they survived (most recently OUT
// ranks just below the winners).
export function horseSummaryRows(game) {
  const winners = game.winner || [];
  const others = game.turnOrder
    .filter((name) => !winners.includes(name))
    .sort((a, b) => (game.players[b].outAt || 0) - (game.players[a].outAt || 0));
  const row = (name, isWinner) => ({
    name,
    isWinner,
    letters: game.players[name].letters,
    out: game.players[name].out,
    wordSoFar: game.word.slice(0, game.players[name].letters),
    totalReps: totalRepsFor(game, name),
  });
  return [...winners.map((name) => row(name, true)), ...others.map((name) => row(name, false))];
}

// Match-ending commentary: how long the whole thing ran and how many rounds
// it took. End time is the latest timestamp we actually have on record (last
// set taken or last elimination) rather than "now" — a tallied game may sit
// untallied for a while after the clock actually ran out.
export function horseSummaryStats(game) {
  if (game.createdAt == null) return { rounds: game.round, durationMs: null };
  const setTimes = (game.sets || []).map((set) => set.at).filter((t) => t != null);
  const outTimes = Object.values(game.players).map((p) => p.outAt).filter((t) => t != null);
  const endAt = Math.max(game.createdAt, ...setTimes, ...outTimes);
  return { rounds: game.round, durationMs: endAt - game.createdAt };
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
  if (game.startedAt != null) return { state: "started", title: "This session has already started", canJoin: false };
  if (game.turnOrder.length >= 8) return { state: "full", title: "This session is full", canJoin: false };
  return {
    state: "ready",
    title: `Join ${game.createdBy}'s Horse game?`,
    canJoin: true,
    slotsLeft: 8 - game.turnOrder.length,
  };
}
