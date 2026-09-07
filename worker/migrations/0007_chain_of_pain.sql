-- Preserve the component totals on the canonical workout. Leaderboards
-- project these into exercise scores; never create duplicate exercise rows.
-- Historical NULL values mean unavailable, not zero. Recover only from
-- the original workout breakdown, never from the combined rep count.
ALTER TABLE sessions ADD COLUMN chain_of_pain_squats INTEGER;
ALTER TABLE sessions ADD COLUMN chain_of_pain_pushups INTEGER;
ALTER TABLE sessions ADD COLUMN chain_of_pain_plank_seconds INTEGER;
ALTER TABLE sessions ADD COLUMN chain_of_pain_segments INTEGER;
ALTER TABLE sessions ADD COLUMN chain_of_pain_duration_seconds INTEGER;
