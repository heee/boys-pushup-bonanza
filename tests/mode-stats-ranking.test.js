import assert from "node:assert/strict";
import test from "node:test";
import { modeStatsModel, modesUsedStat, rankEntries } from "../screens/mode-stats.js";

test("rankEntries sorts best first and gives ties a shared rank", () => {
  const ranked = rankEntries([{ user: "B", value: 5 }, { user: "A", value: 9 }, { user: "C", value: 5 }, { user: "D", value: 1 }]);
  assert.deepEqual(ranked.map((e) => [e.user, e.rank]), [["A", 1], ["B", 2], ["C", 2], ["D", 4]]);
});

test("mode stats rank every player per metric; pace ranks closest to ideal first", () => {
  const t = (min) => new Date(Date.UTC(2026, 10, 1, 10, min)).toISOString();
  const sessions = [
    { user: "Fast", count: 60, startedAt: t(0), timestamp: t(1) },
    { user: "Ideal", count: 38, startedAt: t(0), timestamp: t(1) },
    { user: "Slow", count: 20, startedAt: t(0), timestamp: t(1) },
  ];
  const metrics = modeStatsModel(sessions, "all");
  const pace = metrics.find((m) => m.id === "avgPace");
  assert.deepEqual(pace.ranking.map((e) => e.user), ["Ideal", "Slow", "Fast"]);
  const best = metrics.find((m) => m.id === "bestSession");
  assert.deepEqual(best.ranking.map((e) => [e.user, e.value, e.rank]), [["Fast", 60, 1], ["Ideal", 38, 2], ["Slow", 20, 3]]);
  assert.deepEqual(modesUsedStat(sessions).ranking.map((e) => e.rank), [1, 1, 1]);
});
