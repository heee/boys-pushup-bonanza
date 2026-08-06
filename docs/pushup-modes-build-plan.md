# Pushup Modes Build Plan — Countdown & Cards

**Status:** SPEC — ready to implement. All product decisions below were confirmed with the user; do not re-litigate them.

Adds two new pushup modes alongside the existing default. Rep *detection* is unchanged — all three modes use the same camera/face-detection counter (`createRepCounter()`); only the goal framing and HUD differ.

---

## Decisions (confirmed — build exactly this)

| # | Decision | Chosen behavior |
|---|---|---|
| 1 | Mode picker location | Segmented control on the workout **start** screen (`#workout-idle`), above START. Resets to Classic every time the screen is shown — same pattern as `#home-activity-select`. |
| 2 | Card values | A=1, 2–10 face value, **J=11, Q=12, K=13** |
| 3 | Cards session end | **Endless** — cards keep flipping until the user taps COMPLETE |
| 4 | Countdown start/zero | Starts at **PR+1** reps. Hitting **0 = new record** → fire record celebration, then display **flips to counting up** (+1, +2 …) |
| 5 | Card draw | **Shuffled 52-card deck, no repeats until exhausted**, then reshuffle. Deck state **persists across sessions** in localStorage |
| 6 | Session logging | Logged **identically to Classic** (counts toward totals, streaks, PRs, challenges) **plus a `mode` tag** on the session record |
| 7 | Card art | Two sprite sheets, sliced **in CSS via `background-position`** |
| 8 | Flip visual | **Single 3D flip**, outgoing card on the front face, incoming card on the back face. No card-back artwork needed |
| 9 | Countdown with no PR | Mode shown but **greyed out/disabled** with hint: "Log a session first to set your record." |
| 10 | Cards HUD hero number | **SUPERSEDED — see addendum below.** No giant hero number in Cards mode; the card art itself is the focal point. |

### Standing assumptions (not asked — flag only if they cause trouble)
- **Suit is decorative.** Only rank drives reps.
- **Theme:** `assets/cards-light.png` for light theme, `assets/cards-dark.png` for dark. Follow the existing `[data-theme]` mechanism.
- **Countdown PR source:** the existing `getHighScore(state.currentUser)` — the same number the app already shows. It is the *logged* (weighted-adjusted) count, which is what the leaderboard compares against.
- **Weighted mode composes with both new modes.** Card progress and the countdown track **raw** reps; the weighted multiplier applies only at logging time in `completeWorkout()`, exactly as today.
- **No unlock gate.** Both modes are available to everyone (unlike plank mode's easter egg).
- Both new modes are **pushups only** — they do not appear in plank mode.

---

## Addendum — post-implementation feedback (supersedes/extends the above)

Confirmed with the user after seeing the first pass live. These take precedence over the original decisions #10 and the plain `.camera-wrap` sizing referenced implicitly by the original spec.

| # | Decision | Chosen behavior |
|---|---|---|
| 10 (revised) | Cards HUD focal point | **The card art is the focal point, not a number.** No giant hero number in Cards mode (Classic/Countdown keep theirs unchanged). Card sized to dominate the screen: ~40–45vh tall, capped at ~60vw wide, whichever is tighter — `aspect-ratio` pinned to the sprite's exact per-cell ratio (147:205.75) so `background-size` percentages never stretch the art. `.card-face` paints *only* the sprite: no background-color/border/box-shadow of its own (a panel background behind the sprite's transparent per-cell gutter was showing through as a white frame). Reps-remaining and session total are combined into one subordinate inline line beneath the card: `"7 left on this card · 38 total"`. |
| 11 | Camera preview size | `.camera-wrap` halved app-wide (6.5rem → 3.25rem), not just in Cards mode. It's a framing-confidence indicator, not a focal point; shrinking it also frees vertical space for the larger card. |
| 12 | Camera preview visibility toggle | New Settings toggle, **default ON**: "Show camera preview during workouts." Same `LS`-key/`renderSettings()`/`change`-listener pattern as the high-score-message and voice-cheer toggles. **OFF never touches the `<video>` element's own display/visibility/size** — `requestVideoFrameCallback` (which rep detection depends on) can silently stop firing if the video isn't actually compositing, especially on iOS Safari. Instead, a sibling cover div (`#camera-preview-cover`) is laid on top at full opacity while the video keeps playing underneath at full size, showing a small status dot (green = face currently detected, amber/grey = not) driven by the same signal that drives `#face-box` visibility. |

---

## BLOCKER — assets the user must supply

The two sprite sheets are **not yet in the repo**; the user is adding them at:

- `assets/cards-light.png`
- `assets/cards-dark.png`

Both are a **13 columns × 4 rows** grid — columns are A,2,3,4,5,6,7,8,9,10,J,Q,K left→right; rows are spades, hearts, diamonds, clubs top→bottom. Transparent background.

**Do not block on these.** Use **percentage-based** background-position so the CSS is independent of the sheet's pixel dimensions:

```css
.card-face {
  background-image: url("assets/cards-dark.png");
  background-size: 1300% 400%;              /* 13 cols, 4 rows */
  background-position: calc(var(--col) * 100% / 12) calc(var(--row) * 100% / 3);
}
```
(`--col` 0–12, `--row` 0–3. The `/12` and `/3` divisors are correct — percentage background-position interpolates across `n-1` steps, not `n`. Getting this wrong is the single easiest bug to introduce here; verify card A♠ is top-left and K♣ is bottom-right.)

For local verification before the real art lands, generate a throwaway placeholder sheet (an SVG data-URI grid with the rank/suit drawn as text is fine) so the grid math can be confirmed visually. **Do not commit the placeholder** — and make sure the final CSS points at the real `assets/` paths.

---

## Implementation

### A. Mode state & picker

1. Add `LS.pushupMode` is **not** needed (mode resets each time). Track in `state.pushupMode = "classic" | "countdown" | "cards"`, defaulting to `"classic"`.
2. In `index.html`, inside `#workout-idle`, add a segmented control above `#btn-start` (below the weighted quick toggle):
   ```html
   <div id="pushup-mode-select" class="segmented pushup-mode-select" role="tablist">
     <button type="button" class="segment active" data-pmode="classic">Classic</button>
     <button type="button" class="segment" data-pmode="countdown">Countdown</button>
     <button type="button" class="segment" data-pmode="cards">Cards</button>
   </div>
   ```
3. In `showScreen()`'s existing `id === "screen-workout" && !state.workoutActive` branch, reset the picker to Classic and call a new `renderPushupModePicker()` that disables the Countdown segment when `getHighScore(state.currentUser) < 1`, adding a `.segment-disabled` class + the hint text. Disabled segments must ignore clicks.
4. Wire a click handler mirroring `#home-activity-select`'s.
5. **Beware the CSS specificity trap** that has bitten this repo twice: `.segmented` has a `margin-bottom` that later ID/class rules have overridden unexpectedly. Style the new picker with a class selector of equal-or-greater specificity and verify computed margins in the browser, don't assume.

### B. Countdown mode

- On `startWorkout()`, if mode is `countdown`, capture `state.countdownTarget = state.highScore + 1`.
- Hero number = `max(0, countdownTarget - reps)` while above zero; once `reps >= countdownTarget`, switch to showing `+${reps - countdownTarget}` and add a class so it reads as "past the record."
- The rep label (currently `PUSHUPS`) should read **`TO BEAT YOUR RECORD`** before zero and **`OVER YOUR RECORD`** after.
- At exactly `reps === countdownTarget`, fire the existing record celebration path once (`launchConfetti("workout-confetti")` + record speech). The existing `repState.recordBroken` flag in `onRepCounted` already guards single-fire for the classic path — **do not double-fire**; reuse that flag rather than adding a parallel one.
- The existing `#thermometer-wrap` should fill toward `countdownTarget` in this mode.

### C. Cards mode

1. **Deck module** (keep pure and testable, like `createRepCounter`):
   - `CARD_RANKS = [{label:"A",value:1}, …, {label:"K",value:13}]`, `CARD_SUITS = ["spades","hearts","diamonds","clubs"]` (row order must match the sprite).
   - `drawNextCard()` pops from a persisted shuffled deck in `localStorage` (`LS.cardDeck`), reshuffling a fresh 52 when empty. Use Fisher–Yates. Persist after every draw so a mid-session app kill doesn't duplicate cards.
2. **Session flow:** draw a card on start. Track `state.cardTarget` (reps for current card) and `state.cardRepsDone`. On each counted rep, increment `cardRepsDone`; when it reaches `cardTarget`, draw the next card, run the flip, reset `cardRepsDone = 0`.
3. **HUD** in `#workout-active` (a cards-only block, hidden in other modes): card element above the hero number; hero number = `cardTarget - cardRepsDone`; small line beneath = `${sessionTotal} total`.
4. **Flip animation:** a `.card-flip` wrapper with `transform-style: preserve-3d` and a 400–500ms `rotateY(180deg)` transition; front face = outgoing card, back face = incoming card (`transform: rotateY(180deg); backface-visibility: hidden`). After the transition, swap the incoming card onto the front and reset rotation to 0 **without** a transition so the next flip starts clean. Respect `@media (prefers-reduced-motion: reduce)` with an instant swap.
5. **Do not let the flip block rep counting.** Reps landing mid-flip must still count toward the new card — the detection loop and the animation are independent. This is the most likely functional bug in this mode; test it by repping fast through a card boundary.

### D. Speech & haptics
The hero number is what gets spoken. In Countdown mode speak the remaining-to-record number; in Cards mode speak the remaining-on-card number, and announce the new card on flip (e.g. "Seven"). Keep the existing sprint-pace throttle (`lastRepSpokenAt`, every 5th rep when fast) and keep cheers/records always speaking.

### E. Session logging + Worker (⚠️ requires manual redeploy)
- In `completeWorkout()`, add `mode` to the session object when it isn't `"classic"` (omit for classic to keep records small and backward-compatible).
- **`worker/index.js` `validateSession()` whitelists fields — an untagged `mode` will be silently dropped in the shared store.** Add:
  ```js
  if (body.mode === "countdown" || body.mode === "cards") session.mode = body.mode;
  ```
- Update the endpoint doc comment at the top of `worker/index.js`.
- **Tell the user at the end that the Worker needs a manual Quick Edit redeploy**, or mode tags will only exist in local cache. Same trap as the weighted-mode `rawCount`/`weightLbs` fields.

---

## Verification (do all of this before declaring done)

Camera-based rep detection can't be driven from the desktop preview, so **expose a temporary test hook** (e.g. `window.__t = { forceRep, setMode }`) to drive reps programmatically, then **remove it before committing** — a leftover `window.__debug` has nearly shipped here before, so grep for it after.

1. `node --check app.js && node --check worker/index.js`
2. SW cache-clear ritual (unregister SWs + clear caches, then reload) before every preview check — stale caches have repeatedly caused false "my fix didn't work" results here.
3. Countdown: with PR = N, verify start shows N+1, decrements per rep, hits 0 exactly at rep N+1, fires the record celebration **once**, then counts up.
4. Countdown with no sessions: segment is disabled, shows the hint, cannot be selected.
5. Cards: verify the sprite maps correctly (A♠ top-left, K♣ bottom-right), the card advances at exactly the right rep, the flip plays, the session total accumulates across cards, and **reps during the flip still count**.
6. Deck persistence: draw several cards, reload mid-session, confirm no repeats; run through all 52 and confirm a clean reshuffle.
7. Both themes: light/dark sprite swaps correctly.
8. Classic mode is **completely unchanged** — this is a regression risk, verify explicitly.
9. Logging: complete a session in each mode, confirm the `mode` tag lands in local cache and the count flows into totals/streak/PR normally.
10. Weighted mode + Cards: confirm card progress uses raw reps while the logged total is multiplied.

## Ship checklist (repo conventions — see CLAUDE.md)
- Bump `sw.js` `CACHE_NAME` (currently `bpb-shell-v39` → v40).
- `git fetch` first — the live app pushes real gameplay commits to `data.json` independently; merge before pushing.
- Commit, push, then verify live via curl.
- **Remind the user to redeploy the Worker via Cloudflare Quick Edit** (paste `worker/index.js`).
