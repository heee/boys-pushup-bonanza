import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { GRIP_DEFAULT_SEC_PER_SQUEEZE, gripHandTotals, gripLapDurations, gripLapHand, gripRateFor, gripSuggestedCount } from "../modes/grip.js";
import { insertSession, sessionFromRow, validateSession } from "../worker/index.js";

const grip = (user, day, seconds, count) => ({ type: "grip", user, timestamp: `2026-11-${String(day).padStart(2, "0")}T12:00:00.000Z`, gripDurationSeconds: seconds, count });

test("new players start at the default rate", () => {
  assert.equal(gripRateFor([], "Ann"), GRIP_DEFAULT_SEC_PER_SQUEEZE);
  assert.equal(gripRateFor([grip("Bob", 1, 60, 60)], "Ann"), GRIP_DEFAULT_SEC_PER_SQUEEZE);
});

test("rate averages the player's last five grip sessions", () => {
  const sessions = [
    grip("Ann", 1, 100, 10), // 10 s — oldest, falls out of the window
    grip("Ann", 2, 60, 60),
    grip("Ann", 3, 60, 30),
    grip("Ann", 4, 60, 60),
    grip("Ann", 5, 60, 30),
    grip("Ann", 6, 60, 60),
    { type: "situp", user: "Ann", timestamp: "2026-11-07T12:00:00Z", count: 5 },
    { type: "grip", user: "Ann", timestamp: "2026-11-08T12:00:00Z", count: 40 }, // no duration (pre-migration)
  ];
  assert.equal(gripRateFor(sessions, "Ann"), (1 + 2 + 1 + 2 + 1) / 5);
});

test("absurd samples are clamped", () => {
  assert.equal(gripRateFor([grip("Ann", 1, 600, 1)], "Ann"), 10);
  assert.equal(gripRateFor([grip("Ann", 1, 10, 1000)], "Ann"), 0.3);
});

test("suggested count rounds duration over rate", () => {
  assert.equal(gripSuggestedCount(90, 1.5), 60);
  assert.equal(gripSuggestedCount(10, 3), 3);
  assert.equal(gripSuggestedCount(1, 5), 1);
  assert.equal(gripSuggestedCount(0, 1.5), 0);
});

test("switch-hand marks become per-lap durations starting with left", () => {
  assert.deepEqual(gripLapDurations([], 42), [42]);
  assert.deepEqual(gripLapDurations([45, 87], 127), [45, 42, 40]);
  assert.deepEqual(gripLapDurations([0, 30, 60], 60), [30, 30]);
  assert.deepEqual(gripLapDurations([11.4], 22.4), [11, 11]);
  assert.equal(gripLapHand(0), "L");
  assert.equal(gripLapHand(1), "R");
  assert.deepEqual(gripHandTotals([45, 42, 40]), { L: 85, R: 42 });
  assert.deepEqual(gripHandTotals([]), { L: 0, R: 0 });
});

test("worker validates grip fields and round-trips grip_json", async () => {
  assert.equal(validateSession({ user: "Ann", count: 30, type: "grip" }), null);
  assert.equal(validateSession({ user: "Ann", count: 30, type: "grip", gripDurationSeconds: 45, gripLaps: [1.5] }), null);
  const session = validateSession({ id: "grip-1", user: "Ann", timestamp: "2026-11-08T12:00:00.000Z", count: 33, type: "grip", gripDurationSeconds: 50, gripLaps: [25, 25], gripSuggested: 30 });
  assert.equal(session.type, "grip");
  assert.deepEqual(session.gripLaps, [25, 25]);

  const sqlite = new DatabaseSync(":memory:");
  try {
    for (const migration of ["0001_initial_schema.sql", "0003_holland_mode.sql", "0005_pulse_mode.sql", "0006_session_progression.sql", "0007_chain_of_pain.sql", "0008_kettlebell.sql"]) {
      sqlite.exec(readFileSync(new URL(`../worker/migrations/${migration}`, import.meta.url), "utf8"));
    }
    for (const column of ["cock_result", "cock_end_reason", "cock_median_rpm", "cock_final_cock_rpm"]) sqlite.exec(`ALTER TABLE sessions ADD COLUMN ${column}`);
    const db = { prepare(sql) {
      const statement = sqlite.prepare(sql);
      return { bind(...args) { return {
        async run() { return statement.run(...args); },
        async first(column) { const row = statement.get(...args); return column ? row?.[column] : row; },
      }; } };
    } };
    const readBack = () => sessionFromRow(sqlite.prepare("SELECT s.*, u.name AS user FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?").get("grip-1"));

    // Before the grip_json column exists the session still saves.
    await insertSession(db, session);
    assert.equal(readBack().count, 33);
    assert.equal(readBack().gripDurationSeconds, undefined);

    sqlite.exec(readFileSync(new URL("../worker/migrations/0010_grip.sql", import.meta.url), "utf8"));
    sqlite.exec("DELETE FROM sessions");
    await insertSession(db, session);
    const row = readBack();
    assert.equal(row.gripDurationSeconds, 50);
    assert.deepEqual(row.gripLaps, [25, 25]);
    assert.equal(row.gripSuggested, 30);
  } finally {
    sqlite.close();
  }
});
