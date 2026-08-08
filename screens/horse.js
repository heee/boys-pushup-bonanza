// Horse mode — display-model helpers (pure). The rules engine lives in the
// root horse.js; this file turns a game object into render-ready shapes.

export function horseWordChips(word, lettersCollected) {
  return word.split("").map((letter, index) => ({ letter, filled: index < lettersCollected }));
}

export function horseTurnHeroCopy(game) {
  if (game.target == null) return { kicker: null, value: "SET THE BAR", sub: "Your set decides the number everyone else has to beat." };
  return { kicker: `BEAT ${game.targetSetBy?.toUpperCase()}'S`, value: `${game.target}+`, sub: null };
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
