# Boys Push Up Bonanza 💪

A mobile-first pushup counter and shared leaderboard. Lay the phone flat on the
floor, screen up, do pushups over the front camera, and it counts reps by tracking
how close your face gets to the phone. Shared user and workout data lives in a
private Cloudflare D1 database behind a Cloudflare Worker, never in the public Git
repository. **Setup is one-time for the admin and zero-touch for everyone else.**

Everything the front-end needs is static: `index.html` + `style.css` + `app.js`,
plus a `manifest.json` and `sw.js` for installing it as a PWA. Face detection loads
MediaPipe's Face Detector model from a CDN at runtime. The only non-static piece is
`worker/index.js`, a ~150-line Cloudflare Worker you deploy once.

---

## 1. Create the GitHub repository

1. On GitHub, create a **new repository** (public or private both work).
   - e.g. `boys-pushup-bonanza`
2. Add all the files from this project to that repo (`index.html`, `style.css`,
   `app.js`, `manifest.json`, `sw.js`, `icons/`, `worker/`, this `README.md`).
3. Do not add workout or user datasets to Git. `data.json` is intentionally absent.

4. Commit and push. Shared data will live in Cloudflare D1.

## 2. Create the D1 database

Create a Cloudflare D1 database, apply the SQL files in `worker/migrations/` in
numeric order, and bind it to the Worker using the binding name `DB`. Existing
databases should likewise apply each newer migration once (D1 dashboard → your
database → Console, paste and run the file's contents).

## 3. Deploy the Cloudflare Worker (you only, one time)

This is the piece that lets friends skip all GitHub setup. It's a free Cloudflare
account and a few minutes, no CLI required.

1. Sign up / log in at <https://dash.cloudflare.com> (free plan is plenty for this).
2. Go to **Workers & Pages → Create → Create Worker**. Give it a name (e.g.
   `boys-pushup-bonanza-worker`) and deploy the default "Hello World" template first
   — you'll replace the code next.
3. Open the Worker, click **Edit code** (Quick Edit), delete everything in the
   editor, and paste in the full contents of [`worker/index.js`](worker/index.js)
   from this repo. Click **Deploy**.
4. Back on the Worker's overview page, go to **Settings → Variables and Secrets**
   and add:
   - `DB` (D1 binding) — the database created in step 2
   - `ALLOWED_ORIGIN` (variable) — your GitHub Pages URL, e.g.
     `https://heee.github.io` (or `*` if you'd rather not restrict it)
   - `APP_KEY` (**secret**) — make up any random string; you'll paste this same
     string into `app.js` in the next step
   - `GEOAPIFY_API_KEY` (**secret**) — a Geoapify key with Geocoding API access;
     this stays in the Worker and powers location search and reverse geocoding
5. Note the Worker's URL, shown at the top of its overview page — it looks like
   `https://boys-pushup-bonanza-worker.<your-subdomain>.workers.dev`.
6. Open `app.js` in this repo and update the two constants near the top:

   ```js
   const WORKER_URL = "https://boys-pushup-bonanza-worker.<your-subdomain>.workers.dev";
   const APP_KEY = "<the same random string you used for the APP_KEY secret>";
   ```

7. Commit and push that change. (If Pages is already deployed, this redeploys
   automatically — see the next section if you haven't deployed yet.)

That's it — from here on, anyone who opens the site can complete a workout and it
syncs to everyone's leaderboard immediately, with no Settings screen fiddling.

> **On `APP_KEY`:** it's baked into `app.js`, which is public source anyone can view
> — so it is **not** real security, just a speed bump against someone stumbling on
> your Worker URL and poking at it. D1 remains accessible only through the Worker.

## 4. Deploy to GitHub Pages

1. In the repo, go to **Settings → Pages**.
2. Under "Build and deployment", set **Source** to **Deploy from a branch**.
3. Pick your default branch (e.g. `main`) and folder `/ (root)`, then **Save**.
4. GitHub will publish the site at `https://<owner>.github.io/<repo>/` within a
   minute or two (check the Pages settings page for the exact URL and build status).
5. GitHub Pages serves everything over HTTPS automatically, which is required for
   `getUserMedia` (camera) to work.

Since there's no build step, any push to that branch redeploys the site — just edit
files and push.

## 5. Add it to your iPhone home screen

Share this same set of steps with friends — this is the *only* thing they need to
do. No GitHub account, no token, nothing to type into Settings.

1. Open the GitHub Pages URL in **Safari** on the iPhone (must be Safari, not
   Chrome/Firefox — only Safari can install PWAs to the home screen on iOS).
2. Tap the **Share** icon (square with an arrow) in the toolbar.
3. Scroll down and tap **Add to Home Screen**.
4. Confirm the name ("Pushup Bonanza") and tap **Add**.
5. Launch it from the home screen icon from now on — it opens fullscreen without
   Safari's address bar, and the Wake Lock API keeps the screen on during a session.
6. Pick a name on the first screen and start doing pushups. That's the whole setup.

If you update the code later, pushing to GitHub Pages updates the live site
immediately — the installed home screen icon just reopens that same URL. Devices
that already have it installed may still see the old cached version for a bit
because of the service worker — bump `CACHE_NAME` in `sw.js` (e.g. `bpb-shell-v2`)
whenever you ship a meaningful change, so installed copies pick up the update
promptly instead of serving stale files indefinitely.

---

## Calibration guide

Rep detection works by measuring the height of your detected face's bounding box as
a fraction of the camera frame height. As your face gets closer to the phone (bottom
of a pushup), that fraction goes **up**; as you push back up, it goes back **down**.
A rep counts on a full down → up cycle (hysteresis prevents jitter from counting
double).

- **Down threshold** (default `0.55`): the ratio has to reach *at least* this value
  to register the "down" (chest near floor) position.
- **Up threshold** (default `0.32`): the ratio has to drop *back below* this value to
  register "up" and count the rep.
- The gap between the two thresholds is the hysteresis band — it's what stops small
  camera-angle jitter from triggering false reps.

### How to tune it

1. Open **Settings (⚙️) → Calibration**.
2. Turn on **"Show live calibration readout during workout"**.
3. Go to the workout screen, place the phone as you normally would, and tap **START**.
4. Do a few slow, deliberate pushups. Watch the small readout under the rep count —
   it shows the live smoothed ratio and whether the app thinks you're in the "up" or
   "down" phase.
5. Note the ratio value at the very bottom of your pushup (chest closest to phone)
   and at the very top (arms extended).
   - Set **Down threshold** a little *below* your bottom-of-rep value, so it reliably
     triggers even if you don't go all the way down every time.
   - Set **Up threshold** a little *above* your top-of-rep value, so it reliably
     resets even if your arms aren't fully locked out.
   - Keep a healthy gap between the two — too narrow a gap re-introduces jitter.
6. Do a full set at normal pace and watch the count on screen (or just listen to the
   spoken numbers) to confirm every rep is being caught and nothing is double-counted.

Things that affect calibration per person/phone:
- **Phone placement**: taller people or a phone propped at a slight angle changes
  the face-to-camera distance at both extremes — recalibrate per setup if it feels off.
- **Camera field of view**: different iPhone models have slightly different front
  camera FOVs, which shifts the ratio range — thresholds may need small per-device
  tweaks the first time.
- **Lighting**: very dark rooms reduce face-detection confidence and can cause brief
  drops (handled by the "paused" auto-recovery), but won't affect threshold values.

If detection frequently drops out and pauses ("PAUSED — find your face"), make sure
the phone is positioned so your face stays in frame through the whole rep, and that
there's enough ambient light.

---

## How the shared data storage works

- The front-end never talks to GitHub directly — it only calls your Worker's `/data`
  (GET) and `/session` (POST) endpoints.
- On load (and whenever you open the Leaderboard), the app calls `GET /data`; the
  Worker queries normalized D1 tables and returns the existing client data shape.
- When you complete a session, the app immediately shows it locally, then calls
  `POST /session`. The Worker stores it through prepared D1 queries, so concurrent
  workouts cannot overwrite one another.
- New sessions include a compact, validated ten-second progression array used by
  Session Detail graphs. Historical sessions remain valid and simply omit it.
- If the request fails for any reason (offline, Worker down, or D1 unavailable), the
  session is queued in `localStorage` instead of being lost. The app automatically
  retries everything queued the next time it loads, or the next time you open
  Settings or the Leaderboard.
- Because of this, **no completed session is ever silently dropped** — worst case it
  just sits queued on that device until connectivity is restored.
- User data is not stored in the Git repository.

## Session locations

The home screen can keep one device-wide location for every user on that device.
Automatic mode requests a fresh high-accuracy position only after the user taps
**Use current location**; later launches refresh silently only when location
permission is already granted. Manual search stays fixed until the user switches
back to current location, and clearing disables automatic refresh.

Only Geoapify's **Geocoding API** is required (forward search plus reverse
geocoding). Map Tiles, Places, Routing, Boundaries, and Address Autocomplete are
not used. See [`docs/location-tracking.md`](docs/location-tracking.md) for the
stored schema and privacy boundaries.

## Challenges

Themed, opt-in competitions with their own leaderboard, time window, and goal —
"World Cup Final Push," "12 Days of Fitmas," and so on.

- Definitions live in **`challenges.json`** at the repo root — a plain array, no
  build step, no admin UI. To add or edit a challenge, edit that file and push;
  it's fetched fresh on every visit to the Challenges tab (never cached by the
  service worker), so there's nothing to redeploy or cache-bust.
- Each entry: `id` (kebab-case, must match `/^[a-z0-9-]+$/`), `title`, `emoji`,
  `tagline`, `start`/`end` (`YYYY-MM-DD`, **inclusive**, interpreted in the
  device's local timezone — a challenge can be a single day by setting
  `start === end`), `goalType` (`individual` | `collective` | `streak`), `goal`
  (reps per person / combined reps / consecutive days, depending on
  `goalType`), and `gradient` (two hex colors for the card background).
- Everything else — totals, leaderboards, streaks, "recent flexes" — is
  derived on the fly from the same `sessions` array used everywhere else in
  the app, filtered to each challenge's participant list and date window.
  Joining a challenge mid-run counts your sessions from the whole window
  retroactively; there's no per-user join timestamp.
- Who's opted into what is the one new piece of shared state:
  stored in D1 and written through the Worker's `/join-challenge` endpoint.

## Voice

Reps, cheers and summaries are spoken with **pre-rendered audio clips**, not the
browser's built-in `speechSynthesis` (which sounds robotic and, worse, has enough
startup lag that a rep count lands after the rep).

The trick is that the app's spoken vocabulary is small and fixed — numbers, a
handful of cheers, and the prose around the number in each summary line — so it
gets rendered once at build time and shipped as static files. That means natural
voice quality, **zero** playback latency, no per-use cost, and it works offline.

- **`voice-lines.js`** is the single source of truth for every phrase the app can
  say. Both the browser and the generator import it, so the shipped audio can't
  drift from the strings the app actually speaks.
- **`scripts/generate-voice.js`** renders the corpus to `assets/voice/*.mp3` plus
  a `manifest.json`. Clip filenames are hashed over voice + model + instructions +
  text, so reruns with unchanged settings are free and stale clips get pruned.
- **`voice.js`** resolves a string to clips by greedy longest-match against the
  manifest, then schedules them back-to-back through Web Audio. Anything it can't
  resolve falls back to `speechSynthesis`, so nothing ever goes silent — including
  a fresh checkout where the clips haven't been generated yet.

To (re)generate the audio — ~212 clips, ~3.4k characters, a few cents:

```bash
node scripts/generate-voice.js --dry-run
```

```bash
node scripts/generate-voice.js
```

Needs `OPENAI_API_KEY` in the environment (PowerShell: `$env:OPENAI_API_KEY="sk-..."`).
Pass `--voice onyx` (or `ash`, `ballad`, `sage`, …) to change the voice, or
`--instructions "..."` to redirect the performance; either regenerates everything.
Commit the resulting `assets/voice/` directory, and bump `CACHE_NAME` in `sw.js`.

Adding a new spoken line means adding it to `voice-lines.js` and rerunning the
generator — until you do, that one line just falls back to `speechSynthesis`.

## Notes & limitations

- iOS Safari has never implemented the Vibration API, so the haptic buzz on each rep
  is a no-op there — reps are still announced out loud, which does work.
- iOS also won't play Web Audio until an `AudioContext` is resumed inside a real
  user gesture, so `unlockVoice()` is called from the Start Workout / Start Plank
  tap handlers. If audio is ever silent on iPhone, that's the first thing to check.
- The Screen Wake Lock API requires iOS 16.4+ in Safari. On older versions the app
  shows a one-time toast asking you to disable auto-lock manually for the session.
- Face detection runs fully client-side via MediaPipe's WASM/CPU delegate for
  maximum compatibility with iOS Safari — no video ever leaves the device.
- Cloudflare's free plan covers this easily (100,000 requests/day) — a friend group
  doing pushups isn't going to get close.
- D1 Time Travel provides point-in-time recovery; use it before attempting manual
  repairs to production data.
