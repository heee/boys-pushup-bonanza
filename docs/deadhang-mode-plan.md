# Dead hang — build plan

## Decisions (confirmed with Henning, 2026-10-27)

- **Placement:** its own exercise Type, **"Dead hang"**, listed right after Pull-ups.
  Stroke icon of hands on a bar.
- **Format:** one hang = one session, timed like Planks. `count` = seconds hung.
  Records: longest single hang (PR) and total time hung.
- **Timing — user's choice, per session:** a Camera / Manual toggle on the Dead hang
  start screen, remembered per device.
  - **Manual:** Start → 3-second countdown to get on the bar → clock runs → big Stop.
  - **Camera:** reuses the Pull-ups Pose pipeline (`modes/pullup.js` geometry). The
    clock starts once a hang is seen (wrists above head, arms roughly straight) and
    stops on a drop, touch-down, arm bend, or pull-up — with a 1 s grace window so a
    brief wobble or missed frame doesn't end the set. Any grip counts.
- **Fairness:** camera- and manually-timed hangs count the same on every board; no tag.
- **Integration (Planks-equivalent):** leaderboard + Board chart bucket, history,
  record + confetti on a new best, ghost mode (race your last hang), voice cheers,
  personal goal (time per day/week/month, streak), session detail, sharing.
  **Not in v1:** Games / Challenges modes.

## Data & Worker (⚠️ manual dashboard paste)

Sessions POST `type: "deadhang"`, `count` = seconds, same optional `location` /
`startedAt` as plank. Worker accepts the new type and the new `deadhang` goal type.
No D1 schema change (type is a free string column). Henning pastes `worker/index.js`
into the Cloudflare dashboard before the entry point is used.

## Build order

1. Worker: accept `type: "deadhang"` and goal type `deadhang`.
2. Client plumbing: activity id `deadhang` (type `deadhang`), labels/icon, stats bucket,
   leaderboard / Board / history / session detail / share / goals — following every
   place `planks` is special-cased as a timed activity.
3. Workout screen with the Camera / Manual toggle; manual timing first (fully testable
   in preview).
4. Camera hang detector (`modes/deadhang.js`): pure geometry + state machine with the
   grace window, unit-tested on synthetic landmark traces; tuned on-device.
5. Voice lines (text; clips generated later with `OPENAI_API_KEY`).

## Verification

- `npm test` green, including the hang detector's state machine tests.
- Preview: SW unregister + cache clear; manual hang saves and shows everywhere Planks
  shows (Board, history, detail, goals, share).
- On-device (Henning): camera starts/stops on real hangs; tune thresholds from that.
