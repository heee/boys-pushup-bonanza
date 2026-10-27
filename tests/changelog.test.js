import test from "node:test";
import assert from "node:assert/strict";
import { CHANGELOG, changelogEntryKey, changelogGroups, unseenChangelogCount } from "../changelog.js";

const entries = [
  { date: "2026-10-27", text: "C" },
  { date: "2026-10-27", text: "B" },
  { date: "2026-10-20", text: "A" },
];

test("unseen count is everything above the last-seen entry", () => {
  assert.equal(unseenChangelogCount(entries, null), 3);
  assert.equal(unseenChangelogCount(entries, changelogEntryKey(entries[0])), 0);
  assert.equal(unseenChangelogCount(entries, changelogEntryKey(entries[2])), 2);
});

test("groups by date and flags unseen entries", () => {
  const groups = changelogGroups(entries, changelogEntryKey(entries[1]));
  assert.deepEqual(groups, [
    { date: "2026-10-27", entries: [{ text: "C", unseen: true }, { text: "B", unseen: false }] },
    { date: "2026-10-20", entries: [{ text: "A", unseen: false }] },
  ]);
});

test("CHANGELOG is newest first with valid dates", () => {
  for (let i = 0; i < CHANGELOG.length; i++) {
    assert.match(CHANGELOG[i].date, /^\d{4}-\d{2}-\d{2}$/);
    if (i) assert.ok(CHANGELOG[i - 1].date >= CHANGELOG[i].date);
  }
});
