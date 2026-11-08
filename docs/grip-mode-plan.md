# Grip — build plan

## Decisions (confirmed with Henning, 2026-11-08)

- **Placement:** its own exercise Type, **"Grip"**, listed right after Dead hang.
  Stroke icon of a hand gripper.
- **Format:** open-ended count-up session. Start → 3-2-1 → timer runs → big **Stop**.
  A **Switch hand** button logs laps (L / R alternating) along the way.
- **Session screen:** the hand-grip clip loops as decoration (themed:
  `assets/grip/hand-grip-dark.mp4` / `-light.mp4`, same pattern as Kettlebell clips),
  timer, lap list. **No** live squeeze estimate.
- **Count:** `count` = total squeezes for the session (both hands, one number).
  At Stop, the app suggests `round(duration ÷ rate)`; player confirms on a results
  screen with a big number, −1/+1 buttons (long-press repeats), tap number to type.
  Lap times are shown for info only.
- **Learned rate (per player):** seconds-per-squeeze = average of
  `duration ÷ count` over the player's last 5 Grip sessions (every confirmed
  session counts, adjusted or not). No history → **1.5 s/squeeze**. Derived from
  session history, so it follows the player across devices with no extra storage.
- **Record:** most squeezes in a session (PR + confetti). Time/laps not ranked.
- **Audio (voice-lines.js):** start countdown, a short line on each Switch hand,
  time-based encouragement ~every 30 s.
- **Integration (Dead-hang-equivalent):** leaderboard + Board chart bucket, history,
  record + confetti, voice cheers, personal goal (squeezes per
  day/week/month, streak), session detail (incl. lap splits), sharing.
  **Not in v1:** Games / Challenges, Roadtrip territory, recaps. No ghost mode —
  there's no live count to race.
- **Shipped 2026-11-08.** The clip is a right hand, so it's mirrored during left-hand laps.

## Data & Worker

Sessions POST `type: "grip"`, `count` = squeezes, plus `gripDurationSeconds`,
`gripLaps` (array of lap seconds, first lap = left), `gripSuggested` (the estimate
shown). Stored as one JSON column `grip_json` `{ d, l, e }` (Kettlebell-style).

⚠️ **DDL Henning must run** (D1 console): `ALTER TABLE sessions ADD COLUMN grip_json TEXT;`
Worker deploys via the GitHub action; also accepts goal type `grip`.

## Build order

1. Worker: accept `type: "grip"`, validate/store `grip_json`, goal type `grip`.
2. Client plumbing: activity `grip`, label/icon, stats bucket, leaderboard / Board /
   history / session detail / share / goals — wherever `deadhang` is special-cased
   (but rep-style count, not seconds).
3. Rate helper (pure, unit-tested): last-5 average, default 1.5, guards for
   zero/absurd values.
4. Workout screen: video loop, timer, Switch hand laps, Stop → results stepper → save.
5. Voice lines (text; clips generated later with `OPENAI_API_KEY`).
6. Changelog entry, `CACHE_NAME` + asset `?v=` bumps.

## Verification

- `npm test` green incl. rate helper tests.
- Preview (SW unregister + cache clear): run a session with laps, adjust count,
  save; check Board, history, detail, goals, share; second session's suggestion
  reflects the first's corrected rate.
