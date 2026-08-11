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
