# Working conventions for this repo

- **Minimize dialogue.** Keep responses terse — critical messages and summaries only, no play-by-play narration.
- Worker (`worker/index.js`) redeploys are manual: paste into Cloudflare dashboard Quick Edit. No wrangler (Windows ARM64 has no `workerd` build).
- Before any preview check: unregister service workers + clear caches, then reload.
- Before `git push`: `git fetch` + check `origin/main` for new commits and merge if needed. Live gameplay data is stored in D1 and never committed to Git.
- After completing and verifying requested changes, commit and push them live directly without waiting for a separate prompt.
- Bump `sw.js`'s `CACHE_NAME` on every shipped change.
- Spoken lines live in `voice-lines.js` (single source of truth). Adding one means
  rerunning `node scripts/generate-voice.js` (needs `OPENAI_API_KEY`) and committing
  `assets/voice/`; until then that line falls back to `speechSynthesis`.
- Root scripts are ESM (`package.json` has `"type": "module"`); the two older
  CommonJS scripts are `.cjs`.
- **Keep `app.js` as orchestration, not a feature warehouse.** New modes and
  substantial features belong in focused modules (`modes/`, `screens/`, or a
  clearly named root module). Put rules, calculations, catalogs, and state
  transitions in exported functions; leave only DOM wiring and coordination in
  `app.js`.
- Specialized mode code that is not needed for the default startup path should
  use an on-demand `import()`. Preload it when the user selects or approaches
  that mode, await it before the first required action, and do not add it to the
  service worker's app-shell precache. The runtime cache will store it after its
  first request.
- Every extracted module needs focused Node tests. When adding a feature to an
  existing mode, extend that mode's module instead of placing parallel logic
  back into `app.js`. If a change adds more than a small event-handler-sized
  block to `app.js`, treat that as a signal to create or extend a module first.
- **Design-implementation tasks aren't done until verified against the reference, element by element.** Rendering without errors is not the same as matching the design. Before marking any visual/redesign task complete: reload the actual live/preview page (cache-busted), and check every distinct element named in the spec/mockup — colors, spacing, order, badges, icons, copy — against that reference directly, not from memory of having "already built that." Do this per screen as each is finished, not as one pass at the very end; a review that only happens after everything is "done" misses exactly the omissions this note exists to catch.
- **For major/new-feature work, ask clarifying questions one-by-one before planning.** Don't guess at ambiguous requirements or batch every open question into one message — surface them one at a time, let the answer inform the next question, then present a plan for confirmation before handing off to an executing agent.

## Development roadmap: Holland mode

### Product vision

Holland mode is a continuous, camera-counted endurance circuit inspired by the
reported superhero workout: pull-ups, pushups, then squats, repeated until the
athlete ends the workout. Add it as the final item in the **Other exercises**
section of Explore Modes with a Netherlands flag (`🇳🇱`) icon.

Before starting, the athlete selects an intensity. Remember the last selection
per user:

- Normal: 5 pull-ups / 10 pushups / 15 squats.
- Medium: 10 pull-ups / 20 pushups / 30 squats.
- Hard: 15 pull-ups / 30 pushups / 45 squats.

The headline result is **Holland cycles**, normalized to the Normal workload:
`(pull-ups + pushups + squats) / 30`, displayed to one decimal place. Partial
reps count, so three pull-ups after eight Normal circuits produces `8.1 Holland
cycles`. One complete physical Medium circuit is `2.0`; one Hard circuit is
`3.0`. Always append the selected difficulty, e.g. `24.6 Holland cycles (Hard)`.
Equal scores tie on the leaderboard; elapsed time is context only and never a
tiebreaker.

The timer runs continuously through exercise work, repositioning, and rest.
Each exercise calibrates on its first appearance and reuses that calibration
for later circuits. A segment stops automatically at its target and moves to a
transition screen that announces the completed target, next exercise/target,
repositioning instructions, current cycles, and a **Ready** action. Keep discreet
`− / +` correction controls on every active segment. **Finish workout** remains
available during exercises and transitions; after confirmation it saves every
completed and partial rep.

Use a subtle, original spider-inspired superhero identity: deep red and
midnight blue, fine web-line motifs, angular panels, energetic transitions, and
restrained orange accents. Do not use an actor likeness, movie artwork,
official logos, copied dialogue, or imply that the 27-cycle story is verified.
Voice cues should announce transitions, targets, and cycle milestones, with
occasional original, unhinged web-slinger-style commentary. Reaching `27.0`
normalized cycles unlocks a playful **Holland 27** achievement and special
celebration framed as a legendary benchmark, not a factual claim.

A workout appears once in My Sessions as a Holland entry. Its detail and
summary views show normalized cycles, difficulty, physical circuits completed,
total and partial progress for all three exercises, continuous duration, and
the Holland 27 achievement when earned. The same component reps also feed the
existing pull-up, pushup, and squat totals/statistics/leaderboards without
creating three extra visible history records. Holland cycles also receive their
own leaderboard, stats, comparison, mode-breakdown, and My Sessions filter.

### Build plan

1. **Rules and state machine**
   - Add an on-demand `modes/holland.js` containing the difficulty catalog,
     exercise order, targets, segment/circuit transitions, correction rules,
     normalized-cycle math, partial progress, achievement qualification, and
     session serialization helpers.
   - Keep DOM, camera, storage, and voice orchestration out of the module. Add
     focused Node tests for every exported rule and state transition.

2. **Counter reuse and calibration**
   - Expose small reusable adapters around the existing pull-up, pushup, and
     squat counters so Holland can start/stop detection, receive rep events,
     apply corrected counts, capture calibration, resume with saved calibration,
     and freeze precisely at a segment target.
   - Do not duplicate detection math in the Holland module. Extend each existing
     mode module and its focused tests where reusable behavior is required.

3. **Setup and workout experience**
   - Add focused Holland setup/workout screen code rather than growing
     `app.js`. Include difficulty cards, targets/rules, remembered selection,
     personal best, first-use calibration, active-exercise HUD, transition
     state, confirmation to finish, completion summary, and error/recovery
     states for camera or tracking loss.
   - The active HUD shows exercise and target progress, difficulty, physical
     circuit number, normalized Holland cycles, and continuous elapsed time.
   - Lazy-load and opportunistically preload Holland-specific code according to
     the repo's specialized-mode convention; do not app-shell precache it.

4. **Canonical session model and projections**
   - Store one canonical session with `type: "holland"`, raw aggregate `count`,
     `hollandDifficulty`, `hollandPullups`, `hollandPushups`,
     `hollandSquats`, `startedAt`, `timestamp`, and any achievement metadata.
     Derive normalized cycles from the component/raw total rather than storing
     a rounded value as the source of truth.
   - Add a shared projection helper that makes a Holland session's component
     reps visible to the existing exercise aggregations while keeping history,
     deletion, sync, and offline retry tied to the one canonical record. Audit
     every aggregation path so Holland reps are neither omitted nor double
     counted.

5. **Persistence and Worker API**
   - Add a D1 migration for Holland fields and extend Worker documentation,
     validation, insert/select mapping, and tests. Validate difficulty and
     nonnegative integer component counts, and require aggregate consistency.
   - Preserve optimistic caching and queued offline sync. Deleting the Holland
     entry must remove all derived contributions automatically.
   - Worker deployment remains manual through Cloudflare Dashboard Quick Edit;
     prepare and verify the complete `worker/index.js` before handoff/deploy.

6. **Discovery, history, stats, and sharing**
   - Add Holland to Explore Modes at the bottom of Other exercises, activity
     routing, session metadata/detail, summary, sharing, leaderboard selector,
     My Sessions filters, mode breakdown, comparisons, and mode stats.
   - Format Holland values as one-decimal cycles rather than raw reps and show
     difficulty in parentheses on individual results. Show elapsed time only as
     supporting context. Exercise views consume projected component counts.

7. **Voice and celebration**
   - Put all new transition, target, milestone, banter, completion, and Holland
     27 lines in `voice-lines.js`. Keep them original and spider-inspired rather
     than franchise quotations.
   - Run `node scripts/generate-voice.js` with `OPENAI_API_KEY` and commit the
     resulting `assets/voice/` updates; speech synthesis is only the temporary
     fallback during development.

8. **Verification and release**
   - Test all three difficulties, every transition, one-time calibration reuse,
     target caps, manual corrections, partial finishes from exercise and
     transition states, normalized rounding, timer continuity, Holland 27,
     offline retry, deletion, Worker round trips, and component projection.
   - Run the full Node suite. Then unregister service workers, clear caches,
     reload the actual preview, and verify every specified element and state
     screen-by-screen against this roadmap, including mobile layout and camera
     repositioning.
   - Bump `sw.js`'s cache name, manually deploy the Worker when its changes are
     ready, reconcile `origin/main`, commit, and push the verified release.
