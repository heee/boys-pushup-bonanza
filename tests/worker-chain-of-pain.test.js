import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { insertSession, sessionFromRow, validateSession } from "../worker/index.js";
import { filterByMode } from "../stats.js";
import { chainOfPainComponentSessions } from "../modes/chain-of-pain.js";
import { hollandComponentSessions } from "../modes/holland.js";

test("Chain of Pain survives database persistence and contributes once to each exercise", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    for (const migration of ["0001_initial_schema.sql", "0003_holland_mode.sql", "0005_pulse_mode.sql", "0006_session_progression.sql", "0007_chain_of_pain.sql"]) {
      sqlite.exec(readFileSync(new URL(`../worker/migrations/${migration}`, import.meta.url), "utf8"));
    }
    // These existing production columns predate the Chain migration.
    for (const column of ["cock_result", "cock_end_reason", "cock_median_rpm", "cock_final_cock_rpm"]) sqlite.exec(`ALTER TABLE sessions ADD COLUMN ${column}`);
    const db = { prepare(sql) {
      const statement = sqlite.prepare(sql);
      return { bind(...args) { return {
        async run() { return statement.run(...args); },
        async first(column) { const row = statement.get(...args); return column ? row?.[column] : row; },
      }; } };
    } };
    const session = validateSession({
      id: "chain-round-trip", user: "Test athlete", timestamp: "2026-09-07T15:00:00.000Z",
      type: "chainofpain", count: 31, chainOfPainSquats: 19, chainOfPainPushups: 12,
      chainOfPainPlankSeconds: 42, chainOfPainSegments: 4, chainOfPainDurationSeconds: 30,
    });
    await insertSession(db, session);
    await insertSession(db, session); // Offline retries must remain idempotent.
    const rows = sqlite.prepare("SELECT s.*, u.name AS user FROM sessions s JOIN users u ON u.id=s.user_id").all();
    assert.equal(rows.length, 1);
    const saved = rows.map(sessionFromRow);
    for (const key of ["chainOfPainSquats", "chainOfPainPushups", "chainOfPainPlankSeconds", "chainOfPainSegments", "chainOfPainDurationSeconds", "chainOfPainCycles"]) assert.equal(saved[0][key], session[key], key);
    for (const [mode, count] of [["all", 12], ["classic", 12], ["squats", 19], ["planks", 42]]) {
      const projected = filterByMode(saved, mode);
      assert.equal(projected.length, 1, mode);
      assert.equal(projected[0].count, count, mode);
      assert.equal(projected[0].timestamp, session.timestamp);
      assert.equal(projected[0].chainOfPainSourceId, session.id);
    }
    assert.equal(filterByMode(saved, "chainofpain").length, 1);
    sqlite.prepare("DELETE FROM sessions WHERE id=?").run(session.id);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 0);
  } finally { sqlite.close(); }
});

test("Chain persistence does not fabricate missing historical breakdowns", () => {
  const session = sessionFromRow({ id: "legacy", user: "Test athlete", type: "chainofpain", count: 31,
    chain_of_pain_squats: null, chain_of_pain_pushups: null, chain_of_pain_plank_seconds: null,
    chain_of_pain_segments: null, chain_of_pain_duration_seconds: null });
  assert.equal(session.chainOfPainCycles, undefined);
  assert.equal(filterByMode([session], "all").length, 0);
});

test("app leaderboard and recent-history buckets include Chain components exactly once", () => {
  const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const context = vm.createContext({ chainOfPainComponentSessions, hollandComponentSessions,
    LEADERBOARD_MODE_OPTIONS: ["all", "classic", "squats", "planks", "holland", "chainofpain"].map(id => ({ id })),
  });
  const activityFunction = source.slice(source.indexOf("function sessionActivity("));
  vm.runInContext(activityFunction.slice(0, activityFunction.indexOf("\n}") + 2), context);
  vm.runInContext(source.slice(source.indexOf("function buildSessionIndex("), source.indexOf("function indexSessions(")), context);
  vm.runInContext(source.slice(source.indexOf("function sessionActivityPhrase("), source.indexOf("function renderRecentList(")), context);
  context.sessions = [{ id: "chain", user: "Test athlete", type: "chainofpain", count: 31,
    timestamp: "2026-09-07T15:00:00.000Z", chainOfPainSquats: 19, chainOfPainPushups: 12,
    chainOfPainPlankSeconds: 42, chainOfPainSegments: 4 }];
  const index = vm.runInContext("buildSessionIndex(sessions)", context);
  assert.equal(index.byUser.get("Test athlete").length, 1, "one canonical My Sessions entry");
  for (const [mode, count] of [["all", 12], ["classic", 12], ["squats", 19], ["planks", 42]]) {
    const bucket = index.byLeaderboardMode[mode];
    assert.equal(bucket.length, 1, mode);
    assert.equal(bucket[0].count, count, mode);
    assert.equal(bucket[0].timestamp, context.sessions[0].timestamp, "recent history date survives projection");
    assert.equal(index.byUserLeaderboardMode.get(`${mode}\0Test athlete`)[0], bucket[0]);
    context.projected = bucket[0];
    const label = vm.runInContext("sessionActivityPhrase(projected)", context);
    assert.match(label, /in Chain of Pain$/);
    assert.match(label, mode === "planks" ? /a plank/ : mode === "squats" ? /squats/ : /pushups/);
  }
});
