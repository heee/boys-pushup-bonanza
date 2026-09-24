// Kettlebell preset workouts (see docs/kettlebell-mode-plan.md). Pure data —
// adding or tweaking a workout is an edit here only; the Worker validates
// workout ids by shape, not against this list, so no redeploy is needed.
//
// Exercise targets:
//   reps: n        — countdown = n × learned pace (+ buffer); rest screen
//                    prefills n. perSide: true means n already counts both
//                    sides (6/side → reps: 12) and triggers a "switch sides"
//                    cue at the halfway point.
//   kind: "max"    — fixed windowSec; suggested reps = window ÷ learned pace.
//   kind: "hold"   — fixed windowSec; time only, no reps logged.
// bodyweight: true — no weight stepper, contributes reps but no volume.
// bells: 2        — double-bell move; volume counts both bells.

export const KETTLEBELL_EXERCISES = {
  "kb-pushup": { name: "KB Push Up", spoken: "Push ups", paceSec: 2.0, bodyweight: true },
  "kb-halo": { name: "KB Halo", spoken: "Halos", paceSec: 2.5 },
  "kb-curl": { name: "KB Curl", spoken: "Curls", paceSec: 2.5 },
  "row-clean-press": { name: "Row, Clean, Press", spoken: "Row, clean, press", paceSec: 5.0, bells: 2 },
  "goblet-march": { name: "Goblet March", spoken: "Goblet march", paceSec: 1.5 },
  "seated-press": { name: "Seated Shoulder Press", spoken: "Seated shoulder press", paceSec: 2.5 },
  "seated-curl": { name: "Seated Curl", spoken: "Seated curls", paceSec: 2.5 },
  "seated-halo": { name: "Seated Halo", spoken: "Seated halos", paceSec: 2.5 },
  "seated-over-shoulder": { name: "Seated Over-the-Shoulder", spoken: "Seated over the shoulder", paceSec: 2.0 },
  "plank-drag": { name: "North to South Plank Drag", spoken: "Plank drag", paceSec: 3.0 },
  "bear-taps": { name: "Bear Plank KB Taps", spoken: "Bear plank taps", paceSec: 1.5 },
  "side-leg-raises": { name: "Side to Side Leg Raises", spoken: "Side to side leg raises", paceSec: 2.0, bodyweight: true },
  "overhead-situp": { name: "KB Overhead Sit Ups", spoken: "Overhead sit ups", paceSec: 3.0 },
  "iron-trident": { name: "Iron Trident", spoken: "Iron trident", paceSec: 3.0 },
  "plank-pull-through": { name: "Plank Pull Through", spoken: "Plank pull through", paceSec: 3.0 },
  "kb-high-plank": { name: "KB High Plank", spoken: "High plank", paceSec: 1, bodyweight: true },
  "wood-chop": { name: "Half Kneeling Wood Chop", spoken: "Wood chops", paceSec: 2.5 },
  "hollow-flutter": { name: "Hollow Hold + Flutter Kicks", spoken: "Hollow hold, flutter kicks", paceSec: 1, bodyweight: true },
  "hollow-leg-raise": { name: "Hollow Hold + Leg Raises", spoken: "Hollow hold, leg raises", paceSec: 3.0 },
};

export const KETTLEBELL_WORKOUTS = [
  {
    id: "five-alive",
    name: "Five Alive",
    icon: "🖐️",
    tagline: "Five moves, five rounds, one bell-heavy circuit",
    format: "circuit",
    rounds: 5,
    restSec: 15,
    roundRestSec: 60,
    exercises: [
      { exerciseId: "kb-pushup", kind: "max", windowSec: 45 },
      { exerciseId: "kb-halo", reps: 16 },
      { exerciseId: "kb-curl", reps: 12 },
      { exerciseId: "row-clean-press", reps: 6 },
      { exerciseId: "goblet-march", reps: 24 },
    ],
  },
  {
    id: "throne-room",
    name: "Throne Room",
    icon: "👑",
    tagline: "Seated upper-body circuit, six rounds",
    format: "circuit",
    rounds: 6,
    restSec: 15,
    roundRestSec: 60,
    exercises: [
      { exerciseId: "seated-press", reps: 12, perSide: true },
      { exerciseId: "seated-curl", reps: 12 },
      { exerciseId: "seated-halo", reps: 15 },
      { exerciseId: "seated-over-shoulder", reps: 16, perSide: true },
    ],
  },
  {
    id: "core-ten",
    name: "Core Ten",
    icon: "🔟",
    tagline: "Ten minutes, ten core moves, one bell",
    format: "straight",
    rounds: 1,
    restSec: 10,
    roundRestSec: 10,
    exercises: [
      { exerciseId: "plank-drag", kind: "max", windowSec: 60 },
      { exerciseId: "bear-taps", kind: "max", windowSec: 60 },
      { exerciseId: "side-leg-raises", kind: "max", windowSec: 60 },
      { exerciseId: "overhead-situp", kind: "max", windowSec: 60 },
      { exerciseId: "iron-trident", kind: "max", windowSec: 60 },
      { exerciseId: "plank-pull-through", kind: "max", windowSec: 60 },
      { exerciseId: "kb-high-plank", kind: "hold", windowSec: 60 },
      { exerciseId: "wood-chop", kind: "max", windowSec: 60, perSide: true },
      { exerciseId: "hollow-flutter", kind: "hold", windowSec: 60 },
      { exerciseId: "hollow-leg-raise", kind: "max", windowSec: 60 },
    ],
  },
];

export function kettlebellWorkoutById(id) {
  return KETTLEBELL_WORKOUTS.find((workout) => workout.id === id) || null;
}

export function kettlebellExercise(id) {
  return KETTLEBELL_EXERCISES[id] || { name: id, spoken: id, paceSec: 2.5 };
}
