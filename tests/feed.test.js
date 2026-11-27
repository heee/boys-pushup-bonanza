import test from "node:test";
import assert from "node:assert/strict";
import { BURST_GAP_MS, buildFeedItems, feedDayLabel, mergeReactions, reactionIndex, unreadReactions } from "../feed.js";

const H = 3600 * 1000;
const base = new Date(2026, 10, 10, 9, 0, 0).getTime(); // Tue Nov 10 2026, local
const now = new Date(2026, 10, 27, 12, 0, 0).getTime();
let n = 0;
const s = (user, at, count, extra = {}) => ({ id: `x${n++}`, user, count, timestamp: new Date(at).toISOString(), ...extra });
const kinds = (items) => items.map((i) => i.kind);

test("bursts: same user + exercise within 2h collapse; a gap or other exercise splits", () => {
  const sessions = [s("A", base, 12), s("A", base + H, 10), s("A", base + H + BURST_GAP_MS + 1, 5), s("A", base + 1.5 * H, 30, { type: "squat" })];
  const items = buildFeedItems({ sessions, names: new Set(["A"]), now }).filter((i) => i.kind === "sessions");
  assert.deepEqual(items.map((i) => i.sessions.length).sort(), [1, 1, 2]);
  const burst = items.find((i) => i.sessions.length === 2);
  assert.equal(burst.id, `s:${sessions[0].id}`, "id = first session, stable as sets are added");
});

test("PRs: never on the first session; a PR replaces its plain row", () => {
  const sessions = [s("A", base, 20), s("A", base + 24 * H, 25), s("A", base + 48 * H, 22)];
  const items = buildFeedItems({ sessions, names: new Set(["A"]), now });
  const prs = items.filter((i) => i.kind === "pr");
  assert.equal(prs.length, 1);
  assert.equal(prs[0].value, 25);
  assert.equal(prs[0].previous, 20);
  const rowIds = items.filter((i) => i.kind === "sessions").flatMap((i) => i.sessions.map((x) => x.id));
  assert.ok(!rowIds.includes(sessions[1].id));
});

test("lifetime milestones skip values a trophy already announces", () => {
  const sessions = Array.from({ length: 11 }, (_, i) => s("A", base + i * 24 * H, 1000));
  const items = buildFeedItems({ sessions, names: new Set(["A"]), trophyThresholds: { pushups: [100, 1000, 5000, 25000, 100000] }, now });
  assert.deepEqual(items.filter((i) => i.kind === "milestone").map((i) => i.value), [10000]);
});

test("streak milestones (50 / 100) appear; 7 / 30 left to trophies", () => {
  const sessions = Array.from({ length: 52 }, (_, i) => s("A", new Date(2026, 8, 1 + i, 10).getTime(), 5));
  const items = buildFeedItems({ sessions, names: new Set(["A"]), trophyThresholds: { streak: [7, 30, 90, 180, 365] }, now });
  assert.deepEqual(items.filter((i) => i.kind === "streak").map((i) => i.value), [50]);
});

test("daily #1 only for finished days with ≥2 members; ties share it", () => {
  const today = new Date(2026, 10, 27, 9).getTime();
  const sessions = [s("A", base, 30), s("B", base + H, 30), s("A", base + 24 * H, 10), s("A", today, 50), s("B", today, 10)];
  const items = buildFeedItems({ sessions, names: new Set(["A", "B"]), groupId: "g", now });
  const daily = items.filter((i) => i.kind === "daily1");
  assert.equal(daily.length, 1, "solo day and today are skipped");
  assert.deepEqual(daily[0].winners, ["A", "B"]);
  assert.equal(daily[0].id, "d1:g:2026-11-10");
  assert.ok(items.some((i) => i.kind === "weekly1"), "week of Nov 9 is over");
});

test("scope: only roster members' sessions and games", () => {
  const sessions = [s("A", base, 10), s("Z", base, 10)];
  const horseGames = [{ id: "h1", status: "complete", winner: ["A"], turnOrder: ["A", "Z"], sets: [{ at: base + H }] }, { id: "h2", status: "complete", winner: ["Z"], turnOrder: ["Z", "Y"], sets: [{ at: base }] }];
  const towGames = [{ id: "t1", status: "complete", winner: "b", teams: { a: { name: "Red", players: ["A"] }, b: { name: "Blue", players: ["Z"] } }, scores: { a: 40, b: 50 }, bursts: [{ at: base + 2 * H }] }];
  const items = buildFeedItems({ sessions, names: new Set(["A"]), horseGames, towGames, now });
  assert.deepEqual(kinds(items).sort(), ["horse", "sessions", "tow"]);
  const tow = items.find((i) => i.kind === "tow");
  assert.deepEqual(tow.owners, ["Z"]);
  assert.deepEqual(tow.score, [50, 40]);
});

test("cock wins become highlights; newest first", () => {
  const sessions = [s("A", base, 40, { mode: "cock", cockResult: "win" }), s("A", base + 5 * H, 12)];
  const items = buildFeedItems({ sessions, names: new Set(["A"]), now });
  assert.deepEqual(kinds(items), ["sessions", "cock"]);
});

test("reactions: queued toggles merge over server rows; index + unread", () => {
  const server = [{ itemId: "i1", user: "B", emoji: "🔥", owners: ["A"], at: 100 }, { itemId: "i1", user: "A", emoji: "🐐", owners: ["A"], at: 50 }];
  const merged = mergeReactions(server, [{ itemId: "i1", user: "A", emoji: "🐐", on: false }, { itemId: "i1", user: "A", emoji: "🔥", on: true, at: 200 }]);
  const index = reactionIndex(merged, "A").get("i1");
  assert.deepEqual(index.map((r) => [r.emoji, r.users.length, r.mine]), [["🔥", 2, true]]);
  assert.equal(unreadReactions(merged, "A", 99).length, 1);
  assert.equal(unreadReactions(merged, "A", 100).length, 0);
});

test("day labels", () => {
  assert.equal(feedDayLabel(now - 3 * H, now), "Today");
  assert.equal(feedDayLabel(now - 24 * H, now), "Yesterday");
  assert.equal(feedDayLabel(base, now), "Tue, Nov 10");
});
