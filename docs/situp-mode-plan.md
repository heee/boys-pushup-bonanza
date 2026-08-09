# Situp mode — build plan

Modeled on [squat-mode-plan.md](squat-mode-plan.md); executed by a handed-off agent,
with Henning's manual steps called out explicitly.

## Decisions (confirmed with Henning, 2026-08-09)

- **Scope:** mirror the Squat template — its own screen next to Plank/Squat, free-set
  format (count until the boy stops), per-user best, own stats bucket, minimal
  integration with pushup modes/leaderboards.
- **Capture:** camera auto-count. Phone propped at the boy's feet (against wall/couch),
  facing him, ~1–1.5 m from his face at the top of the rep.
- **Calibration:** automatic warmup, no taps — thresholds derive from the first couple
  of reps, reusing the squat warmup pattern (`estimateSquatRange`/`tickSquatWarmup`).
- **Voice:** full new situp-specific line pack, highly unhinged, pre-rendered for every
  preset. Generation needs `OPENAI_API_KEY` at runtime — provided by Henning as an env
  var when that step runs; the key must never be written to any file, commit, or doc.
- **Not included:** weighted profiles (squat-only concern), shared leaderboard modes.

## Capture design — inverted face-size signal

Pushups: `faceBBox.height / videoHeight` (face size) rises on the way down. Situps with
the phone at the feet are the mirror image: the face is **large at the crunch top**
(close to camera) and **small or undetected lying flat** (far, tilted at the ceiling).

To keep `createRepCounter()`'s "ratio rises on the way down" contract AND make the rep
fire at the crunch top (where the spoken number feels right), feed it an **inverted
ratio**: `1 − normalizedFaceSize`. Lying back → ratio high ("down" phase); crunching up
→ ratio falls through the `up` threshold → rep counts at the top.

**Face dropout is signal, not noise:** a face lost while lying flat is expected — clamp
the ratio to its lying-back value on undetected frames (with a short debounce so a
single missed frame mid-rep doesn't fake a full lie-back). This turns the model's known
weakness at flat angles into a robust "he's down" indicator.

Reuse as-is: `createCameraController()` (camera.js, already parameterized),
`createRepCounter()` (rep-counter.js), `blaze_face_short_range` (rated ~2 m; feet
distance is well inside it). Pose Landmarker is plan B only if the spike shows the face
also drops out near the top of the rep.

### Phase 0 — capture spike (⚠️ Henning on-device)

Mirror the squat spike: a temporary Settings → Calibration "Situp capture test" row with
the existing ring-buffer + "download trace" pattern, logging
`{t, bboxHeight, centerY, detected, inferenceMs}`.

**Manual step:** Henning props the phone at his feet, does ~10 situps at a comfortable
distance, downloads traces. Go/no-go: face detected in ≥90 % of frames in the upper
half of the motion; clean bimodal size signal; dropouts confined to the lying-flat
portion. If the face also vanishes near the top, fall back to Pose Landmarker (nose
landmark distance) like squats did.

The agent builds the spike row + replay tests up front but does **not** block on the
traces — the signal shape is well understood from pushups/squats, so the full build
proceeds and traces validate/tune thresholds before ship is declared done.

### Calibration — auto-warmup

Copy the squat warmup: rolling sample window while the boy does his first reps,
10th/90th percentile → crunch-top / lying-back sizes, thresholds at 35 %/65 % of the
span (`deriveSquatThresholds` math generalizes; extract or mirror into
`modes/situp.js`). Undetected frames during warmup contribute the clamped lying-back
value. Reject with a "Move the phone closer to your feet" hint if the swing is below a
`SITUP_MIN_SWING` floor (start at 0.10 of frame height, tune from traces). Same warmup
guards as squats (min ms, min/max samples, hint timer).

## Screen & flow (mirror Squat's screen)

1. **Entry:** visible tile next to Squat/Plank on the home screen (`explore-modes` and
   dashboard entry points — match wherever Squat surfaces).
2. **Workout screen** (`screen-situp-workout`): camera preview, giant rep count, phase
   indicator, Stop button, wake lock, `unlockVoice()` inside the Start tap.
3. **Rep feedback:** spoken numbers from the existing clip pack; cheers with the same
   `cheerProbability` shape, pulling from the new situp lines.
4. **Record:** per-user best via `getSitupBest(name)` mirroring `getSquatBest`
   (`bestFor(indexedSessionsForUser(name, "situps"), …)`). Record-break: celebration
   line + confetti.
5. **Summary:** rep count with the +/- missed-reps adjuster, then save.

## Data & Worker (⚠️ manual dashboard step, ships FIRST)

Sessions POST with `type: "situp"`, `count` = reps, same optional `location`/`startedAt`
as plank/squat. Worker change: accept `body.type === "situp"` in the type validation
(worker/index.js — same shape as the squat addition) and update the file's doc-comment.
Backward-compatible (new type only).

**Deploy order:** the Worker commit lands first and Henning pastes `worker/index.js`
into the Cloudflare dashboard (Quick Edit) **as soon as the agent's report flags it** —
before the boys can reach the new screen. Client-side: new `situps` bucket in
`byActivity`, session history/detail render situp sessions with their own marker
(follow the squat 🏋️ pattern).

## Voice lines

1. New exports in voice-lines.js: `SITUP_START_LINES` (~3), `SITUP_CHEER_LINES` (~8),
   `SITUP_RECORD_LINE`, `FUN_MESSAGES_SITUP` (~6, template style). Tone: highly
   unhinged drill-instructor (see `CHASE_CHAOS_LINES` register). Situp imagery: abs,
   crunches, the ceiling he keeps staring at, sitting up so hard the couch is jealous,
   ab-dominal authority, etc.
2. **Manual step:** `node scripts/generate-voice.js` with `OPENAI_API_KEY` in the env,
   for every preset; commit clips + manifests. Until run, new lines fall back to
   `speechSynthesis` — flagged in the agent's report as pending.
3. Extend voice resolution test coverage for a sample of new lines.

## Build order

1. **Worker change** (commit + push first; Henning pastes to dashboard immediately).
2. **Capture spike row** + replay-test harness (`tests/situp-counter.test.js`) with
   synthetic traces; real traces from Henning tune thresholds later.
3. **`modes/situp.js`** (inverted-ratio mapping, clamp/debounce, warmup estimation,
   threshold derivation) + unit tests.
4. **Voice lines** (text + tests; generation deferred to Henning's key).
5. **Screen + flow + save path + entry tile** (tile ships in this final step so nothing
   is reachable before the Worker paste).
6. **Verification** below, then ship.

## Verification checklist

- `node --test tests/` green (situp counter replay, warmup, voice resolution).
- SW ritual: unregister + clear caches before every preview check; bump `CACHE_NAME`
  and `?v=` params in every shipping commit.
- Preview: workout screen renders, warmup hint shows, Stop → summary → save path posts
  `type: "situp"`, history/detail show the situp marker, per-user best independent of
  plank/squat/pushup stats.
- On-device (Henning): 15-situp set counted ±1; deliberate half-crunches do NOT count;
  face-dropout while lying flat does not double-count; record line fires.
- `git fetch` + check `origin/main` before every push (live data commits).

## Post-build manual steps for Henning (agent lists these in its report)

1. Paste updated `worker/index.js` into Cloudflare dashboard Quick Edit.
2. Run the capture test on-device, download traces, confirm go/no-go (agent or a
   follow-up session tunes thresholds from them if needed).
3. Run voice generation with `OPENAI_API_KEY`; commit `assets/voice/` + manifests.
