# Horse Mode — Build Plan

Executable spec for the multiplayer **Horse** push-up mode. Companion to the
design handoff (`Push-up Tracker Redesign (bundled).html`, section "Horse") —
all visual specs (colors, chip sizes, rings, pills) live there and in the
handoff .md; this doc locks product/engineering decisions.

## Locked decisions (confirmed with Henning, 2026-08-08)

1. **Async = in-app polling only.** No OS/Web Push in v1. The Home bell badge
   lights when the app (re)fetches `data.json` and finds a pending action for
   the current user. Refetch on load + on visibilitychange.
2. **Horse sets are real sessions.** Every completed turn posts a normal
   session (`mode: "horse"`) — counts toward stats, streaks, challenges, PRs.
3. **Turn screen = layout A only** ("Beat Mia's 32+" hero, own letters as a
   small `1/5 · H` header pill). Layout B is not built.
4. **48h skip rule** for stalled async turns: once `turnStartedAt` is >48h old,
   any player can tap "Skip" on the stalled player → they take a letter, turn
   advances. Enforced by the Worker (server clock), not the client.
5. **Word**: Classic `HORSE` or a random 5-letter word from a curated in-repo
   list (fun/unhinged, non-offensive — e.g. GRUNT, CHAOS, BEANS style; ~60
   entries in a new `horse-words.js`). Reshuffle button re-rolls. Word is fixed
   at game creation.
6. **Push-ups only** in v1 (no squat variant).

## Rules engine (as specced — note the bar behavior)

- Success = reps **≥ target**. The turn-taker's **actual reps become the new
  target** for the next player — this applies after *every* set, including a
  failed one (spec rules 2 & 7: "whoever just completed a set becomes the new
  target-setter"). A failure both assigns a letter **and lowers the bar** to
  the failing count, exactly like basketball HORSE where a miss resets the
  shot. Intentional; do not "fix".
- A skipped player (48h rule) takes a letter but sets **no** new target — the
  bar carries over unchanged.
- Letters are assigned in word order. 5 letters = OUT; OUT players are skipped
  in turn order but stay visible (dimmed, struck through) in lists.
- 2-player game ends the moment one player is OUT; 3+ continues to last
  player standing. Round N = number of completed cycles through the order.

## Architecture

- **New shared state**: `horseGames` array in `data.json` (normalize in
  `storage.js`). Game shape:

```json
{
  "id": "hg-...",
  "word": "HORSE",
  "sessionType": "live" | "invite",
  "status": "active" | "complete",
  "createdBy": "Name",
  "createdAt": 0,
  "turnOrder": ["Name", ...],
  "turnIndex": 0,
  "turnStartedAt": 0,
  "target": 32,
  "targetSetBy": "Mia",
  "round": 1,
  "players": { "Name": { "letters": 2, "out": false, "outAt": null, "declined": false } },
  "sets": [{ "user": "Name", "reps": 33, "needed": 41, "letter": true, "skipped": false, "at": 0 }],
  "winner": null
}
```

- **Live mode** runs entirely client-side (one device): local state machine in
  a new pure module `horse.js`, each set posts a session via the existing
  queue, and the finished game is written once via `POST /horse-create` with
  `status: "complete"` (so summary/rematch/history work identically).
- **Async mode**: `POST /horse-create` at setup; each turn = camera set →
  `POST /horse-turn { gameId, user, reps }` — the **Worker** applies the rules
  (letter, target, advance, elimination, winner) server-side so concurrent
  writes can't corrupt state; response returns the updated game for immediate
  UI. Session posting stays a separate client-side `POST /session` (reuses
  offline queue; the turn POST itself requires connectivity like join-challenge).
- **New Worker endpoints** (`worker/index.js` — manual dashboard redeploy):
  - `POST /horse-create` — validate + append game.
  - `POST /horse-turn` — apply set, run rules, advance turn.
  - `POST /horse-skip` — 48h-guarded letter + advance.
  - `POST /horse-decline` — invited player bows out before their first set;
    removed from turnOrder (game continues if ≥2 players remain, else voided).
  - Rules logic shared conceptually with `horse.js` but duplicated in the
    Worker (it has no module imports today); keep both against `tests/`.
- **Client API** (`api.js`): `createHorseGame`, `postHorseTurn`,
  `skipHorsePlayer`, `declineHorseInvite`.

## Screens (new `screens/horse.js` + markup in `index.html`)

1. **Setup** — word toggle (Classic/Random + reshuffle), session-type toggle,
   player picker reusing existing user-list rows ("Starting" tag on self,
   dashed "+ Invite more"), CTA "Do your set — sets the bar" → camera flow.
2. **Your turn (layout A)** — accent hero "BEAT MIA'S 32+", `1/5 · H` header
   pill, existing camera-tracking box + live count line, existing lock-in FAB.
   Integrates with the existing active-workout flow as `mode: "horse"` in
   `workout-modes.js` (hero model = target remaining).
3. **Turn order** — "Horse · Round N", target reminder line, per-player rows
   with status (Up now / Waiting / OUT), mini 5-chip letter strips, active-row
   ring, OUT rows at 0.5 opacity. Skip affordance appears on the stalled row
   only when the 48h window has passed. Async landing screen.
4. **Letter collected** — "Needed 41+ · you got 33", 74px letter badge with
   red ring, full letter strip, "N letters left", Continue → turn order.
5. **Summary** — crown pill winner banner, ranked list (winner gold-ringed,
   others "OUT · HORS…"), Rematch (new game, same settings/players, winner
   starts) + Share (new entry in `share-messages.js`).

## Home entry points

- **Explore modes**: Horse card in the PUSHUPS section (opens Setup).
- **Bell**: 30×30 circle left of the streak pill, dot badge when pending
  items exist for the current user; dropdown rows: "Your turn in Horse ·
  beat 32+" (→ Your turn) and "Mia invited you to Horse" with Join / Decline.
  Multiple pending games supported. Derived purely from fetched `horseGames`.

## Test plan

- `tests/`: pure-rules tests for `horse.js` (letter assignment, bar reset on
  failure, skip carries bar, 2-player instant end, 3+ last-standing, OUT
  skipping, round counting, decline shrinking to <2 voids game).
- Manual: live 2-player and 3-player pass-the-phone runs; async two-browser
  run against the deployed Worker; bell badge appears after refetch.

## Build order (each step shippable)

1. `horse.js` rules module + tests + `horse-words.js`.
2. Live mode end-to-end: setup (Live only) → turn loop → letter → summary,
   sessions posted, `mode: "horse"` in workout/stats plumbing, Explore card.
   *(Ships value with zero Worker changes.)*
3. Worker endpoints + `storage.js`/`api.js` + async setup path + turn-order
   screen wired to remote state + 48h skip + decline. *(Manual Worker redeploy.)*
4. Bell + dropdown on Home; share message; rematch.

## Complexity

Overall **medium-large** — biggest feature since the Challenges module,
roughly 1.5× it. Cheap parts: rules engine, word list, letter/summary/turn-order
screens (static rendering). Expensive parts: threading `mode: "horse"` through
the existing active-workout/camera flow (app.js is 6.6k lines and this flow is
its spine), the four Worker endpoints with server-side rules (plus manual
redeploy round-trips to test), and the bell dropdown (new Home-header surface).
Live-only (through step 2) is comfortably **medium** and independently
shippable.

## Out of scope (v1)

- Web/OS push notifications, live presence, spectating in-progress sets.
- Squat Horse. Custom word lengths. Handicaps/house rules.
- Abandon-game action (48h skip keeps games moving; revisit if dead games
  accumulate).
