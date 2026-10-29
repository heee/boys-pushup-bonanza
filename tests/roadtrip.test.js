import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRoadtripTerritories,
  detectRoadtripConquests,
  roadtripConquestShareMessage,
  roadtripPeriodPhrase,
  roadtripDetailRows,
  roadtripOverviewRows,
} from "../roadtrip.js";

const now = new Date(2026, 7, 4, 12);
const loc = (neighborhood, city = "Houston", country = "United States", code = "US") => ({
  provider: "geoapify",
  neighborhood: neighborhood ? { id: `n:${neighborhood}:${city}`, name: neighborhood } : undefined,
  city: { id: `c:${city}:${code}`, name: city },
  country: { id: `country:${code}`, name: country, code },
});
const session = (id, user, count, hour, location = loc("Montrose"), extra = {}) => ({
  id, user, count, location, timestamp: new Date(2026, 7, 4, hour).toISOString(), ...extra,
});

test("aggregates weighted stored counts and excludes planks", () => {
  const rows = buildRoadtripTerritories([
    session("a", "Ada", 30, 8, loc("Montrose"), { rawCount: 20 }),
    session("b", "Ben", 10, 9, loc("Heights")),
    session("c", "Ada", 999, 10, loc("Montrose"), { type: "plank" }),
  ], { tier: "city", period: "day", now });
  assert.equal(rows[0].total, 40);
  assert.equal(rows[0].contributorCount, 2);
});

test("keeps duplicate names separate with parent context", () => {
  const rows = buildRoadtripTerritories([
    session("a", "Ada", 20, 8, loc("Downtown", "Houston")),
    session("b", "Ben", 15, 9, loc("Downtown", "Austin")),
  ], { tier: "neighborhood", period: "week", now });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.parent), ["Houston · US", "Austin · US"]);
});

test("strict overtakes change holder while ties preserve incumbent", () => {
  const base = [session("a", "Ada", 20, 8), session("b", "Ben", 20, 9)];
  let territory = buildRoadtripTerritories(base, { tier: "neighborhood", now })[0];
  assert.equal(territory.holder, "Ada");
  territory = buildRoadtripTerritories([...base, session("c", "Ben", 1, 10)], { tier: "neighborhood", now })[0];
  assert.equal(territory.holder, "Ben");
  assert.equal(territory.conqueredAt, new Date(2026, 7, 4, 10).getTime());
});

test("overview and local lists pin the user's out-of-range rows", () => {
  const territories = Array.from({ length: 12 }, (_, index) => ({ id: `c:${index}:US`, users: [] }));
  assert.equal(roadtripOverviewRows(territories, loc("N", "11"), "city", 10).pinned.id, "c:11:US");
  const territory = { users: Array.from({ length: 12 }, (_, index) => ({ name: `U${index}`, total: 20 - index })) };
  assert.equal(roadtripDetailRows(territory, "U11", 10).pinned.rank, 12);
});

test("a first claim on an empty board is not a conquest", () => {
  const fresh = session("new", "Ada", 10, 10);
  assert.equal(detectRoadtripConquests([fresh], "new", { now }).length, 0);
});

test("detects overtakes, names the incumbent, and rejects a tie", () => {
  const prior = session("old", "Ben", 20, 8);
  const tie = session("tie", "Ada", 20, 9);
  assert.equal(detectRoadtripConquests([prior, tie], "tie", { now }).length, 0);
  const win = session("win", "Ada", 21, 10);
  const wins = detectRoadtripConquests([prior, win], "win", { now });
  assert.equal(wins.length, 3);
  assert.ok(wins.every((item) => item.overtaken === "Ben" && item.kind === "conquered" && item.periods.length === 6));
  assert.ok(wins.every((item) => item.flag === "🇺🇸"));
});

test("share message breaks into blocks with flags and plain-English periods", () => {
  assert.equal(roadtripPeriodPhrase(["day"]), "today");
  assert.equal(roadtripPeriodPhrase(["day", "week", "all"]), "today, this week & all-time");
  const message = roadtripConquestShareMessage("Ada", [
    { name: "Downtown", flag: "🇺🇸", periods: ["day", "week"], overtaken: "Ben" },
    { name: "Washington", flag: "🇺🇸", periods: ["month"], overtaken: "Cy" },
  ]);
  assert.equal(message, [
    "🚨 TERRITORY THEFT 🚨\nAda just stole:",
    "🇺🇸 Downtown — today & this week\nRipped out of Ben's sweaty little hands.",
    "🇺🇸 Washington — this month\nRipped out of Cy's sweaty little hands.",
    "The Roadtrip map has a new landlord. Pay rent in pushups, losers. 🌍👑",
  ].join("\n\n"));
});
