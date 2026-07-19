# Pushup Capture Optimization Plan

> **Status: EXECUTED** (Phases 0, 1, 3 — see commit history). Implementation notes:
> - Pure counter `createRepCounter()` in app.js (between `REP_COUNTER_START/END` markers) — replay-testable in Node.
> - Chosen algorithm: raw-threshold hysteresis with prev-sample confirmation (`confirmMs = 80`) instead of median-of-3 — median failed replay tests at degraded (10 Hz) sample rates and across face-lost gaps. Single-frame glitches still rejected at 30 fps; single-sample crossings accepted when inter-sample gap > 80 ms.
> - Sampling: `minIntervalMs` 100 → 25 (~30 fps). GPU delegate with CPU fallback at init + runtime rebuild after 10 consecutive detect failures.
> - Debounce `minMsBetweenReps = 280`. Rep side effects deferred via `setTimeout(0)`; number speech skipped at sprint pace (every 5th rep only) — cheers/records always speak.
> - Trace ring buffer (~2 min) + "Download last workout trace" button in Settings → Calibration.
> - Replay results: old EMA algo 0–1/20 reps counted on synthetic fast traces; new counter 20/20 across fast/very-fast/normal/slow/shallow + glitch/noise/gap edge cases.
> - Phase 2 (adaptive thresholds) intentionally NOT implemented — revisit only if real-world traces still show misses.

**Problem:** Fast pushups are sometimes not counted. User-confirmed symptom: reps done "too quickly" get missed (this is why the missed-reps +/- adjuster exists on the summary screen).

**Scope:** Plan only — execution is for a follow-up session. All code references are to `app.js` at commit `8534798`.

---

## How capture works today

1. `startDetectionLoop()` (app.js ~2099) samples the camera via `requestVideoFrameCallback` (fallback rAF), but throttles processing to **one detection per 100 ms** (`minIntervalMs = 100`) → effectively ≤10 samples/sec.
2. `runDetectionOnce()` (~2080) runs MediaPipe FaceDetector (**CPU delegate**, app.js ~1863) on the frame and computes `ratio = faceBBox.height / videoHeight` (bigger face = closer to floor = "down").
3. `processRatio()` (~2019) smooths with an EMA: `smoothed = 0.7·prev + 0.3·raw`.
4. A two-threshold hysteresis state machine counts reps: phase `up→down` when `smoothed ≥ 0.55` (`DEFAULT_DOWN`), then `down→up` counts a rep when `smoothed ≤ 0.32` (`DEFAULT_UP`).
5. `onRepCounted()` (~2053) updates DOM, speaks (`speechSynthesis.cancel()` + new utterance), vibrates.

## Root-cause hypotheses (ranked)

### H1 — EMA smoothing × 10 Hz throttle attenuates fast reps (primary)
With α = 0.3 at 10 Hz, the EMA time constant is ≈ 280 ms. A fast rep spends maybe 200–300 ms near each extreme, so the smoothed signal only travels ~50–65 % of the way toward the raw extreme before the movement reverses. If raw ratio swings 0.28 ↔ 0.62, smoothed may peak at ~0.48 — never reaching the 0.55 down-threshold — and the rep is silently ignored. This exactly matches "fast reps don't count."

### H2 — Effective sample rate is too low
≤10 samples/sec gives only ~2–3 samples inside each extreme of a fast rep. Combined with detection latency, extremes can fall between samples. CPU-delegate inference on a phone can take 30–60 ms/frame, further reducing real throughput and adding jitter.

### H3 — Wide fixed hysteresis band
0.32↔0.55 defaults require a large face-size swing. Users with shallower fast reps (or phone slightly farther from face) won't fully cross both thresholds. Thresholds are user-calibratable but static during a session.

### H4 — Main-thread jank around each counted rep (secondary)
`speechSynthesis.cancel()` + utterance per rep, DOM writes, confetti at record — all on the main thread that also runs detection. Jank after rep N can eat the samples of rep N+1. Likely a contributor, not the core bug.

---

## Plan

### Phase 0 — Instrumentation first (do this before changing behavior)
1. Add a ring buffer (e.g. last 120 s) of `{t, rawRatio, smoothedRatio, phase, inferenceMs}` recorded inside `processRatio()`/`runDetectionOnce()`.
2. When the existing calibration-readout setting (`LS.calibrationReadout`) is on, show live sample-rate + inference-time; add a "Download trace" button (Settings → Calibration) that saves the buffer as JSON.
3. Refactor the counting logic into a **pure function** (e.g. `advanceRep(state, rawRatio, tMs, config) -> {state, counted}`) with zero DOM access, so recorded traces can replay through it in Node (`node --check` machine has Node; no Python).
4. Acceptance: can record a real fast-rep session on the phone, download the trace, and replay it offline reproducing the missed reps.

### Phase 1 — Quick wins (likely fixes most of it)
1. **Drop the throttle:** `minIntervalMs` 100 → 33 (or 0 with rVFC; rVFC already fires at camera fps ≈ 30). Guard: skip a frame if the previous inference is still running.
2. **Lighten smoothing:** replace EMA(0.3) with either a 3-sample median filter (kills single-frame bbox glitches without lag) or EMA with α ≥ 0.6. Re-derive the right α from Phase 0 traces.
3. **GPU delegate:** try `delegate: "GPU"` in `ensureFaceDetector()` with automatic fallback to CPU on init failure. Expect large inference-time drop on phones.
4. **Debounce instead of smoothing for noise-safety:** add `minMsBetweenReps` (≈ 250–300 ms) so lighter smoothing can't double-count one rep.
5. Acceptance: replayed Phase 0 traces count the previously-missed reps; a live 20-fast-rep set counts 20/20 (±1); no double counts on slow reps.

### Phase 2 — Adaptive thresholds (if Phase 1 isn't enough)
1. Track a rolling min/max of the raw ratio over the session (with slow decay).
2. Derive dynamic thresholds as fractions of the observed personal range (e.g. down = min + 0.65·range, up = min + 0.35·range), clamped to sane bounds; keep the manual calibration sliders as overrides.
3. Alternative/simpler: single midpoint crossing with direction + amplitude gate (count on downward→upward turnaround whose amplitude ≥ 50 % of rolling range).
4. Acceptance: same person counts correctly at slow, medium, and sprint pace without touching calibration sliders; shallow-but-real reps count, head-bobs don't.

### Phase 3 — Jank reduction (polish)
1. Move `speak()`/`vibrate()`/`updateHighscoreMessage`/thermometer updates out of the hot path: queue via `setTimeout(0)` or `requestIdleCallback` after `onRepCounted` increments the counter DOM.
2. Only call `speechSynthesis.cancel()` when something is actually speaking; consider skipping per-rep number speech above a pace threshold (speak every rep can't keep up at 1 rep/s anyway) — e.g. speak only every 5th rep when fast.
3. Acceptance: trace shows no >100 ms sample gaps immediately after a counted rep.

### Phase 4 — Ship checklist (per repo conventions, see CLAUDE.md)
- `node --check app.js`; replay-test the pure counter against saved traces.
- Preview-test with SW cache-clear ritual (plank mode can't proxy this — camera needed; use the calibration readout + a hand moving toward/away from the webcam to simulate ratio swings on desktop).
- Bump `sw.js` `CACHE_NAME`, `git fetch`/merge, commit, push, verify live.
- No Worker changes needed (fully client-side).

## Guardrails
- Don't break slow/normal-pace counting or the pause-on-face-lost behavior (`FACE_LOST_TIMEOUT_MS`).
- Keep the calibration sliders functional (Settings → Calibration) — they're the escape hatch on unusual setups.
- Battery: rVFC at 30 fps with GPU delegate should be fine, but confirm the phone doesn't heat up noticeably during a 2-minute session; if it does, adaptive throttling (30 fps while moving, 10 fps while idle in "up") is the fallback.
