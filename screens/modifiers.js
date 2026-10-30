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

// Pull-up grips — the camera tracks the wrists as the bar line, so every
// grip here still counts (wide grip is left out until tested on-device:
// the hands can leave the frame).
export const PULLUP_MODIFIERS = [
  { id: "pullup-overhand", icon: "✊", title: "Overhand", sub: "Standard pull-up grip; more lats and lower traps", cueLabel: "Overhand Grip", cueSub: "Palms facing away" },
  { id: "pullup-chinup", icon: "🤲", title: "Chin-up", sub: "Underhand grip; more biceps and chest, usually more reps", cueLabel: "Chin-up Grip", cueSub: "Palms facing you" },
  { id: "pullup-neutral", icon: "🤜", title: "Neutral", sub: "Palms facing each other; easiest on shoulders and elbows", cueLabel: "Neutral Grip", cueSub: "Palms facing each other" },
  { id: "pullup-lsit", icon: "📐", title: "L-sit", sub: "Legs held straight out in front; adds a hard core hold", cueLabel: "L-sit Pull-up", cueSub: "Legs straight out, hold the L" },
  { id: "pullup-weighted", icon: "🏋️", title: "Weighted", sub: "Belt, vest, or a dumbbell between the feet", cueLabel: "Weighted", cueSub: "Extra weight on" },
  { id: "random", icon: "🎲", title: "Random", sub: "A new grip picked for you each session" },
];

// Squat stances and tempos that keep the camera's hip-height signal intact
// (split squats are left out until tested: smaller, one-sided hip travel).
// Load is the separate kettlebell toggle on the Squat screen.
export const SQUAT_MODIFIERS = [
  { id: "squat-standard", icon: "🦵", title: "Standard", sub: "Feet about shoulder-width apart", cueLabel: "Standard Squat", cueSub: "Feet shoulder-width" },
  { id: "squat-sumo", icon: "↔️", title: "Sumo", sub: "Wide stance, toes out; more inner thighs and glutes", cueLabel: "Sumo Squat", cueSub: "Wide stance, toes out" },
  { id: "squat-narrow", icon: "🤏", title: "Narrow", sub: "Feet close together; more quad emphasis", cueLabel: "Narrow Stance", cueSub: "Feet close together" },
  { id: "squat-pause", icon: "⏸️", title: "Pause at bottom", sub: "Hold about 2 seconds at the bottom; no bounce", cueLabel: "Pause Squat", cueSub: "Hold 2 seconds at the bottom" },
  { id: "squat-jump", icon: "🚀", title: "Jump squat", sub: "Explode up off the floor every rep; power and conditioning", cueLabel: "Jump Squat", cueSub: "Explode up every rep" },
  { id: "random", icon: "🎲", title: "Random", sub: "A new variation picked for you each session" },
];

// Dead hang styles — all keep straight arms with hands above the shoulders,
// so camera timing still works.
export const DEADHANG_MODIFIERS = [
  { id: "deadhang-passive", icon: "😮‍💨", title: "Passive hang", sub: "Fully relaxed shoulders; decompression and mobility", cueLabel: "Passive Hang", cueSub: "Let the shoulders relax" },
  { id: "deadhang-active", icon: "💪", title: "Active hang", sub: "Shoulder blades pulled down and engaged; builds scapular strength", cueLabel: "Active Hang", cueSub: "Pull shoulders down, stay engaged" },
  { id: "deadhang-mixed", icon: "🔀", title: "Mixed grip", sub: "One hand over, one under; stronger grip, longer holds", cueLabel: "Mixed Grip", cueSub: "One overhand, one underhand" },
  { id: "deadhang-towel", icon: "🧻", title: "Towel hang", sub: "Grip a towel over the bar; a big grip-strength step up", cueLabel: "Towel Hang", cueSub: "Hands on the towel, not the bar" },
  { id: "random", icon: "🎲", title: "Random", sub: "A new style picked for you each session" },
];

// Home Type → its modifier list; types without one get none.
const MODIFIERS_BY_TYPE = { pushups: MODIFIERS, planks: PLANK_MODIFIERS, situps: CRUNCH_MODIFIERS, pullups: PULLUP_MODIFIERS, squats: SQUAT_MODIFIERS, deadhang: DEADHANG_MODIFIERS };

export function modifiersForType(typeId) {
  return MODIFIERS_BY_TYPE[typeId] || [];
}

// Every concrete modifier across all types, for looking up a saved session's tag.
export const ALL_MODIFIERS = [...MODIFIERS, ...PLANK_MODIFIERS, ...CRUNCH_MODIFIERS, ...PULLUP_MODIFIERS, ...SQUAT_MODIFIERS, ...DEADHANG_MODIFIERS].filter((m) => m.id !== "random");

export function findModifier(id) {
  return ALL_MODIFIERS.find((m) => m.id === id) || null;
}

const resolvableIds = (list) => list.filter((m) => m.id !== "random").map((m) => m.id);
export const RESOLVABLE_MODIFIER_IDS = resolvableIds(MODIFIERS);

// "random" resolves to a fresh concrete modifier from the given list every
// call (see startWorkout and each exercise's start function in app.js, called once per
// session start); any other id (including null) passes through unchanged.
export function resolveModifier(id, random = Math.random, list = MODIFIERS) {
  if (id !== "random") return id;
  const ids = resolvableIds(list);
  return ids[Math.floor(random() * ids.length)];
}
