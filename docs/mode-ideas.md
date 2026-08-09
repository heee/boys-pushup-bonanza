# Mode ideas backlog (evaluate later)

Earmarked 2026-08-09 during Situp mode planning. Grounding: `createRepCounter` accepts
any monotonic "rises on the way down" ratio; camera.js supports FaceDetector and
PoseLandmarker; new exercises follow the Squat/Situp template
(docs/squat-mode-plan.md, docs/situp-mode-plan.md).

## Next priority: Tug-of-war

Two boys alternate short live bursts on one phone; a rope marker slides toward
whoever's ahead. Versus/co-op counterpart to Ladder Rivals. Reuses the pushup capture
pipeline unchanged — the new work is the turn/burst structure (Horse mode's
pass-the-phone flow is the closest template), the rope UI, and win/loss voice lines.
**Henning wants this built next after Situps.**

## New exercises (ranked by signal reliability)

- **Burpees** — face-Y swings floor→standing, far bigger than squats. Reuses squat
  auto-warmup with wider thresholds. High energy fit.
- **Pull-ups / chin-ups** — face-Y rises past a threshold (inverted squat signal).
  Needs a bar; nice outdoor/territory tie-in.
- **Wall-sit holds** — timer scoring like Plank: face steady in the hold zone keeps the
  clock running. Trivially reliable.
- **Jumping jacks** — face-Y bounce too small; needs pose (wrists above nose = down
  phase). Pose pipeline already live from squats. Fast, satisfying counts for kids.
- **Squat jumps / star jumps** — squat signal plus airborne peak; could score "air
  time" as a bonus stat.

## New game formats (reuse existing exercises)

- **Medley / Triathlon** — chained rounds (10 pushups → 15 squats → 20 situps) with
  per-exercise calibration profiles swapping automatically. Natural once Situps land;
  gives Bonanza stats a new session shape.
- **HORSE mixed-exercise** — challenger picks the exercise per turn. Small delta on the
  existing Horse mode, big replay value.
- **Boss battle** — boss with HP, each rep deals damage, timed phases. Fits the voice
  pipeline (taunts on hit/phase change).
- **Rhythm mode** — reps must land on a spoken/metronome beat; per-rep timing data and
  the voice pipeline already exist. Trains pacing rather than volume.
