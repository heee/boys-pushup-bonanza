# Chain of Pain mode — build plan

Modeled on [squat-mode-plan.md](squat-mode-plan.md) and [situp-mode-plan.md](situp-mode-plan.md)
for the per-exercise camera-counting reuse, and on Holland mode (see AGENTS.md
"Development roadmap: Holland mode") for the chained multi-exercise circuit
state-machine pattern — but Chain of Pain's segments are **TIME-driven**
(a fixed duration per exercise), not rep-target-driven like Holland's.

## Decisions (confirmed with Henning, 2026-09-07)

- **Exercise order:** Squats → Push-ups → Planks (3 exercises; crunches
  deliberately excluded from scope for now).
- **Duration:** one duration picked from a fixed picker (30s / 1min / 2.5min /
  5min) applies equally to all 3 exercise segments — no per-exercise custom
  duration.
- **Rest/transition:** a fixed 10-second rest/transition buffer between every
  exercise segment, including wrapping from Planks back to Squats when
  starting a new cycle, with a visible countdown UI, so the boy can
  reposition the phone for the next exercise's camera angle.
- **Rep counting:** Squats and Push-ups use camera-based rep counting reusing
  the existing detection/threshold math (squat: pose hip-Y, same as the
  standalone Squat screen; pushup: face-size ratio against the already-
  calibrated Settings thresholds, same as Holland's pushup segment — no
  reinvented detection). Planks are a timer-only hold, no rep counting, same
  as Plank mode itself (which has no camera at all).
- **Forced advance:** when a segment's timer expires, it force-advances to
  the rest/transition regardless of current rep count — whatever was counted
  stands.
- **Cycle / stop behavior:** runs continuously, looping Squats→Push-ups→
  Planks→(rest)→Squats→... until the boy taps Stop/Finish. No fixed end
  condition, no difficulty tiers beyond the duration picker. A "cycle" = one
  full pass through all 3 exercises.
- **Partial-cycle credit uses SEGMENT granularity:** each fully-completed
  exercise segment (i.e. its timer ran out) = 1/3 cycle credit, a continuous
  fractional value — segment-granular rather than rep-granular (unlike
  Holland's rep-granular normalized cycles). E.g. stopping mid-plank after
  completing squats+push-ups = 0.7 cycles; stopping mid-squat on cycle 2
  after one full cycle = 1.0 (the in-progress segment earns no credit).
- **No milestone/achievement** (unlike Holland's "Holland 27") — kept simple.
- **Summary screen:** total cycles (one decimal, e.g. "3.7 cycles"), reps per
  exercise (squats total, push-ups total; planks shows total hold time
  instead of reps), and a personal-best callout if the boy beat his prior
  best cycle count. Mirrors Squat/Situp's summary structure, with the
  missed-reps +/- adjuster applied per rep-counted exercise (squats,
  push-ups) — planks has no adjuster since there's nothing to miscount.
- **Session storage:** new session `type: "chainofpain"`. Mirrors Holland's
  convention (`hollandCycles`/`hollandPullups`/etc.) rather than Pulse's
  seconds-as-`count` convention: `chainOfPainSquats`, `chainOfPainPushups`,
  `chainOfPainPlankSeconds` (component totals), `chainOfPainCycles` (the
  continuous fractional cycle value, sortable stat for leaderboard/best),
  `chainOfPainSegments` (raw count of fully-completed segments),
  `chainOfPainDurationSeconds` (the picked per-segment duration). `count` is
  `chainOfPainSquats + chainOfPainPushups`, same pattern as Holland's `count`
  being the raw aggregate reps.
- **Leaderboard:** new Chain of Pain tab in `LEADERBOARD_MODE_OPTIONS`,
  sorted by `chainOfPainCycles` descending — `getChainOfPainBest` mirrors
  `getHollandBest` exactly.
- **Entry point:** visible tile/button in Explore Modes' "Other exercises"
  bucket, alongside Squat/Situp/Holland/Plank — no hidden unlock gate.
- **Voice lines:** full pack in voice-lines.js — `CHAINOFPAIN_START_LINES`,
  `CHAINOFPAIN_CHEER_LINES`, `CHAINOFPAIN_RECORD_LINE`,
  `FUN_MESSAGES_CHAINOFPAIN` — drill-instructor register matching
  `CHASE_CHAOS_LINES`, leaning on chain/link/forge/relentless-circuit
  imagery (it's three exercises welded together) plus squat/pushup/plank
  imagery.

## State machine — `modes/chain-of-pain.js`

Pure module, no DOM/camera/storage (mirrors `modes/holland.js`'s separation
of concerns):

- `CHAIN_OF_PAIN_EXERCISE_ORDER` = `["squat", "pushup", "plank"]`.
- `CHAIN_OF_PAIN_DURATIONS` — the 4 fixed picker options (id/seconds/label).
- `CHAIN_OF_PAIN_REST_SECONDS` = 10.
- `chainOfPainCreateState(durationSeconds)` — `segmentIndex`, `phase`
  (`"segment"` | `"rest"`), `segmentsCompleted`, `segmentReps` (current
  segment's reps, or elapsed seconds for plank), `totals`
  (`{ squat, pushup, plankSeconds }`), `lastSegment` (transition-screen
  snapshot).
- `chainOfPainRecordReps`/`chainOfPainApplyCorrection` — squat/pushup only,
  no upper cap (time-driven, not target-driven, unlike Holland's capped
  `hollandRecordReps`); clamped at 0.
- `chainOfPainTickPlank` — plank-only per-second accumulator.
- `chainOfPainSegmentExpired`/`chainOfPainRestExpired` — elapsed-ms
  comparisons the DOM layer's own timer drives (the module stays pure —
  callers pass elapsed ms, it doesn't own real time).
- `chainOfPainCompleteSegment` — force-advance on timer expiry: credits one
  segment regardless of rep count, moves to `"rest"` phase.
- `chainOfPainAdvanceFromRest` — moves to the next exercise, wrapping
  plank → squat to start a new cycle.
- `chainOfPainCycles` = `segmentsCompleted / 3` — continuous, segment-
  granular fractional value.
- `chainOfPainBuildSession` — canonical session shape.
- `chainOfPainComponentSessions` — projects a Chain of Pain session's
  component reps/seconds into squat/pushup/plank aggregations, mirroring
  `hollandComponentSessions` (used by `stats.js`'s `expandHollandProjections`
  and the session index in app.js).

## Screen & flow

1. **Entry:** Explore Modes "Other exercises" bucket
   (`screens/explore-modes.js`).
2. **Idle screen** (`screen-chainofpain-workout` → `#chainofpain-idle`):
   duration picker (4 cards, mirrors Holland's difficulty cards), personal
   best readout, Start.
3. **Workout screen** (`#chainofpain-in-progress`): camera preview (hidden
   during plank — Plank mode has none either), HUD chips (duration label,
   cycles so far, segment/rest countdown), a cal-stage (squat's one-time
   auto-warmup, reusing `estimateSquatRange`/`deriveSquatThresholds`/
   `squatCalibrationValid` from `modes/squat.js`), a count-stage (rep count
   or plank hold time + missed-rep correction row, hidden for plank), and a
   rest-stage (countdown + "Skip rest" button + next-exercise hint).
4. **Camera reuse:** squat segments use the same pose-tracking pipeline
   (`squatHipY`/`squatBodyBBox`, already defined in app.js for the
   standalone Squat screen) the standalone Squat mode and Holland's squat
   segment use; pushup segments reuse the app's own face-tracking pipeline
   and already-calibrated Settings thresholds (no per-session warmup, same
   as Holland's pushup segment); plank segments have no camera at all.
5. **Record:** per-user best via `getChainOfPainBest(name)` mirroring
   `getHollandBest` (`bestFor(indexedSessionsForUser(name, "chainofpain"),
   name, () => true, "chainOfPainCycles")`).
6. **Summary:** cycles (one decimal), per-exercise breakdown line, personal-
   best badge, and two missed-rep +/- adjusters (squats, pushups) that patch
   the already-committed session (delete + recreate on the Worker, same
   pattern the generic missed-reps adjuster uses, since `/session` only
   inserts).

## Data & Worker (⚠️ manual dashboard step)

Sessions POST with `type: "chainofpain"`. Worker validates and derives
`chainOfPainCycles` server-side from `chainOfPainSegments / 3` (not
client-trusted, same pattern as `hollandCycles`), and enforces
`chainOfPainSquats + chainOfPainPushups === count` (aggregate consistency,
same as Holland's pullup+pushup+squat === count rule). Doc-comment at the
top of `worker/index.js` updated. Backward-compatible (new type only) — no
D1 schema change needed since sessions are stored as JSON blobs, same as
Holland's fields.

**Deploy order:** paste the updated `worker/index.js` into the Cloudflare
dashboard (Quick Edit — no wrangler on this machine) as soon as this build's
report flags it, since the live app updates on push.

## Voice lines

`CHAINOFPAIN_START_LINES` (3), `CHAINOFPAIN_CHEER_LINES` (8),
`CHAINOFPAIN_RECORD_LINE`, `FUN_MESSAGES_CHAINOFPAIN` (6) — text only.
Generation (`node scripts/generate-voice.js`, needs `OPENAI_API_KEY`) was not
run in this build (no key available in this environment) — these lines fall
back to `speechSynthesis` until Henning runs it himself and commits
`assets/voice/`.

## Verification checklist

- `node --test` green (chain-of-pain-mode unit tests, voice resolution
  coverage, explore-modes ordering).
- SW ritual: unregister + clear caches before every preview check;
  `CACHE_NAME` and `?v=` params bumped in this shipping commit.
- On-device (Henning, follow-up): a full circuit at each duration option
  counts squats/pushups accurately, plank hold ticks once per second, rest
  countdown auto-advances (and "Skip rest" works), partial-cycle math
  matches the confirmed examples, session appears in history + Session
  detail + leaderboard tab, Chain of Pain best independent of
  squat/pushup/plank/Holland stats, voice lines fall back to speechSynthesis
  until voice generation is run.
- `git fetch` + check `origin/main` before push (live data commits).
