# Fix: voice cues kill Apple Podcasts — build plan

Executor note: follow this plan literally. Where it says "do not", that guard exists because a
previous attempt shipped that exact change and broke all sound. Read "Why the last fix failed"
before writing code.

## Background — the two incidents

1. **Podcast bug (open):** when a boy has Apple Podcasts playing and starts a workout, our voice
   cues stop his podcast — and it never comes back for the rest of the app session.
2. **Regression (reverted):** a prior fix (commits `226ecd1` → `0bdb3e7` → `12e08be`, reverted in
   `5988ea7`; only reachable via reflog) set `navigator.audioSession.type = "ambient"`. Result:
   no voice audio at all on the test device. Reverted.

## Why the podcast dies today

[voice.js](../voice.js) keeps iOS Web Audio reliably audible by playing a **looping silent
`<audio>` element** (`unlockAudioEl`, started in `unlockVoice()`) for the rest of the page's
life. An HTMLMediaElement forces WebKit's page audio session into the native **MediaPlayback**
category, which is *exclusive*: iOS pauses other apps' audio when the session activates. Because
the loop never stops (only `deactivateVoice()` stops it, and that is wired solely to the Settings
sound toggle at [app.js:2128](../app.js:2128)), the page's audio session never deactivates, so
iOS never tells Podcasts it may resume. Even if the boy manually resumes his podcast, our next
voice line kills it again.

## Why the last fix failed (and why "transient" would fail too)

iOS maps web Audio Session types to native `AVAudioSession` categories
(WebKit `DOMAudioSession.cpp`, `fromDOMAudioSessionType()`):

| web type | native category | mixes with Podcasts | audible with Ring/Silent switch on "silent" |
|---|---|---|---|
| `playback` (what a playing `<audio>` forces) | MediaPlayback | ❌ pauses them | ✅ |
| `ambient` (the reverted fix) | AmbientSound | ✅ | ❌ **muted** |
| `transient` (the "obvious next try") | **AmbientSound — same as ambient** | ✅ | ❌ **muted** |
| `transient-solo` | SoloAmbientSound | ❌ | ❌ |

The reverted fix silenced everything because iPhones commonly sit with the Ring/Silent switch on
silent: `ambient` audio is hardware-muted then. `transient` is a trap — WebKit maps it to the
*identical* native category, so it fails the same way. **There is no web-exposed session type
that both mixes and ignores the mute switch** (native apps use `.playback + .mixWithOthers /
.duckOthers`; the web API exposes no options). Any fix built on switching the session type
trades one bug for the other.

## The solution: don't change *what* the session is — change *how long we hold it*

Native workout apps behave like this: claim the audio session while speaking, then deactivate it
with `notifyOthersOnDeactivation`; Apple Podcasts (and Apple Music) honor that signal and resume
automatically. WebKit deactivates a page's audio session once the page goes silent — but our
page **never goes silent** because of the eternal keep-alive loop.

So: keep the exact, proven, mute-switch-immune playback route **unchanged while the coach is
speaking**, but release it (pause the keep-alive loop + suspend the AudioContext) after a grace
period of silence. iOS then deactivates our session and Podcasts resumes on its own. During a
set of fast rep counts the session stays held continuously (reps arrive well inside the grace
window); during rests and after the workout, the podcast comes back.

Why this can't reproduce the "no sound" regression: the audio path while speaking is
byte-for-byte the current shipped one. The only new behavior is *stopping* audio when nothing is
playing, plus re-claiming it the same way `unlockVoice()` already does.

Re-claiming outside a tap is safe: an HTMLMediaElement that has once been `play()`ed inside a
user gesture keeps its gesture activation for the life of the element, and `ctx.resume()` on an
already-unlocked context works outside gestures. Both are verified on-device in the test plan,
with a contingency if iOS disagrees (see Contingency).

Known limitation (document, don't fight it): auto-resume is honored by Apple Podcasts and Apple
Music, but many third-party apps (Spotify, Overcast) ignore the resume signal. For them the fix
still helps — once our session is released, a manual resume from the lock screen *sticks*
between voice lines instead of being re-killed.

Phase 2 adds true simultaneous mixing (podcast never pauses at all) as an **opt-in** Settings
toggle using `ambient` — the reverted code was functionally fine; shipping it as the silent
default for everyone was the mistake. Opt-in + explicit "ring switch must be on" labeling makes
it safe.

---

## Phase 1 — hold-while-speaking route lifecycle (voice.js only)

All changes in [voice.js](../voice.js). No app.js, index.html, or worker changes.

### 1. New constant and state

```js
// How long after the last scheduled sound ends before we release the iOS
// audio route. Long enough that per-rep counting never churns the session,
// short enough that a paused podcast resumes during a normal rest.
const ROUTE_RELEASE_GRACE_MS = 12000;
let routeReleaseTimer = null;
```

### 2. `releaseVoiceRoute()` + `scheduleRouteRelease(activeMs)`

```js
// Releases the OS audio route so iOS deactivates our session and lets the
// interrupted app (Podcasts/Music) resume. Keeps ctx, decoded buffers, and
// unlockAudioEl intact — unlockVoice() re-claims the same objects. Never
// recreate unlockAudioEl: the existing instance carries the user-gesture
// activation that lets it re-play() outside a tap.
function releaseVoiceRoute() {
  if (routeReleaseTimer) { clearTimeout(routeReleaseTimer); routeReleaseTimer = null; }
  if (!unlocked) return;
  unlocked = false;
  clearActiveSources();
  if (unlockAudioEl) {
    try { unlockAudioEl.pause(); } catch (e) { /* best effort */ }
  }
  if (ctx?.state === "running") {
    try { const p = ctx.suspend(); if (p?.catch) p.catch(() => {}); } catch (e) { /* best effort */ }
  }
}

function scheduleRouteRelease(activeMs) {
  if (routeReleaseTimer) clearTimeout(routeReleaseTimer);
  routeReleaseTimer = setTimeout(releaseVoiceRoute, activeMs + ROUTE_RELEASE_GRACE_MS);
}
```

Do **not** touch `buffers`, do **not** set `contextNeedsRefresh`, do **not** call `ctx.close()`.
`deactivateVoice()` stays as-is but must also clear `routeReleaseTimer` at its top.

### 3. Claim cancels release

At the top of `unlockVoice()` (before `refreshAudioGraphIfNeeded()`), clear any pending timer:

```js
if (routeReleaseTimer) { clearTimeout(routeReleaseTimer); routeReleaseTimer = null; }
```

`unlockVoice()` already handles re-claiming (`ctx.resume()` when suspended, replay of
`unlockAudioEl` when `!unlocked`) — no other change to it.

### 4. Schedule a release after every sound

- `play(bufs)`: it already computes the end time in `when`. After the loop:
  `scheduleRouteRelease((when - ctx.currentTime) * 1000);`
- `playZenGong()`: before `return 1150;` add `scheduleRouteRelease(3500);` (longest partial rings 3.2 s).
- `playSharpshooterHit()`: before `return 260;` add `scheduleRouteRelease(400);`
- `speakFallback(text)` and `speakCalm(text)`: after `speechSynthesis.speak(u)`:
  `u.onend = () => scheduleRouteRelease(0);` and also `scheduleRouteRelease(15000);` as a
  safety net in case `onend` never fires (a known speechSynthesis flake).

Note: `speakClips`' async path (`playWhenReady` → `play`) schedules from inside `play()`, so it
is covered. If release fires in the sub-second gap while clips are still decoding, the existing
`!unlocked` guard skips playback silently — acceptable and rare (grace is 12 s, decode is <1 s).

### 5. Export

Export `releaseVoiceRoute` from voice.js (app.js does not use it in Phase 1; the contingency and
future hooks do).

### 6. Tests

`node --test tests/` must pass. The existing tests assert `navigator.audioSession.type` stays
`"auto"` — Phase 1 must not touch `navigator.audioSession` at all, so they keep passing. Add a
test: after a (mocked-timer) release, `unlockAudioEl.paused` is true and `ctx.suspend` was
called; after a subsequent `unlockVoice()`, play resumes. Follow the existing mock patterns in
[tests/voice.test.js](../tests/voice.test.js).

### 7. Cleanup commit (separate, optional but recommended)

The revert left dead code in voice.js: `primeIOSStartClip`, `playPrimedGestureClip`,
`playMediaSequence`, `clearMediaPlayback`, and the `mediaVoice*` / `mediaGapTimer` /
`mediaPrimedKey` state. Nothing calls them anymore (`speakClips` no longer dispatches to the
media path). Remove them in their own commit *after* Phase 1 is verified, and re-run the tests —
some tests may exercise these; delete those tests with the code.

---

## Phase 2 — opt-in "Mix with music & podcasts" toggle

Only start after Phase 1 is verified on-device.

1. **Setting:** new localStorage key `bpb-mix-audio` (`"1"`/`"0"`, default `"0"` = off).
2. **UI:** checkbox in Settings next to the sound toggle (`chk-sound-enabled`,
   [app.js:2125](../app.js:2125)); render it only when `typeof navigator !== "undefined" && "audioSession" in navigator`
   (currently Safari-only API). Label: **"Mix coach with music & podcasts"**, subtext:
   *"Podcasts keep playing under the coach. The coach then follows the Ring/Silent switch — if
   your phone is on silent you won't hear him."*
3. **voice.js:**
   ```js
   function applyAudioSessionType() {
     try {
       if (typeof navigator !== "undefined" && navigator.audioSession) {
         navigator.audioSession.type =
           localStorage.getItem("bpb-mix-audio") === "1" ? "ambient" : "auto";
       }
     } catch (e) { /* best effort */ }
   }
   ```
   Call it in `initVoice()` and at the top of `unlockVoice()` (same two call sites the reverted
   patch used — that placement was correct). The toggle's change handler calls an exported
   setter that writes the key and calls `applyAudioSessionType()`.
4. Phase 1's release logic stays active regardless (harmless under ambient; still useful when
   the toggle is off).
5. **Tests:** default stays `"auto"` (existing assertions unchanged); add a case: with
   `bpb-mix-audio = "1"`, `initVoice`/`unlockVoice` set `"ambient"`; toggling off restores `"auto"`.

Do **not** default this on, and do **not** use `"transient"` (see table above — identical native
category to ambient, same mute-switch failure).

---

## On-device verification (mandatory before push)

Ritual first (per CLAUDE.md): unregister service workers + clear caches, reload. Bump
`CACHE_NAME` in [sw.js](../sw.js) (currently `bpb-shell-v159`) and the `?v=` params
(`app.js?v=152` in index.html, `voice.js?v=146` in app.js) in every shipping commit.

Matrix — {Safari tab, installed Home-Screen app} × {silent switch on, off} × {Apple Podcasts
playing, idle}:

1. **Regression gate (the thing that broke last time):** with mixing OFF (default), start a
   workout in all combinations — every rep count must be audible, including silent-switch-on.
2. Podcast playing → do a set → stop for ~15 s → podcast must resume by itself.
3. Complete a workout → podcast resumes ~12–14 s after the completion line.
4. **Non-gesture re-claim:** Plank mode — its cheers fire from a timer, not a tap. Let >15 s of
   silence pass mid-plank so the route releases, then confirm the next timed cheer is audible.
5. Phase 2, mixing ON, ringer audible: podcast keeps playing *under* the voice (no pause).
   Silent switch on: voice muted (expected, matches the label).
6. Background the installed app mid-workout, return, tap next rep — voice recovers (existing
   `contextNeedsRefresh` path must still work).
7. Zen gong and Sharpshooter sounds still play; voice-preset switch in Settings still works.

## Contingency

If check 4 fails (iOS refuses the non-gesture re-claim after a release): keep everything, but
stop scheduling releases from `play()`/gong/sharpshooter while a workout is active. Instead call
the exported `releaseVoiceRoute()` from app.js at workout boundaries only: end of
`completeWorkout()` ([app.js:5165](../app.js:5165)), plank finish, and navigation back to the
home screen. Podcasts then resume after workouts rather than during rests — smaller win, zero
risk.

## Ship checklist

- `node --test tests/` green.
- `CACHE_NAME` + `?v=` bumps in the same commit as the code.
- `git fetch` and check `origin/main` for live-app data commits before pushing (Worker writes
  `data.json` independently); merge if needed.
- No `worker/index.js` changes in this plan — nothing to paste into the Cloudflare dashboard.
