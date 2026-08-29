-- Compact ten-second workout progression buckets used by Session Detail.
-- JSON shapes are validated by the Worker before insertion.
ALTER TABLE sessions ADD COLUMN session_progression_json TEXT;
