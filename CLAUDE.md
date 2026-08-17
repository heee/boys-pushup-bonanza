# Working conventions for this repo

- **Mode roadmap:** Situps is in build (docs/situp-mode-plan.md). Further mode/exercise
  ideas are earmarked in docs/mode-ideas.md for later evaluation — **Tug-of-war is the
  prioritized next build** after Situps.

- **Minimize dialogue.** Keep responses terse — critical messages and summaries only, no play-by-play narration.
- **Always push live directly** after making a change — don't wait to be asked. Commit and `git push` (following the fetch/merge-check and `CACHE_NAME` bump rules below) as a normal part of finishing the change, without asking for confirmation first.
- **End every turn with a brief summary**: confirm the push landed (commit hash) and, if `worker/index.js` changed, confirm the Worker redeploy landed too.
- Worker (`worker/index.js`) redeploys go straight through the Cloudflare API MCP connection (`cloudflare-api`'s `execute` tool, PUT `/accounts/{accountId}/workers/scripts/boys-pushup-bonanza-worker`) — no manual dashboard paste, no wrangler (Windows ARM64 has no `workerd` build). Fetch current bindings first via GET `.../scripts/boys-pushup-bonanza-worker/settings` and include them unchanged in the redeploy's multipart metadata (`DB` D1 binding, `ALLOWED_ORIGIN`/`APP_KEY` plain text, `GEOAPIFY_API_KEY`/`GITHUB_TOKEN` secrets — secret bindings need only `{name, type: "secret_text"}`, no value, to stay intact) so the deploy doesn't drop them.
- Before any preview check: unregister service workers + clear caches, then reload.
- Before `git push`: `git fetch` + check `origin/main` for new commits (the live app writes real gameplay data straight to `data.json` via the Worker, independent of this working tree) — merge if needed.
- Bump `sw.js`'s `CACHE_NAME` on every shipped change.
- Spoken lines live in `voice-lines.js` (single source of truth). Adding one means
  rerunning `node scripts/generate-voice.js` (needs `OPENAI_API_KEY`) and committing
  `assets/voice/`; until then that line falls back to `speechSynthesis`.
- Root scripts are ESM (`package.json` has `"type": "module"`); the two older
  CommonJS scripts are `.cjs`.
- **Design-implementation tasks aren't done until verified against the reference, element by element.** Rendering without errors is not the same as matching the design. Before marking any visual/redesign task complete: reload the actual live/preview page (cache-busted), and check every distinct element named in the spec/mockup — colors, spacing, order, badges, icons, copy — against that reference directly, not from memory of having "already built that." Do this per screen as each is finished, not as one pass at the very end; a review that only happens after everything is "done" misses exactly the omissions this note exists to catch.
- **For major/new-feature work, ask clarifying questions one-by-one before planning.** Don't guess at ambiguous requirements or batch every open question into one message — surface them one at a time, let the answer inform the next question, then present a plan for confirmation before handing off to an executing agent.
