import test from "node:test";
import assert from "node:assert/strict";
import {
  computeGroupBreakdown,
  computeGroupStats,
  computeGroupMilesLogged,
  computeGroupVolumeRecordBadge,
  computeGroupMilestoneBadge,
  haversineMiles,
  HOUSTON_COORDS,
} from "../group-recap.js";

function session({ user, count, type, mode, date, startedAt, cityId, cityName }) {
  const s = { id: `${user}-${date}-${Math.random()}`, user, count, timestamp: date };
  if (type) s.type = type;
  if (mode) s.mode = mode;
  if (startedAt) s.startedAt = startedAt;
  if (cityId) {
    s.location = {
      provider: "geoapify",
      country: { id: "country:us", name: "United States", code: "US" },
      city: { id: cityId, name: cityName },
    };
  }
  return s;
}

test("computeGroupBreakdown totals per exercise, splits out the viewer's share, and sorts by group total", () => {
  const start = new Date("2026-08-01T00:00:00Z");
  const end = new Date("2026-09-01T00:00:00Z");
  const sessions = [
    session({ user: "Alice", count: 20, date: "2026-08-05T00:00:00Z" }), // pushup
    session({ user: "Bob", count: 30, date: "2026-08-06T00:00:00Z" }), // pushup
    session({ user: "Alice", count: 75, type: "situp", date: "2026-08-07T00:00:00Z" }),
  ];
  const rows = computeGroupBreakdown(sessions, start, end, "Alice");
  assert.equal(rows[0].key, "situp");
  assert.equal(rows[0].groupTotal, 75);
  assert.equal(rows[0].yourTotal, 75);
  assert.equal(rows[1].key, "pushup");
  assert.equal(rows[1].groupTotal, 50);
  assert.equal(rows[1].yourTotal, 20);
});

test("computeGroupBreakdown omits exercises no one did that month", () => {
  const start = new Date("2026-08-01T00:00:00Z");
  const end = new Date("2026-09-01T00:00:00Z");
  const rows = computeGroupBreakdown([], start, end, "Alice");
  assert.deepEqual(rows, []);
});

test("computeGroupStats sums duration/sessions across everyone and counts non-Classic sessions as games", () => {
  const start = new Date("2026-08-01T00:00:00Z");
  const end = new Date("2026-09-01T00:00:00Z");
  const sessions = [
    session({ user: "Alice", count: 20, date: "2026-08-05T01:00:00Z", startedAt: "2026-08-05T00:00:00Z" }), // classic, 1hr
    session({ user: "Bob", count: 10, mode: "dice", date: "2026-08-06T00:30:00Z", startedAt: "2026-08-06T00:00:00Z" }), // 30min game
    session({ user: "Carl", count: 5, type: "holland", date: "2026-08-07T00:15:00Z", startedAt: "2026-08-07T00:00:00Z" }), // 15min game
  ];
  const stats = computeGroupStats(sessions, start, end);
  assert.equal(stats.sessionsCount, 3);
  assert.equal(stats.gamesPlayed, 2);
  assert.ok(Math.abs(stats.hoursDown - 1.75) < 0.001);
});

test("computeGroupVolumeRecordBadge fires only when this month beats every earlier month", () => {
  const sessions = [
    session({ user: "Alice", count: 1000, date: "2026-06-15T00:00:00Z" }),
    session({ user: "Alice", count: 500, date: "2026-07-15T00:00:00Z" }),
  ];
  const augStart = new Date("2026-08-01T00:00:00Z");
  const augEnd = new Date("2026-09-01T00:00:00Z");

  // Below the June record — no badge.
  const belowRecord = [...sessions, session({ user: "Bob", count: 800, date: "2026-08-10T00:00:00Z" })];
  assert.equal(computeGroupVolumeRecordBadge(belowRecord, augStart, augEnd), null);

  // Beats every prior month — badge fires.
  const aboveRecord = [...sessions, session({ user: "Bob", count: 1500, date: "2026-08-10T00:00:00Z" })];
  const badge = computeGroupVolumeRecordBadge(aboveRecord, augStart, augEnd);
  assert.ok(badge);
  assert.match(badge.text, /Biggest month/);
});

test("computeGroupMilestoneBadge fires only in the month a 50k threshold is actually crossed", () => {
  const start = new Date("2026-08-01T00:00:00Z");
  const end = new Date("2026-09-01T00:00:00Z");

  // Lifetime total stays under 50,000 even after this month — no badge.
  const noCross = [
    session({ user: "Alice", count: 40000, date: "2026-01-01T00:00:00Z" }),
    session({ user: "Alice", count: 5000, date: "2026-08-05T00:00:00Z" }),
  ];
  assert.equal(computeGroupMilestoneBadge(noCross, start, end), null);

  // Crosses 50,000 during August — badge fires naming that threshold.
  const oneCross = [
    session({ user: "Alice", count: 48000, date: "2026-01-01T00:00:00Z" }),
    session({ user: "Alice", count: 5000, date: "2026-08-05T00:00:00Z" }),
  ];
  const badge = computeGroupMilestoneBadge(oneCross, start, end);
  assert.ok(badge);
  assert.match(badge.text, /50,000/);

  // Crosses two thresholds in one month — names the higher one.
  const twoCrosses = [
    session({ user: "Alice", count: 48000, date: "2026-01-01T00:00:00Z" }),
    session({ user: "Alice", count: 55000, date: "2026-08-05T00:00:00Z" }),
  ];
  const bigBadge = computeGroupMilestoneBadge(twoCrosses, start, end);
  assert.match(bigBadge.text, /100,000/);

  // Was already crossed in an earlier month — doesn't refire.
  const alreadyCrossed = [
    session({ user: "Alice", count: 60000, date: "2026-01-01T00:00:00Z" }),
    session({ user: "Alice", count: 100, date: "2026-08-05T00:00:00Z" }),
  ];
  assert.equal(computeGroupMilestoneBadge(alreadyCrossed, start, end), null);
});

test("computeGroupMilesLogged excludes Houston, doubles for the round trip, and skips cities missing coordinates", () => {
  const sessions = [
    session({ user: "Alice", count: 10, date: "2026-08-01T00:00:00Z", cityId: "city:houston", cityName: "Houston" }),
    session({ user: "Alice", count: 10, date: "2026-08-02T00:00:00Z", cityId: "city:austin", cityName: "Austin" }),
    session({ user: "Alice", count: 10, date: "2026-08-03T00:00:00Z", cityId: "city:unknown", cityName: "Nowhereville" }),
  ];
  const austinCoords = { lat: 30.2672, lon: -97.7431 };
  const miles = computeGroupMilesLogged(sessions, { "city:austin": austinCoords });
  const expected = haversineMiles(HOUSTON_COORDS, austinCoords) * 2;
  assert.ok(Math.abs(miles - expected) < 0.01);
});

test("haversineMiles returns 0 for identical points", () => {
  assert.equal(haversineMiles(HOUSTON_COORDS, HOUSTON_COORDS), 0);
});
