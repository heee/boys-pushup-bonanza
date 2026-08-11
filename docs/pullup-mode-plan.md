# Pull-ups mode — build plan

## Confirmed product decisions

- Label: **Pull-ups** with the 💪 icon.
- Camera faces the athlete straight-on, like Squats.
- A rep is strict: full dead hang → chin clears the bar → full dead hang.
- Overhand, underhand, and neutral grips all count.
- First release is unassisted and unweighted.
- Pull-ups are an independent activity across PRs, history, stats, leaderboards,
  sharing, session detail, and challenge routing. No scheduled challenges ship yet.
- Calibration movements count. Squats receives the same buffered-replay behavior.

## Capture and counting design

The on-demand `modes/pullup.js` module consumes MediaPipe Pose landmarks. Both
wrists provide a stable proxy for the bar line. It estimates the chin from the
nose-to-mouth scale because the Pose model does not expose a chin landmark.
Shoulder-to-bar distance supplies the per-athlete motion range.

Calibration buffers timestamped frames until it has observed both a straight-arm
hang and chin clearance across a meaningful travel span. The finalized thresholds
are replayed through the production state machine, preserving completed warmup
reps. The state machine only counts hang → top → hang, on the final return to hang.

Feet are not required in frame; reliable visibility of hands, head, shoulders,
elbows, and hips takes priority. Missing upper-body tracking pauses an active set.

## Delivery and verification

- Worker session validation accepts `type: "pullup"`; Worker deployment remains a
  manual Cloudflare Dashboard Quick Edit paste per repository convention.
- Pull-up code is loaded with `import()` and omitted from the app-shell precache.
- Focused tests cover geometry, strict range, partial-rep rejection, dropout
  recovery, calibration replay, session classification, stats, sharing, challenge
  routing, voice corpus, and Worker validation.
- Before preview review: unregister service workers, clear caches, and reload.
- On-device acceptance: each strict rep counts once; bent-arm bottoms and
  chin-below-bar tops do not; calibration reps appear in the live total.
