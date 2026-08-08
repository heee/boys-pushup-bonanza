// Random-word pool for Horse mode — fun/unhinged, non-offensive, always 5
// letters so the elimination math matches Classic HORSE.
export const HORSE_WORDS = [
  "CHAOS", "GONZO", "ZESTY", "NOMAD", "VIBES", "SPICY", "SAUCY", "QUAKE",
  "STORM", "RIVAL", "ROGUE", "HYPED", "BRAWL", "CRANK", "FLAME", "WEIRD",
  "GOOFY", "WACKY", "PANIC", "CLOWN", "GRUMP", "SNARK", "SASSY", "ROWDY",
  "FIZZY", "JAZZY", "DIZZY", "FUZZY", "NIFTY", "HASTY", "ZIPPY", "PEPPY",
  "JUMPY", "MOODY", "MURKY", "TIPSY", "YIKES", "GIDDY", "ROAST", "PROWL",
  "GROWL", "SNEAK", "STING", "SCARY", "FUNKY", "GUTSY", "BOSSY", "FRISK",
];

export function randomHorseWord(exclude, rng = Math.random) {
  const pool = exclude ? HORSE_WORDS.filter((w) => w !== exclude) : HORSE_WORDS;
  const source = pool.length ? pool : HORSE_WORDS;
  return source[Math.floor(rng() * source.length)];
}
