# Boys Push Up Bonanza 💪

A mobile-first, no-backend pushup counter and shared leaderboard. Lay the phone flat
on the floor, screen up, do pushups over the front camera, and it counts reps by
tracking how close your face gets to the phone. All data is stored as a single
`data.json` file in a GitHub repo, shared by everyone via the GitHub API — no server,
no database, no accounts.

Everything runs client-side: `index.html` + `style.css` + `app.js`, plus a
`manifest.json` and `sw.js` for installing it as a PWA. Face detection loads
MediaPipe's Face Detector model from a CDN at runtime.

---

## 1. Create the GitHub repo and seed `data.json`

1. On GitHub, create a **new repository** (public or private both work — private just
   means you must always use a token, even for reading).
   - e.g. `boys-pushup-bonanza`
2. Add all the files from this project to that repo (`index.html`, `style.css`,
   `app.js`, `manifest.json`, `sw.js`, `icons/`, this `README.md`).
3. Add a `data.json` file at the **root** of the repo with this exact starting content:

   ```json
   { "sessions": [] }
   ```

4. Commit and push. This file is the shared database — the app reads and writes to
   it via the GitHub Contents API.

## 2. Generate a fine-grained personal access token

Each person's phone needs its own token so it can write new sessions to `data.json`.

1. Go to **GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens** (or open <https://github.com/settings/personal-access-tokens/new>
   directly).
2. **Repository access**: choose "Only select repositories" and pick the
   `boys-pushup-bonanza` repo you just created. Don't grant access to any other repo.
3. **Permissions**: under "Repository permissions", set **Contents** to
   **Read and write**. Leave everything else as "No access".
4. Set an expiration (90 days is reasonable — you'll just regenerate it later).
5. Generate the token and copy it (starts with `github_pat_...`). GitHub only shows
   it once.
6. In the app, open **Settings (⚙️)** and paste it into the **Fine-grained token**
   field, along with your repo owner (your GitHub username or org) and repo name.
   Tap **Save connection**, then **Test connection** to confirm it can read
   `data.json`.

Repeat step 6 on every device / for every friend — each person generates their own
token scoped to the same repo. The token is only ever stored in that device's
`localStorage`; it is never hardcoded or committed anywhere.

## 3. Deploy to GitHub Pages

1. In the repo, go to **Settings → Pages**.
2. Under "Build and deployment", set **Source** to **Deploy from a branch**.
3. Pick your default branch (e.g. `main`) and folder `/ (root)`, then **Save**.
4. GitHub will publish the site at `https://<owner>.github.io/<repo>/` within a
   minute or two (check the Pages settings page for the exact URL and build status).
5. GitHub Pages serves everything over HTTPS automatically, which is required for
   `getUserMedia` (camera) to work.

Since there's no build step, any push to that branch redeploys the site — just edit
files and push.

## 4. Add it to your iPhone home screen

1. Open the GitHub Pages URL in **Safari** on the iPhone (must be Safari, not
   Chrome/Firefox — only Safari can install PWAs to the home screen on iOS).
2. Tap the **Share** icon (square with an arrow) in the toolbar.
3. Scroll down and tap **Add to Home Screen**.
4. Confirm the name ("Pushup Bonanza") and tap **Add**.
5. Launch it from the home screen icon from now on — it opens fullscreen without
   Safari's address bar, and the Wake Lock API keeps the screen on during a session.

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

- On load (and whenever you open the Leaderboard), the app fetches `data.json` from
  the repo via the GitHub Contents API and caches it locally.
- When you complete a session, the app immediately shows it to you locally, then
  tries to write it to `data.json`: it re-fetches the latest file (to get the current
  `sha`), merges your new session into the `sessions` array, and commits the update.
  Re-fetching right before writing (and retrying a couple of times) avoids clobbering
  someone else's session if two people finish workouts at nearly the same moment.
- If the write fails for any reason (offline, bad/expired token, GitHub hiccup), the
  session is queued in `localStorage` instead of being lost. The app automatically
  retries everything queued the next time it loads, or the next time you open
  Settings or the Leaderboard.
- Because of this, **no completed session is ever silently dropped** — worst case it
  just sits queued on that device until connectivity/token issues are resolved.

## Notes & limitations

- iOS Safari has never implemented the Vibration API, so the haptic buzz on each rep
  is a no-op there — reps are still announced out loud via speech synthesis, which
  does work.
- The Screen Wake Lock API requires iOS 16.4+ in Safari. On older versions the app
  shows a one-time toast asking you to disable auto-lock manually for the session.
- Face detection runs fully client-side via MediaPipe's WASM/CPU delegate for
  maximum compatibility with iOS Safari — no video ever leaves the device.
