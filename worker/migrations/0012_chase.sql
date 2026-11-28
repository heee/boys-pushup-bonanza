-- Chase results (docs/activity-feed-plan.md): { p: period, r: rival, n: points
-- needed, o: overtaken 0/1, m: remaining, l: final lead }. Apply by hand in the
-- D1 console; the Worker skips the write until the column exists.
ALTER TABLE sessions ADD COLUMN chase_json TEXT;
