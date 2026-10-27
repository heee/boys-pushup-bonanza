// Settings > Changelog — hand-written, newest first. One entry per major
// user-facing feature: a short plain-English line ("Added X", "Reordered Y"),
// not every fix or version bump. Add a new entry at the top when shipping one.

export const CHANGELOG = [
  { date: "2026-10-27", text: "Reached goals now shimmer gold on Home" },
  { date: "2026-10-27", text: "Added Changelog in Settings" },
  { date: "2026-10-27", text: "Reordered Settings options for efficiency, with your profile up top" },
  { date: "2026-10-27", text: "Removed viewing and deleting other users from Settings" },
  { date: "2026-10-27", text: "Added Poker collection: lifetime count of every hand you've hit" },
  { date: "2026-10-27", text: "Session complete actions now sit in one icon row" },
  { date: "2026-10-26", text: "Added Iron Grip kettlebell workout" },
  { date: "2026-10-26", text: "Added demo clips for every Five Alive kettlebell move" },
  { date: "2026-10-26", text: "Fixed shares dropping the message text" },
  { date: "2026-10-25", text: "Poker now deals seven cards and scores your best five" },
  { date: "2026-10-25", text: "Royal Flush is now a bonus hand in Royal Flush Rush" },
  { date: "2026-10-25", text: "Home: pick Type, Mode and Modifier from one selector row" },
  { date: "2026-10-25", text: "Swipe between periods and tabs on Leaderboard, Challenges and Roadtrip" },
  { date: "2026-10-25", text: "Past challenges nobody joined are now hidden" },
  { date: "2026-10-25", text: "Renamed the app to Bonanza with new mode icons" },
  { date: "2026-09-24", text: "Added kettlebell workouts: Five Alive, Throne Room and Core Ten" },
  { date: "2026-09-20", text: "Chain of Pain: correct your rep count during rest" },
  { date: "2026-09-13", text: "Added Royal Flush Rush poker hand challenge" },
  { date: "2026-09-12", text: "Added monthly Boys Bonanza recap" },
  { date: "2026-09-12", text: "Added Tug of War death match" },
  { date: "2026-09-12", text: "Added pace note (too fast/slow) to pushup summaries" },
  { date: "2026-09-12", text: "Leaderboard shows average and best pushups per session" },
  { date: "2026-09-12", text: "Redesigned Ladder mode" },
  { date: "2026-09-08", text: "Added Crunches personal goal" },
  { date: "2026-09-07", text: "Chain of Pain now tracks upright pushups" },
];

export function changelogEntryKey(entry) {
  return `${entry.date}|${entry.text}`;
}

// Entries newer than the last one this device has seen (list is newest
// first). Nothing seen yet means everything is new.
export function unseenChangelogCount(entries, lastSeenKey) {
  const i = entries.findIndex((e) => changelogEntryKey(e) === lastSeenKey);
  return i === -1 ? entries.length : i;
}

// [{ date, entries: [{ text, unseen }] }] in list order, one group per date.
export function changelogGroups(entries, lastSeenKey) {
  const unseen = unseenChangelogCount(entries, lastSeenKey);
  const groups = [];
  entries.forEach((e, i) => {
    let g = groups[groups.length - 1];
    if (!g || g.date !== e.date) groups.push((g = { date: e.date, entries: [] }));
    g.entries.push({ text: e.text, unseen: i < unseen });
  });
  return groups;
}
