// Runs groupAction (worker/index.js) against a real SQLite database with the
// 0001 + 0009 migrations applied, via a tiny D1-shaped shim.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { deleteSession, fetchData, groupAction, GroupError, randomGroupCode } from "../worker/index.js";
import { readdirSync } from "node:fs";

function d1(sqlite) {
  const statement = (sql, params = []) => ({
    bind: (...args) => statement(sql, args),
    run: async () => sqlite.prepare(sql).run(...params),
    all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
    first: async (column) => {
      const row = sqlite.prepare(sql).get(...params);
      return column ? row?.[column] ?? null : row ?? null;
    },
    _exec: () => (/^\s*select/i.test(sql) ? { results: sqlite.prepare(sql).all(...params) } : sqlite.prepare(sql).run(...params)),
  });
  return {
    prepare: (sql) => statement(sql),
    batch: async (statements) => {
      sqlite.exec("BEGIN");
      try {
        const out = statements.map((s) => s._exec());
        sqlite.exec("COMMIT");
        return out;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
}

function freshDb(users = ["Henning", "Nelson", "Danger D"]) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../worker/migrations/0001_initial_schema.sql", import.meta.url), "utf8"));
  for (const name of users) sqlite.prepare("INSERT INTO users (name) VALUES (?)").run(name);
  sqlite.prepare("INSERT INTO custom_challenges (id,title,tagline,emoji,goal_type,goal,start,end,gradient_json,created_by) VALUES ('c1','T','t','🎯','individual',10,'2026-01-01','2026-02-01','[]','Nelson')").run();
  sqlite.exec(readFileSync(new URL("../worker/migrations/0009_groups.sql", import.meta.url), "utf8"));
  return { sqlite, db: d1(sqlite) };
}

test("migration seeds The Boys 2.1 with every user, Henning admin, and scopes old challenges", () => {
  const { sqlite } = freshDb();
  const members = sqlite.prepare("SELECT u.name, m.role FROM group_members m JOIN users u ON u.id = m.user_id WHERE group_id = 'the-boys-21' ORDER BY u.name").all();
  assert.deepEqual(members.map((m) => [m.name, m.role]), [["Danger D", "member"], ["Henning", "admin"], ["Nelson", "member"]]);
  assert.equal(sqlite.prepare("SELECT group_id FROM challenge_scopes WHERE challenge_id = 'c1'").get().group_id, "the-boys-21");
});

test("create makes the caller admin; join by code (case-insensitive) adds a member", async () => {
  const { db } = freshDb();
  const { group } = await groupAction(db, { action: "create", user: "Nelson", name: "  Work   Crew " });
  assert.equal(group.name, "Work Crew");
  assert.match(group.inviteCode, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.deepEqual(group.members.map((m) => [m.name, m.role]), [["Nelson", "admin"]]);
  const joined = await groupAction(db, { action: "join", user: "Newbie", code: group.inviteCode.toLowerCase() });
  assert.deepEqual(joined.group.members.map((m) => m.name), ["Nelson", "Newbie"]);
  await assert.rejects(groupAction(db, { action: "join", user: "X", code: "NOPE00" }), GroupError);
});

test("only admins rename, promote, remove, delete", async () => {
  const { db } = freshDb();
  await assert.rejects(groupAction(db, { action: "rename", user: "Nelson", groupId: "the-boys-21", name: "Nope" }), /admin/);
  await assert.rejects(groupAction(db, { action: "rename", user: "Stranger", groupId: "the-boys-21", name: "Nope" }), /not a member/);
  let { group } = await groupAction(db, { action: "promote", user: "Henning", groupId: "the-boys-21", target: "Nelson" });
  assert.equal(group.members.find((m) => m.name === "Nelson").role, "admin");
  ({ group } = await groupAction(db, { action: "remove", user: "Nelson", groupId: "the-boys-21", target: "Danger D" }));
  assert.ok(!group.members.some((m) => m.name === "Danger D"));
  await assert.rejects(groupAction(db, { action: "remove", user: "Nelson", groupId: "the-boys-21", target: "Nelson" }), /leave/);
  ({ group } = await groupAction(db, { action: "rename", user: "Nelson", groupId: "the-boys-21", name: "The Boys 3.0" }));
  assert.equal(group.name, "The Boys 3.0");
});

test("last admin leaving promotes the longest-standing member; last member leaving deletes the group", async () => {
  const { db, sqlite } = freshDb();
  const { group } = await groupAction(db, { action: "create", user: "Henning", name: "Pair" });
  await groupAction(db, { action: "join", user: "Nelson", code: group.inviteCode });
  const after = await groupAction(db, { action: "leave", user: "Henning", groupId: group.id });
  assert.deepEqual(after.group.members.map((m) => [m.name, m.role]), [["Nelson", "admin"]]);
  const gone = await groupAction(db, { action: "leave", user: "Nelson", groupId: group.id });
  assert.equal(gone.group, null);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM groups WHERE id = ?").get(group.id).n, 0);
});

test("deleting a group turns its challenges personal", async () => {
  const { db, sqlite } = freshDb();
  await groupAction(db, { action: "delete", user: "Henning", groupId: "the-boys-21" });
  assert.deepEqual({ ...sqlite.prepare("SELECT visibility, group_id FROM challenge_scopes WHERE challenge_id = 'c1'").get() }, { visibility: "personal", group_id: null });
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM group_members").get().n, 0);
});

test("invite codes skip look-alike characters", () => {
  for (let i = 0; i < 200; i++) assert.doesNotMatch(randomGroupCode(), /[IO01]/);
});

function dbWithMigrations(filter) {
  const sqlite = new DatabaseSync(":memory:");
  const dir = new URL("../worker/migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().filter(filter)) {
    sqlite.exec(readFileSync(new URL(file, dir), "utf8"));
  }
  sqlite.prepare("INSERT INTO users (name) VALUES ('Henning')").run();
  sqlite.prepare("INSERT INTO sessions (id, user_id, timestamp, count) VALUES ('s1', 1, '2026-10-29T10:00:00Z', 20)").run();
  return { sqlite, db: d1(sqlite) };
}

test("before the 0009 migration, /data and deletes keep working with groups switched off", async () => {
  const { db, sqlite } = dbWithMigrations((f) => !f.startsWith("0009"));
  const data = await fetchData(db);
  assert.equal(data.groupsEnabled, false);
  assert.deepEqual(data.groups, []);
  assert.equal(data.sessions.length, 1);
  await deleteSession(db, "s1");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM users").get().n, 0);
});

test("after the 0009 migration, /data reports groups with members", async () => {
  const { db } = dbWithMigrations(() => true);
  // users inserted after the seed ran — seed again the way the console would have
  await groupAction(db, { action: "join", user: "Henning", code: "BOYS21" });
  const data = await fetchData(db);
  assert.equal(data.groupsEnabled, true);
  assert.deepEqual(data.groups.map((g) => [g.name, g.members.map((m) => m.name)]), [["The Boys 2.1", ["Henning"]]]);
});

test("open lobbies carry audience + max players; joins respect the cap", async () => {
  const { validateHorseCreate, validateTowCreate, createHorseGame, joinOpenPlayer, validateLobbyAudience } = await import("../worker/index.js");
  const input = validateHorseCreate({ word: "HORSE", sessionType: "open", createdBy: "Ada", players: ["Ada"], audience: "group", groupId: "g1", maxPlayers: 2 });
  assert.deepEqual([input.audience, input.groupId, input.maxPlayers], ["group", "g1", 2]);
  assert.deepEqual(validateLobbyAudience({ audience: "group" }, "open"), {}, "group without id is dropped");
  assert.deepEqual(validateLobbyAudience({ audience: "public", maxPlayers: 9 }, "open"), { audience: "public", groupId: null });
  assert.deepEqual(validateLobbyAudience({ audience: "public" }, "invite"), {});
  let game = { ...createHorseGame(input), maxPlayers: 2 };
  game = joinOpenPlayer(game, { user: "Ben" });
  assert.throws(() => joinOpenPlayer(game, { user: "Cy" }), /full/);
  const tow = validateTowCreate({ target: 100, rounds: 3, sessionType: "open", createdBy: "Ada", audience: "public", maxPlayers: 4 });
  assert.equal(tow.rosterSize, 4);
  assert.equal(tow.audience, "public");
});
