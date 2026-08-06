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
    ];

    for (const [mode, count, ctx, expected] of cases) {
      assert.match(pickShareMessage(count, ctx), expected, mode);
    }
  }, "all-mode-themes");
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
