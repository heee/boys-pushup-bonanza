export function workoutHeroModel(mode, count, state = {}) {
  if (mode === "horse") {
    // The hero number is the target to beat, not the live count — see
    // horseTurnHeroCopy in screens/horse.js. This just drives the live-count
    // subordinate line and the spoken rep number.
    return { kind: "horse", count, spokenValue: count, spokenPrefix: "" };
  }
  if (mode === "countdown") {
    const remaining = state.countdownTarget - count;
    return {
      kind: "hero",
      display: remaining > 0 ? String(remaining) : `+${-remaining}`,
      label: remaining > 0 ? "TO BEAT YOUR RECORD" : "OVER YOUR RECORD",
      over: remaining <= 0,
      spokenValue: Math.abs(remaining),
      spokenPrefix: remaining > 0 ? "" : "plus ",
    };
  }
  if (mode === "tow") {
    // Tug of War bursts are open-ended, just like Classic — the only
    // difference is the label, since "reps" here are being contributed to a
    // team total rather than a personal one.
    return { kind: "hero", display: String(count), label: "REPS COUNTED", over: false, spokenValue: count, spokenPrefix: "" };
  }
  const targets = {
    cards: [state.cardTarget, state.cardRepsDone],
    poker: [state.pokerCardTarget, state.pokerCardRepsDone],
    dice: [state.diceTarget, state.diceRepsDone],
    wheel: [state.wheelTarget, state.wheelRepsDone],
    ladder: [state.ladderRung, state.ladderRepsDone],
    sharpshooter: [state.sharpshooterTarget, state.sharpshooterRepsDone],
    pyramid: [state.pyramidRow, state.pyramidRepsDone],
  };
  if (targets[mode]) {
    const remaining = Math.max(0, targets[mode][0] - targets[mode][1]);
    return { kind: mode, remaining, spokenValue: remaining, spokenPrefix: "" };
  }
  return { kind: "hero", display: String(count), label: "PUSHUPS", over: !!state.highScore && count > state.highScore, spokenValue: count, spokenPrefix: "" };
}

export function workoutHudModel(mode, highScore, fortuneChallenge) {
  const cards = mode === "cards";
  const dice = mode === "dice";
  const poker = mode === "poker";
  const wheel = mode === "wheel";
  const ladder = mode === "ladder";
  const fortune = mode === "fortune";
  const chase = mode === "chase";
  const zen = mode === "zen";
  const sharpshooter = mode === "sharpshooter";
  const pyramid = mode === "pyramid";
  const horse = mode === "horse";
  const tow = mode === "tow";
  const pulse = mode === "pulse";
  const cock = mode === "cock";
  const fortuneHidesCounter = fortune && !!fortuneChallenge?.hideCounter;
  const fortuneMinimalFeedback = fortune && !!fortuneChallenge?.minimalFeedback;
  return {
    cards,
    dice,
    wheel,
    ladder,
    fortune,
    chase,
    zen,
    poker,
    sharpshooter,
    pyramid,
    horse,
    tow,
    pulse,
    cock,
    hideHero: cards || poker || dice || wheel || ladder || sharpshooter || pyramid || horse || fortuneHidesCounter || zen || pulse || cock,
    hideHighscore: dice || wheel || sharpshooter || pyramid || horse || tow || fortuneMinimalFeedback || chase || zen || pulse || cock,
    // Pulse/Cock both have their own pace visualization (trace chart), not
    // the generic high-score thermometer.
    hideThermometer: zen || horse || tow || pulse || cock || !highScore,
  };
}

// Five perspective slots, farthest (1, top) to nearest (5, bottom), always
// centered on the live rung at slot 3 — the ladder scrolls under the player
// rather than the player moving up a list, so slot math is a plain offset
// from `current` rather than a page reset. Slots below rung 1 don't exist
// yet (start of a session) and come back as status "empty" so the caller can
// skip rendering them instead of re-centering.
//
// `self` (optional {name, avatar, rung}) is folded into whichever row matches
// the player's own all-time best Ladder rung — same treatment as any other
// rival, keyed off `self.rung` rather than the live rung being climbed, so it
// stays put on that row instead of following the player up the ladder.
export function ladderRungRows(current, rivals, compactRivals, self) {
  return [1, 2, 3, 4, 5].map((slot) => {
    const rung = current + (3 - slot);
    if (rung < 1) return { slot, rung: null, status: "empty", rival: null, compactRivals: false };
    const status = rung < current ? "done" : rung === current ? "active" : "locked";
    let rival = rivals.find((entry) => entry.rung === rung) || null;
    if (self && self.rung === rung) {
      const users = rival ? [...rival.users, { ...self, self: true }] : [{ ...self, self: true }];
      rival = { rung, names: users.map((user) => user.name), users };
    }
    return {
      slot,
      rung,
      status,
      rival,
      compactRivals: rival ? compactRivals(rival.users) : false,
    };
  });
}
