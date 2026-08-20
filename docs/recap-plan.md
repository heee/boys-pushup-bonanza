# Recap modals — build plan

Weekly/monthly/quarterly/annual "Wrapped"-style recap modals, built and shipped
2026-08-19. No prior entry existed in [mode-ideas.md](mode-ideas.md) — this doc exists
purely as a record of the decisions made, for future reference.

## Decisions (confirmed with Henning, 2026-08-19)

- **Scope:** all four tiers (week/month/quarter/year) built in one pass, sharing one
  modal shell with a distinct gradient palette per tier (orange/gold/steel-blue/dark-bronze)
  and a distinct activity strip per tier (7-day dot streak for week; bucketed bar chart —
  4 weeks/3 months/12 months — for month/quarter/year).
- **Exercise coverage:** every exercise the user was active in that period (pushups,
  situps, squats, pull-ups, planks, Holland), shown as swipeable pill tabs inside one
  modal — most-active exercise first, one full hero layout per tab.
- **Queueing:** if multiple period boundaries elapsed since the app was last opened,
  queue all of them and show largest-first (Annual → Quarterly → Monthly → Weekly).
- **Zero-activity periods:** skipped silently — marked seen, never shown, never nags.
- **Territory highlight:** required adding a genuine persistent, non-resetting
  territory tier (`"all"`) to Roadtrip, since the existing day/week/month/year tiers all
  reset — see `ROADTRIP_PERIODS` in [roadtrip.js](../roadtrip.js). Surfaced both in the
  recap's "{city} still yours — held N days" highlight and as a 5th option in the
  existing Roadtrip screen's period picker.
- **Share format:** renders the on-screen card to a PNG (hand-drawn to a `<canvas>`,
  1080×1920 story format) and shares it via the same `navigator.share({files})` pattern
  every other share button in the app already uses — no new dependency, since this repo
  has no build step.

## Architecture

`recap.js` is a pure, state-free module (mirrors `stats.js`/`roadtrip.js`) that computes
everything a recap needs from raw sessions — no `app.js` global `state` coupling:

- `completedPeriodRange(tier, now)` / `previousPeriodRange(tier, now)` — a recap always
  covers the period that just **finished** as of `now` (e.g. opening the app on the
  first day of a new week recaps last week), not the in-progress one.
- `rankForPeriod(pool, user, start, end)` — state-free generalization of the existing
  `computeUserPeriodStanding` pattern in app.js, usable for both the current period's
  rank and the previous period's rank (the "was #N" comparison).
- `getActiveExercises` / `computeRecapTab` / `buildRecapTier` — per-exercise-per-tier
  payload: hero total, delta % vs the prior period, session count, session PB (week) or
  period-total volume record (month/quarter/year), rank + rank change, the activity
  strip, and up to 3 highlight lines (rank, PB/volume-record, territory — each included
  only when it actually applies).
- `checkAndQueueRecaps(sessions, user, now, storage)` — gates each tier behind a
  localStorage "last shown period-start" key (`bpb-recapSeen_{tier}`), called once from
  `init()` in app.js right after the worker data fetch resolves.
- `exportRecapImage(tier, tab, user)` — the canvas share-image renderer.

The territory highlight is inherently cross-exercise (Roadtrip doesn't distinguish
session types), so it's computed once per period and attached only to the primary
(most-active) tab.

## Verification

Forced open every tier/palette via a temporary `window.__forceRecap(tier)` console hook
(removed before shipping) and compared element-by-element against the reference mockups:
colors, hero number placement, delta pill, dot vs. bar strip, stat tile row, highlight
copy/icons, and the share/dismiss buttons.
