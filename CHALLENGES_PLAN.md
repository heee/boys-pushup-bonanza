# Challenges Module — Build Plan

Executable spec for adding a **Challenges** module to Boys Pushup Bonanza.
Written to be implemented step-by-step without further product decisions —
all decisions below are final unless Henning says otherwise.

## Locked decisions

1. **Active tab shows ALL currently-running challenges**, joined or not.
   Unjoined ones show a JOIN button on the card. People can join mid-challenge.
2. **Retroactive credit**: progress is derived purely from session timestamps
   within the challenge window. A late joiner's earlier in-window sessions count.
   No per-user join timestamps are stored.
3. **Three goal types**: `individual`, `collective`, `streak` (see schema).
4. **Winner recognition**: Past cards show 🥇 + winner name(s) + score. No
   profile badges in v1.
5. Challenge definitions are **static** in `challenges.json` at repo root,
   curated via git. No admin UI.
6. Joining requires connectivity (no offline join queue in v1). On failure,
   toast "Couldn't join — check your connection."
7. Joining is one-way in v1 (no leave button).

## Architecture summary

- **No new logging.** Every challenge stat (totals, leaderboards, streaks,
  recent sessions) is derived from the existing `data.json` sessions filtered
  by challenge window + participant list.
- New shared state: `challengeParticipants` map in `data.json`
  (`{ [challengeId]: ["Name", ...] }`).
- One new Worker endpoint: `POST /join-challenge`.
- New static file `challenges.json` (definitions), fetched network-first
  (see service worker note — it must NOT be cache-first).

---

## 1. `challenges.json` (new file, repo root)

Create with exactly this content (goals are Henning-tuned starting values):

```json
{
  "challenges": [
    {
      "id": "worldcup-2026",
      "title": "World Cup Final Push",
      "emoji": "⚽",
      "tagline": "The World Cup is on home soil. Every rep is a penalty saved.",
      "start": "2026-07-11",
      "end": "2026-07-19",
      "goalType": "individual",
      "goal": 250,
      "gradient": ["#1a5c2e", "#7ec850"]
    },
    {
      "id": "back-to-school-2026",
      "title": "Back to School: Report Card",
      "emoji": "🎒",
      "tagline": "Earn your A in pump class. No summer slacking on the transcript.",
      "start": "2026-08-01",
      "end": "2026-08-31",
      "goalType": "individual",
      "goal": 600,
      "gradient": ["#8a3a2e", "#e8a04a"]
    },
    {
      "id": "stein-hoist-2026",
      "title": "Stein Hoist September",
      "emoji": "🍺",
      "tagline": "Oktoberfest arm insurance. 10,000 together before the first Maß.",
      "start": "2026-09-01",
      "end": "2026-09-30",
      "goalType": "collective",
      "goal": 10000,
      "gradient": ["#c9982e", "#f5e19a"]
    },
    {
      "id": "pumpkin-spice-2026",
      "title": "Pump-kin Spice",
      "emoji": "🎃",
      "tagline": "No tricks, all pecs. 666 reps before the witching hour.",
      "start": "2026-10-01",
      "end": "2026-10-31",
      "goalType": "individual",
      "goal": 666,
      "gradient": ["#4a2a5e", "#e8762e"]
    },
    {
      "id": "club-180-2026",
      "title": "The 180 Club",
      "emoji": "🎯",
      "tagline": "One week, 180 reps — a perfect checkout. Dart tournament rules: lose a leg, owe ten.",
      "start": "2026-10-12",
      "end": "2026-10-18",
      "goalType": "individual",
      "goal": 180,
      "gradient": ["#2e4a2e", "#a83232"]
    },
    {
      "id": "earn-your-bird-2026",
      "title": "Earn Your Bird",
      "emoji": "🦃",
      "tagline": "Ends Thanksgiving. Every rep is a guilt-free bite of stuffing.",
      "start": "2026-11-01",
      "end": "2026-11-26",
      "goalType": "individual",
      "goal": 500,
      "gradient": ["#6b4a2e", "#c98a3a"]
    },
    {
      "id": "spoetzl-sprint-2026",
      "title": "Spoetzl Sprint",
      "emoji": "🍻",
      "tagline": "1,909 together before the Shiner pilgrimage — the year Cosmo fired up the brewery. Prost.",
      "start": "2026-11-09",
      "end": "2026-11-22",
      "goalType": "collective",
      "goal": 1909,
      "gradient": ["#6b4a2e", "#e8b23a"]
    },
    {
      "id": "turkey-trot-day-2026",
      "title": "Turkey Trot Day",
      "emoji": "🏃",
      "tagline": "Flash challenge: 100 reps on Thanksgiving Day. Phil has a podium to defend.",
      "start": "2026-11-26",
      "end": "2026-11-26",
      "goalType": "individual",
      "goal": 100,
      "gradient": ["#8a5a2e", "#d99a4a"]
    },
    {
      "id": "fitmas-2026",
      "title": "12 Days of Fitmas",
      "emoji": "🎅",
      "tagline": "Survive the holidays. Twelve straight days, no excuses under the tree.",
      "start": "2026-12-13",
      "end": "2026-12-24",
      "goalType": "streak",
      "goal": 12,
      "gradient": ["#8a2e2e", "#2e6b3a"]
    },
    {
      "id": "every-damn-day-2027",
      "title": "Every Damn Day January",
      "emoji": "🔥",
      "tagline": "The resolution flagship. 31 days, zero misses. Who actually shows up?",
      "start": "2027-01-01",
      "end": "2027-01-31",
      "goalType": "streak",
      "goal": 31,
      "gradient": ["#b5482f", "#e8c468"]
    },
    {
      "id": "buck-the-floor-2027",
      "title": "Buck the Floor",
      "emoji": "🤠",
      "tagline": "Rodeo Run training season through the last day of RodeoHouston. 8 seconds is a ride, 8 pushups is a warmup.",
      "start": "2027-02-01",
      "end": "2027-03-14",
      "goalType": "individual",
      "goal": 1000,
      "gradient": ["#7a4a2e", "#d9b66a"]
    },
    {
      "id": "super-bowl-sunday-2027",
      "title": "Super Bowl Sunday",
      "emoji": "🏈",
      "tagline": "Flash challenge: 200 reps between kickoff and the final whistle. Halftime show optional, pushups aren't.",
      "start": "2027-02-14",
      "end": "2027-02-14",
      "goalType": "individual",
      "goal": 200,
      "gradient": ["#2e5e3a", "#8a6a3a"]
    },
    {
      "id": "mudbug-madness-2027",
      "title": "Mudbug Madness",
      "emoji": "🦞",
      "tagline": "Crawfish season, baby. Peel. Pinch. Push. Earn your spot at the boil.",
      "start": "2027-03-15",
      "end": "2027-04-05",
      "goalType": "individual",
      "goal": 640,
      "gradient": ["#8a2e2e", "#e8623a"]
    },
    {
      "id": "go-low-get-high-2027",
      "title": "420: Go Low to Get High",
      "emoji": "🌿",
      "tagline": "Exactly 420 reps. Ends 4/20. Blaze through it.",
      "start": "2027-04-01",
      "end": "2027-04-20",
      "goalType": "individual",
      "goal": 420,
      "gradient": ["#2e5e3a", "#8ac850"]
    },
    {
      "id": "memorial-murph-2027",
      "title": "Memorial May Murph-ish",
      "emoji": "🎖️",
      "tagline": "Honor the fallen the hard way. 900 reps across May.",
      "start": "2027-05-01",
      "end": "2027-05-31",
      "goalType": "individual",
      "goal": 900,
      "gradient": ["#3a4a2e", "#a8b45e"]
    },
    {
      "id": "pterodactyls-2027",
      "title": "Make Pterodactyls Fly",
      "emoji": "🦖",
      "tagline": "5,000 combined reps — enough collective thrust for takeoff.",
      "start": "2027-06-01",
      "end": "2027-06-30",
      "goalType": "collective",
      "goal": 5000,
      "gradient": ["#2e5e5e", "#7ac8a8"]
    },
    {
      "id": "club-1776-2027",
      "title": "The 1776 Club",
      "emoji": "🎆",
      "tagline": "Texas-sized America challenge. 1,776 reps. Hardcore tier. God bless.",
      "start": "2027-07-01",
      "end": "2027-07-31",
      "goalType": "individual",
      "goal": 1776,
      "gradient": ["#8a2e2e", "#2e3a8a"]
    }
  ]
}
```

Schema notes:
- `start`/`end` are `YYYY-MM-DD`, **inclusive**, interpreted in the device's
  local timezone: start = local midnight of `start`, end = 23:59:59.999 local
  of `end`. Parse with `new Date(y, m-1, d)` — never `new Date("YYYY-MM-DD")`
  (that parses as UTC and shifts days).
- `goalType: "individual"` → `goal` = reps per participant.
- `goalType: "collective"` → `goal` = combined reps of all participants.
- `goalType: "streak"` → `goal` = consecutive days (a day counts if the
  participant logged ≥ 1 session that local day within the window).
- `gradient` = two hex colors for the card background.
- `start` = `end` produces a one-day **flash challenge** — no special code
  path needed; the window math handles it. Challenges may overlap freely
  (sprints and flash days layer on top of monthly challenges by design).
- Placeholder dates to revisit: `club-180-2026` (sync to the actual dart
  tournament night when scheduled) and `spoetzl-sprint-2026` (sync to the
  booked Shiner brewery trip).

## 2. Worker changes (`worker/index.js`)

Add endpoint (same auth/validation pattern as existing endpoints):

```
POST /join-challenge   body: { user, challengeId }
```

- Validate `user` (trim, ≤ 40 chars, non-empty) and `challengeId`
  (string, trim, ≤ 64 chars, non-empty, must match /^[a-z0-9-]+$/).
- Mutation via existing `commitMutation`:
  ```js
  if (!data.challengeParticipants || typeof data.challengeParticipants !== "object") {
    data.challengeParticipants = {};
  }
  const list = data.challengeParticipants[challengeId] || [];
  if (!list.includes(user)) list.push(user);
  data.challengeParticipants[challengeId] = list;
  ```
  Commit message: `Join challenge: ${user} -> ${challengeId}`.
- Also update the existing `/delete-user` mutation to remove the user from
  every `challengeParticipants` array:
  ```js
  if (data.challengeParticipants) {
    for (const k of Object.keys(data.challengeParticipants)) {
      data.challengeParticipants[k] = data.challengeParticipants[k].filter((u) => u !== user);
    }
  }
  ```
- Update `fetchGithubFile` defaults: ensure `data.challengeParticipants`
  defaults to `{}` (same pattern as `data.avatars`).
- Update the endpoint comment block at the top of the file.

**IMPORTANT — tell Henning after building:** the Worker is deployed manually.
He must paste the updated `worker/index.js` into the Cloudflare dashboard
(Edit code → Deploy). Until then, JOIN buttons will error politely. Offer to
verify `/join-challenge` via curl afterward (pattern: POST with
`X-App-Key: Bonanza` header; clean up any test join by hand-editing is NOT
possible via endpoint — so test with a real expected user name, e.g.
`{"user":"Henning","challengeId":"stein-hoist-2026"}`, which is harmless).

## 3. Client data plumbing (`app.js`)

### Fetching definitions

```js
const CHALLENGES_URL = "challenges.json";
let challengeDefs = [];           // module-level cache
async function loadChallenges() {
  try {
    const res = await fetch(CHALLENGES_URL, { cache: "no-cache" });
    const json = await res.json();
    challengeDefs = Array.isArray(json.challenges) ? json.challenges : [];
  } catch (e) { /* keep previous value; empty list renders an empty state */ }
}
```
Call `loadChallenges()` in `init()` and at the start of `renderChallengesScreen()`.

### Participants

- `getCachedData()` / `workerFetchData()`: default `data.challengeParticipants`
  to `{}` (same normalization pattern as `avatars`).
- `workerJoinChallenge(user, challengeId)` — same fetch pattern as
  `workerSetAvatar`, POST to `/join-challenge`.
- After a successful join: update local cache
  (`cached.challengeParticipants[id]`), re-render, `toast("You're in! 💪")`.

### Derivation helpers (pure functions)

```js
function challengeWindow(c) → { startDate, endDate }   // local-tz parsing per schema note
function challengeStatus(c, now) → "upcoming" | "active" | "past"
function challengeParticipantsOf(c) → string[]          // from cached data
function challengeSessions(c) → Session[]               // all sessions by participants inside window
function challengeTotal(c) → number                     // sum of counts
function userChallengeTotal(c, name) → number
function windowStreak(sessions, name, startDate, endDate) → { best, current }
  // best = longest run of consecutive local days with ≥1 session in window
  // current = run ending today (or yesterday if today has no session yet)
function challengeLeaderboard(c) → [{ name, score }]    // sorted desc
  // individual/collective: score = userChallengeTotal
  // streak: score = windowStreak(...).best
function challengeWinners(c) → string[]                 // all names tied at max score; [] if no sessions
function daysLeft(c, now) → number                      // ceil to end-of-window, min 0
function daysUntilStart(c, now) → number
```

## 4. Navigation (`index.html` + `app.js`)

Header (order matters):

```html
<button id="streak-badge" ...></button>
<button id="btn-nav-challenges" class="icon-btn" aria-label="Challenges" title="Challenges">🎯</button>
<button id="btn-nav-dashboard" ...>🏆</button>
<button id="btn-nav-settings" ...>⚙️</button>
```

Wire like existing buttons:
```js
$("btn-nav-challenges").addEventListener("click", () =>
  guardLeaveWorkout(() => showScreen("screen-challenges")));
```

## 5. Screens (`index.html`)

### Screen: challenges list

```html
<section id="screen-challenges" class="screen">
  <h1 class="screen-title">Challenges 🎯</h1>
  <div id="challenge-tab-select" class="segmented" role="tablist">
    <button class="segment active" data-ctab="active">Active</button>
    <button class="segment" data-ctab="upcoming">Upcoming</button>
    <button class="segment" data-ctab="past">Past</button>
  </div>
  <div id="challenge-list" class="challenge-list"></div>
</section>
```

### Screen: challenge detail

```html
<section id="screen-challenge-detail" class="screen">
  <button id="btn-challenge-back" class="btn btn-small">← All challenges</button>
  <div id="challenge-detail-body"></div>
</section>
```

`showScreen` additions: `screen-challenges` → `renderChallengesScreen()`;
detail screen is rendered by `openChallengeDetail(id)` (stores
`state.openChallengeId`, renders body, then `showScreen("screen-challenge-detail")`).
Back button returns to `screen-challenges`.

## 6. Rendering

### Card (list view), per challenge

- Root `div.challenge-card`, `style="background: linear-gradient(135deg, C1, C2)"`,
  click → `openChallengeDetail(id)`.
- Contents:
  - `div.challenge-card-emoji` — the emoji, large (~2.6rem)
  - `div.challenge-card-title` — title
  - `div.challenge-card-dates` — "Jul 11 – Jul 19" plus status chip:
    active → "N days left", upcoming → "Starts in N days", past → "Ended <date>"
  - `div.challenge-card-meta` — "👥 N joined · ∑ N pushups"
  - Active/Upcoming + not joined → `button.btn.btn-primary.challenge-join-btn`
    "JOIN" (`event.stopPropagation()` in its click handler, then
    `joinChallenge(id)`)
  - Joined → `span.challenge-joined-chip` "✓ In"
  - Past → winner line: `🥇 Name — score` (join ties with " & ";
    for streak append " days"). Omit if no winners.
- Tab filtering: `active`/`upcoming`/`past` via `challengeStatus`.
  Sort: active by soonest end first; upcoming by soonest start; past by most
  recently ended first.
- Empty states (reuse `.leaderboard-empty` styling):
  Active: "No challenge running right now — check Upcoming."
  Upcoming: "Nothing on the calendar yet. Tell Henning."
  Past: "No completed challenges yet."

### Detail view

Top to bottom:
1. Hero: same gradient background, big emoji, title, tagline, dates + status chip.
2. If not joined and not past: JOIN button (full width, `btn-primary`).
3. **My progress** (only if joined):
   - individual: thermometer (reuse `.thermometer-track/.thermometer-fill`
     markup pattern with a local instance, NOT the workout ids) — my total vs
     `goal`, label "X / GOAL · N days left". Fill green (`.thermometer-win`)
     when goal reached.
   - collective: same thermometer but group total vs goal, label
     "X / GOAL together · N days left"; below it "Your contribution: N".
   - streak: label "Current streak: X days · Best: Y / GOAL days"; thermometer
     fills best/goal.
4. Overview stat grid (reuse `.stats-grid`/`.stat-card`): Duration ("Jul 1 – 31"),
   Participants, Total pushups, Days left (or "Ended").
5. **Leaderboard**: reuse `.leaderboard-row` markup incl. avatars + `TROPHIES`;
   score column = reps (individual/collective) or "N days" (streak).
6. **Recent flexes**: top 5 most recent in-window sessions by participants,
   reuse `.recent-row` markup.

### Join flow

```js
async function joinChallenge(id) {
  if (!state.currentUser) { toast("Pick your name on the home screen first."); return; }
  try { await workerJoinChallenge(state.currentUser, id); }
  catch (e) { toast("Couldn't join — check your connection.", 4000); return; }
  const cached = getCachedData();
  if (!cached.challengeParticipants[id]) cached.challengeParticipants[id] = [];
  if (!cached.challengeParticipants[id].includes(state.currentUser))
    cached.challengeParticipants[id].push(state.currentUser);
  cacheData(cached);
  toast("You're in! 💪");
  // re-render whichever view is open
}
```

`renderChallengesScreen()` should also `refreshFromRemote()` first (same
pattern as `renderDashboard`) so participant lists and totals are fresh.

## 7. CSS (`style.css`)

New classes (follow existing design language: 16–18px radii, `var(--shadow)`,
800-weight titles):

```
.challenge-list { display: flex; flex-direction: column; gap: 0.8rem; }
.challenge-card { border-radius: 18px; padding: 1rem 1.1rem; color: #fff;
  box-shadow: var(--shadow); cursor: pointer; position: relative;
  text-shadow: 0 1px 3px rgba(0,0,0,0.4); }
.challenge-card-emoji { font-size: 2.6rem; line-height: 1; }
.challenge-card-title { font-size: 1.15rem; font-weight: 900; margin-top: 0.3rem; }
.challenge-card-dates { font-size: 0.82rem; font-weight: 700; opacity: 0.9; }
.challenge-card-meta  { font-size: 0.85rem; font-weight: 700; margin-top: 0.4rem; }
.challenge-join-btn   { position: absolute; top: 1rem; right: 1rem; }
.challenge-joined-chip { position: absolute; top: 1rem; right: 1rem;
  background: rgba(0,0,0,0.35); border-radius: 999px; padding: 0.3rem 0.7rem;
  font-weight: 800; font-size: 0.8rem; }
.challenge-winner-line { margin-top: 0.5rem; font-weight: 800; }
.challenge-hero { /* detail header: same gradient, larger emoji, centered */ }
.challenge-status-chip { display: inline-block; background: rgba(0,0,0,0.35);
  border-radius: 999px; padding: 0.2rem 0.6rem; font-size: 0.78rem; }
```

White text + text-shadow keeps both themes readable on gradients — verify
contrast on the lightest gradient (`stein-hoist-2026`) in light theme; darken
its colors if illegible.

## 8. Service worker (`sw.js`)

Two required changes:
1. Bump `CACHE_NAME` (`bpb-shell-v16` → next number at build time).
2. The runtime cache is **cache-first for all same-origin GETs**, which would
   freeze `challenges.json` forever. Add an exclusion so it always passes
   through to the network:
   ```js
   if (url.pathname.endsWith("/challenges.json")) return; // network only
   ```
   Place next to the existing cross-origin early-return in the fetch handler.
   Do NOT add challenges.json to SHELL_FILES.

## 9. README

Add a short "Challenges" section: definitions live in `challenges.json`
(schema summary + the local-timezone/inclusive-dates rule), participants sync
via the Worker, and editing/adding a challenge = edit JSON + push (no cache
bump needed since it's network-fetched).

## 10. Verification checklist (before pushing)

Use the local static server + browser tools, seed `localStorage`
(`bpb-cache-data`, `bpb-last-user`) with fake sessions/participants spanning
each challenge state. Screenshot each:

1. Header shows 🎯; click navigates to Challenges; guard works mid-workout.
2. Active tab: running challenge; unjoined shows JOIN, joined shows "✓ In".
3. Upcoming tab: future challenge with "Starts in N days" + JOIN.
4. Past tab: ended challenge with 🥇 winner line (verify tie shows both names).
5. Detail (individual): thermometer correct vs seeded totals; green at goal.
6. Detail (collective): group thermometer + "your contribution".
7. Detail (streak): seed sessions on consecutive days; verify best/current.
8. Leaderboard + Recent flexes render with avatars; streak scores say "days".
9. Both themes; mobile viewport (390×844); no console errors.
10. `challenges.json` fetch is NOT served from SW cache after edits
    (verify via network panel after a reload).

## 11. Ship steps

1. Commit all files (app.js, index.html, style.css, sw.js bump,
   challenges.json, worker/index.js, README, this plan can stay).
2. Push; confirm Pages build via
   `gh api repos/heee/boys-pushup-bonanza/pages/builds/latest` (manually
   re-trigger with a POST to `.../pages/builds` if stuck — it has stuck before).
3. Verify live: `curl` app.js for a new symbol (e.g. `joinChallenge`) and
   sw.js for the new CACHE_NAME.
4. Remind Henning: **manual Worker redeploy required** (paste
   `worker/index.js` into Cloudflare dashboard), then verify
   `/join-challenge` with curl and confirm `challengeParticipants` appears
   in `/data`.

## Future enhancements (explicitly out of scope for v1)

- Leave-challenge button (+ `/leave-challenge` endpoint)
- Profile medal counts (🏅 per challenge won) on leaderboard rows
- Share hook: "I just joined {title} — in?" via existing share plumbing
- Push-style nudges when a challenge is ending and you're short of goal
- Handicaps / pro-rated goals for late joiners
