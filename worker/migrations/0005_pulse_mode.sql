-- Pulse mode fields on the existing sessions table (see docs/pulse-mode-plan.md).
-- A Pulse session is stored as one canonical row like every other mode.
-- `count` is overloaded as seconds held in band (matching the plank convention),
-- so the actual rep count is kept separately in pulse_reps.
ALTER TABLE sessions ADD COLUMN pulse_band_width TEXT;
ALTER TABLE sessions ADD COLUMN pulse_band_low INTEGER;
ALTER TABLE sessions ADD COLUMN pulse_band_high INTEGER;
ALTER TABLE sessions ADD COLUMN pulse_end_reason TEXT;
ALTER TABLE sessions ADD COLUMN pulse_break_rpm INTEGER;
ALTER TABLE sessions ADD COLUMN pulse_reps INTEGER;
