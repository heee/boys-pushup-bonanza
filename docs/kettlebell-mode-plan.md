# Kettlebell workouts — build plan

Decisions confirmed with Henning, 2026-09-24. Executed by a handed-off agent, with
Henning's manual steps called out explicitly.

## Decisions

- **Scoring:** timer-driven, **no camera**. Reps are user-confirmed (self-reported), so
  kettlebell data never mixes into camera-verified rep totals/leaderboards.
- **Placement:** new third section **"Kettlebell"** on Choose your mode
  (`screens/explore-modes.js`, alongside "Pushups" / "Other exercises"), one card per
  preset workout.
- **Presets only** (no in-app builder in v1), stored as a config module. Henning
  supplies workouts; v1 ships exactly two (below).
- **Format per workout:** `circuit` (round-robin through all exercises, N rounds) or
  `straight` (all sets of one exercise, then the next). Rest is per workout:
  `restSec` between exercises/sets, `roundRestSec` between circuit rounds.
- **Solo** — one user per session.
- **Weight:** tracked per exercise, remembered per user, **lb, plain 5 lb steps**.
  Double-bell moves record `bells: 2` (volume counts both). Bodyweight moves
  (KB Push Up) have no weight — reps only, no volume contribution.
- **Headline result:** total **volume** (Σ reps × weight × bells).
- **Stats:** counts toward daily streak + session history; own totals (not added to
  pushup/squat/etc. totals or goals); new Kettlebell dashboard card (volume this
  week / all-time, best volume per workout, Boys Bonanza volume by person).
- **Voice:** full coaching via `voice-lines.js`.

## Flow

1. **Preview screen** (card tap) — ordered list of the sequence: exercise, target
   reps, estimated duration, weight stepper (last-used, ±5 lb) per exercise; format,
   rounds, rest; optional "go heavier" nudge chips; **Start**.
2. **Active screen** — exercise name, round X/N, target reps, weight, big countdown.
   **Done** button ends the set early (records actual elapsed time). Countdown hitting
   0 also ends the set. `/side` exercises get a "switch sides" voice cue at halfway.
3. **Rest screen** — countdown of `restSec` (or `roundRestSec` after the last exercise
   of a circuit round); reps just completed prefilled with the suggestion, **+/-**
   stepper (reuse the Chain of Pain rest-stage correction pattern, commit 2b987ef);
   "Next: …" preview; **Ready** skips the rest.
4. Repeat until done → **Summary** — volume hero, per-exercise table (reps, weight vs.
   last run of the same workout, ▲/▼, PR badge).

## Timing & learning

- **Countdown** for a rep set = `targetReps × paceSec(user, exercise, weight)`, rounded
  up to whole seconds plus a small buffer (~10 %). Rep ranges use the **top** of the
  range (e.g. 8–12 → 12). `/side` targets count both sides (6/side = 12 reps).
- **Max sets** use a fixed window (`maxWindowSec`, 45 s for Five Alive); the suggested
  reps = window ÷ learned pace (or recent actuals).
- **Suggested reps** on the rest screen = target reps (or the Max estimate). The user
  adjusts to actual.
- **Pace learning:** each completed set yields `elapsedSec / actualReps` (elapsed = Done
  tap time, or full window if the timer ran out). Keep an exponential moving average
  per user × exercise × weight; seed from the exercise's default pace; fall back to
  the nearest known weight, then default.
- **Go-heavier nudge:** if the user hit the target (top of range) in **every** set of an
  exercise at a weight, the next preview suggests **+5 lb** for that exercise. Just a
  suggestion — no auto-change. Rep targets never auto-change.

## v1 workouts

### Five Alive — circuit × 5, rest 15 s, 60 s between rounds

| # | Exercise | Target | Notes |
|---|---|---|---|
| 1 | KB Push Up | Max (45 s window) | bodyweight, hands on bells — no volume |
| 2 | KB Halo | 16 | |
| 3 | KB Curl | 12 | |
| 4 | Row, Clean, Press | 6 | double bell (`bells: 2`); 1 rep = row+clean+press |
| 5 | Goblet March | 24 | |

### Throne Room — circuit × 6, rest 15 s, 60 s between rounds (all seated)

| # | Exercise | Target | Notes |
|---|---|---|---|
| 1 | Seated Shoulder Press | 6/side (12) | source range 5–6/side |
| 2 | Seated Curl | 12 | source range 8–12 |
| 3 | Seated Halo | 15 | |
| 4 | Seated Over-the-Shoulder | 8/side (16) | source range 6–8/side |

Default paces (seed only, tune freely): push-up 2.0 s, halo 2.5 s, curl 2.5 s,
row-clean-press 5.0 s, goblet march 1.5 s, seated press 2.5 s, seated over-the-shoulder
2.0 s.

## Data model

Config (`kettlebell-workouts.js`):

```js
{ id: "five-alive", name: "Five Alive", format: "circuit", rounds: 5,
  restSec: 15, roundRestSec: 60,
  exercises: [
    { id: "kb-pushup", name: "KB Push Up", target: "max", maxWindowSec: 45, bodyweight: true },
    { id: "kb-halo", name: "KB Halo", target: 16 },
    { id: "row-clean-press", name: "Row, Clean, Press", target: 6, bells: 2 },
    ...
  ] }
```

Session (`type: "kettlebell"`): `count` = total reps; `kettlebellWorkoutId`;
`kettlebellVolumeLbs`; `kettlebellDurationSeconds`; `kettlebellSets` = JSON array of
`{ exerciseId, round, targetReps, suggestedReps, actualReps, weightLbs, bells,
elapsedSec }`. Keeping `suggestedReps` vs `actualReps` preserves the raw learning
signal for later tuning.

Local per-user state (localStorage, same pattern as `getSquatWeightedProfiles`):
last weight per exercise; pace EMA per exercise × weight.

## Build steps

1. `kettlebell-workouts.js` config + pure logic module `modes/kettlebell.js`
   (sequence expansion for circuit/straight, countdown math, pace EMA, suggestion,
   nudge, volume) with unit tests in `tests/`.
2. Explore-modes: third "Kettlebell" section, one card per workout.
3. Screens: preview, active, rest (reuse Chain of Pain rest-stage stepper), summary.
   Wake lock acquired **before** the first countdown (see CLAUDE.md note on
   `startX()` ordering).
4. Voice lines in `voice-lines.js`: exercise names, "Round N", target numbers,
   "3, 2, 1", "Rest", "Next: …", "Switch sides", finish + volume line. Run
   `node scripts/generate-voice.js` (needs `OPENAI_API_KEY`) and commit `assets/voice/`.
5. Session save + sync; stats: streak/history inclusion, excluded from rep totals and
   goals, new Kettlebell dashboard card incl. Boys Bonanza volume comparison.
6. Worker: accept `type: "kettlebell"` + the fields above (validate: known workout id,
   nonnegative integers, sets array shape/length cap).
7. Bump `sw.js` `CACHE_NAME`; verify every screen against this spec on a cache-busted
   reload.

## ⚠️ Henning's manual steps

- **D1 schema (DDL — the MCP connection can't run it):** add columns, e.g.
  `ALTER TABLE sessions ADD COLUMN kettlebell_workout_id TEXT;`
  `ALTER TABLE sessions ADD COLUMN kettlebell_volume_lbs INTEGER;`
  `ALTER TABLE sessions ADD COLUMN kettlebell_duration_seconds INTEGER;`
  `ALTER TABLE sessions ADD COLUMN kettlebell_sets TEXT;`
  (exact statements finalized by the build agent against the live schema).
- **Worker redeploy:** paste updated `worker/index.js` into Cloudflare Quick Edit.
- **Voice generation:** provide `OPENAI_API_KEY` as an env var when step 4 runs.

## Out of scope (v1)

Camera counting, in-app workout builder, group sessions, bell-inventory settings,
bodyweight-as-volume for push-ups, auto-progressing rep targets.
