# Boys Push Up Bonanza 💪

A mobile-first pushup counter and shared leaderboard. Lay the phone flat on the
floor, screen up, do pushups over the front camera, and it counts reps by tracking
how close your face gets to the phone. All data lives in a single `data.json` file
in a GitHub repo — but friends never touch GitHub or paste any token. A small
Cloudflare Worker holds the one GitHub credential server-side and proxies reads and
writes, so **setup is one-time for the admin (you) and zero-touch for everyone else.**

Everything the front-end needs is static: `index.html` + `style.css` + `app.js`,
plus a `manifest.json` and `sw.js` for installing it as a PWA. Face detection loads
MediaPipe's Face Detector model from a CDN at runtime. The only non-static piece is
`worker/index.js`, a ~150-line Cloudflare Worker you deploy once.

---

## 1. Create the GitHub repo and seed `data.json`

1. On GitHub, create a **new repository** (public or private both work).
   - e.g. `boys-pushup-bonanza`
2. Add all the files from this project to that repo (`index.html`, `style.css`,
   `app.js`, `manifest.json`, `sw.js`, `icons/`, `worker/`, this `README.md`).
3. Add a `data.json` file at the **root** of the repo with this exact starting content:

   ```json
   { "sessions": [] }
   ```

4. Commit and push. This file is the shared database — the Worker reads and writes
   to it via the GitHub Contents API. Nothing else in the repo needs to touch it.

## 2. Generate one fine-grained personal access token (you only, one time)

Only you need this token — it lives in the Worker, never on a friend's phone.

1. Go to **GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens** (or open <https://github.com/settings/personal-access-tokens/new>
   directly).
2. **Repository access**: choose "Only select repositories" and pick the
   `boys-pushup-bonanza` repo you just created. Don't grant access to any other repo.
3. **Permissions**: under "Repository permissions", set **Contents** to
   **Read and write**. Leave everything else as "No access".
4. Set an expiration (1 year is the max for fine-grained tokens — put a reminder to
   regenerate it and update the Worker secret when it's about to expire).
5. Generate the token and copy it (starts with `github_pat_...`). GitHub only shows
   it once — you'll paste it into the Worker in the next step.

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
   - `GH_OWNER` (variable) — your GitHub username/org, e.g. `heee`
   - `GH_REPO` (variable) — `boys-pushup-bonanza`
   - `GH_BRANCH` (variable) — `main`
   - `ALLOWED_ORIGIN` (variable) — your GitHub Pages URL, e.g.
     `https://heee.github.io` (or `*` if you'd rather not restrict it)
   - `GITHUB_TOKEN` (**secret**) — the fine-grained token from step 2
   - `APP_KEY` (**secret**) — make up any random string; you'll paste this same
     string into `app.js` in the next step
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
> your Worker URL and poking at it. The actual secret (`GITHUB_TOKEN`) never leaves
> the Worker and is never visible to the browser.

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
immediately — the installed home screen icon just reopens that same URL. If the
service worker cached old files, force-refresh once (or reinstall) after a big update.

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
  Worker fetches `data.json` from GitHub and returns it, and the app caches it locally.
- When you complete a session, the app immediately shows it to you locally, then
  calls `POST /session`. The Worker re-fetches the latest `data.json` (to get the
  current `sha`), merges the new session into the `sessions` array, and commits the
  update — retrying a few times if it raced another write. Re-fetching right before
  writing is what avoids clobbering someone else's session if two people finish
  workouts at nearly the same moment.
- If the request fails for any reason (offline, Worker down, GitHub hiccup), the
  session is queued in `localStorage` instead of being lost. The app automatically
  retries everything queued the next time it loads, or the next time you open
  Settings or the Leaderboard.
- Because of this, **no completed session is ever silently dropped** — worst case it
  just sits queued on that device until connectivity is restored.
- The only credential that can write to the repo (`GITHUB_TOKEN`) lives in the
  Worker's environment and is never sent to or visible from any phone.

## Notes & limitations

- iOS Safari has never implemented the Vibration API, so the haptic buzz on each rep
  is a no-op there — reps are still announced out loud via speech synthesis, which
  does work.
- The Screen Wake Lock API requires iOS 16.4+ in Safari. On older versions the app
  shows a one-time toast asking you to disable auto-lock manually for the session.
- Face detection runs fully client-side via MediaPipe's WASM/CPU delegate for
  maximum compatibility with iOS Safari — no video ever leaves the device.
- Cloudflare's free plan covers this easily (100,000 requests/day) — a friend group
  doing pushups isn't going to get close.
- If a fine-grained token's expiration passes, writes will start failing (reads
  still work, since a stale token just gets rejected on the write path) — regenerate
  the token and update the `GITHUB_TOKEN` secret on the Worker (Settings → Variables
  and Secrets), no redeploy of the front-end needed.
