// Share message tone (docs/share-tone-plan.md): Chill / Spicy / Unhinged.
// Every share pool carries a per-line tone string ("c"/"s"/"u", one letter
// per template, from share-tone-ratings.js); picking draws only from lines
// at the chosen level. Untagged arrays pass through untouched.

export const SHARE_TONES = ["chill", "spicy", "unhinged"];
export const SHARE_TONE_KEY = "bpb-share-tone";
export const DEFAULT_SHARE_TONE = "unhinged";

export function currentShareTone() {
  try {
    const value = globalThis.localStorage?.getItem(SHARE_TONE_KEY);
    return SHARE_TONES.includes(value) ? value : DEFAULT_SHARE_TONE;
  } catch {
    return DEFAULT_SHARE_TONE;
  }
}

// Attach ratings: { POOL_NAME: array } + { POOL_NAME: "csu…" }.
export function tagTones(pools, ratings) {
  for (const [name, pool] of Object.entries(pools)) {
    if (ratings[name]) pool.tones = ratings[name];
  }
}

export function tonedChoices(pool, tone = currentShareTone()) {
  if (!pool?.tones) return pool;
  const code = tone[0];
  const choices = pool.filter((_, i) => pool.tones[i] === code);
  return choices.length ? choices : pool;
}

// Appends rated fill lines: { POOL_NAME: { c: [...], s: [...], u: [...] } }.
export function addTonedLines(pools, extras) {
  for (const [name, byTone] of Object.entries(extras)) {
    const pool = pools[name];
    if (!pool) continue;
    pool.tones ||= "u".repeat(pool.length);
    for (const code of ["c", "s", "u"]) {
      for (const template of byTone[code] || []) {
        pool.push(template);
        pool.tones += code;
      }
    }
  }
}

// Spread-joining two pools keeps their ratings.
export function concatToned(...pools) {
  const out = pools.flat();
  out.tones = pools.map((p) => p.tones || "u".repeat(p.length)).join("");
  return out;
}
