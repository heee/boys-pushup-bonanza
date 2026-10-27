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

// Plank variations (timed, no camera, so any of them can be held). Ids are
// prefixed so a session's `modifier` never collides with a pushup grip.
export const PLANK_MODIFIERS = [
  { id: "plank-standard", icon: "🪵", title: "Standard", sub: "Forearms down, body in one straight line", cueLabel: "Forearm Plank", cueSub: "Elbows under shoulders, body straight" },
  { id: "plank-high", icon: "🙌", title: "High plank", sub: "Straight arms; a bit easier on the core, more shoulder work", cueLabel: "High Plank", cueSub: "Hands under shoulders, arms straight" },
  { id: "plank-side", icon: "📐", title: "Side plank", sub: "Obliques and deep back stabilizers; switch sides halfway", cueLabel: "Side Plank", cueSub: "Switch sides halfway" },
  { id: "plank-rkc", icon: "🔥", title: "RKC plank", sub: "Max tension: squeeze glutes, pull elbows toward toes — much shorter holds", cueLabel: "RKC Plank", cueSub: "Squeeze glutes, pull elbows to toes" },
  { id: "plank-longlever", icon: "📏", title: "Long-lever", sub: "Elbows a few inches ahead of shoulders; longer lever, more load", cueLabel: "Long-Lever Plank", cueSub: "Elbows ahead of shoulders" },
  { id: "plank-taps", icon: "👋", title: "Shoulder taps", sub: "High plank, alternate tapping each shoulder; resist the twist", cueLabel: "Shoulder Taps", cueSub: "Alternate taps, hips stay still" },
  { id: "random", icon: "🎲", title: "Random", sub: "A new variation picked for you each session" },
];

// Crunch variations that keep the camera's face-toward-the-phone signal
// intact (phone at the feet); twisting/leg-raise variations are left out
// until they're tested on-device.
export const CRUNCH_MODIFIERS = [
  { id: "crunch-standard", icon: "🙇", title: "Standard", sub: "Classic crunch, shoulder blades off the floor", cueLabel: "Standard Crunch", cueSub: "Shoulder blades off the floor" },
  { id: "crunch-crossbody", icon: "❌", title: "Cross-body", sub: "Elbow to opposite knee, alternating; brings in the obliques", cueLabel: "Cross-Body", cueSub: "Elbow to opposite knee, alternate" },
  { id: "crunch-pause", icon: "⏸️", title: "Pause at top", sub: "Hold about 2 seconds at the top of every rep; no momentum", cueLabel: "Pause at Top", cueSub: "Hold 2 seconds every rep" },
  { id: "crunch-weighted", icon: "🏋️", title: "Weighted", sub: "Hold a plate or weight on your chest", cueLabel: "Weighted", cueSub: "Weight held on your chest" },
  { id: "random", icon: "🎲", title: "Random", sub: "A new variation picked for you each session" },
];

// Home Type → its modifier list; types without one get none.
const MODIFIERS_BY_TYPE = { pushups: MODIFIERS, planks: PLANK_MODIFIERS, situps: CRUNCH_MODIFIERS };

export function modifiersForType(typeId) {
  return MODIFIERS_BY_TYPE[typeId] || [];
}

// Every concrete modifier across all types, for looking up a saved session's tag.
export const ALL_MODIFIERS = [...MODIFIERS, ...PLANK_MODIFIERS, ...CRUNCH_MODIFIERS].filter((m) => m.id !== "random");

export function findModifier(id) {
  return ALL_MODIFIERS.find((m) => m.id === id) || null;
}

const resolvableIds = (list) => list.filter((m) => m.id !== "random").map((m) => m.id);
export const RESOLVABLE_MODIFIER_IDS = resolvableIds(MODIFIERS);

// "random" resolves to a fresh concrete modifier from the given list every
// call (see startWorkout/startPlank/startSitup in app.js, called once per
// session start); any other id (including null) passes through unchanged.
export function resolveModifier(id, random = Math.random, list = MODIFIERS) {
  if (id !== "random") return id;
  const ids = resolvableIds(list);
  return ids[Math.floor(random() * ids.length)];
}
