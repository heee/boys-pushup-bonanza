// Team-name mashup generator for Tug of War — reuses the app's existing
// unhinged flavor vocabulary (bonanza, rodeo, beer, gym-bro energy — see
// horse-words.js for the tone reference) so team names feel like they
// belong in this app rather than a generic sports-team generator.
export const TOW_NAME_PREFIXES = [
  "Bonanza", "Rodeo", "Beer Run", "Gym Bro", "Protein", "Iron", "Sweat",
  "Grind", "Chaos", "Legend", "Thunder", "Savage", "Rowdy", "Renegade",
  "Barnyard", "Stampede", "Outlaw", "Dynasty", "Mayhem", "Hangover",
  "Bonfire", "Backyard", "Feral", "Unhinged", "Midnight", "Six-Pack",
];

export const TOW_NAME_SUFFIXES = [
  "Buckaroos", "Bandits", "Warriors", "Wranglers", "Renegades", "Marauders",
  "Gladiators", "Titans", "Maniacs", "Legends", "Outlaws", "Rustlers",
  "Chargers", "Vipers", "Beasts", "Crushers", "Savages", "Hooligans",
  "Riders", "Bruisers", "Goons", "Menaces", "Wrecking Crew", "Degenerates",
];

export function randomTeamName(rng = Math.random) {
  const prefix = TOW_NAME_PREFIXES[Math.floor(rng() * TOW_NAME_PREFIXES.length)];
  const suffix = TOW_NAME_SUFFIXES[Math.floor(rng() * TOW_NAME_SUFFIXES.length)];
  return `The ${prefix} ${suffix}`;
}

// Generates two distinct team names — used at setup and by the reroll
// control (available pre-Start only; the caller enforces that, not this
// pure function).
export function randomTeamNames(rng = Math.random) {
  const a = randomTeamName(rng);
  let b = randomTeamName(rng);
  let guard = 0;
  while (b === a && guard < 10) {
    b = randomTeamName(rng);
    guard += 1;
  }
  return { a, b };
}
