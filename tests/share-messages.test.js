import test from "node:test";
import assert from "node:assert/strict";

async function withFirstTemplate(run, key) {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const module = await import(`../share-messages.js?${key}`);
    return run(module);
  } finally {
    Math.random = originalRandom;
  }
}

test("every completed workout mode keeps its own unhinged share theme", async () => {
  await withFirstTemplate(({ pickShareMessage }) => {
    const cases = [
      ["classic", 25, { mode: "classic" }, /CLASSIC MODE: 25 pushups.*suspicious pump/],
      ["countdown", 35, { mode: "countdown", countdownCtx: { target: 30, beat: true, margin: 5, remaining: 0 } }, /COUNTDOWN MURDERED: target 30.*35.*by 5/],
      ["cards", 30, { mode: "cards", cardsCtx: { cards: 3, cardsText: "3 cards" } }, /CARDS MODE: cleared 3 cards.*30 pushups/],
      ["poker", 80, { mode: "poker", pokerCtx: { hands: 2, handsText: "2 hands", bestRank: 6, bestHand: "Full House" } }, /80 pushups across 2 hands.*Full House/],
      ["dice", 28, { mode: "dice", diceCtx: { rolls: 4, rollsText: "4 rolls" } }, /DICE MODE: cleared 4 rolls.*28 reps/],
      ["ladder", 36, { mode: "ladder", ladderCtx: { maxRung: 8, isNewBest: false, passedRivals: [] } }, /Reached rung 8.*36 reps/],
      ["sharpshooter", 62, { mode: "sharpshooter", sharpshooterCtx: { targets: 3, targetsText: "3 targets", longestShot: 24, remaining: 12 } }, /SHARPSHOOTER MODE: destroyed 3 targets.*62 pushups/],
      ["fortune", 24, { mode: "fortune", fortuneCtx: { title: "PERFECT FORM", target: null } }, /FORTUNE COOKIE assigned PERFECT FORM.*24 pushups/],
      ["zen", 20, { mode: "zen", isZen: true }, /ZEN MODE: 20 silent pushups/],
      ["plank", "1:30", { mode: "plank", isPlank: true }, /1:30 pretending to be a coffee table/],
      ["pullup", 8, { mode: "pullup", isPullup: true }, /8 pull-ups.*Gravity.*meeting/],
      ["squat", 15, { mode: "squat", isSquat: true }, /15 squats.*recliner.*unemployment/],
      ["situp", 15, { mode: "situp", isSitup: true }, /15 crunches.*ceiling.*inspected/],
      ["chainofpain", "3.7 cycles", { mode: "chainofpain", isChainOfPain: true, chainOfPainCtx: { squats: 40, pushups: 30, plankSeconds: 90, segments: 11 } }, /3\.7 cycles.*chain.*link/],
    ];

    for (const [mode, count, ctx, expected] of cases) {
      assert.match(pickShareMessage(count, ctx), expected, mode);
    }
  }, "all-mode-themes");
});

test("Chain of Pain share pool is large, non-repeating, and interpolates cycles + breakdown", async () => {
  const originalRandom = Math.random;
  try {
    const { pickShareMessage } = await import("../share-messages.js?chainofpain-pool");
    const ctx = {
      mode: "chainofpain",
      isChainOfPain: true,
      chainOfPainCtx: { squats: 12, pushups: 8, plankSeconds: 45, segments: 16 },
    };
    // Sweep Math.random across enough evenly-spaced buckets to visit every
    // pool entry exactly once (offset by 0.1/N to stay clear of float-floor
    // edge cases), collecting the resulting messages into a set.
    const buckets = 24;
    const seen = new Set();
    for (let i = 0; i < buckets; i++) {
      Math.random = () => Math.min(0.999999, (i + 0.1) / buckets);
      seen.add(pickShareMessage("5.3 cycles", ctx));
    }
    assert.ok(seen.size >= 15, `expected at least 15 distinct Chain of Pain share messages, got ${seen.size}`);
    assert.ok([...seen].every((m) => m.includes("5.3 cycles")), "every message should interpolate the cycles readout");
    assert.ok([...seen].every((m) => (m.match(/\p{Extended_Pictographic}/gu) || []).length >= 3), "every message should include several emojis");
    assert.ok([...seen].every((m) => /chain/i.test(m)), "every message should keep the chain theme");
    assert.ok([...seen].some((m) => m.includes("12") && m.includes("8")), "at least one message should interpolate the squats/pushups breakdown");
  } finally {
    Math.random = originalRandom;
  }
});

test("Chain shares distinguish complete loops from extra exercise links", async () => {
  const originalRandom = Math.random;
  try {
    const { pickShareMessage } = await import("../share-messages.js?chain-links");
    for (const segments of [0, 1, 2, 3, 16]) {
      Math.random = () => 20.1 / 24;
      const message = pickShareMessage(`${(segments / 3).toFixed(1)} cycles`, {
        mode: "chainofpain", chainOfPainCtx: { segments },
      });
      assert.ok(message.includes(`Full loops: ${Math.floor(segments / 3)}`));
      assert.ok(message.includes(`Extra completed links: ${segments % 3}`));
      assert.doesNotMatch(message, /undefined|NaN/);
    }
  } finally {
    Math.random = originalRandom;
  }
});

test("unfinished special-mode sessions never fall back to Classic copy", async () => {
  await withFirstTemplate(({ pickShareMessage }) => {
    assert.match(pickShareMessage(6, { mode: "cards", cardsCtx: { cards: 0 } }), /Cards mode.*card cleared/i);
    assert.match(pickShareMessage(7, { mode: "poker", pokerCtx: { hands: 0 } }), /Poker mode.*not even one full hand/i);
    assert.match(pickShareMessage(5, { mode: "dice", diceCtx: { rolls: 0 } }), /Dice mode.*zero rolls/i);
    assert.match(pickShareMessage(4, { mode: "ladder", ladderCtx: { maxRung: 0 } }), /Ladder mode.*rung zero/i);
    assert.match(pickShareMessage(4, { mode: "sharpshooter", sharpshooterCtx: { targets: 0, remaining: 6 } }), /Sharpshooter mode.*no target destroyed/i);
  }, "unfinished-modes");
});

test("Ladder shares compact passed rivals and append PR plus weighted damage", async () => {
  await withFirstTemplate(({ compactVictimNames, pickShareMessage }) => {
    assert.equal(compactVictimNames(["Dave", "Mike", "Nelson", "Paul", "Rob"]), "Dave, Mike, and 3 other victims");
    const message = pickShareMessage(55, {
      mode: "ladder",
      ladderCtx: {
        maxRung: 10,
        isNewBest: true,
        passedRivals: ["Dave", "Mike", "Nelson", "Paul", "Rob"],
      },
      weightedCtx: { weightLbs: 25, rawCount: 40 },
      prCtx: { title: "August PR", oldBest: 48, newCount: 55 },
    });
    assert.match(message, /rung 10/i);
    assert.match(message, /Passed Dave, Mike, and 3 other victims/);
    assert.match(message, /New personal best at rung 10/);
    assert.match(message, /\+25 lbs/);
    assert.match(message, /August PR: 48 → 55/);
  }, "ladder-modifiers");
});

test("Fortune progression outcomes append without replacing Fortune copy", async () => {
  await withFirstTemplate(({ pickShareMessage }) => {
    const win = pickShareMessage(31, {
      mode: "fortune",
      fortuneCtx: { title: "ONE MORE", target: 30, beatTarget: true, remaining: 0 },
    });
    assert.match(win, /FORTUNE COOKIE assigned ONE MORE/);
    assert.match(win, /Target 30 cleared/);

    const miss = pickShareMessage(27, {
      mode: "fortune",
      fortuneCtx: { title: "MATCH YOUR BEST", target: 30, beatTarget: false, remaining: 3 },
    });
    assert.match(miss, /MATCH YOUR BEST/);
    assert.match(miss, /survived by 3/);
  }, "fortune-outcomes");
});

test("Chase shares retain their mode theme while appending weighted and PR context", async () => {
  await withFirstTemplate(({ pickChaseShareMessage }) => {
    const message = pickChaseShareMessage(50, {
      finalLead: 4,
      passed: ["weekly"],
      finalStage: "weekly",
      rival: "Danger D",
    }, {
      weightedCtx: { weightLbs: 20, rawCount: 40 },
      prCtx: { title: "Summer PR", oldBest: 45, newCount: 50 },
    });
    assert.match(message, /CHASE COMPLETE: 50 pushups.*Danger D.*4 ahead on weekly/);
    assert.match(message, /\+20 lbs/);
    assert.match(message, /Summer PR: 45 → 50/);
  }, "chase-modifiers");
});

test("Grip modifiers append a themed bonus line, Standard grip stays silent", async () => {
  await withFirstTemplate(({ pickShareMessage }) => {
    const wide = pickShareMessage(20, { mode: "classic", modifierCtx: { id: "wide" } });
    assert.match(wide, /↔️/);
    assert.match(wide, /chest/i);

    const decline = pickShareMessage(20, { mode: "classic", modifierCtx: { id: "decline" } });
    assert.match(decline, /↘️/);
    assert.match(decline, /feet|gravity/i);

    const standard = pickShareMessage(20, { mode: "classic", modifierCtx: { id: "standard" } });
    assert.doesNotMatch(standard, /↔️|🤏|💎|🔀|🏹|↗️|↘️/);

    const none = pickShareMessage(20, { mode: "classic" });
    assert.doesNotMatch(none, /↔️|🤏|💎|🔀|🏹|↗️|↘️/);
  }, "modifier-bonus");
});

test("Horse reminder messages call out the pending player by name and target", async () => {
  await withFirstTemplate(({ pickHorseReminderMessage }) => {
    const message = pickHorseReminderMessage({ name: "Mia", targetLabel: "32+" });
    assert.match(message, /Mia/);
    assert.match(message, /32\+/);
  }, "horse-reminder");
});

test("Horse reminder messages avoid repeating the same template twice in a row", async () => {
  await withFirstTemplate(({ pickHorseReminderMessage }) => {
    const ctx = { name: "Dev", targetLabel: "10+" };
    const first = pickHorseReminderMessage(ctx);
    Math.random = () => 0.999999;
    const second = pickHorseReminderMessage(ctx);
    assert.notEqual(first, second);
  }, "horse-reminder-repeat");
});

test("Horse completion messages weave in the winner, rounds, duration, and loser count", async () => {
  await withFirstTemplate(({ pickHorseCompleteMessage }) => {
    const message = pickHorseCompleteMessage({
      winnerText: "Phil",
      winnerIsPlural: false,
      word: "HORSE",
      rounds: 6,
      durationText: "2h 14m",
      loserCount: 2,
      topTotal: 184,
    });
    assert.match(message, /Phil/);
    assert.match(message, /6 rounds/);
  }, "horse-complete");
});

test("Horse completion messages avoid repeating the same template twice in a row", async () => {
  await withFirstTemplate(({ pickHorseCompleteMessage }) => {
    const ctx = { winnerText: "Mia & You", winnerIsPlural: true, word: "HORSE", rounds: 4, durationText: null, loserCount: 1, topTotal: 90 };
    const first = pickHorseCompleteMessage(ctx);
    Math.random = () => 0.999999;
    const second = pickHorseCompleteMessage(ctx);
    assert.notEqual(first, second);
  }, "horse-complete-repeat");
});
