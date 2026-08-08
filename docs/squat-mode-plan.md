# Squat mode — build plan

## Decisions (confirmed with Henning)

- **Scope:** bonus mode alongside Plank — its own screen, per-user best, minimal integration
  with pushup modes/leaderboards.
- **Discovery:** visible from the start (no hidden unlock).
- **Capture:** camera auto-count. Phone propped against a wall, boy stands ~1.5–2.5 m back.
- **Session format:** free set — count until the boy stops; best-ever reps is the record.
- **Voice:** new squat-specific lines, highly unhinged, added to the pre-rendered pack.
  Voice generation (`scripts/generate-voice.js`, needs `OPENAI_API_KEY`) is run by the
  session driving this plan — the key is provided at runtime as an env var and must never
  be written to any file, commit, or this doc.

## Capture design — reuse the pushup pipeline with a different signal

Pushups: MediaPipe FaceDetector → `faceBBox.height / videoHeight` (face size = distance from
floor). Squats: same detector, but the signal is **face vertical position** —
`bboxCenterY / videoHeight` (0 = top of frame). Standing → face high (small value); at depth →
face drops (large value). Same monotonic "ratio rises on the way down" shape as pushups, so
[rep-counter.js](../rep-counter.js) `createRepCounter()` works unchanged — only thresholds
differ. [camera.js](../camera.js) `createCameraController()` is already fully parameterized
(model URL, callbacks) and is reused as-is.

### Phase 0 — on-device feasibility spike (before building the screen)

Build the capture loop first, behind a temporary Settings → Calibration "Squat capture test"
row (mirroring the pushup trace tooling):

1. Instantiate a second camera controller with the existing
   `blaze_face_short_range` model, front camera, portrait.
2. Log `{t, centerY, bboxHeight, inferenceMs}` to a ring buffer with the existing
   "download trace" pattern.
3. Henning props the phone against a wall, does 10 squats at ~1.5 m and ~2.5 m, downloads
   traces.
4. **Go/no-go:** face detected in ≥90 % of frames at 1.5–2 m and centerY swing ≥ 0.15 of
   frame height. Known risk: the short-range BlazeFace model is rated to ~2 m; if detection
   drops out at distance, the calibration screen tells the boy to stand closer (preferred)
   — MediaPipe's tasks-vision FaceDetector has no drop-in full-range model, and Pose
   Landmarker (plan B) is a much heavier model, so only go there if closer doesn't work.
5. Add replay tests: feed recorded traces through `createRepCounter` with squat thresholds
   in a new `tests/squat-counter.test.js`, same harness style as the pushup replay tests.

### Calibration

Wall-tilt makes absolute thresholds room-dependent, so calibrate per session start (cheap,
2 taps):

- Start screen shows the camera preview with a face indicator. Step 1 "Stand tall" —
  capture 1.5 s median centerY. Step 2 "Hold a squat" — capture 1.5 s median. Derive
  `down = standY + 0.65·(squatY − standY)`, `up = standY + 0.35·(squatY − standY)`.
- Persist last calibration in `localStorage` (`bpb-squat-cal`) and offer "Use last
  calibration" to skip straight to the set.
- Reject calibration if the swing is < 0.10 of frame height ("Stand closer to the phone").

## Screen & flow (mirror Plank's structure)

1. **Entry:** visible tile/button next to the Plank entry point on the home screen.
2. **Workout screen** (`screen-squat-workout`): camera preview (small), giant rep count,
   phase indicator, Stop button. Wake lock like pushups. `unlockVoice()` inside the Start
   tap (matches [app.js:5733](../app.js:5733) pattern).
3. **Rep feedback:** spoken numbers reuse the existing clip pack; cheers fire with the same
   `cheerProbability` shape Plank uses, pulling from the new squat lines.
4. **Record:** per-user best via a `getSquatBest(name)` mirroring
   [`getPlankBest`](../app.js:3994) (`bestFor(indexedSessionsForUser(name, "squats"), …)`).
   Record-break: celebration line + confetti, same as Plank's record moment.
5. **Summary:** rep count with the same +/- missed-reps adjuster pushups have, then save.

## Data & Worker (⚠️ manual dashboard step, must ship FIRST)

Sessions save through the existing session POST, with `type: "squat"`, `count` = reps.
**The Worker validates `type` and only knows `"plank"`** ([worker/index.js:327](../worker/index.js:327)) — an
unknown type falls through to the pushup branch. Required Worker change: accept
`body.type === "squat"` (store `type: "squat"`, `count` as integer reps, same optional
`location`/`startedAt` fields as plank). Update the doc-comment at the top of the file
(worker/index.js:10).

Deploy order: Henning pastes the updated `worker/index.js` into the Cloudflare dashboard
(Quick Edit — no wrangler on this machine) **before** the client change is pushed, since the
live app updates on push. The Worker change is backward-compatible (new type only).

Client-side reads: `indexedSessionsForUser(name, "squats")` bucket, session history/detail
screens should render squat sessions with a 🏋️ (or similar) marker — check the Session
detail screen added in `987aa6d` for where type-specific labels live.

## Voice lines

1. Add to [voice-lines.js](../voice-lines.js), following existing export patterns:
   - `SQUAT_START_LINES` (~3), `SQUAT_CHEER_LINES` (~8), `SQUAT_RECORD_LINE`,
     `FUN_MESSAGES_SQUAT` (~6, template style like `FUN_MESSAGES_PLANK`).
   - Tone: highly unhinged, matching the existing drill-instructor energy (see
     `CHASE_CHAOS_LINES` for the register). Squat-specific imagery: thighs, chairs that no
     longer deserve them, the floor, elevators filing complaints, etc.
2. Run `node scripts/generate-voice.js` with `OPENAI_API_KEY` set in the environment for
   **every voice preset** (each preset has its own dir under `assets/voice/`), commit the
   new clips + updated manifests.
3. Any line not yet generated falls back to `speechSynthesis` automatically — but the goal
   is zero fallback at ship time.
4. Extend `tests/voice.test.js` resolution coverage for a sample of the new lines.

## Build order

1. **Worker change** → Henning pastes to dashboard, verify with a manual `type:"squat"`
   POST (curl) that it round-trips.
2. **Phase 0 spike** (capture test row + trace download + replay tests) → on-device go/no-go.
3. **Voice lines** + generation run + commit assets.
4. **Screen + flow + calibration + save path.**
5. **Verification** (below), then ship.

## Verification checklist

- `node --test tests/` green (replay + voice resolution tests).
- SW ritual: unregister + clear caches before every preview check; bump `CACHE_NAME` and
  `?v=` params in every shipping commit; new voice assets reachable offline after one
  online play (SW runtime-caches them like existing clips).
- On-device: wall-propped set of 15 squats counted 20/20-style accuracy (±1) at
  comfortable distance; deliberate half-squats do NOT count; record-break line fires;
  session appears in history + Session detail; squat best independent of plank/pushup
  stats; voice lines play as clips (not robotic speechSynthesis).
- Podcast interplay: voice route releases ~12 s after the set ends (Phase 1 of
  docs/podcast-voice-mixing-plan.md applies to squat speech automatically since it goes
  through the same voice.js pipeline).
- `git fetch` + check `origin/main` before push (live data commits).
