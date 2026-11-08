-- Grip mode (docs/grip-mode-plan.md): one JSON column holding
-- { d: durationSeconds, l: lap seconds (first lap = left hand), e: suggested count }.
-- The Worker tolerates its absence (session saves, grip_json write is skipped).
ALTER TABLE sessions ADD COLUMN grip_json TEXT;
