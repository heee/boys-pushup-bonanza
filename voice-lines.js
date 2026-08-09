// ===========================================================
// Boys Push Up Bonanza — spoken-line corpus
//
// Single source of truth for every phrase the app can say out loud. Imported
// by BOTH the browser (app.js / voice.js) and the offline clip generator
// (scripts/generate-voice.js), so the shipped audio can never drift from the
// strings the app actually speaks.
//
// The playback engine splices whole pre-rendered clips together, so the corpus
// is deliberately made of *fragments that end on natural phrase boundaries* —
// a number is its own clip, and the prose around it is its own clip. Lines
// that interpolate a teammate's real name work the same way: the fixed prose
// on either side is recorded as its own clip, and the actual name is recorded
// separately (see scripts/generate-voice.js, which pulls the current roster
// from data.json) — the runtime word-matcher in voice.js splices them back
// together, so a name-dropping callout still plays entirely in the custom
// voice instead of falling back to the browser's robotic speechSynthesis.
// ===========================================================

// Shared by voice.js (which manifest/clip folder to load) and the Settings
// screen (which options to list). "dir" is relative to assets/voice/ — the
// default preset lives directly in assets/voice/ for backward compatibility
// with clips generated before multi-preset support existed; each persona
// gets its own subfolder. Keep in sync with scripts/generate-voice.js's own
// PRESETS map (that one also carries the voice/instructions, which are a
// generation-time-only concern and don't belong in the browser bundle).
export const VOICE_PRESETS = [
  { id: "default", label: "Default", dir: "" },
  { id: "drill-de", label: "German Drill Instructor", dir: "drill-de" },
  { id: "sultry", label: "Sexy Drill Instructor", dir: "sultry" },
];

// Numbers 0..MAX_WHOLE_NUMBER get their own single clip so the common case
// (counting reps) is one seamless recording rather than spliced syllables.
// Above that we fall back to splicing "two hundred" + "forty-seven".
export const MAX_WHOLE_NUMBER = 150;

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

export function numberToWords(n) {
  n = Math.round(Number(n));
  if (!Number.isFinite(n)) return "";
  if (n < 0) return "minus " + numberToWords(-n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + numberToWords(n % 100) : "");
  if (n < 1000000) return numberToWords(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + numberToWords(n % 1000) : "");
  return String(n);
}

export function zenCompletionLine(n) {
  return `Practice complete. You completed ${Math.round(Number(n) || 0)} pushups.`;
}
// Corpus-only mirror of zenCompletionLine's wording — kept separate so the
// runtime function is free to round/coerce its argument without breaking the
// sentinel-substitution trick templateFragments relies on (see below).
const ZEN_COMPLETION_TEMPLATE = (n) => `Practice complete. You completed ${n} pushups.`;

// Canonical lookup form for a phrase: lowercase, no punctuation or emoji,
// single-spaced. Both the manifest keys and the runtime matcher go through
// this, so "Let's go!" and "let's go" resolve to the same clip.
export function normalizeSpoken(text) {
  return String(text)
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1$2") // 1,234 -> 1234
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const CARD_RANK_SPOKEN = { A: "Ace", J: "Jack", Q: "Queen", K: "King" };

export const ENCOURAGE_LINES = [
  "Keep grinding!",
  "Let's gooo!",
  "Don't you dare stop now!",
  "Push through!",
  "Almost there — you can smell the record!",
  "Just a few more! You're so close!",
  "Finish strong!",
  "You've got this!",
  "Dig deep!",
  "One more! One more!",
];

export const CHASE_CHAOS_LINES = [
  "The crown is loose! Cause a damn incident!",
  "Keep moving! The leaderboard has called the cops!",
  "More reps! Make the math regret being invented!",
  "This is no longer exercise. This is a hostile damn takeover!",
  "Do not stop! Become the problem nobody trained for!",
  "The floor wants mercy. Denied!",
  "Unleash the gains goblin! It has no permits!",
  "Push, you magnificent agent of chaos!",
];

// Spoken every 5 credited points during a Chase session. All three
// interpolated slots (points, rival name, period label) resolve at runtime
// through their own clips — see CHASE_PERIOD_LABELS below and the real
// usernames scripts/generate-voice.js adds from data.json.
export const CHASE_GAP_LINES = [
  (n, leader, period) => `${n} points until ${leader}'s ${period} throne gets repossessed.`,
  (n, leader) => `${leader} has ${n} points of oxygen left. Breathe irresponsibly.`,
  (n, leader, period) => `${n} points on the ${period} chase. The leaderboard has started hiding the furniture.`,
  (n, leader) => `${n} points until ${leader} becomes a historical footnote.`,
];

// One-off Chase milestone lines (not pools — each fires in one specific
// situation), previously inlined in app.js where the interpolated name meant
// they always fell back to the browser voice.
export const CHASE_TOOK_LEAD_LINE = (leader, period) => `${leader} passed. You lead the ${period} board. Keep extending this beautiful disaster!`;
export const CHASE_LEAD_MARGIN_LINE = (n, leader) => `${n} points clear of ${leader}. Binoculars and emotional support are en route.`;
export const CHASE_FINISH_AHEAD_LINE = (lead, rival, stage) => `Session complete. ${lead} points ahead of ${rival} on the ${stage} board.`;
export const CHASE_FINISH_BEHIND_LINE = (remaining, rival, stage) => `Session complete. ${remaining} points remain to catch ${rival} on the ${stage} board.`;

// Matches CHASE_PERIODS' labels (screens the period picker uses) — every
// value that can ever land in a CHASE_GAP_LINES/CHASE_*_LINE slot needs its
// own clip. normalizeSpoken lowercases everything, so one entry here covers
// both "Daily" and "daily" however a given template happens to case it.
export const CHASE_PERIOD_LABELS = ["Daily", "Weekly", "Monthly", "Quarterly", "Annual"];

// Ladder rival callouts (see ladderRivalCallout in app.js) — same
// interpolated-name situation as Chase. ladderNames() can join 2+ names with
// "and"/commas, which is why those small connector words get their own
// fixed-phrase entries below rather than being baked into a single clip.
export const LADDER_RIVAL_PASSED_LINE = (names) => `Just left ${names} in the dust! Their rung is now a tiny roadside memorial.`;
export const LADDER_RIVAL_MATCHED_LINE = (names) => `You are on ${names}'s rung. Eviction proceedings have begun. Break their furniture.`;
export const LADDER_RIVAL_APPROACHING_LINE = (names) => `${names} are two rungs away. The ladder is drafting their obituary.`;

// Small connector words/phrases needed to splice multi-name callouts
// ("Nelson, Matt, and John") back together at runtime.
export const NAME_JOIN_WORDS = ["and", "the competition"];

// Ladder-specific cheers — spoken instead of the plain rung number on every
// other rung cleared (see onRepCounted in app.js), so a long climb doesn't
// just sound like a flat count-up the whole way.
export const POKER_CALLOUTS = {
  pair: [
    "Pair. Two cards agree. Your arms are still outnumbered.",
    "That's a pair! Small win, big effort required.",
    "Pair on the table. Modest hand, immodest sweat.",
    "A pair! Two matching cards, one very tired human.",
    "Pair! Not much of a hand, but neither is quitting.",
    "That's a pair. The deck's warming up. So are you.",
    "Pair complete. Baby steps, real reps.",
    "A pair on the table! The deck's just getting started.",
  ],
  "two-pair": [
    "Two pair! Double the matching, double the burn.",
    "That's two pair. Two small wins stacked into one big effort.",
    "Two pair on the table! The deck's playing nice today.",
    "Two pair! Not bad, not legendary, definitely still reps.",
    "That's two pair. Twice the luck, all of the sweat.",
    "Two pair complete! The deck's building toward something.",
    "Two pair! Halfway to a full house, all the way to exhausted.",
    "That's two pair on the table. Solid hand, solid effort.",
  ],
  "three-of-a-kind": [
    "Three of a kind. The deck is getting nervous.",
    "Trips. Three matching cards and zero adult supervision.",
    "Three of a kind. Somewhere a probability professor just wept.",
    "Trips on the table. Sanity remains optional.",
    "Three matching cards. The other two are filing a complaint.",
    "Three of a kind! The deck just picked a favorite and it's chaos.",
    "Trips! Three cards agreed on something. Nothing else in this room has.",
    "Three of a kind. Statistically rare. Emotionally inevitable.",
  ],
  straight: [
    "Straight. Five cards in formation. Shoulders in chaos.",
    "Straight! Five cards in a row, zero cards in control.",
    "A straight. The deck lined up. Your arms did not.",
    "Straight draw complete. Consecutive numbers, questionable decisions.",
    "Five in a row! The deck found its marching orders.",
    "Straight! Sequential cards, non-sequential breathing.",
    "That's a straight. Orderly cards, disorderly shoulders.",
    "Straight on the table. The floor didn't see it coming.",
  ],
  flush: [
    "Flush. Same suit. Completely unwell behavior.",
    "Flush! Five of the same suit, zero shared sanity.",
    "That's a flush. The deck picked a team and it's winning.",
    "Flush on the table. Matching suits, mismatched breathing.",
    "Five of a kind of suit. None of a kind of rest.",
    "Flush! The cards matched. Your arms did not get the memo.",
    "A flush! Uniform suits, catastrophic form.",
    "Flush complete. The deck is flexing harder than you are.",
  ],
  "full-house": [
    "Full house. Nobody leaves. Nobody has functioning arms.",
    "Full house! Three plus two equals nobody's making it home early.",
    "That's a full house. The deck just moved in and it's not leaving.",
    "Full house on the table. Occupancy maximum. Arms evicted.",
    "Full house! Everybody's home and nobody's comfortable.",
    "That's a full house. Zero vacancies, several regrets.",
    "Full house complete. The deck is officially overcrowded.",
    "Full house! Three of one, two of another, none of you left standing.",
  ],
  "four-of-a-kind": [
    "Four of a kind. This is now a crime scene.",
    "Four of a kind! Somebody call a lawyer, the deck's confessing.",
    "Quads on the table. Four matching cards, one exhausted human.",
    "Four of a kind! The odds just filed a missing person's report.",
    "That's quads. Four cards agreed. Your shoulders did not consent.",
    "Four of a kind! This deck has a favorite and it's terrifying.",
    "Quads! Statistically absurd. Physically brutal.",
    "Four of a kind on the table. The deck is showing off now.",
  ],
  "straight-flush": [
    "Straight flush. The deck has begun speaking in tongues.",
    "Straight flush! The deck just achieved main character energy.",
    "That's a straight flush. Reality is now optional.",
    "Straight flush on the table. The laws of probability have left the chat.",
    "Straight flush! Five in a row, same suit, zero explanations.",
    "A straight flush! The deck is showing off and so should you.",
    "Straight flush complete. Somebody frame this deck.",
    "Straight flush! This is either destiny or a rigged deck. Either way, keep pushing.",
  ],
  "royal-flush": [
    "Royal flush. Shut it down. We have angered the gods.",
    "Royal flush! Call it. The deck peaked and so should your form.",
    "A royal flush. The rarest hand in the deck, on the floor, right now.",
    "Royal flush! Somewhere a casino pit boss just got nervous.",
    "That's a royal flush. The deck has ascended. So should your rep count.",
    "Royal flush on the table! This might never happen again. Neither will these reps.",
    "Royal flush! Ten, Jack, Queen, King, Ace — royalty and zero mercy.",
    "Royal flush! The universe blinked. Don't you dare stop.",
  ],
};

export const LADDER_CHEER_LINES = [
  "Higher!",
  "Keep climbing!",
  "Don't look down!",
  "Rung after rung!",
  "You're on fire!",
  "Send it!",
  "No rope needed!",
  "Climbing strong!",
  "Another rung!",
  "Up you go!",
];

export const SHARPSHOOTER_HIT_LINES = [
  "Bullseye! Target destroyed.",
  "Dead center! The target has retained counsel.",
  "Direct hit! The bullseye is now a crime scene.",
  "Target down! Reloading the suffering.",
  "Clean shot! The range officer has left the building.",
  "Bullseye! Gravity has been formally warned.",
  "Target annihilated! Next victim incoming.",
  "Dead center! Your chest has ballistic clearance.",
];

// Pyramid mode — spoken instead of the plain row number on every other row
// cleared (see onRepCounted in app.js), same alternation Ladder uses.
export const PYRAMID_ROW_CHEER_LINES = [
  "One row closer!",
  "The pyramid shrinks!",
  "Keep stacking!",
  "Another row down!",
  "The apex is calling!",
  "Brick by brick!",
  "Row cleared!",
  "Onward and upward!",
];

// Wheel of pain — spoken when a spin lands (see wheelSpokenForResult in
// app.js). Numbers reuse the shared numberToWords corpus above; only the
// fixed prose around them needs its own clips. Grip-switch labels mirror
// MODIFIERS' cueLabel strings (screens/modifiers.js) — kept as a flat list
// here rather than importing that module, so the voice corpus doesn't take
// a dependency on a UI screen.
export const WHEEL_DOUBLE_PREFIX = "Double or nothing!";
export const WHEEL_BOSS_LINE = (n) => `Boss number! ${n}!`;
export const WHEEL_FREEBIE_LINE = (n) => `Freebie! Just ${n}.`;
export const WHEEL_BUST_LINE = (n) => `Bust! Same again: ${n}!`;
export const WHEEL_TEMPO_LINE = (n) => `Slow tempo! ${n}!`;
export const WHEEL_GRIP_LABELS = ["Standard Grip", "Wide Grip", "Close Grip", "Diamond Grip", "Staggered Grip", "Archer", "Incline", "Decline"];

export const PYRAMID_APEX_LINE = "Apex reached! The tomb has been disturbed.";
export const PYRAMID_TURNAROUND_LINE = "Turning around! Now we rebuild what we destroyed.";
export const PYRAMID_COMPLETE_LINE = "Pyramid complete! Let the history books remember this.";

// Horse mode — spoken from completeHorseTurn in app.js at the four moments
// a turn can end: the bar gets raised (beat the target, or the opening set
// that sets it), a letter gets collected (missed but survives), full
// elimination (word spelled out, OUT), and winning the whole game. Same
// unhinged register as the rest of the corpus, leaning on the actual H-O-R-S-E
// spelling-bee/livestock conceit since that's the one joke unique to this mode.
export const HORSE_CLEAR_LINES = [
  "Bar raised! Somebody here is about to cry.",
  "New number on the board! The word is getting hungrier.",
  "Cleared it! That bar is now a certified war crime.",
  "Target smoked! Next victim, please.",
  "That's the new number to beat! Bring a lawyer.",
  "Bar's up! Somewhere, a letter is being sharpened just for the rest of you.",
  "Cleared with room to spare! The rest of the field is in grave danger.",
  "New target locked in! May whoever's next find mercy, because I certainly won't.",
  "That number is officially cursed now! Good luck, everybody.",
  "Bar raised! This horse just got a lot more horse.",
  "Set and matched! Somewhere a horse just felt a great disturbance.",
];

export const HORSE_LETTER_LINES = [
  "Missed it! The word is spelling itself whether you like it or not.",
  "That's a letter for the collection! One step closer to a very public equestrian tragedy.",
  "Whiff! Somewhere, an actual horse just whinnied in your general direction.",
  "Letter collected! The spelling bee has teeth, apparently.",
  "Came up short! You're being spelled into oblivion, one letter at a time.",
  "That's a letter, unfortunately! The word does not accept apologies.",
  "Missed the number! Somebody update the obituary, the horse edition.",
  "Letter added! You are one step closer to a very embarrassing group chat screenshot.",
  "Didn't beat it! The word is spelling itself and it is not being gentle about it.",
];

export const HORSE_ELIMINATED_LINES = [
  "OUT! The word has spoken, and it is furious.",
  "Fully spelled! You are, canonically, a horse now. Congratulations.",
  "That's the whole word! Somebody get this man a saddle, he is finished.",
  "Eliminated! The horse accepts your resignation.",
  "OUT! Word complete. The stable door is closing behind you.",
  "Spelled in full! You have been legally reclassified as livestock.",
  "That's it, you're out! The other horses are already laughing.",
  "OUT! Somewhere, an actual horse is deeply offended on your behalf.",
];

export const HORSE_WIN_LINES = [
  "Winner! Everyone else here is now, officially, a horse.",
  "Game over, you win! The stable is empty except for the losers.",
  "Champion! You out-horsed everybody, and that sentence just happened.",
  "Victory! The other horses have been put out to pasture.",
  "That's the game! You remain human. Everyone else, considerably less so.",
  "You win! History will remember this as the day nobody else could count.",
  "Game, set, horse! You are the last one standing and it absolutely shows.",
  "Champion of Horse! A title that sounds worse than it is. You earned it though.",
];

export const FUN_MESSAGES = [
  (n) => `${n} pushups down. Somewhere, a gym bro just shed a single tear.`,
  (n) => `That's ${n} reps of pure bonanza energy.`,
  (n) => `${n}! The floor never stood a chance.`,
  (n) => `Boom. ${n} pushups. Tell your friends before they check the leaderboard.`,
  (n) => `${n} reps in the books. Absolute unit behavior.`,
  (n) => `${n} pushups. Certified gym bro moment.`,
  (n) => `The floor is filing a restraining order after ${n} pushups today.`,
  (n) => `${n} reps deep. Somebody get this man a protein shake.`,
  (n) => `Legendary. ${n} pushups and not a single excuse.`,
  (n) => `${n} down. Your future self just texted "thank you."`,
  (n) => `That's ${n} reps of chaotic gains energy.`,
  (n) => `${n} pushups. The gains gremlins are pleased.`,
  (n) => `Absolute unit alert: ${n} pushups completed.`,
  (n) => `${n} reps. Somewhere a protein shake shed a single tear of joy.`,
  (n) => `${n} pushups in. You may now flex responsibly.`,
  (n) => `${n} down. The leaderboard trembles.`,
];

// Squat mode — spoken at set start (SQUAT_START_LINES), as random mid-set
// cheers (SQUAT_CHEER_LINES, same cheerProbability shape Plank uses), and on
// a new per-user best (SQUAT_RECORD_LINE, added to FIXED_PHRASES below).
// Same unhinged drill-instructor register as CHASE_CHAOS_LINES, aimed at
// thighs/chairs/the floor/gravity instead of the leaderboard.
export const SQUAT_START_LINES = [
  "Every chair in this house is about to lose its job! Let's go!",
  "Gravity signed up for this! Down we go!",
  "Knees soft, dignity optional! Squat time!",
];

export const SQUAT_CHEER_LINES = [
  "Lower! That chair filed a formal complaint!",
  "Thighs on fire and the fire department is proud!",
  "Elevators everywhere are filing grievances! Keep squatting!",
  "Gravity is doing its best work today! Don't you dare stand down!",
  "The floor did not consent to this many visits! Again!",
  "Quads the size of Sunday dinner! Keep going!",
  "That recliner will never feel safe around you again! Squat!",
  "Somewhere a La-Z-Boy just wept with jealousy! Push!",
];

export const SQUAT_RECORD_LINE = "New squat record! The chairs have officially been replaced!";

export const FUN_MESSAGES_SQUAT = [
  (n) => `${n} squats deep. Somewhere, a recliner is filing for unemployment.`,
  (n) => `That's ${n} squats of pure thigh chaos.`,
  (n) => `${n} squats! The floor has seen entirely too much of you today.`,
  (n) => `${n} down. Gravity would like a word with your quads.`,
  (n) => `${n} squats logged. Elevators everywhere remain deeply offended.`,
  (n) => `${n} squats. Certified chair-replacement behavior.`,
];

export const FUN_MESSAGES_PLANK = [
  (s) => `${s} second plank! Somewhere, a yoga instructor sheds a single tear.`,
  (s) => `Held it for ${s} seconds. Absolute plank behavior.`,
  (s) => `${s} seconds of pure core chaos.`,
  (s) => `${s} seconds down. The floor is still shaking.`,
  (s) => `That's ${s} seconds of plank supremacy.`,
  (s) => `${s} seconds. Your abs just filed a complaint.`,
];

// Everything the app says that isn't a number, a cheer, or a fun-message tail.
export const FIXED_PHRASES = [
  "Let's go",
  "Paused",
  "Back to it",
  "Session complete.",
  "Plank complete.",
  "New personal record! Absolute legend!",
  "New plank record! Absolute legend!",
  SQUAT_RECORD_LINE,
  "New rung record!",
  "Hidden plank mode unlocked!",
  "All leaders passed. The leaderboard is now a crime scene. Keep going!",
  "One point ahead. Crown acquired. Dignity optional.",
];

// Splitting a template on a sentinel gives us exactly the prose fragments that
// sit around the interpolated value(s) — which is what we need to record.
// Supports any arity: each argument position gets its own sentinel character,
// so a 3-slot template (e.g. points/name/period) still yields clean fixed
// fragments around every slot, not just the first.
const SENTINELS = ["", "", "", ""];
const SENTINEL_SPLIT_RE = new RegExp(`[${SENTINELS.join("")}]`);
function templateFragments(fn) {
  const args = SENTINELS.slice(0, Math.max(1, fn.length));
  return String(fn(...args))
    .split(SENTINEL_SPLIT_RE)
    .map((s) => s.replace(/^[\s!.,;:?—-]+/, "").trim())
    .filter((s) => normalizeSpoken(s).length > 0);
}

// Every distinct clip the app needs, as { text, key, tone } entries. `text`
// is what gets sent to the TTS API; `key` is what the runtime matcher looks
// up; `tone` selects which delivery instructions scripts/generate-voice.js
// uses — a single "be intense" prompt reads as huskier/quieter on a single
// short word than on a full sentence, so numbers, hype lines, and calm
// status lines each get their own tuned instructions. Real teammate names
// are NOT part of this static corpus (they're user data, not app content) —
// scripts/generate-voice.js adds those separately by reading data.json.
export function buildCorpus() {
  const entries = [];
  const seen = new Set();
  const add = (text, tone) => {
    const key = normalizeSpoken(text);
    if (!key || seen.has(key)) return; // first tone tagged for a phrase wins
    seen.add(key);
    entries.push({ key, text, tone });
  };

  add("Paused", "calm");
  add("Back to it", "calm");

  for (let n = 0; n <= MAX_WHOLE_NUMBER; n++) add(numberToWords(n), "number");
  for (let h = 2; h <= 9; h++) add(`${ONES[h]} hundred`, "number");
  add("thousand", "number");
  add("minus", "number");
  add("plus", "number");
  for (const rank of Object.values(CARD_RANK_SPOKEN)) add(rank, "number");

  for (const phrase of FIXED_PHRASES) add(phrase, "hype");
  for (const phrase of CHASE_PERIOD_LABELS) add(phrase, "hype");
  for (const word of NAME_JOIN_WORDS) add(word, "hype");
  for (const line of ENCOURAGE_LINES) add(line, "hype");
  for (const line of CHASE_CHAOS_LINES) add(line, "hype");
  for (const line of SQUAT_START_LINES) add(line, "hype");
  for (const line of SQUAT_CHEER_LINES) add(line, "hype");
  for (const line of LADDER_CHEER_LINES) add(line, "hype");
  for (const line of SHARPSHOOTER_HIT_LINES) add(line, "hype");
  for (const line of PYRAMID_ROW_CHEER_LINES) add(line, "hype");
  add(PYRAMID_APEX_LINE, "hype");
  add(PYRAMID_TURNAROUND_LINE, "hype");
  add(PYRAMID_COMPLETE_LINE, "hype");
  for (const line of HORSE_CLEAR_LINES) add(line, "hype");
  for (const line of HORSE_LETTER_LINES) add(line, "hype");
  for (const line of HORSE_ELIMINATED_LINES) add(line, "hype");
  for (const line of HORSE_WIN_LINES) add(line, "hype");
  add(WHEEL_DOUBLE_PREFIX, "hype");
  for (const label of WHEEL_GRIP_LABELS) add(label, "hype");
  for (const fn of [WHEEL_BOSS_LINE, WHEEL_FREEBIE_LINE, WHEEL_BUST_LINE, WHEEL_TEMPO_LINE]) {
    for (const frag of templateFragments(fn)) add(frag, "hype");
  }
  for (const lines of Object.values(POKER_CALLOUTS)) {
    for (const line of lines) add(line, "hype");
  }
  for (const fn of FUN_MESSAGES) for (const frag of templateFragments(fn)) add(frag, "hype");
  for (const fn of FUN_MESSAGES_PLANK) for (const frag of templateFragments(fn)) add(frag, "hype");
  for (const fn of FUN_MESSAGES_SQUAT) for (const frag of templateFragments(fn)) add(frag, "hype");
  for (const fn of CHASE_GAP_LINES) for (const frag of templateFragments(fn)) add(frag, "hype");
  for (const frag of templateFragments(CHASE_TOOK_LEAD_LINE)) add(frag, "hype");
  for (const frag of templateFragments(CHASE_LEAD_MARGIN_LINE)) add(frag, "hype");
  for (const frag of templateFragments(CHASE_FINISH_AHEAD_LINE)) add(frag, "hype");
  for (const frag of templateFragments(CHASE_FINISH_BEHIND_LINE)) add(frag, "hype");
  for (const frag of templateFragments(LADDER_RIVAL_PASSED_LINE)) add(frag, "hype");
  for (const frag of templateFragments(LADDER_RIVAL_MATCHED_LINE)) add(frag, "hype");
  for (const frag of templateFragments(LADDER_RIVAL_APPROACHING_LINE)) add(frag, "hype");
  for (const frag of templateFragments(ZEN_COMPLETION_TEMPLATE)) add(frag, "zen");

  return entries;
}
