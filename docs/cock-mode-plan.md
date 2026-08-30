# Cock Mode — build plan

Modeled on [pulse-mode-plan.md](pulse-mode-plan.md); executed by a handed-off agent.
No visual mockup file — a live-run concept was designed and confirmed inline as a
Claude Artifact during planning (bot-vs-boy pace duel, single visible nerve meter,
standard checkmark FAB to end). Build against the decisions below.

## Concept

A game of chicken against a bot ("the cock"): both sides hold a pushup pace, and
whoever backs off first loses. No opponent AI/ML needed — this is a deterministic
pace curve plus two mirrored "nerve" meters, built almost entirely on Pulse mode's
existing rolling-rpm and history infrastructure.

## Decisions (confirmed with Henning, 2026-08-30)

- **Naming:** the mode is **"Cock Mode"**, the opponent is **"the cock"** (rooster
  emoji 🐓, not a bot icon/label anywhere in copy or voice lines).
- **Bot pace curve:** starts at the boy's historical median rpm (same source as
  Pulse — `pulseBandFromHistory`/`pulseHistorySessionsForUser` computation, reused
  as-is for the median only, no band low/high needed here) and **ramps up slowly**
  over the run's elapsed time. Exact ramp function/rate is a tunable constant, set
  during implementation and adjusted on-device (flag as a tuning pass, same as
  Pulse's 7s window / 5s recovery were).
- **Unlock gate:** identical to Pulse — tile greyed out with progress text until 3
  valid Classic-mode sessions exist (reuse the same eligibility check/history
  filter: `!session.type && (session.mode === "classic" || !session.mode)`, valid
  `startedAt` + `count > 0`). No separate gating logic to write.
- **Startup grace period:** ~4s (shorter than Pulse's 7s, confirmed explicitly by
  Henning — Cock Mode's rolling window can be tighter since it only needs a
  directional ahead/behind read, not a precise band placement). During this window
  neither nerve meter moves and status pill reads a neutral "Finding pace…"; a FAB
  tap during grace ends the session with **no win/loss recorded**.
- **Win condition:** the cock's nerve meter (0–100, starts at 100) drains while the
  boy's rolling rpm is *above* the cock's current pace, refills while it's at/below.
  Hits 0 → the cock chickens out → **automatic win**, taken straight to the session
  end screen (no button, no confirmation).
- **Loss condition:** mirrored — the boy has his own resolve meter (0–100, same
  drain/refill logic, inverted: drains while behind the cock's pace) that is
  **never rendered on screen**. Hits 0 → **automatic loss**, taken straight to the
  session end screen. Drain/refill rates for both meters are tunable constants; a
  reasonable starting point is symmetric with the bot's (adjust independently
  during on-device tuning if one side folds too fast/slow).
- **Manual end via FAB:** Cock Mode reuses the shared checkmark FAB (`#btn-complete`,
  same fixed bottom-right circular control other modes use — no new buttons, no
  "chicken out"/"keep pushing" copy anywhere). Tapping it **resolves the current
  position**: ahead of the cock's pace at that instant → recorded as a **win**;
  behind → recorded as a **loss**. (During the grace period only, this instead
  records nothing — see above.)
- **Scope:** solo vs. the cock only for v1. No pass-the-phone/versus variant.
- **Voice lines:** the cock talks. New `voice-lines.js` pack, small (mirrors
  Pulse's pack size): a start line, taunt lines fired on nerve-meter milestones
  (e.g. crossing under 50%), a chicken-out/loss line for the cock, and a win/loss
  line pair for the boy's outcome screen. Reuses the existing pre-rendered OpenAI
  TTS + `speechSynthesis` fallback pattern.
- **Leaderboard/PB:** ranks on **win/loss record** (wins, or current win streak —
  pick one during implementation; win streak reads better head-to-head, default to
  that unless it fights the existing leaderboard sort shape). New
  `{ id: "cock", label: "Cock" }` entry in `LEADERBOARD_MODE_OPTIONS`.

## Live pace mechanic

Reuses Pulse's rep-timestamp/rolling-rpm plumbing directly:

- **Rolling window:** shorter than Pulse's 7s given the 4s grace period above —
  likely also ~4–5s, tunable. `rollingRpm = repsInWindow / (windowMs / 60000)`,
  recomputed on an evaluation tick (~150–200ms) and on every counted rep, same
  pattern as `pulseEvaluateTick`.
- **Cock's current pace:** `cockRpm(elapsedMs) = medianRpm * rampFn(elapsedMs)`,
  a pure function of elapsed time — never depends on the boy's live pace (the cock
  doesn't "react" to being ahead/behind on pace itself, only its nerve meter does).
- **Nerve/resolve tick:** on each evaluation tick, compare `rollingRpm` to
  `cockRpm(elapsedMs)`; move both meters by a small per-tick delta in the
  appropriate direction, clamped [0, 100]. No debounce beyond the rolling window
  itself, matching Pulse's rationale.
- **Rep source:** `createRepCounter().advance(rawRatio, tMs)` — identical capture
  pipeline to every other pushup mode, no new capture logic.

## Data model

`type` stays unset (normal pushup session), `mode: "cock"`, fitting the existing
`session.mode` bucketing (`byLeaderboardMode`, `LEADERBOARD_MODE_OPTIONS`) with no
Worker `type`-validation changes needed.

New fields on the session object (sparse/nullable, following the pyramid/holland/
pulse pattern of mode-specific columns):

- `count` — reps, as normal (unlike Pulse, this mode's score isn't time-based).
- `cockResult` — `"win" | "loss"`.
- `cockEndReason` — `"nerve_zero" | "resolve_zero" | "fab_ahead" | "fab_behind"`
  (the last two only during a manual FAB end past the grace window).
- `cockMedianRpm` — the boy's historical median rpm locked in at Start (for
  results-trace rendering / leaderboard context, mirrors `pulseBandLow`/`High`).
- `cockFinalCockRpm` — the cock's pace at the moment the run ended (context for the
  results screen — "you were pushing 41rpm against the cock's 34").

## Voice lines

1. New exports in `voice-lines.js`: `COCK_START_LINES` (~3), `COCK_TAUNT_LINES`
   (fired once per nerve-meter threshold crossing, not on a timer),
   `COCK_LOSS_LINES` (cock's chicken-out line, boy wins), `COCK_WIN_LINES` (cock's
   gloat line, boy loses). Tone: playful trash-talk fitting "Cock Mode," not the
   grind/intensity register of the core app.
2. **Manual step:** `node scripts/generate-voice.js` with `OPENAI_API_KEY` in the
   env (Henning supplied the key directly in chat for this build — export it as a
   session-local env var when running the script; it must never be written to any
   file, commit, or doc), for every preset; commit clips + manifests. Until run,
   new lines fall back to `speechSynthesis`, flagged as pending in the build report.
3. Extend voice resolution test coverage for the new lines.

## Screen & flow

1. **Entry:** tile on home/explore screen, locked/progress state per the gate
   decision above (same UI pattern as Pulse's locked tile).
2. **Setup:** pace-history readout (median from last 25 valid Classic sessions,
   reusing Pulse's history calc), best-run readout (win streak/record), Start. No
   band-width picker — there's only one pace curve, not three.
3. **Active run:** header with status pill + elapsed clock, cock card (rooster
   avatar, nerve meter, cock's current rpm), live pace trace (dual line: boy vs.
   cock, mirrors the confirmed mockup), reps/pace stat pair, standard checkmark FAB
   bottom-right (no other buttons). Grace-period status pill reads "Finding pace…".
4. **Run ended:** auto-routed here on either meter hitting zero, or on FAB tap past
   grace (no confirmation dialog in any case). Win/loss framing line (voice + on
   screen), reps, win-streak/PB pill if applicable, static full-run trace, Share +
   Run again.
5. **Leaderboard screen:** add `{ id: "cock", label: "Cock" }` to
   `LEADERBOARD_MODE_OPTIONS`, sorted by the chosen win-record metric.

## Data & Worker (⚠️ manual dashboard step, ships FIRST)

Sessions POST with `mode: "cock"` (no `type` change) plus the new `cock*` fields
above. Worker change: extend the session INSERT param list (worker/index.js, same
pattern as the pyramid/holland/pulse fields) to persist the new columns, plus a D1
migration to add them (nullable, additive, backward compatible). Update the
Worker file's doc-comment.

**Deploy order:** Worker commit lands first, Henning pastes `worker/index.js` into
the Cloudflare dashboard Quick Edit as soon as the agent's report flags it — before
the tile is reachable.

## Build order

1. **Worker change + D1 migration** (commit + push first; Henning pastes to
   dashboard immediately).
2. **`modes/cock.js`**: median-from-history reuse, cock pace-ramp function, rolling
   rpm calc, mirrored nerve/resolve state machine, FAB-tap resolution logic. Unit
   tests for all of it, including synthetic rep-timestamp traces for both
   auto-win/auto-loss paths and both FAB-tap-outcome paths.
3. **Voice lines** (text + tests; generation deferred until this step runs with
   `OPENAI_API_KEY` in the env).
4. **Screen + flow** (setup, active-run with dual-line trace + nerve meter + FAB,
   run-ended). Cock avatar/taunt cues wired to meter-threshold transitions.
5. **Home/explore tile** with locked/progress state (ships in this step so nothing
   is reachable before the Worker paste).
6. **Leaderboard tab** addition.
7. **Verification** below, then ship.

## Verification checklist

- `node --test tests/` green (median reuse, pace-ramp function, nerve/resolve state
  machine including both auto-end paths and both FAB-tap-outcome paths).
- SW ritual: unregister + clear caches before every preview check; bump
  `CACHE_NAME` and `?v=` params in every shipping commit.
- Preview: locked tile shows correct progress count for a fresh profile; setup
  screen median readout matches a hand-computed value from real session data; live
  run screen matches the confirmed Artifact mockup element-by-element per
  CLAUDE.md's design-verification rule — nerve meter, pace trace, status pill
  copy/color, FAB position/behavior; both auto-end paths and both FAB-tap outcomes
  save with the correct `cockResult`/`cockEndReason`; Leaderboard shows the new
  Cock tab sorted correctly.
- On-device (Henning): confirm the ~4s grace window, ramp rate, and meter
  drain/refill rates feel right at real pushup cadence — these are tunable
  constants, expect at least one pass of real-world adjustment.
- `git fetch` + check `origin/main` before every push (live data commits).

## Deferred / open items (not designed away, revisit later)

- Pass-the-phone versus variant (both boys take a turn against the cock, compared
  head-to-head).
- Whether the boy's hidden resolve meter should ever surface (e.g. a subtle screen
  tint/vibrate warning as it nears zero) without becoming a second visible bar —
  raised as a possible middle ground, not decided.
- Difficulty variants beyond the flat historical-median + ramp (e.g. an easier
  "flat pace" variant for younger/newer boys) — out of scope for v1.

## Post-build manual steps for Henning (agent lists these in its report)

1. Paste updated `worker/index.js` into Cloudflare dashboard Quick Edit.
2. Run voice generation with `OPENAI_API_KEY` in the env; commit `assets/voice/` +
   manifests.
3. On-device pass at real cadence to sanity-check the grace window, pace-ramp rate,
   and nerve/resolve drain rates; tune constants if needed.
