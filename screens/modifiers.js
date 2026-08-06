// Cross-mode "how a pushup is executed" modifiers (grip/hand position, or
// incline/decline) — orthogonal to pushupMode (which game is being played).
// cueLabel/cueSub are the short strings shown on the in-session floating
// cue; title/sub are the fuller copy shown in the picker list.
export const MODIFIERS = [
  { id: "standard", icon: "🤲", title: "Standard", sub: "Hands approximately shoulder-width apart", cueLabel: "Standard Grip", cueSub: "Shoulder-width hands" },
  { id: "wide", icon: "↔️", title: "Wide", sub: "Hands outside shoulder width; greater chest emphasis", cueLabel: "Wide Grip", cueSub: "Hands outside shoulder width" },
  { id: "close", icon: "🤏", title: "Close", sub: "Hands inside shoulder width; more triceps emphasis", cueLabel: "Close Grip", cueSub: "Hands inside shoulder width" },
  { id: "diamond", icon: "💎", title: "Diamond", sub: "Thumbs and index fingers form a diamond", cueLabel: "Diamond Grip", cueSub: "Thumbs and index fingers touching" },
  { id: "staggered", icon: "🔀", title: "Staggered", sub: "One hand slightly forward, the other back; alternate hands every rep", cueLabel: "Staggered Grip", cueSub: "Alternate hands every rep" },
  { id: "archer", icon: "🏹", title: "Archer", sub: "Shift toward one arm while the other stays extended", cueLabel: "Archer", cueSub: "Shift side to side, one arm stays extended" },
  { id: "incline", icon: "↗️", title: "Incline", sub: "Hands elevated — easier", cueLabel: "Incline", cueSub: "Hands elevated" },
  { id: "decline", icon: "↘️", title: "Decline", sub: "Feet elevated — harder", cueLabel: "Decline", cueSub: "Feet elevated" },
  { id: "random", icon: "🎲", title: "Random", sub: "A new modifier picked for you each session" },
];

export const RESOLVABLE_MODIFIER_IDS = MODIFIERS.filter((m) => m.id !== "random").map((m) => m.id);

// "random" resolves to a fresh concrete modifier every call (see
// startWorkout in app.js, which calls this once per session start); any
// other id (including null) passes through unchanged.
export function resolveModifier(id, random = Math.random) {
  if (id !== "random") return id;
  return RESOLVABLE_MODIFIER_IDS[Math.floor(random() * RESOLVABLE_MODIFIER_IDS.length)];
}
