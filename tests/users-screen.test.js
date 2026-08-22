import test from "node:test";
import assert from "node:assert/strict";
import { orderedUserNames, renameCachedIdentity, userSelectionModel, visibleUserSessions } from "../screens/users.js";

const sessions = [
  { id: "1", user: "B", timestamp: "2026-08-01T10:00:00Z" },
  { id: "2", user: "A", timestamp: "2026-08-02T10:00:00Z" },
  { id: "3", user: "A", timestamp: "2026-08-03T10:00:00Z" },
];

test("current user remains first while management names sort", () => {
  assert.deepEqual(orderedUserNames(sessions, "B", { alphabetical: true }), ["B", "A"]);
});

test("session history is newest-first and paginated", () => {
  assert.deepEqual(visibleUserSessions(sessions, "A", 1), { sessions: [sessions[2]], hasMore: true, total: 2 });
});

test("session history sorts by date or length in either direction", () => {
  const sortable = [
    { id: "old-short", user: "A", timestamp: "2026-08-01T10:00:00Z", count: 10 },
    { id: "new-long", user: "A", timestamp: "2026-08-03T10:00:00Z", count: 30 },
    { id: "new-short", user: "A", timestamp: "2026-08-02T10:00:00Z", count: 5 },
  ];
  const ids = (options) => visibleUserSessions(sortable, "A", 10, options).sessions.map((session) => session.id);

  assert.deepEqual(ids({ sortBy: "date", direction: "asc" }), ["old-short", "new-short", "new-long"]);
  assert.deepEqual(ids({ sortBy: "length", direction: "desc" }), ["new-long", "old-short", "new-short"]);
  assert.deepEqual(ids({ sortBy: "length", direction: "asc" }), ["new-short", "old-short", "new-long"]);
});

test("cached rename updates sessions, avatar, and challenge enrollment", () => {
  const data = { sessions: [{ user: "A" }], avatars: { A: "flex" }, challengeParticipants: { c1: ["A", "B"] } };
  assert.deepEqual(renameCachedIdentity(data, "A", "Z"), { sessions: [{ user: "Z" }], avatars: { Z: "flex" }, challengeParticipants: { c1: ["Z", "B"] } });
});

test("known devices start compact with only the recent user outside More", () => {
  assert.deepEqual(userSelectionModel(["B", "A"], "B"), {
    recentUser: "B",
    compact: true,
    creating: false,
    visibleUsers: [],
    showMore: true,
    staleRecentUser: false,
  });
});

test("More expands other users without duplicating the recent user", () => {
  assert.deepEqual(userSelectionModel(["B", "A", "C"], "B", { expanded: true }).visibleUsers, ["A", "C"]);
});

test("unknown and stale devices use the full-list state", () => {
  assert.deepEqual(userSelectionModel(["A", "B"], "").visibleUsers, ["A", "B"]);
  assert.equal(userSelectionModel(["A", "B"], "Missing").staleRecentUser, true);
});

test("new-user creation is modeled as a focused state", () => {
  const model = userSelectionModel(["A", "B"], "A", { expanded: true, creating: true });
  assert.equal(model.creating, true);
  assert.deepEqual(model.visibleUsers, ["B"]);
});
