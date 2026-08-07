// Segment catalog. angleDeg values sum to 360 and drive the weighted random
// pick (bigger share = more likely) — they are NOT the visual slice size;
// the dial is drawn with 12 equal-size slices (see displaySegments) while
// the odds stay skewed toward common outcomes underneath. numRange values
// are fractions of the user's personal best (PR); freebie is a flat rep
// count, not PR-scaled.
export const WHEEL_SEGMENTS = [
  { id: "num1", type: "number", icon: "🔢", label: "…", angleDeg: 60, numRange: [0.10, 0.20] },
  { id: "num2", type: "number", icon: "🔢", label: "…", angleDeg: 50, numRange: [0.20, 0.35] },
  { id: "num3", type: "number", icon: "🔢", label: "…", angleDeg: 42, numRange: [0.35, 0.50] },
  { id: "num4", type: "number", icon: "🔢", label: "…", angleDeg: 36, numRange: [0.50, 0.65] },
  { id: "num5", type: "number", icon: "🔢", label: "…", angleDeg: 28, numRange: [0.65, 0.75] },
  { id: "grip", type: "grip", icon: "🤲", label: "Grip", angleDeg: 27, numRange: [0.10, 0.75] },
  { id: "tempo", type: "tempo", icon: "🐢", label: "Slow", angleDeg: 27, numRange: [0.10, 0.75] },
  { id: "spin_again", type: "spin_again", icon: "🔁", label: "Spin again", angleDeg: 27 },
  { id: "double", type: "double", icon: "✖️2", label: "Double or nothing", angleDeg: 27 },
  { id: "freebie", type: "freebie", icon: "🎁", label: "Freebie", angleDeg: 12, flatValue: 3 },
  { id: "boss", type: "boss", icon: "👑", label: "Boss", angleDeg: 12, numRange: [1.00, 1.25] },
  { id: "bust", type: "bust", icon: "💀", label: "Bust", angleDeg: 12 },
];

// Equal-size layout for the dial itself — every slice gets the same visual
// share regardless of its actual pick weight (see pickSegment/angleDeg).
export function displaySegments() {
  const slice = 360 / WHEEL_SEGMENTS.length;
  return WHEEL_SEGMENTS.map((seg, i) => {
    const start = i * slice;
    const end = start + slice;
    return { ...seg, startDeg: start, endDeg: end, midDeg: start + slice / 2 };
  });
}

function pickSegment(random) {
  const roll = random() * 360;
  let acc = 0;
  for (const seg of WHEEL_SEGMENTS) {
    acc += seg.angleDeg;
    if (roll < acc) return seg;
  }
  return WHEEL_SEGMENTS[WHEEL_SEGMENTS.length - 1];
}

function numberInRange(pr, [lo, hi], random) {
  const min = Math.max(1, Math.round(pr * lo));
  const max = Math.max(min, Math.round(pr * hi));
  return min + Math.floor(random() * (max - min + 1));
}

// Resolves one Spin tap to completion, following spin_again/double chains.
// Returns { landings, targetReps, modifierId, cueLabel, cueSub } where
// `landings` is the ordered list of segments the wheel visually stops on
// (for sequential animation) and the rest describes the final set to do.
export function resolveWheelSpin({ pr, lastTarget, random = Math.random, pickRandomModifier, chainCap = 5 }) {
  const landings = [];
  let doubled = false;

  function land() {
    const seg = pickSegment(random);
    landings.push(seg);
    const atCap = landings.length >= chainCap;
    if (seg.type === "spin_again" && !atCap) return land();
    if (seg.type === "double" && !atCap) { doubled = true; return land(); }
    // Safety valve: chain length hit cap while still on a non-resolvable
    // segment (spin_again/double) — force a plain number instead of
    // finalizing on a type finalize() can't handle.
    if (seg.type === "spin_again" || seg.type === "double") {
      return finalize(WHEEL_SEGMENTS.find((s) => s.type === "number"));
    }
    return finalize(seg);
  }

  function finalize(seg) {
    let targetReps, modifierId = null, cueLabel = null, cueSub = null;
    if (seg.type === "number") targetReps = numberInRange(pr, seg.numRange, random);
    else if (seg.type === "boss") { targetReps = numberInRange(pr, seg.numRange, random); cueLabel = "Boss number"; cueSub = "Give it everything"; }
    else if (seg.type === "freebie") { targetReps = seg.flatValue; cueLabel = "Freebie"; cueSub = "Mercy set"; }
    else if (seg.type === "bust") { targetReps = lastTarget || numberInRange(pr, [0.10, 0.20], random); cueLabel = "Bust"; cueSub = "Same number again"; }
    else if (seg.type === "grip") { targetReps = numberInRange(pr, seg.numRange, random); modifierId = pickRandomModifier(random); }
    else if (seg.type === "tempo") { targetReps = numberInRange(pr, seg.numRange, random); cueLabel = "Slow Tempo"; cueSub = "3s down, 3s up — no extra reps, just no rushing"; }
    if (doubled) targetReps *= 2;
    return { landings, targetReps, modifierId, cueLabel, cueSub };
  }

  return land();
}
