// Share tone fill lines for the share pools defined in app.js (Roadtrip,
// head-to-head, challenge invites, Board). Same rules as
// share-messages-extra.js; see docs/share-tone-plan.md.

export const APP_SHARE_EXTRA_LINES = {
  ROADTRIP_SHARE_GENERIC: {
    u: [
      (ctx) => `${ctx.rankOrdinal} in ${ctx.placeLabel} 🦷 ${ctx.scoreText} reps and I've started marking this ${ctx.turf} like a feral raccoon with a gym membership.`,
    ],
  },
  ROADTRIP_SHARE_LEADING: {
    c: [
      (ctx) => `#1 in ${ctx.placeLabel} 🥇 ${ctx.scoreText} reps. Proud of this one!`,
      (ctx) => `Top spot in ${ctx.placeLabel} with ${ctx.scoreText} reps 🏆`,
      (ctx) => `Leading ${ctx.placeLabel} on Roadtrip 🗺️ ${ctx.scoreText} reps so far.`,
    ],
    u: [
      (ctx) => `I rule ${ctx.placeLabel} now 👑 ${ctx.scoreText} reps. I've started taxing the pigeons.`,
      (ctx) => `#1 in ${ctx.placeLabel}. ${ctx.scoreText} reps. I'm having my face carved into the nearest hill. Pecs first.`,
    ],
  },
  ROADTRIP_SHARE_ABSENT: {
    u: [
      (ctx) => `${ctx.holderName} and ${ctx.runnerUpName} are locked in a blood feud over ${ctx.placeLabel} 🩸 ${ctx.gapText} reps apart. Bring popcorn and a mop.`,
      (ctx) => `${ctx.holderName} rules ${ctx.placeLabel} (${ctx.holderScoreText}) while ${ctx.runnerUpName} sharpens a spoon in the shadows (${ctx.runnerUpScoreText}) 🥄`,
      (ctx) => `${ctx.placeLabel}: ${ctx.holderName} on the throne, ${ctx.runnerUpName} ${ctx.gapText} back and plotting regicide via pushups 👑🗡️`,
      (ctx) => `Two people are fighting to the death over ${ctx.placeLabel} and the rest of the ${ctx.turf} is just eating snacks. ${ctx.holderName} leads by ${ctx.gapText}.`,
      (ctx) => `${ctx.holderName} (${ctx.holderScoreText}) vs ${ctx.runnerUpName} (${ctx.runnerUpScoreText}) for ${ctx.placeLabel}. The loser has to move to a different ${ctx.turf} and change their name.`,
    ],
  },
  ROADTRIP_SHARE_ABSENT_SOLO: {
    c: [
      (ctx) => `${ctx.holderName} leads ${ctx.placeLabel} with ${ctx.holderScoreText} reps 🗺️ Room for more players!`,
      (ctx) => `${ctx.placeLabel} is all ${ctx.holderName} so far: ${ctx.holderScoreText} reps. Want to join?`,
      (ctx) => `${ctx.holderName} has ${ctx.placeLabel} to themselves with ${ctx.holderScoreText} reps 🙌 Come say hi on the board.`,
    ],
    s: [
      (ctx) => `${ctx.holderName} owns ${ctx.placeLabel} with ${ctx.holderScoreText} reps and zero competition. Where's everyone hiding?`,
    ],
    u: [
      (ctx) => `${ctx.holderName} is the sole ruler of ${ctx.placeLabel} 👑 ${ctx.holderScoreText} reps. They've started knighting squirrels.`,
      (ctx) => `${ctx.placeLabel} belongs to ${ctx.holderName} alone. ${ctx.holderScoreText} reps. The ${ctx.turf} has been renamed in their honor, by them, on a napkin.`,
      (ctx) => `Nobody else in ${ctx.placeLabel}. ${ctx.holderName} (${ctx.holderScoreText} reps) is just doing pushups at an empty ${ctx.turf} like a haunted lighthouse keeper.`,
      (ctx) => `${ctx.holderName} has conquered ${ctx.placeLabel} unopposed 🏰 ${ctx.holderScoreText} reps. The local wildlife has pledged allegiance.`,
      (ctx) => `${ctx.placeLabel} is a one-person empire. ${ctx.holderName}, ${ctx.holderScoreText} reps, is now legally the ${ctx.ruler}, the mascot, and the weather.`,
    ],
  },
  COMPARE_SHARE_LEADING: {
    c: [
      (ctx) => `${ctx.leader} vs ${ctx.trailer} in ${ctx.activityWord}: ${ctx.leaderWins}-${ctx.trailerWins} 📊 Fun rivalry!`,
      (ctx) => `Head-to-head check: ${ctx.leader} leads ${ctx.trailer} ${ctx.leaderWins} to ${ctx.trailerWins} 💪`,
      (ctx) => `${ctx.leader} ${ctx.leaderWins}, ${ctx.trailer} ${ctx.trailerWins} in ${ctx.activityWord} categories. Good race so far 🙌`,
      (ctx) => `Friendly rivalry update: ${ctx.leader} up ${ctx.leaderWins}-${ctx.trailerWins} on ${ctx.trailer} 🏁`,
    ],
    s: [
      (ctx) => `${ctx.leader} ${ctx.leaderWins}, ${ctx.trailer} ${ctx.trailerWins}. ${ctx.trailer}, maybe try doing a pushup sometime 😏`,
    ],
    u: [
      (ctx) => `${ctx.leader} leads ${ctx.trailer} ${ctx.leaderWins}-${ctx.trailerWins} 💀 ${ctx.trailer}'s ancestors felt that.`,
      (ctx) => `${ctx.leader} ${ctx.leaderWins}, ${ctx.trailer} ${ctx.trailerWins}. ${ctx.trailer} has been sentenced to life as a doormat.`,
      (ctx) => `${ctx.leaderWins}-${ctx.trailerWins}. ${ctx.leader} has absorbed ${ctx.trailer}'s strength like a weird gym vampire 🧛`,
      (ctx) => `${ctx.leader} over ${ctx.trailer}, ${ctx.leaderWins}-${ctx.trailerWins}. ${ctx.trailer}'s pecs have been reported missing.`,
    ],
  },
  COMPARE_SHARE_TIED: {
    c: [
      (ctx) => `${ctx.leader} and ${ctx.trailer} are tied at ${ctx.leaderWins} each 🤝 Close race!`,
      (ctx) => `Dead even: ${ctx.leader} vs ${ctx.trailer}, ${ctx.leaderWins}-${ctx.leaderWins} ⚖️`,
      (ctx) => `${ctx.leader} and ${ctx.trailer}, perfectly matched at ${ctx.leaderWins} categories each 💪`,
    ],
    s: [
      (ctx) => `${ctx.leader} and ${ctx.trailer} tied ${ctx.leaderWins}-${ctx.leaderWins}. One of you is about to get humbled.`,
      (ctx) => `Tied at ${ctx.leaderWins}. ${ctx.leader}, ${ctx.trailer}: somebody stop being soft and break it.`,
      (ctx) => `${ctx.leader} vs ${ctx.trailer}, ${ctx.leaderWins} apiece. Neither of you can pull away. Embarrassing for both.`,
      (ctx) => `Dead even at ${ctx.leaderWins}. ${ctx.leader} and ${ctx.trailer} are equally mediocre. Prove me wrong.`,
      (ctx) => `${ctx.leaderWins}-${ctx.leaderWins}. Whoever blinks first is doing pushups in the group chat forever.`,
    ],
    u: [
      (ctx) => `${ctx.leader} and ${ctx.trailer} are tied ${ctx.leaderWins}-${ctx.leaderWins}. They're the same person now. Science can't separate them.`,
      (ctx) => `Tied at ${ctx.leaderWins}. ${ctx.leader} and ${ctx.trailer} must now fight on a rope bridge over a volcano.`,
      (ctx) => `${ctx.leader} vs ${ctx.trailer}, ${ctx.leaderWins} each. The universe is holding its breath and also its bladder.`,
      (ctx) => `Perfect tie at ${ctx.leaderWins}. ${ctx.leader} and ${ctx.trailer} are locked in a cosmic stalemate. The floor is taking bets.`,
    ],
  },
  CHALLENGE_INVITE_MESSAGES: {
    s: [
      (ctx) => `${ctx.titleWithEmoji} is live 🎯 ${ctx.goalAmountText} by ${ctx.deadlineText}. Join or admit you're scared.`,
      (ctx) => `Boys, ${ctx.titleWithEmoji}: ${ctx.goalAmountText} by ${ctx.deadlineText}${ctx.hasLeader ? `. ${ctx.leaderName}'s ahead and getting cocky` : ""}. Stop hiding.`,
    ],
    u: [
      (ctx) => `${ctx.titleWithEmoji} has opened its gates 🚪 ${ctx.goalAmountText} by ${ctx.deadlineText}. Bring snacks, a will, and your best pecs.`,
      (ctx) => `A prophecy foretold ${ctx.titleWithEmoji}. ${ctx.goalAmountText} by ${ctx.deadlineText}${ctx.hasLeader ? `. ${ctx.leaderName} has already been chosen by the floor` : ""}. Fulfill your destiny.`,
      (ctx) => `${ctx.titleWithEmoji} is live and hungry 🍖 ${ctx.goalAmountText} by ${ctx.deadlineText}. Feed it reps or it feeds on you.`,
    ],
  },
  SHARE_MESSAGES_MY_BONANZA: {
    s: [
      (ctx) => `${ctx.dayText} ${ctx.activityWord} today, ${ctx.weekText} this week. Post your numbers. Oh wait 😏`,
      (ctx) => `${ctx.weekText} this week, ${ctx.dayText} today. Somebody in this group is slacking and it isn't me.`,
      (ctx) => `Today ${ctx.dayText}, week ${ctx.weekText}. Your move, couch potatoes.`,
    ],
  },
  SHARE_MESSAGES_BOYS_GENERIC: {
    s: [
      (ctx) => `${ctx.rankOrdinal} place ${ctx.periodLabel} with ${ctx.scoreText} ${ctx.activityWord}. Everyone above me, start sweating.`,
      (ctx) => `${ctx.scoreText} ${ctx.activityWord}, ${ctx.rankOrdinal} ${ctx.periodLabel}. Coming for your spot, boys.`,
      (ctx) => `Sitting ${ctx.rankOrdinal} of ${ctx.participants}. Not for long. Enjoy it while it lasts up there 😏`,
    ],
  },
  SHARE_MESSAGES_BOYS_NO_RANK: {
    s: [
      (ctx) => `${ctx.scoreText} ${ctx.activityWord} ${ctx.periodLabel}. Not ranked yet. Don't get comfortable, boys.`,
      (ctx) => `${ctx.scoreText} ${ctx.periodLabel}. Off the board for now. You've been warned.`,
      (ctx) => `${ctx.scoreText} ${ctx.activityWord} ${ctx.periodLabel}. Unranked and unbothered. Coming for all of you.`,
      (ctx) => `${ctx.scoreText} ${ctx.periodLabel}. The leaderboard doesn't know my name yet. It will. Loudly.`,
    ],
    u: [
      (ctx) => `${ctx.scoreText} ${ctx.activityWord} ${ctx.periodLabel}. Lurking below the leaderboard like a swamp creature with a protein shake.`,
      (ctx) => `${ctx.scoreText} ${ctx.periodLabel}. Unranked. I am the cryptid of this leaderboard. Blurry photos only.`,
      (ctx) => `${ctx.scoreText} ${ctx.activityWord} ${ctx.periodLabel}. I'm not on the board, I'm UNDER it, gnawing at the legs.`,
      (ctx) => `${ctx.scoreText} ${ctx.periodLabel}. Unranked and feral. The leaderboard has started locking its doors at night.`,
      (ctx) => `${ctx.scoreText} ${ctx.activityWord} ${ctx.periodLabel}. Building strength in the sewers like a ninja turtle with something to prove.`,
    ],
  },
};
