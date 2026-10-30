import test from "node:test";
import assert from "node:assert/strict";
import { challengeVisibleTo, groupsForUser, isGroupAdmin, resolveActiveGroupId, scopeUserNames } from "../groups.js";

const boys = { id: "the-boys-21", name: "The Boys 2.1", members: [{ name: "Henning", role: "admin" }, { name: "Nelson", role: "member" }] };
const work = { id: "g-work", name: "Work", members: [{ name: "Nelson", role: "admin" }, { name: "Ada", role: "member" }] };
const groups = [work, boys];

test("membership + admin", () => {
  assert.deepEqual(groupsForUser(groups, "Nelson").map((g) => g.id), ["g-work", "the-boys-21"]);
  assert.ok(isGroupAdmin(boys, "Henning"));
  assert.ok(!isGroupAdmin(boys, "Nelson"));
});

test("active group falls back to The Boys 2.1, then first group, then solo", () => {
  assert.equal(resolveActiveGroupId(groups, "Nelson", "g-work"), "g-work");
  assert.equal(resolveActiveGroupId(groups, "Nelson", "gone"), "the-boys-21");
  assert.equal(resolveActiveGroupId(groups, "Ada", null), "g-work");
  assert.equal(resolveActiveGroupId(groups, "Solo", null), null);
});

test("board scope", () => {
  assert.equal(scopeUserNames("all", { groups, user: "Ada" }), null);
  assert.deepEqual([...scopeUserNames("me", { groups, user: "Ada" })], ["Ada"]);
  assert.deepEqual([...scopeUserNames("g-work", { groups, user: "Ada" })], ["Nelson", "Ada"]);
});

test("challenge visibility", () => {
  const ctx = (user, participants = []) => ({ user, groups, participants });
  assert.ok(challengeVisibleTo({ id: "builtin" }, ctx("Ada")));
  const groupOnly = { createdBy: "Henning", visibility: "group", groupId: "the-boys-21" };
  assert.ok(challengeVisibleTo(groupOnly, ctx("Nelson")));
  assert.ok(!challengeVisibleTo(groupOnly, ctx("Ada")));
  assert.ok(challengeVisibleTo(groupOnly, ctx("Ada", ["Ada"])));
  assert.ok(!challengeVisibleTo({ createdBy: "Henning", visibility: "personal" }, ctx("Nelson")));
  assert.ok(challengeVisibleTo({ createdBy: "Henning", visibility: "public" }, ctx("Ada")));
});

test("picker shows device profiles plus their groups' rosters", async () => {
  const { pickerUserNames } = await import("../groups.js");
  const ordered = ["Henning", "Ada", "Nelson", "Stranger"];
  assert.deepEqual(pickerUserNames(ordered, { deviceProfiles: ["Henning"], groups }), ["Henning", "Nelson"]);
  assert.deepEqual(pickerUserNames(ordered, { deviceProfiles: ["Nelson"], groups }), ["Henning", "Ada", "Nelson"]);
  assert.deepEqual(pickerUserNames(ordered, { deviceProfiles: [], groups }), []);
  assert.deepEqual(pickerUserNames(ordered, { deviceProfiles: ["Newbie"], groups }), ["Newbie"]);
});
