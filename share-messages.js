// Workout-completion share copy and mode-priority selection.
// Loaded only when Share is tapped so startup does not parse the large message library.

function pickFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const SHARE_MESSAGES = [
  (n) => `${n} pushups! 💪 Come beat my pump 🔥`,
  (n) => `Just banged out ${n} pushups 😤 Who's next?`,
  (n) => `${n} reps in the bank 🏦 Leaderboard's calling your name 🏆`,
  (n) => `${n} pushups down 📉 Beat that, if you can 😏`,
  (n) => `${n} reps deep 💦 Your move, boys 👀`,
  (n) => `${n} pushups logged ✅ The bonanza continues 🚀`,
  (n) => `${n} down. Who's got next? 👀`,
  (n) => `${n} reps closer to full send 🚀 Tag, you're it.`,
  (n) => `Just put up ${n} 😤 Show me something.`,
  (n) => `${n} pushups. That's the tax, boys 💸 Pay up.`,
  (n) => `${n} in the books 📚 Curriculum's tough, huh?`,
  (n) => `${n} pushups, zero excuses 🙅 What's yours?`,
  (n) => `${n} reps. The bar's set 📏 Go clear it.`,
  (n) => `${n} down, arms still attached 💪 Barely.`,
  (n) => `${n} pushups fresh off the floor 🔥 Your turn.`,
  (n) => `${n} reps banked, ego inflated 😏 As usual.`,
  (n) => `${n} pushups. Somebody had to do it 🤷`,
  (n) => `${n} down like it's nothing 😤 (it was something)`,
  (n) => `${n} reps, no spotter needed 💪 Unlike some of you.`,
  (n) => `${n} pushups today. Bonanza never blinks 👁️`,
];

const SHARE_MESSAGES_ZEN = [
  (n) => `${n} mindful pushups. Big chest, quiet mind. 🧘💪`,
  (n) => `${n} reps in silence. The gains still heard me. 🪷`,
  (n) => `Found my center. It was ${n} pushups deep. 🧘`,
  (n) => `${n} calm reps deposited in the gains account. 🍃💪`,
  (n) => `Breathed in peace, pushed out ${n} reps. 🪷`,
  (n) => `${n} pushups. No noise, just steady work. 🧘‍♂️`,
  (n) => `Inner peace secured. Outer pecs pending. ${n} reps. 🍃`,
  (n) => `${n} reps with the ego on airplane mode. 🪷💪`,
  (n) => `Quiet session, loud progress: ${n} pushups. 🧘`,
  (n) => `${n} pushups closer to enlightenment—and a respectable pump. 🪷`,
  (n) => `The floor and I reached an understanding: ${n} reps. 🍃`,
  (n) => `${n} controlled reps. Strong body, unbothered spirit. 🧘💪`,
  (n) => `Today’s mantra: breathe, push, repeat. ${n} times. 🪷`,
  (n) => `${n} reps, zero drama, excellent vibes. 🍃💪`,
  (n) => `A peaceful ${n} pushups. Your move, whenever the spirit calls. 🧘`,
  (n) => `${n} quiet reps. May your form be clean and your shoulders forgiving. 🪷`,
  (n) => `Moved with intention. Also moved ${n} pushups. 🍃`,
  (n) => `${n} reps completed in pursuit of balance and bigger sleeves. 🧘💪`,
  (n) => `Serenity now. Soreness later. ${n} pushups. 🪷`,
  (n) => `${n} pushups without disturbing the peace. Mostly. 🍃`,
  (n) => `The mind was still. The chest was working. ${n} reps. 🧘`,
  (n) => `${n} reps offered respectfully to the gains. 🪷💪`,
  (n) => `Calm breath, steady form, ${n} pushups in the books. 🍃`,
  (n) => `${n} reps. Competing only with yesterday, respectfully. 🧘`,
  (n) => `Zen achieved. Pump acquired. ${n} pushups. 🪷💪`,
  (n) => `Raw-dogging ${n} pushups—no counter, no hype, just vibes. 🧘`,
  (n) => `${n} pushups with no emotional support counter. Character building. 🍃💪`,
  (n) => `No music. No yelling. Just me, the floor, and ${n} questionable decisions. 🪷`,
  (n) => `${n} reps completed on do-not-disturb mode. The pecs still got the memo. 🧘💪`,
  (n) => `Raw reps, peaceful thoughts, mildly cooked arms. ${n} total. 🍃`,
  (n) => `${n} pushups counted by a camera that respectfully kept its mouth shut. 🪷`,
  (n) => `Meditated directly into ${n} pushups. Side effects may include sleeves getting tighter. 🧘`,
  (n) => `${n} silent reps. My inner monologue was unfortunately still available. 🍃💪`,
];

const SHARE_MESSAGES_CLASSIC_UNHINGED = [
  (n) => `CLASSIC MODE: ${n} pushups, no gimmicks, no witnesses, one deeply suspicious pump. The floor is pressing charges.`,
  (n) => `${n} classic pushups. Just a grown man repeatedly lowering himself toward a phone like it owes him money. Normal shit.`,
  (n) => `Kept it classic: ${n} reps and a medically irresponsible amount of confidence. Somebody alert the sleeves.`,
  (n) => `${n} pushups in the original flavor. No cards, no dice, just raw-dogging gravity until it called the cops.`,
  (n) => `Classic session complete: ${n} reps. My chest has declared independence and my arms are seeking asylum.`,
  (n) => `${n} old-school pushups. The camera counted them, the floor survived them, and the boys are now legally required to respond.`,
  (n) => `Put ${n} classic reps on the board and immediately became unbearable. Your move, cowards.`,
  (n) => `${n} reps with no special rules because apparently ordinary suffering wasn't deranged enough.`,
];

const SHARE_MESSAGES_COUNTDOWN_WIN = [
  (n, c) => `COUNTDOWN MURDERED: target ${c.target}, finished at ${n}. Beat the bastard by ${c.margin} and left the old record in a shallow grave.`,
  (n, c) => `Needed ${c.target}. Did ${n}. The countdown hit zero, kept going, and became a crime documentary. +${c.margin} over the target.`,
  (n, c) => `Target: ${c.target}. Actual damage: ${n}. Previous me has been fired for underperformance by ${c.margin} reps.`,
  (n, c) => `I watched the countdown die at ${c.target}, then did ${c.margin} more reps over the body. ${n} total.`,
  (n, c) => `${n} reps. Record target ${c.target} has been beaten, bagged, and removed from the premises.`,
];

const SHARE_MESSAGES_COUNTDOWN_MISS = [
  (n, c) => `Countdown report: ${n} reps, ${c.remaining} short of ${c.target}. The record escaped, but I know where the bastard lives.`,
  (n, c) => `Target ${c.target} survived today's ${n}-rep assassination attempt with ${c.remaining} HP. Temporary problem.`,
  (n, c) => `Did ${n}. Needed ${c.target}. Missed by ${c.remaining} and have begun an extremely normal revenge spreadsheet.`,
  (n, c) => `${c.remaining} reps short of killing the ${c.target} target. The countdown may leave town, but it cannot hide.`,
  (n, c) => `The record won this round: ${n}/${c.target}. Enjoy the borrowed time, asshole.`,
];

const SHARE_MESSAGES_CARDS_UNHINGED = [
  (n, c) => `CARDS MODE: cleared ${c.cardsText}, paid ${n} pushups, and flipped the dealer through a drywall partition. 🃏`,
  (n, c) => `${c.cardsText} came off the deck and ${n} reps came out of my shoulders. The casino is now an active crime scene.`,
  (n, c) => `The deck demanded ${n} pushups across ${c.cardsText}. I paid in full and repossessed the damn table.`,
  (n, c) => `Cleared ${c.cardsText} for ${n} reps. Every card was a tiny rectangular warrant for my arrest.`,
  (n, c) => `${n} pushups, ${c.cardsText}, zero adult supervision. The dealer has entered witness protection.`,
  (n, c) => `I drew ${c.cardsText} and answered with ${n} pushups because therapy had a waitlist. 🃏`,
];

const SHARE_MESSAGES_CARDS_EMPTY = [
  (n) => `Cards mode ended before one card cleared: ${n} pushups spent fighting the first tiny cardboard dictator. The deck is smug as hell.`,
  (n) => `${n} reps into Cards mode and card one still refused to die. This feud is now generational.`,
];

const SHARE_MESSAGES_POKER_EMPTY = [
  (n) => `Poker mode: ${n} pushups and not even one full hand. The flop never came, but my arms still folded.`,
  (n) => `${n} reps into a poker hand that died unfinished. The dealer called it; my shoulders called an ambulance.`,
];

const SHARE_MESSAGES_DICE_UNHINGED = [
  (n, c) => `DICE MODE: cleared ${c.rollsText}, paid ${n} reps, and threatened two plastic cubes in front of God and everybody. 🎲`,
  (n, c) => `${c.rollsText} sentenced me to ${n} pushups. The dice have no remorse and I have no functioning triceps.`,
  (n, c) => `Rolled ${c.rollsText}, did ${n} reps, and turned probability into a hostile workplace.`,
  (n, c) => `${n} pushups because two cubes kept making demands. This is how cults start. 🎲`,
  (n, c) => `The dice wrote ${c.rollsText} worth of checks. My shoulders cashed all ${n} reps and burned down the bank.`,
];

const SHARE_MESSAGES_DICE_EMPTY = [
  (n) => `Dice mode ended with ${n} pushups and zero rolls cleared. Two cubes just ruined my afternoon without finishing the paperwork.`,
  (n) => `${n} reps against the opening roll. The dice won and are being complete assholes about it.`,
];

const SHARE_MESSAGES_SHARPSHOOTER_UNHINGED = [
  (n, c) => `SHARPSHOOTER MODE: destroyed ${c.targetsText}, stacked ${n} pushups, and turned the bullseye into an active crime scene. 🏹`,
  (n, c) => `${c.targetsText} eliminated with ${n} reps. The target board has retained counsel and changed its emergency contact.`,
  (n, c) => `Bullseye body count: ${c.targets}. Pushup body count: ${n}. The range officer quietly deleted the security footage.`,
  (n, c) => `${n} pushups, ${c.targetsText}, longest shot ${c.longestShot}. The arrows were metaphorical; the violence was administrative.`,
  (n, c) => `I put ${c.targetsText} through the drywall with ${n} pushups. Accuracy is up. Adult supervision is down.`,
  (n, c) => `Sharpshooter report: ${n} reps and ${c.targetsText} formally removed from the premises. Next of kin notified.`,
  (n, c) => `Dead center ${c.targets} time${c.targets === 1 ? "" : "s"}. ${n} pushups later, the bullseye is a protected witness.`,
  (n, c) => `${c.targetsText} entered the range. ${n} reps left the range. Nobody is answering questions without a lawyer.`,
];

const SHARE_MESSAGES_SHARPSHOOTER_EMPTY = [
  (n, c) => `Sharpshooter mode ended with ${n} pushups and no target destroyed. The bullseye survived with ${c.remaining} reps left and has become insufferable.`,
  (n, c) => `${n} reps into the opening target and zero confirmed kills. The target board is already writing a memoir.`,
  (n, c) => `No bullseye today: ${n} pushups, ${c.remaining} left. The target escaped and I have begun an extremely normal manhunt.`,
];

const SHARE_MESSAGES_LADDER_EMPTY = [
  (n) => `Ladder mode: ${n} pushups, rung zero, and a spectacular collapse in the lobby. The summit sent flowers.`,
  (n) => `${n} reps before the first rung cleared. The ladder laughed; I have memorized its address.`,
];

const SHARE_MESSAGES_FORTUNE = [
  (n, c) => `FORTUNE COOKIE assigned ${c.title}. I answered with ${n} pushups and ate the prophecy before it could testify. 🥠`,
  (n, c) => `Cracked a cookie, received ${c.title}, committed ${n} reps. The fortune now reads: "what the hell was that?"`,
  (n, c) => `${c.title} came out of the cookie. ${n} pushups came out of me. Neither party had legal representation.`,
  (n, c) => `Today's cursed fortune: ${c.title}. Final body count: ${n} reps and one spiritually compromised cookie.`,
  (n, c) => `A tiny paper slip told me to do ${c.title}, so naturally I gave it ${n} pushups and catastrophic obedience.`,
  (n, c) => `Fortune mode delivered ${c.title}. I delivered ${n} reps and a formal threat to the snack industry. 🥠`,
];

const SHARE_MESSAGES_ZEN_UNHINGED = [
  (n) => `ZEN MODE: ${n} silent pushups while my soul floated above my body and asked what the hell I was doing. 🪷`,
  (n) => `${n} mindful reps. Inner peace achieved; outer shoulders absolutely fucked. Namaste.`,
  (n) => `Breathed in serenity, exhaled ${n} pushups, and became a calm little threat to everyone on the leaderboard.`,
  (n) => `${n} reps with no counter, no yelling, and no evidence except the haunted look in my pecs.`,
  (n) => `Meditated until ${n} pushups happened. The mind is empty. The chest is full. The arms are decorative.`,
  (n) => `Completed ${n} silent reps and reached enlightenment three exits past common sense. 🧘`,
];

const SHARE_MESSAGES_PLANK = [
  (t) => `Held a ${t} plank! 🪵 Beat that 💪`,
  (t) => `${t} plank in the books 🧱 Your move, boys 👀`,
  (t) => `Just planked for ${t} 😤 Who's next?`,
  (t) => `${t} of pure core chaos 🔥 Come get some`,
  (t) => `${t} plank logged ✅ The bonanza continues 🚀`,
  (t) => `${t} on the clock, core screaming 😤 Worth it.`,
  (t) => `${t} plank. Floor's still warm 🔥 Your turn.`,
  (t) => `${t} held, zero regrets 💪 (some regrets)`,
  (t) => `${t} plank tax paid 💸 What's your rate?`,
  (t) => `${t} of stillness, tons of shaking 🫨 Beat it.`,
  (t) => `${t} plank. Somebody had to suffer 🤷`,
  (t) => `${t} down on the timer ⏱️ Bonanza never blinks 👁️`,
];

const SHARE_MESSAGES_PLANK_UNHINGED = [
  (t) => `${t} pretending to be a coffee table while my organs negotiated surrender.`,
  (t) => `Held ${t}. The floor and I are now legally considered coworkers.`,
  (t) => `${t} of weaponized stillness. Seismologists have questions.`,
  (t) => `Planked for ${t}. My core left the group chat but the record stands.`,
  (t) => `${t} horizontal and furious. Furniture everywhere is feeling threatened.`,
  (t) => `I gave the floor ${t} of intense eye contact. It blinked first.`,
  (t) => `${t} plank complete. My elbows have retained counsel.`,
  (t) => `Stayed rigid for ${t} like a haunted two-by-four with something to prove.`,
  (t) => `${t} of shaking so fast I briefly achieved molecular invisibility.`,
  (t) => `Plank report: ${t}, one puddle of dignity, no structural survivors.`,
  (t) => `${t} on my forearms. OSHA has closed the living room pending investigation.`,
  (t) => `Held ${t}. Local tectonic plates have requested that I calm down.`,
  (t) => `${t} plank. I am no longer a person; I am load-bearing infrastructure.`,
  (t) => `My body said collapse. The stopwatch said ${t}. The stopwatch won.`,
  (t) => `${t} of premium-grade suffering, harvested fresh from the floor.`,
  (t) => `Planked ${t} and saw through time. Tomorrow's abs send their regards.`,
  (t) => `${t}. The core is cooked, plated, and being sent back to the kitchen.`,
  (t) => `Held ${t} with the grace of a shopping cart falling down stairs.`,
  (t) => `${t} plank. Somewhere a bridge inspector just felt a disturbance.`,
  (t) => `I became a shelf for ${t}. Nothing was stored except rage.`,
  (t) => `${t} of refusing gravity's perfectly reasonable offer.`,
  (t) => `Forearms down, sanity off: ${t}. Please update the family records.`,
  (t) => `${t} plank complete. The carpet knows too much now.`,
  (t) => `Held ${t} while every cell in my body drafted a resignation email.`,
];

const SHARE_MESSAGES_SQUAT = [
  (n) => `${n} squats! 🦵 A recliner somewhere just filed for unemployment.`,
  (n) => `Did ${n} squats. My chair has been formally replaced.`,
  (n) => `${n} reps of thigh chaos, no witnesses, several offended elevators.`,
  (n) => `Squatted ${n} times. Gravity sends its regards and a lawyer.`,
  (n) => `${n} squats deep. The floor has seen entirely too much of me today.`,
  (n) => `Camera counted ${n} squats and did not editorialize. Impressive restraint.`,
  (n) => `${n} squats logged. Quads the size of Sunday dinner, ego to match.`,
  (n) => `Put up ${n} squats and made every chair in the house nervous.`,
];

const SHARE_MESSAGES_STREAK = [
  (n, ctx) => `${n} pushups and a ${ctx.streak}-day streak going 🔥 Who's catching up?`,
  (n, ctx) => `${ctx.streak} days straight, ${n} pushups today 😤 Consistency is the cheat code.`,
  (n, ctx) => `Day ${ctx.streak} of the streak. ${n} pushups banked 💪`,
  (n, ctx) => `${ctx.streak} days deep, no cracks yet 🧱 ${n} more today.`,
  (n, ctx) => `Streak's at ${ctx.streak} 🔥 ${n} pushups keeping it alive.`,
  (n, ctx) => `${ctx.streak}-day streak, ${n} reps today. Who's actually showing up? 👀`,
  (n, ctx) => `Day ${ctx.streak}. Still here, still pushing 😤 ${n} today.`,
  (n, ctx) => `${n} pushups, ${ctx.streak} days running 🏃 Catch me if you can.`,
];

const SHARE_MESSAGES_PLANK_STREAK = [
  (t, ctx) => `${t} plank and a ${ctx.streak}-day streak going 🔥 Who's catching up?`,
  (t, ctx) => `Day ${ctx.streak} of the streak, held ${t} today 💪`,
  (t, ctx) => `${ctx.streak} days straight, ${t} plank today 😤 Cheat code: consistency.`,
  (t, ctx) => `Streak's at ${ctx.streak} 🔥 ${t} plank keeping it alive.`,
  (t, ctx) => `Day ${ctx.streak}. Still here, core still shaking 😤 ${t} today.`,
  (t, ctx) => `${t} plank, ${ctx.streak} days running 🏃 Catch me if you can.`,
];

const SHARE_MESSAGES_WEEK = [
  (n, ctx) => `${n} pushups today, ${ctx.weekTotalDisplay} this week 📈 The bonanza never sleeps.`,
  (n, ctx) => `${ctx.weekTotalDisplay} pushups this week and counting 🚀 Today's ${n} of them.`,
  (n, ctx) => `Week total: ${ctx.weekTotalDisplay} 📊 ${n} of those just now.`,
  (n, ctx) => `${ctx.weekTotalDisplay} pushups this week 💪 Somebody's carrying the leaderboard.`,
  (n, ctx) => `${n} today brings the week to ${ctx.weekTotalDisplay} 📈 Keep up.`,
  (n, ctx) => `Weekly tally: ${ctx.weekTotalDisplay} 🏦 ${n} of it fresh.`,
];

const SHARE_MESSAGES_PLANK_WEEK = [
  (t, ctx) => `${t} today, ${ctx.weekTotalDisplay} of plank time this week 📈 The bonanza never sleeps.`,
  (t, ctx) => `Week total: ${ctx.weekTotalDisplay} of planking 📊 ${t} of that just now.`,
  (t, ctx) => `${ctx.weekTotalDisplay} of plank this week 🧱 Somebody's carrying the leaderboard.`,
  (t, ctx) => `${t} today brings the week to ${ctx.weekTotalDisplay} 📈 Keep up.`,
  (t, ctx) => `Weekly plank tally: ${ctx.weekTotalDisplay} ⏱️ ${t} of it fresh.`,
];

const BREAD_EMOJI = ["🍞", "🥖", "🥯", "🫓", "🥨"];
const SHARE_MESSAGES_BREAD = [
  (n) => `${n} pushups. Time to get the bread ${pickFrom(BREAD_EMOJI)}`,
  (n) => `Getting that bread ${pickFrom(BREAD_EMOJI)} — ${n} pushups deep.`,
  (n) => `${n} reps, ${pickFrom(BREAD_EMOJI)} secured. Who's hungry?`,
  (n) => `${n} pushups earned the ${pickFrom(BREAD_EMOJI)} today. Come get some.`,
  (n) => `Bread's baked ${pickFrom(BREAD_EMOJI)} — ${n} pushups did it.`,
  (n) => `${n} reps deep, ${pickFrom(BREAD_EMOJI)} in hand. Your loaf's still in the oven.`,
  (n) => `${n} pushups later, ${pickFrom(BREAD_EMOJI)} unlocked. Get to work.`,
  (n) => `Earned my ${pickFrom(BREAD_EMOJI)} — ${n} pushups on the receipt.`,
];

const SHARE_MESSAGES_PLANK_BREAD = [
  (t) => `${t} plank. Time to get the bread ${pickFrom(BREAD_EMOJI)}`,
  (t) => `Getting that bread ${pickFrom(BREAD_EMOJI)} — ${t} plank held.`,
  (t) => `${t} plank, ${pickFrom(BREAD_EMOJI)} secured. Who's hungry?`,
  (t) => `${t} held, ${pickFrom(BREAD_EMOJI)} earned. Come get some.`,
  (t) => `Bread's baked ${pickFrom(BREAD_EMOJI)} — ${t} plank did it.`,
  (t) => `${t} plank later, ${pickFrom(BREAD_EMOJI)} unlocked. Get to work.`,
];

const SHARE_MESSAGES_CARDS = [
  (n, c) => `${c.cardsText} cleared, ${n} pushups 🃏 The deck lost.`,
  (n, c) => `Ran ${c.cardsText} off the deck for ${n} reps 🎴 House always loses.`,
  (n, c) => `${n} pushups across ${c.cardsText} 🃏 Dealer's ruined.`,
  (n, c) => `Played ${c.cardsText}, paid ${n} reps 💀 Worth it.`,
  (n, c) => `${c.cardsText} down, ${n} pushups deep 🎴 Shuffle 'em again.`,
  (n, c) => `The deck dealt ${c.cardsText}. I paid every one. ${n} reps 😤`,
  (n, c) => `${n} reps, ${c.cardsText} — I don't gamble, I just do pushups 🃏`,
];

const SHARE_MESSAGES_POKER = [
  (n, c) => `${n} pushups across ${c.handsText}. Best hand: ${c.bestHand}. The deck has retained counsel. ♠️`,
  (n, c) => `Cleared ${c.handsText} and ${n} reps. Pulled ${c.bestHand}. I am no longer welcome near felt surfaces. 🃏`,
  (n, c) => `${c.bestHand}, ${c.handsText}, ${n} pushups. My shoulders have been taken into protective custody.`,
  (n, c) => `Dealt five at a time, paid every card in pushups. ${n} reps. ${c.handsText}. Best: ${c.bestHand}. Absolutely feral behavior.`,
  (n, c) => `The cards said ${c.bestHand}. My arms said call a priest. ${n} pushups over ${c.handsText}.`,
  (n, c) => `${n} reps and ${c.handsText} later, the casino has replaced me with a warning sign. Best hand: ${c.bestHand}.`,
  (n, c) => `Poker Hands incident report: ${c.handsText}, ${n} pushups, one ${c.bestHand}, and no responsible adults present.`,
  (n, c) => `I did ${n} pushups because five tiny rectangles told me to. Best result: ${c.bestHand}. This is how civilizations end.`,
  (n, c) => `${c.handsText} completed. ${n} pushups deposited. ${c.bestHand} achieved through violence against gravity.`,
  (n, c) => `The deck dealt. I crawled. ${n} pushups, ${c.handsText}, best hand ${c.bestHand}. God has left the card room.`,
];

const SHARE_MESSAGES_POKER_RARE = [
  (n, c) => `${c.bestHand.toUpperCase()}. ${n} PUSHUPS. THE DECK IS SCREAMING AND I HAVE EATEN THE DEALER. ${c.handsText}.`,
  (n, c) => `Pulled ${c.bestHand} after ${n} pushups and immediately became legally classified as a table hazard.`,
  (n, c) => `${c.bestHand}. Ring the damn bells. Hide the cards. ${n} reps across ${c.handsText} and the prophecy is complete.`,
  (n, c) => `BREAKING: ${c.bestHand} manifests during pushup ritual. ${n} reps. ${c.handsText}. Authorities advise against eye contact.`,
  (n, c) => `I summoned ${c.bestHand} with ${n} pushups and catastrophic confidence. The deck now answers to me.`,
];

const SHARE_MESSAGES_CARDS_KINGS = [
  (n, c) => `Put ${c.plural(c.kings, "king")} face-down on the floor 👑💀 ${c.cardsText}, ${n} reps.`,
  (n, c) => `${c.plural(c.kings, "king")} dethroned 👑 ${n} pushups across ${c.cardsText}.`,
  (n, c) => `Royalty went DOWN today — ${c.plural(c.kings, "king")} flattened 👑 ${n} reps total.`,
  (n, c) => `Kings are just 13 pushups with a crown on 👑 Took ${c.kings} of them. ${n} reps.`,
];

const SHARE_MESSAGES_CARDS_ACES = [
  (n, c) => `${c.plural(c.aces, "ace")} — the deck's idea of mercy 🎴 ${n} reps over ${c.cardsText}.`,
  (n, c) => `Pulled ${c.plural(c.aces, "ace")} and still finished ${n} reps 🃏 Free real estate.`,
];

const SHARE_MESSAGES_CARDS_FACES = [
  (n, c) => `${c.plural(c.faces, "face card")} in one session 👑 The court got humbled. ${n} reps.`,
  (n, c) => `Deck kept throwing royalty — ${c.plural(c.faces, "face card")} 😤 ${n} pushups, no complaints.`,
];

const SHARE_MESSAGES_CARDS_SUIT = [
  (n, c) => `${c.topSuitEmoji} would not stop coming — ${c.topSuitCount} of them 🎴 ${n} reps, ${c.cardsText}.`,
  (n, c) => `The deck has a ${c.topSuitEmoji} problem. ${c.topSuitCount} this session. ${n} pushups.`,
];

const SHARE_MESSAGES_DICE = [
  (n, c) => `${c.rollsText} rolled, ${n} pushups paid 🎲 The table's on fire and so are my shoulders.`,
  (n, c) => `Rolled ${c.rollsText}, paid every single one in reps 🎲 The house always wins except today.`,
  (n, c) => `${c.rollsText} of chaos, ${n} pushups of consequence 🎲🔥 No refunds.`,
  (n, c) => `Vegas has nothing on this floor. ${c.rollsText}, ${n} reps, zero regrets (lying).`,
  (n, c) => `Every roll was a new sentence and every sentence was pushups. ${c.rollsText}, ${n} reps. 🎲`,
  (n, c) => `${n} pushups later and the dice are STILL hot 🎲🔥 ${c.rollsText} down.`,
  (n, c) => `Craps table energy, cardio consequences 🎲 ${c.rollsText}, ${n} reps.`,
  (n, c) => `I don't gamble with money, I gamble with my shoulders 🎲 ${c.rollsText}, ${n} reps.`,
  (n, c) => `The dice decided my fate ${c.rollsText} 🎲 My fate was pushups. ${n} total.`,
  (n, c) => `Rolled like the dice owed me money 🎲 ${c.rollsText}, ${n} pushups collected.`,
  (n, c) => `Two cubes of chaos, ${c.rollsText}, ${n} reps of pure consequence 🎲😵`,
  (n, c) => `The dice gods demanded tribute. ${c.rollsText} worth. Paid in full: ${n} reps. 🎲`,
];

const SHARE_MESSAGES_DICE_DOUBLES = [
  (n, c) => `${c.plural(c.doubles, "double")} rolled 🎲🎲 The dice matched, my arms didn't get a vote. ${n} reps.`,
  (n, c) => `Rolled doubles ${c.doubles} time${c.doubles === 1 ? "" : "s"} — the universe was just being cruel. ${n} pushups, ${c.rollsText}.`,
  (n, c) => `${c.plural(c.doubles, "double")}. Same number twice, zero mercy once. ${n} reps.`,
];

const SHARE_MESSAGES_DICE_SNAKE_EYES = [
  (n, c) => `Snake eyes ${c.snakeEyes} time${c.snakeEyes === 1 ? "" : "s"} 🐍👀 Lowest possible roll, still had to pay it. ${n} reps.`,
  (n, c) => `Rolled snake eyes and somehow *I'm* the unlucky one, not the dice 🐍 ${n} pushups, ${c.rollsText}.`,
];

const SHARE_MESSAGES_DICE_BOXCARS = [
  (n, c) => `Boxcars ${c.boxcars} time${c.boxcars === 1 ? "" : "s"} 🚂🎲 Two sixes, twelve reps, zero survivors. ${n} total.`,
  (n, c) => `Rolled double sixes and the dice just laughed at me 🎲 ${c.boxcars} boxcar${c.boxcars === 1 ? "" : "s"}, ${n} reps.`,
];

const SHARE_MESSAGES_DICE_SEVENS = [
  (n, c) => `Sevened out ${c.sevens} times 🎰 Lucky number, unlucky shoulders. ${n} reps, ${c.rollsText}.`,
  (n, c) => `The dice kept landing on 7 like it was rigged 🎲 ${c.sevens} times. ${n} pushups.`,
];

const SHARE_MESSAGES_LADDER = [
  (n, c) => `Climbed to rung ${c.maxRung} before gravity called my lawyer. ${n} reps. 🪜⚖️`,
  (n, c) => `Rung ${c.maxRung} and my shoulders filed a missing person report. ${n} pushups. 🪜🚨`,
  (n, c) => `Made it to rung ${c.maxRung} then cashed out like a coward. ${n} reps, zero regrets. 🪜💸`,
  (n, c) => `Rung ${c.maxRung} deep and still breathing (barely). ${n} pushups total. 🪜🫁`,
  (n, c) => `Climbed ${c.maxRung} rungs of pure bad decisions. ${n} reps. 🪜🙃`,
  (n, c) => `The ladder said stop at rung ${c.maxRung}. I said one more. ${n} reps. 🪜😈`,
  (n, c) => `Rung ${c.maxRung}, no rope, no regrets, no cartilage left. ${n} pushups. 🪜💀`,
  (n, c) => `Sent it to rung ${c.maxRung} and cashed out before my arms unionized. ${n} reps. 🪜✊`,
  (n, c) => `Rung ${c.maxRung} — the air up there is thin and so is my patience. ${n} pushups. 🪜🌬️`,
  (n, c) => `Climbed ${c.maxRung} rungs like the floor owed me money. ${n} reps. 🪜💰`,
  (n, c) => `Rung ${c.maxRung} deep, cashed out, walked away like a legend (crawled). ${n} pushups. 🪜🐢`,
  (n, c) => `${c.maxRung} rungs of chaos, ${n} pushups of consequence 🪜🔥 The ladder wins next time.`,
  (n, c) => `Rung ${c.maxRung} — one more step and I'd have needed a priest. ${n} reps. 🪜🙏`,
  (n, c) => `Climbed ${c.maxRung} rungs on a floor that did nothing to deserve this. ${n} pushups. 🪜😤`,
];

const SHARE_MESSAGES_LADDER_NEW_BEST = [
  (n, c) => `NEW PERSONAL BEST — rung ${c.maxRung} 🏆🪜 Previous me could never. ${n} reps.`,
  (n, c) => `Rung ${c.maxRung} — a new record and a new lower-back problem. ${n} pushups. 🏆🪜💀`,
  (n, c) => `Personal best: rung ${c.maxRung}. Personal worst: everything below the neck. ${n} reps. 🏆😵`,
];

const SHARE_MESSAGES_LADDER_HIGH = [
  (n, c) => `Rung ${c.maxRung} — officially higher than my will to live. ${n} reps. 🪜🚀`,
  (n, c) => `Double digits on the ladder (${c.maxRung}) and single digits left in my soul. ${n} pushups. 🪜👻`,
  (n, c) => `Rung ${c.maxRung} — someone call air traffic control. ${n} reps. 🪜✈️`,
];

const SHARE_MESSAGES_LADDER_UNHINGED = [
  (n, c) => `Reached rung ${c.maxRung}. Base camp reports ${n} reps and one climber speaking exclusively in wheezes.`,
  (n, c) => `Rung ${c.maxRung}: where my arms became folklore. ${n} pushups entered the legend.`,
  (n, c) => `I climbed to ${c.maxRung}, looked gravity in the eyes, and immediately cashed out. ${n} reps.`,
  (n, c) => `${c.maxRung} rungs conquered. ${n} pushups. The ladder is now under federal protection.`,
  (n, c) => `Rung ${c.maxRung} achieved through confidence and no adult supervision. ${n} reps.`,
  (n, c) => `Climbed to ${c.maxRung}. Sherpas refused the assignment. ${n} pushups later, I understand why.`,
  (n, c) => `${n} reps carried me to rung ${c.maxRung}. My shoulders are demanding hazard pay.`,
  (n, c) => `Rung ${c.maxRung} has fallen. Ring the bells. Hide the ibuprofen. ${n} reps.`,
  (n, c) => `The ladder escalated. I escalated back. Final incident count: rung ${c.maxRung}, ${n} pushups.`,
  (n, c) => `Made rung ${c.maxRung} and descended via emotional collapse. ${n} reps, technically victorious.`,
  (n, c) => `Rung ${c.maxRung}. ${n} pushups. This expedition was funded entirely by bad judgment.`,
  (n, c) => `Climbed until rung ${c.maxRung} started asking personal questions. ${n} reps and no comment.`,
  (n, c) => `${c.maxRung} rungs, ${n} reps, and one demolished relationship with gravity.`,
  (n, c) => `I came. I saw. I made it weird at rung ${c.maxRung}. ${n} pushups.`,
  (n, c) => `Rung ${c.maxRung} unlocked. Arms downgraded to decorative accessories. ${n} reps.`,
  (n, c) => `Authorities found me at rung ${c.maxRung} surrounded by ${n} pushups. No motive yet.`,
  (n, c) => `The ladder requested ${n} reps. I paid, reached rung ${c.maxRung}, and disputed the charge.`,
  (n, c) => `Rung ${c.maxRung}: population me, briefly. ${n} pushups got me evicted.`,
  (n, c) => `Scaled ${c.maxRung} rungs like a raccoon escaping consequences. ${n} reps.`,
  (n, c) => `${n} pushups to rung ${c.maxRung}. The summit photo is just me lying face-down.`,
];

const SHARE_MESSAGES_PYRAMID_EMPTY = [
  (n) => `Attempted a pyramid. Got buried under the base row instead. ${n} reps, zero apex, several regrets.`,
  (n) => `${n} pushups into the pyramid before the ancient curse (my shoulders) kicked in. Apex remains unreached.`,
];

const SHARE_MESSAGES_PYRAMID_UNHINGED = [
  (n, c) => `Cleared a ${c.pyramidSizeLabel} pyramid, ${c.pyramidDirectionLabel}. ${n} reps. Archaeologists will find my arms in 3000 years and weep.`,
  (n, c) => `${c.pyramidSizeLabel} pyramid: conquered. ${n} pushups. The pharaohs are filing a noise complaint.`,
  (n, c) => `Reached the apex of a ${c.pyramidSizeLabel} pyramid (${c.pyramidDirectionLabel}) and disturbed something ancient. ${n} reps. No regrets, several curses.`,
  (n, c) => `${n} pushups later, the ${c.pyramidSizeLabel} pyramid has been fully looted. My shoulders are the sacrificial offering.`,
  (n, c) => `Built and demolished a ${c.pyramidSizeLabel} pyramid, ${c.pyramidDirectionLabel}, in ${n} reps. UNESCO has revoked my heritage status.`,
  (n, c) => `The apex has been reached. The tomb has been disturbed. ${n} pushups, ${c.pyramidSizeLabel} pyramid, zero survivors (my arms).`,
  (n, c) => `${c.pyramidSizeLabel} pyramid, ${c.pyramidDirectionLabel}: complete. ${n} reps. Somewhere, a mummy just filed a restraining order.`,
  (n, c) => `Summited the ${c.pyramidSizeLabel} pyramid in ${n} reps. Sold my soul to the ${c.pyramidDirectionLabel === "Up & down" ? "climb back down" : "climb"}. Worth it.`,
  (n, c) => `${n} pushups excavated an entire ${c.pyramidSizeLabel} pyramid, ${c.pyramidDirectionLabel}. Indiana Jones would not approve of my form.`,
  (n, c) => `Pyramid scheme complete: ${c.pyramidSizeLabel}, ${c.pyramidDirectionLabel}, ${n} reps. Everyone at the base row got recruited into my suffering.`,
  (n, c) => `Climbed a ${c.pyramidSizeLabel} pyramid ${c.pyramidDirectionLabel === "Up & down" ? "and climbed right back down" : "straight to the apex"}. ${n} reps. My knees have filed for asylum.`,
  (n, c) => `${c.pyramidSizeLabel} pyramid demolished, ${n} reps deep. Ancient Egypt has entered the chat and it is not impressed.`,
];

const SHARE_MESSAGES_CHASE_WIN = [
  (n, c) => `CHASE COMPLETE: ${n} pushups. Passed ${c.rival} and finished ${c.finalLead} ahead on ${c.finalStage}. The leaderboard is now a crime scene.`,
  (n, c) => `${n} pushups and the chase is OVER. ${c.passedText} got passed; ${c.finalStage} belongs to me by ${c.finalLead}. Tell their families I was extremely normal about it.`,
  (n, c) => `HUNT CONCLUDED: ${c.rival} removed from the food chain. ${n} reps, ${c.finalLead}-point lead on ${c.finalStage}.`,
  (n, c) => `I caught the leaders and rearranged the leaderboard furniture. ${n} pushups. Up ${c.finalLead} on ${c.finalStage}.`,
  (n, c) => `${c.passedText}: caught. ${c.finalStage}: conquered. ${n} reps: entered into evidence. Lead: ${c.finalLead}.`,
  (n, c) => `The chase ended at ${n} pushups. I am ${c.finalLead} ahead on ${c.finalStage}, and the former leaders are changing their names.`,
  (n, c) => `Put up ${n}, cleared ${c.passedText}, took ${c.finalStage} by ${c.finalLead}. Nature is healing incorrectly.`,
  (n, c) => `BREAKING: ${n} pushups overtake ${c.passedText}; ${c.finalStage} emperor declares a ${c.finalLead}-point lead.`,
  (n, c) => `Chase complete. ${n} reps. ${c.passedText} passed. ${c.finalLead} ahead on ${c.finalStage}. Do not approach the leaderboard; it is frightened.`,
  (n, c) => `I arrived with ${n} pushups and repossessed ${c.finalStage} from ${c.passedText} by ${c.finalLead}.`,
  (n, c) => `${n} pushups later, ${c.passedText} are behind me and ${c.finalStage} is under new management. Margin: ${c.finalLead}.`,
  (n, c) => `The leaders ran. I did pushups. Terrible tactical choice. ${n} reps, ${c.finalLead} ahead on ${c.finalStage}.`,
  (n, c) => `Mission accomplished with ${n} reps and no emotional restraint. ${c.passedText} passed; ${c.finalStage} lead is ${c.finalLead}.`,
  (n, c) => `Caught the crown doing ${n} pushups. ${c.passedText} can identify it at the station. I lead by ${c.finalLead} on ${c.finalStage}.`,
  (n, c) => `The leaderboard said ${c.passedText}. I said past tense. ${n} pushups, ${c.finalLead} clear on ${c.finalStage}.`,
  (n, c) => `${n} reps completed the hostile takeover. ${c.passedText} are now historical context. ${c.finalLead} ahead on ${c.finalStage}.`,
  (n, c) => `Chase status: everybody caught, dignity missing. ${n} pushups; ${c.finalStage} lead now ${c.finalLead}.`,
  (n, c) => `I caught ${c.passedText} with ${n} pushups and kept running through the caution tape. ${c.finalLead} ahead on ${c.finalStage}.`,
];

const SHARE_MESSAGES_CHASE_PROGRESS = [
  (n, c) => `CHASE UPDATE: ${n} pushups. ${c.remaining} remain to catch ${c.rival} on ${c.currentStage}. I can hear the panic-refreshing.`,
  (n, c) => `${n} reps into the hunt. ${c.conqueredText}${c.remaining} left on ${c.currentStage}. The crown has begun sweating.`,
  (n, c) => `${n} pushups deposited, ${c.remaining} to erase on ${c.currentStage}. ${c.conqueredText}Nobody make sudden leaderboard movements.`,
  (n, c) => `${n} pushups. ${c.conqueredText}Only ${c.remaining} between me and the ${c.currentStage} leader, who should consider witness protection.`,
  (n, c) => `Closed the gap with ${n} reps. ${c.remaining} remain on ${c.currentStage}. I am outside the leaderboard and somebody is home.`,
  (n, c) => `Hunt report: ${n} pushups, ${c.remaining} points left on ${c.currentStage}. ${c.conqueredText}The footsteps are getting louder.`,
  (n, c) => `${c.remaining} to go on ${c.currentStage} after ${n} pushups. ${c.conqueredText}This is no longer cardio; it is a siege.`,
  (n, c) => `Did ${n}. Need ${c.remaining} more on ${c.currentStage}. ${c.conqueredText}The leader is bargaining with mathematics.`,
  (n, c) => `${n} pushups moved the target to ${c.remaining} away on ${c.currentStage}. ${c.conqueredText}I remain extremely calm and not crown-motivated.`,
  (n, c) => `CHASE NOT OVER: ${n} reps, ${c.remaining} left on ${c.currentStage}. ${c.conqueredText}Release the hounds. The hounds are also doing pushups.`,
  (n, c) => `${n} pushups narrowed ${c.currentStage} to ${c.remaining}. ${c.conqueredText}This message counts as a warning.`,
  (n, c) => `${n} reps closer. ${c.remaining} remain on ${c.currentStage}. ${c.conqueredText}Their lead is on borrowed time and terrible terms.`,
  (n, c) => `Leaderboard weather: ${n} pushups with a ${c.remaining}-point chance of imminent chaos on ${c.currentStage}.`,
  (n, c) => `The target survived today's ${n} pushups. Barely. ${c.remaining} remain on ${c.currentStage}. ${c.conqueredText}Tomorrow has been notified.`,
  (n, c) => `${n} pushups complete. ${c.remaining} left on ${c.currentStage}. I am approaching at the speed of poor decisions.`,
  (n, c) => `Gap: ${c.remaining} on ${c.currentStage}. Reps: ${n}. Sanity: none. ${c.conqueredText}`,
  (n, c) => `The chase ate ${n} more pushups and is still hungry. ${c.remaining} remain on ${c.currentStage}. ${c.conqueredText}`,
  (n, c) => `${n} reps, ${c.remaining} to go. ${c.conqueredText}The ${c.currentStage} leader retains temporary custody of the crown.`,
];

const SHARE_MODIFIERS_WEIGHTED = [
  (c) => `Did it wearing +${c.weightLbs} lbs because regular gravity wasn't being enough of an asshole.`,
  (c) => `Raw damage: ${c.rawCount} reps with +${c.weightLbs} lbs strapped on like a terrible financial decision.`,
  (c) => `Added-weight clause: +${c.weightLbs} lbs, ${c.rawCount} actual reps, and absolutely no concern from management.`,
  (c) => `This disaster was weighted: +${c.weightLbs} lbs and ${c.rawCount} raw reps. My spine has requested arbitration.`,
];

const SHARE_MODIFIERS_PR = [
  (c) => `Also detonated ${c.title}: ${c.oldBest} → ${c.newCount}. The old record can eat shit.`,
  (c) => `${c.title} collateral damage: ${c.oldBest} → ${c.newCount}. Previous me has been escorted out.`,
  (c) => `And because restraint is dead: new ${c.title}, ${c.oldBest} → ${c.newCount}.`,
  (c) => `Bonus crime: ${c.title} erased from ${c.oldBest} to ${c.newCount}.`,
];

export function compactVictimNames(names) {
  const unique = [...new Set((names || []).filter(Boolean))];
  if (unique.length <= 1) return unique[0] || "";
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique[0]}, ${unique[1]}, and ${unique.length - 2} other victim${unique.length === 3 ? "" : "s"}`;
}

function decorateShareMessage(message, ctx) {
  const extras = [];
  if (ctx.weightedCtx?.weightLbs > 0) extras.push(pickFrom(SHARE_MODIFIERS_WEIGHTED)(ctx.weightedCtx));
  if (ctx.ladderCtx?.passedRivals?.length) {
    extras.push(`Passed ${compactVictimNames(ctx.ladderCtx.passedRivals)}. Their Ladder PRs are now decorative little participation trophies.`);
  }
  if (ctx.ladderCtx?.isNewBest) {
    extras.push(`New personal best at rung ${ctx.ladderCtx.maxRung}; previous me has been demoted to civilian.`);
  }
  if (ctx.fortuneCtx?.target != null) {
    extras.push(ctx.fortuneCtx.beatTarget
      ? `Target ${ctx.fortuneCtx.target} cleared. The prophecy has been violently fulfilled.`
      : `Target ${ctx.fortuneCtx.target} survived by ${ctx.fortuneCtx.remaining}. That smug little paper bastard gets one night.`);
  }
  if (ctx.prCtx) extras.push(pickFrom(SHARE_MODIFIERS_PR)(ctx.prCtx));
  return [message, ...extras].join(" ");
}

let lastChaseShareTemplate = null;
export function pickChaseShareMessage(count, chase, shareCtx = {}) {
  const pool = chase.finalLead > 0 ? SHARE_MESSAGES_CHASE_WIN : SHARE_MESSAGES_CHASE_PROGRESS;
  const ctx = {
    ...chase,
    rival: chase.rival || "the leader",
    passedText: chase.rival || "the leader",
    conqueredText: "",
  };
  let template;
  let guard = 0;
  do { template = pickFrom(pool); guard++; }
  while (template === lastChaseShareTemplate && pool.length > 1 && guard < 10);
  lastChaseShareTemplate = template;
  return decorateShareMessage(template(count, ctx), shareCtx);
}

const SHARE_MESSAGES_PR_ACHIEVED = [
  (n, c) => `OLD ME: ${c.oldBest}. NEW ME: ${c.newCount}. Old me can eat it. 🔥 New PR in ${c.title}!`,
  (n, c) => `Just broke my own record in ${c.title} — ${c.oldBest} → ${c.newCount} 📈 The old number has been evicted.`,
  (n, c) => `${c.newCount} reps in one set 🏆 Personal best for ${c.title}, previous best (${c.oldBest}) has been served papers.`,
  (n, c) => `New max: ${c.newCount}. Old max: ${c.oldBest}. Math has never been kinder to me. 😤 ${c.title} PR secured.`,
  (n, c) => `${c.title}: PR ACHIEVED 🎉 ${c.oldBest} was cute. ${c.newCount} is the new floor.`,
  (n, c) => `Smashed my own ceiling in ${c.title} — went from ${c.oldBest} to ${c.newCount} in one set. 💥 The ceiling didn't survive.`,
  (n, c) => `Yesterday's best was ${c.oldBest}. Today's is ${c.newCount}. 🚀 ${c.title} has a new champion and it's me.`,
  (n, c) => `${c.newCount} reps, one set, zero mercy 😈 That's ${c.newCount - c.oldBest} more than my old best (${c.oldBest}). ${c.title} PR.`,
  (n, c) => `Filed a restraining order against my old number (${c.oldBest}) 📄 New one's ${c.newCount}. ${c.title} PR unlocked.`,
  (n, c) => `${c.title} update: I no longer recognize the guy who could only do ${c.oldBest}. ${c.newCount} now. 🔥`,
  (n, c) => `Personal record demolished 🧨 ${c.oldBest} → ${c.newCount} in ${c.title}. The rebuild begins tomorrow.`,
  (n, c) => `${c.newCount} in one set. My previous best of ${c.oldBest} just watched it happen from the cheap seats. 🎟️ ${c.title} PR.`,
  (n, c) => `Somewhere, my old best of ${c.oldBest} is filing a complaint. ${c.newCount} now. ${c.title} 🏆 New PR, no notes.`,
];

let lastShareTemplate = null;
export function pickShareMessage(count, ctx) {
  const mode = ctx.isPlank ? "plank" : (ctx.mode || (ctx.isZen ? "zen" : "classic"));
  let pool;
  let modeCtx = ctx;
  if (mode === "countdown") {
    modeCtx = ctx.countdownCtx;
    pool = modeCtx?.beat ? SHARE_MESSAGES_COUNTDOWN_WIN : SHARE_MESSAGES_COUNTDOWN_MISS;
  } else if (mode === "cards") {
    modeCtx = ctx.cardsCtx;
    pool = modeCtx?.cards > 0 ? SHARE_MESSAGES_CARDS_UNHINGED : SHARE_MESSAGES_CARDS_EMPTY;
  } else if (mode === "poker") {
    modeCtx = ctx.pokerCtx;
    pool = modeCtx?.hands > 0
      ? (modeCtx.bestRank >= 3 ? [...SHARE_MESSAGES_POKER, ...SHARE_MESSAGES_POKER_RARE] : SHARE_MESSAGES_POKER)
      : SHARE_MESSAGES_POKER_EMPTY;
  } else if (mode === "dice") {
    modeCtx = ctx.diceCtx;
    pool = modeCtx?.rolls > 0 ? SHARE_MESSAGES_DICE_UNHINGED : SHARE_MESSAGES_DICE_EMPTY;
  } else if (mode === "sharpshooter") {
    modeCtx = ctx.sharpshooterCtx;
    pool = modeCtx?.targets > 0 ? SHARE_MESSAGES_SHARPSHOOTER_UNHINGED : SHARE_MESSAGES_SHARPSHOOTER_EMPTY;
  } else if (mode === "ladder") {
    modeCtx = ctx.ladderCtx;
    pool = modeCtx?.maxRung > 0 ? SHARE_MESSAGES_LADDER_UNHINGED : SHARE_MESSAGES_LADDER_EMPTY;
  } else if (mode === "pyramid") {
    modeCtx = ctx.pyramidCtx;
    pool = modeCtx?.peakReached ? SHARE_MESSAGES_PYRAMID_UNHINGED : SHARE_MESSAGES_PYRAMID_EMPTY;
  } else if (mode === "fortune") {
    modeCtx = ctx.fortuneCtx;
    pool = SHARE_MESSAGES_FORTUNE;
  } else if (mode === "zen") {
    pool = SHARE_MESSAGES_ZEN_UNHINGED;
  } else if (mode === "plank") {
    pool = SHARE_MESSAGES_PLANK_UNHINGED;
  } else if (mode === "squat") {
    pool = SHARE_MESSAGES_SQUAT;
  } else {
    pool = SHARE_MESSAGES_CLASSIC_UNHINGED;
  }
  let template;
  let guard = 0;
  do {
    template = pickFrom(pool);
    guard++;
  } while (template === lastShareTemplate && pool.length > 1 && guard < 10);
  lastShareTemplate = template;
  return decorateShareMessage(template(count, modeCtx || {}), ctx);
}
