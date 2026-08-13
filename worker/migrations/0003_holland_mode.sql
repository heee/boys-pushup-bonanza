-- Holland mode fields on the existing sessions table (see AGENTS.md "Holland
-- mode" and modes/holland.js). A Holland session is stored as one canonical
-- row like every other mode; its component reps are projected client-side
-- into the pull-up/pushup/squat aggregations rather than duplicated into
-- extra rows here.
ALTER TABLE sessions ADD COLUMN holland_difficulty TEXT;
ALTER TABLE sessions ADD COLUMN holland_pullups INTEGER;
ALTER TABLE sessions ADD COLUMN holland_pushups INTEGER;
ALTER TABLE sessions ADD COLUMN holland_squats INTEGER;
ALTER TABLE sessions ADD COLUMN holland_cycles REAL;
ALTER TABLE sessions ADD COLUMN holland_circuits INTEGER;
ALTER TABLE sessions ADD COLUMN holland_achievement TEXT;
