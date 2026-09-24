-- Kettlebell workouts (docs/kettlebell-mode-plan.md): one JSON column holding
-- { w: workoutId, v: volumeLbs, d: durationSeconds, s: compact set log }.
-- Must be applied BEFORE the Worker that writes it is deployed.
ALTER TABLE sessions ADD COLUMN kettlebell_json TEXT;
