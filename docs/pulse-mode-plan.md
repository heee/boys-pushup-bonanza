# Pulse mode — build plan

Modeled on [situp-mode-plan.md](situp-mode-plan.md); executed by a handed-off agent,
with Henning's manual steps called out explicitly. Visual reference:
`Pulse mode - visuals.html` (Henning's mockup, screens A/B/C variants — build against
variant C throughout, per the layout notes in that file).

## Decisions (confirmed with Henning, 2026-08-23)

- **Sequencing:** Tug-of-war is already built (CLAUDE.md's roadmap line is stale).
  Pulse is the active next build.
- **Band data source:** median rpm comes from the boy's last 25 **Classic-mode**
  pushup sessions only (`!session.type && (session.mode === "classic" || !session.mode)`
  — verify the `!session.mode` fallback against real data, since older sessions may
  predate the `mode` field). Game modes (Poker/Wheel/Ladder/Chase/etc.) are excluded —
  their bursty cadence isn't representative.
- **Missing duration:** a session only counts toward the median/unlock if it has a
  valid `startedAt` and `count > 0` (rpm = count / ((timestamp − startedAt) / 60000)).
  Sessions without usable duration are skipped entirely — they don't count toward the
  "3 sessions to unlock" gate either. A boy with only old, undated sessions needs fresh
  Classic runs before Pulse unlocks.
- **Recovery window:** flat 5s for all three band widths (Wide/Standard/Razor) — no
  Razor-specific shortening. Razor's difficulty comes from the tighter band, not the
  timer.
- **Rest vs. fade:** no special case. A full stop is just a floor breach like sprinting
  is a ceiling breach — same 5s recovery countdown, same "pick it up" pill.
- **Startup grace period:** the rolling pace window needs ~7s of run time before it's
  meaningful. During that window the status pill reads a neutral "Finding pace…", the
  trace and band lines draw normally, but no ceiling/floor breach can trigger.
- **Leaderboard:** no per-run mini leaderboard on the results screen (drop that panel
  from the mockup). Instead, Pulse gets one new tab in the existing Leaderboard screen
  (`LEADERBOARD_MODE_OPTIONS`), ranked by time-in-band, **combined across all band
  widths** — Wide/Standard/Razor runs sit in one ranked list for now. Splitting by band
  width is explicitly deferred, not designed away — leave the door open (e.g. keep
  `pulseBandWidth` on every session so a future filter is just a WHERE clause, not a
  schema change).
- **Personal best:** same combined-across-widths logic as the leaderboard, for
  consistency (`bestFor(indexedSessionsForUser(name, "pulse"))` mirroring
  `getSitupBest`). Flagging this inference for Henning's sign-off in review — it wasn't
  asked separately but follows directly from the leaderboard decision.
- **Locked-state UI:** the mode tile is visible on the home/explore screen at all
  times, greyed out with progress text ("2/3 Classic sessions logged") until the boy
  has 3 valid Classic sessions, then it unlocks in place. No hidden-tile / toast
  mechanism — there's no existing precedent for a data-driven progress-gated tile
  elsewhere in the app, so this is new UI.
- **Audio/haptics:** metronome tick at band-centre pace (one tick per full rep,
  doubles rate as an out-of-band warning), fast-triple vibrate for hot, slow-double
  vibrate for cold, on-screen pill text carries the in-run instruction ("Ease off" /
  "Pick it up"). Reuse the existing oscillator tone helper (voice.js:647-672) for
  ticks and `vibrate()` (app.js:533) for haptic patterns. **Update 2026-08-23:**
  the original plan kept the pace signal non-verbal ("no spoken warning lines" —
  the mockup framed it as "readable without looking directly at the screen").
  Reversed per Henning: entering hot/cold now also speaks a line
  (`PULSE_HOT_LINES` / `PULSE_COLD_LINES` in voice-lines.js), fired once per
  breach entry alongside the vibrate call, not on a timer.
  Separately, Pulse **does** get a small `voice-lines.js` pack (start line(s) + a
  record/PB line, mirroring the situps pack but smaller — reps aren't the score, so no
  rep-number callouts). See **Voice lines** below.

## Scoring mechanic — elapsed clock vs. recorded score

The mockup shows the big "Holding for" timer still counting *up* while the status pill
reads "Too hot" mid-recovery (e.g. "Holding for 3:08" with a 2.4s recovery meter still
draining) — so the displayed clock does **not** pause during a recovery window, it's
just total elapsed run time. But the spec is explicit that the *recorded* score on
timeout is the moment of the original crossing, not the moment the countdown expired.
Reconciling both:

- `elapsedMs = now − runStartMs`, displayed continuously, never pauses.
- On breach start (ceiling or floor), capture `breachEnteredElapsedMs = elapsedMs` at
  that instant and start the 5s countdown.
- Return inside band before timeout → countdown cancels, resets to full 5.0s, run
  keeps going, `elapsedMs` keeps climbing as before.
- Countdown reaches 0 → run ends, **recorded score = `breachEnteredElapsedMs`** (up to
  5s less than what the clock shows at that instant), `endReason` = `"ceiling"` or
  `"floor"`, `breakRpm` = the rolling rpm at breach start.
- "Bank run" at any time (in-band or mid-recovery) → recorded score = current
  `elapsedMs`, `endReason` = `"banked"`.

Flagging this explicitly for Henning's review since it's inferred from the mockup
rather than stated outright in the spec text.

## Live pace mechanic

- **Rolling window:** 7s (midpoint of the spec's "6–8 seconds"), tunable constant.
  `rollingRpm = repsInWindow / (windowMs / 60000)`, recomputed on an evaluation tick
  (~150–200ms interval) *and* on every counted rep — a tick-driven recompute is
  required so pace visibly decays during a stall, not just on the next rep.
- **Breach detection:** compare `rollingRpm` directly against `[bandLow, bandHigh]` on
  each evaluation tick. No extra debounce layer beyond the window itself — the 7s
  window is what gives "one fast rep nudges it, four seconds of sprinting sends it
  over," per the spec's own framing.
- **Band is fixed for the whole run** — computed once at Start, never recalculated
  live, per spec.
- **Rep source:** `createRepCounter().advance(rawRatio, tMs)` (rep-counter.js:14)
  already returns `{ counted, phase }` per frame with a timestamp; Pulse pushes
  `tMs` onto a rep-timestamp array whenever `counted` is true, matching how the
  existing workout loop already drives the counter (verify exact call site in app.js
  during implementation — same camera/rep pipeline as Classic, no new capture logic).

## Data model

`type` stays unset (a normal pushup session, like Classic/Poker/etc.), `mode: "pulse"`
— fits the existing `session.mode` bucketing used by `LEADERBOARD_MODE_OPTIONS` and
`byLeaderboardMode` (app.js:262-264, 745-748) with no `type`-validation changes needed
in the Worker.

New fields on the session object (sparse/nullable, following the pyramid/holland
pattern of mode-specific columns):

- `count` — **seconds held**, not reps (overloads `count` the same way Plank already
  does — see app.js:4404, `formatDuration(s.count * 1000)`). This is what the
  leaderboard and personal-best sort on, for free, with zero new sort logic.
- `pulseReps` — actual rep count (since `count` no longer means reps for this mode).
- `pulseBandWidth` — `"wide" | "standard" | "razor"`.
- `pulseBandLow`, `pulseBandHigh` — the rpm bounds locked in at Start (for results-trace
  rendering and any future band-width leaderboard split).
- `pulseEndReason` — `"ceiling" | "floor" | "banked"`.
- `pulseBreakRpm` — rolling rpm at the moment of the run-ending breach; `null` when
  `endReason === "banked"`.

## Voice lines

Small pack, not the full situps-sized set — reps aren't the score here, so no
rep-number callouts or per-rep cheers.

1. New exports in voice-lines.js: `PULSE_START_LINES` (~3, pace/control framing rather
   than volume/strength), `PULSE_RECORD_LINE` (new personal-best on time-in-band).
   Tone: matches the app's existing register, but leans into "control" / "steady"
   imagery rather than grind/intensity, since that's the mode's actual point.
2. **Manual step:** `node scripts/generate-voice.js` with `OPENAI_API_KEY` in the env
   (Henning supplied the key directly in chat for this build — export it as a
   session-local env var when running the script; it must never be written to any
   file, commit, or doc), for every preset; commit clips + manifests. Until run, new
   lines fall back to `speechSynthesis`, flagged as pending in the build report.
3. Extend voice resolution test coverage for the new lines.

## Screen & flow

1. **Entry:** visible tile on home/explore screen (locked/progress state per the
   decision above), next to the other pushup sub-modes.
2. **Setup** (mirrors mockup screen 1): pace-history readout (median + range bar over
   last 25 valid Classic sessions), band-width picker (Wide/Standard/Razor, Standard
   default), metronome toggle (on by default), best-run readout, Start.
3. **Active run** (mockup screen 2, variant C): header with status pill, centred
   elapsed clock, live trace (fixed frame, 60s rolling scroll, zones/lines per state),
   recovery meter (only rendered while in a breach), pace/reps pair, Bank run + pause.
4. **Run ended** (mockup screen 3): cause-of-ending line, recorded time, reps, PB pill
   if applicable, static full-run trace, Share + Run again. **Drop the inline mini
   leaderboard panel** from the mockup — that data now lives in the main Leaderboard
   screen's new Pulse tab instead.
5. **Leaderboard screen:** add `{ id: "pulse", label: "Pulse" }` to
   `LEADERBOARD_MODE_OPTIONS` (app.js:228-245); sorts by `count` (seconds) like Planks
   already do, no band-width filter for v1.

## Data & Worker (⚠️ manual dashboard step, ships FIRST)

Sessions POST with `mode: "pulse"` (no `type` change) plus the new `pulse*` fields
above. Worker change: extend the session INSERT param list (worker/index.js, same
pattern as the pyramid/holland fields around line 1086) to persist the new columns, and
a D1 migration to add them (nullable, additive — backward compatible). Update the
Worker file's doc-comment.

**Deploy order:** Worker commit lands first, Henning pastes `worker/index.js` into the
Cloudflare dashboard Quick Edit **as soon as the agent's report flags it** — before the
tile is reachable. Client-side: leaderboard tab addition, session history/detail render
Pulse sessions with their own marker and the seconds-held format (not reps).

## Build order

1. **Worker change + D1 migration** (commit + push first; Henning pastes to dashboard
   immediately).
2. **`modes/pulse.js`**: band-from-history calc (median + width multiplier, valid-session
   filtering), rolling-rpm calc, breach/recovery state machine, elapsed-vs-recorded
   scoring logic above. Unit tests for all of it, including synthetic rep-timestamp
   traces for the recovery-timeout edge case (score = breach-entry time, not timeout
   time).
3. **Voice lines** (text + tests; generation deferred until this step runs with
   `OPENAI_API_KEY` in the env — see Voice lines above).
4. **Screen + flow** (`screens/pulse.js` or inline in app.js following the prevailing
   pattern for other modes): setup, active-run (trace chart, status pill, recovery
   meter, elapsed clock), run-ended. Tone/vibrate cues wired to state transitions.
5. **Home/explore tile** with locked/progress state (ships in this step so nothing is
   reachable before the Worker paste).
6. **Leaderboard tab** addition.
7. **Verification** below, then ship.

## Verification checklist

- `node --test tests/` green (band calc, rolling-rpm, breach/recovery state machine,
  including the breach-vs-timeout scoring edge case).
- SW ritual: unregister + clear caches before every preview check; bump `CACHE_NAME`
  and `?v=` params in every shipping commit.
- Preview: locked tile shows correct progress count for a fresh profile; setup screen
  band readout matches a hand-computed median from real session data; live run screen
  matches the mockup (variant C) element-by-element per CLAUDE.md's design-verification
  rule — trace scroll, zone lighting, recovery meter, pill copy/color, haptic triggers;
  Bank run and timeout both save with the correct `pulseEndReason`/score; Leaderboard
  shows the new Pulse tab sorted by time-in-band.
- On-device (Henning): confirm the 7s rolling window and 5s recovery feel right at
  real pushup cadence — these are tunable constants, expect at least one pass of
  real-world adjustment.
- `git fetch` + check `origin/main` before every push (live data commits).

## Deferred / open items (not designed away, revisit later)

- Splitting the Leaderboard's Pulse tab by band width (schema already supports it via
  `pulseBandWidth`).
- Async shared-leaderboard window (day/week/explicit challenge) beyond the always-on
  combined leaderboard.
- Whether other exercise types (situps/squats/pullups) eventually get their own Pulse
  variant — out of scope for this build, which is pushups only.

## Post-build manual steps for Henning (agent lists these in its report)

1. Paste updated `worker/index.js` into Cloudflare dashboard Quick Edit.
2. Run voice generation with `OPENAI_API_KEY` in the env; commit `assets/voice/` +
   manifests.
3. On-device pass at real cadence to sanity-check the 7s rolling window / 5s recovery
   feel; tune constants if needed.
