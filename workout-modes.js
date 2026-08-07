export function workoutHeroModel(mode, count, state = {}) {
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
  return { kind: "hero", display: String(count), label: "PUSHUPS", over: false, spokenValue: count, spokenPrefix: "" };
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
    hideHero: cards || poker || dice || wheel || ladder || sharpshooter || pyramid || fortuneHidesCounter || zen,
    hideHighscore: dice || wheel || sharpshooter || pyramid || fortuneMinimalFeedback || chase || zen,
    hideThermometer: zen || !highScore,
  };
}

export function ladderRungRows(current, rivals, compactRivals) {
  const pageStart = Math.floor((current - 1) / 5) * 5 + 1;
  return [4, 3, 2, 1, 0].map((slot) => {
    const rung = pageStart + slot;
    const rival = rivals.find((entry) => entry.rung === rung) || null;
    return {
      rung,
      status: rung < current ? "cleared" : rung === current ? "active" : "locked",
      rival,
      compactRivals: rival ? compactRivals(rival.users) : false,
    };
  });
}
