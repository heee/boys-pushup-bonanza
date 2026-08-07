// ===========================================================
// Boys Push Up Bonanza — voice playback engine
//
// Plays pre-rendered TTS clips (assets/voice/*.mp3, built by
// scripts/generate-voice.js) through Web Audio instead of the browser's
// robotic built-in speechSynthesis.
//
// Why not just call a TTS API at runtime? Rep counts are spoken *per rep* —
// a 200-400ms network round trip puts the voice behind the body, and it would
// break offline use. The spoken vocabulary here is small and fixed, so we
// render it once and ship it.
//
// Any string that can't be resolved to clips falls back to speechSynthesis,
// so nothing ever goes silent.
// ===========================================================

import { normalizeSpoken, numberToWords, VOICE_PRESETS } from "./voice-lines.js?v=135";

const LS_VOICE_PRESET = "bpb-voice-preset";
const DEFAULT_PRESET_ID = VOICE_PRESETS[0].id;

export function getVoicePreset() {
  const id = localStorage.getItem(LS_VOICE_PRESET) || DEFAULT_PRESET_ID;
  return VOICE_PRESETS.some((p) => p.id === id) ? id : DEFAULT_PRESET_ID;
}

// The default preset's clips live directly in assets/voice/ (predates
// multi-preset support); each persona gets its own subfolder underneath.
function presetDirSegment() {
  const preset = VOICE_PRESETS.find((p) => p.id === getVoicePreset()) || VOICE_PRESETS[0];
  return preset.dir ? `${preset.dir}/` : "";
}
function manifestUrl() {
  return `./assets/voice/${presetDirSegment()}manifest.json`;
}
function clipDir() {
  return `./assets/voice/${presetDirSegment()}`;
}

// Gap inserted between spliced clips. Just enough that two recordings don't
// run into each other, small enough that it still reads as one sentence.
const SEGMENT_GAP = 0.055;
// Samples quieter than this at a clip's head/tail are treated as silence and
// trimmed, so splices stay tight regardless of what the TTS API padded on.
const SILENCE_THRESHOLD = 0.006;

let ctx = null;
let masterGain = null;
let clips = null;          // Map<normalizedKey, filename>
let maxPhraseWords = 1;
const buffers = new Map(); // normalizedKey -> AudioBuffer (decoded) | Promise
let activeSources = [];
let generation = 0;
let unlocked = false;
let ready = false;
let contextNeedsRefresh = false;
let mediaGapTimer = null;
let mediaVoiceActive = false;
let mediaVoiceEl = null;
let mediaVoiceSignature = "";
let mediaPrimedKey = "";
let lifecycleRecoveryInstalled = false;

// How long after the last scheduled sound ends before we release the iOS
// audio route. Long enough that per-rep counting never churns the session,
// short enough that a paused podcast resumes during a normal rest.
const ROUTE_RELEASE_GRACE_MS = 12000;
let routeReleaseTimer = null;

// ---------- setup ----------

function isIOSHomeScreenApp() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent || "")
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true
    || window.matchMedia?.("(display-mode: standalone)")?.matches === true;
  return ios && standalone;
}

function createAudioGraph() {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return false;
  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  contextNeedsRefresh = false;
  return true;
}

function refreshAudioGraphIfNeeded() {
  if (!contextNeedsRefresh && ctx?.state !== "closed" && ctx?.state !== "interrupted") return;
  clearActiveSources();
  const oldCtx = ctx;
  ctx = null;
  masterGain = null;
  unlocked = false;
  buffers.clear();
  if (oldCtx && oldCtx.state !== "closed") {
    try {
      const p = oldCtx.close?.();
      if (p?.catch) p.catch(() => {});
    } catch (e) { /* stale iOS contexts are safe to abandon */ }
  }
  createAudioGraph();
}

function installLifecycleRecovery() {
  if (lifecycleRecoveryInstalled || typeof document === "undefined") return;
  lifecycleRecoveryInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    // WebKit can return a Home Screen app to the foreground with a context
    // that still says "running" while its clock and output are frozen. Mark
    // it stale now so the next workout tap creates a clean graph.
    contextNeedsRefresh = true;
  });
  if (typeof window !== "undefined") {
    window.addEventListener?.("pagehide", () => { contextNeedsRefresh = true; });
  }
}

async function loadManifest() {
  try {
    // Plain fetch, not force-cache: the service worker already serves this
    // offline, and force-cache would happily pin a 404 from a checkout that
    // predates the generated clips.
    const res = await fetch(manifestUrl());
    if (!res.ok) return false;
    const manifest = await res.json();
    clips = new Map(Object.entries(manifest.clips || {}));
    if (!clips.size) return false;
    maxPhraseWords = 1;
    for (const key of clips.keys()) {
      maxPhraseWords = Math.max(maxPhraseWords, key.split(" ").length);
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function initVoice() {
  if (ready) return true;
  try {
    if (!ctx && !createAudioGraph()) return false;
    installLifecycleRecovery();
    ready = await loadManifest();
  } catch (e) {
    ready = false;
  }
  // No blanket pointerdown listener here: that used to unlock audio (and
  // start the looping keep-alive <audio> below) on the very first tap
  // ANYWHERE in the app, even on screens that never speak — which claims
  // iOS's shared audio session and silences background music (e.g. the
  // Music app) for the rest of the page's life. Every code path that
  // actually calls speak() must call unlockVoice() itself, inside its own
  // tap handler, so audio is only ever claimed right before it's needed.
  return ready;
}

// Called when the user picks a different voice in Settings. Keeps the
// shared AudioContext/unlock state untouched (so this never re-asks for
// audio permission mid-session) — just clears decoded buffers (they're the
// wrong voice now) and reloads the new preset's manifest.
export async function setVoicePreset(id) {
  localStorage.setItem(LS_VOICE_PRESET, VOICE_PRESETS.some((p) => p.id === id) ? id : DEFAULT_PRESET_ID);
  buffers.clear();
  clips = null;
  maxPhraseWords = 1;
  ready = false;
  if (ctx) ready = await loadManifest();
}

// Some iOS Safari versions report ctx.state === "running" (and take no
// exceptions anywhere in the Web Audio graph) while still producing no
// audible output — the underlying OS audio session was never actually
// activated, because that historically happens more reliably via an
// HTMLMediaElement play() than via AudioContext.resume() alone. A silent
// inline WAV (no network/asset dependency) played through a real <audio>
// element, directly in the same gesture, is the standard workaround.
const SILENT_WAV = "data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";
let unlockAudioEl = null;

function primeIOSStartClip() {
  if (!isIOSHomeScreenApp() || !clips) return false;
  const key = normalizeSpoken("Let's go");
  const file = clips.get(key);
  if (!file) return false;
  if (!mediaVoiceEl) {
    mediaVoiceEl = new Audio();
    mediaVoiceEl.setAttribute("playsinline", "");
    mediaVoiceEl.preload = "auto";
  }
  if (mediaPrimedKey !== key || !mediaVoiceEl.src) {
    mediaVoiceEl.src = clipDir() + file;
    mediaPrimedKey = key;
    try { mediaVoiceEl.load?.(); } catch (e) { /* preload is best effort */ }
  }
  return true;
}

function playPrimedGestureClip(text) {
  if (!isIOSHomeScreenApp() || !mediaVoiceEl || !unlocked) return false;
  const keys = resolve(text);
  if (!keys || keys.length !== 1 || keys[0] !== mediaPrimedKey) return false;

  stopVoice();
  const gen = generation;
  mediaVoiceActive = true;
  mediaVoiceSignature = keys.join("\u0000");
  mediaVoiceEl.loop = false;
  mediaVoiceEl.volume = 1;
  mediaVoiceEl.currentTime = 0;
  mediaVoiceEl.onended = () => {
    if (gen !== generation) return;
    mediaVoiceActive = false;
    mediaVoiceSignature = "";
  };
  mediaVoiceEl.onerror = () => {
    if (gen !== generation) return;
    mediaVoiceActive = false;
    mediaVoiceSignature = "";
    speakFallback(text);
  };
  try {
    const p = mediaVoiceEl.play();
    if (p?.catch) p.catch(mediaVoiceEl.onerror);
    return true;
  } catch (e) {
    mediaVoiceEl.onerror();
    return false;
  }
}

// Releases the OS audio route so iOS deactivates our session and lets the
// interrupted app (Podcasts/Music) resume. Keeps ctx, decoded buffers, and
// unlockAudioEl intact — unlockVoice() re-claims the same objects. Never
// recreate unlockAudioEl: the existing instance carries the user-gesture
// activation that lets it re-play() outside a tap.
export function releaseVoiceRoute() {
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

// iOS/Safari will not produce sound from an AudioContext that was never
// resumed inside a user gesture. Call this from a tap handler.
export function unlockVoice() {
  if (routeReleaseTimer) { clearTimeout(routeReleaseTimer); routeReleaseTimer = null; }
  refreshAudioGraphIfNeeded();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume();
    if (!unlocked) {
      const silent = ctx.createBufferSource();
      silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      silent.connect(masterGain);
      silent.start(0);

      if (!unlockAudioEl) {
        unlockAudioEl = new Audio(SILENT_WAV);
        unlockAudioEl.setAttribute("playsinline", "");
        unlockAudioEl.volume = 0.01;
        // A one-shot play() only produced a brief audible "kick" on the
        // suspended->running transition, then AudioContext output went
        // silent again even though ctx.state stayed "running" — the OS
        // audio route wasn't actually staying active. Looping this for
        // the rest of the page's life keeps a real hardware output route
        // continuously alive, which is what iOS actually needs.
        unlockAudioEl.loop = true;
      }
      const p = unlockAudioEl.play();
      if (p && p.then) {
        p.catch(() => {});
      }

      unlocked = true;
    }
  } catch (e) { /* audio unlock is best effort */ }
}

export function isVoiceReady() {
  return ready;
}

// ---------- clip loading ----------

function trimSilence(buf) {
  const data = buf.getChannelData(0);
  let start = 0;
  let end = data.length - 1;
  while (start < end && Math.abs(data[start]) < SILENCE_THRESHOLD) start++;
  while (end > start && Math.abs(data[end]) < SILENCE_THRESHOLD) end--;
  // Leave a hair of room so we don't clip the attack or chop the release.
  start = Math.max(0, start - Math.floor(buf.sampleRate * 0.01));
  end = Math.min(data.length - 1, end + Math.floor(buf.sampleRate * 0.02));
  const length = end - start + 1;
  if (length <= 0 || length === data.length) return buf;

  const out = ctx.createBuffer(buf.numberOfChannels, length, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    out.getChannelData(c).set(buf.getChannelData(c).subarray(start, end + 1));
  }
  return out;
}

function loadClip(key) {
  const cached = buffers.get(key);
  if (cached) return Promise.resolve(cached);

  const file = clips.get(key);
  if (!file) return Promise.resolve(null);

  const pending = fetch(clipDir() + file)
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`fetch ${res.status} for ${file}`))))
    .then((bytes) => ctx.decodeAudioData(bytes).catch((e) => Promise.reject(new Error(`decodeAudioData failed for ${file}: ${e && e.message}`))))
    .then((buf) => {
      const trimmed = trimSilence(buf);
      buffers.set(key, trimmed);
      return trimmed;
    })
    .catch((e) => {
      buffers.delete(key); // let a later attempt retry
      return null;
    });

  buffers.set(key, pending);
  return pending;
}

// Warm the clips a workout is about to need, so the first rep plays with zero
// decode latency. The service worker keeps the files locally after this.
export function preloadVoice(texts) {
  if (!ready) return Promise.resolve();
  const keys = new Set();
  for (const text of texts) {
    for (const key of resolveWords(normalizeSpoken(text).split(" ").filter(Boolean)) || []) {
      keys.add(key);
    }
  }
  return Promise.all([...keys].map(loadClip)).then(() => undefined);
}

// Numbers 0..max plus the fixed phrases — everything a live set can say.
export function preloadCountingRange(max) {
  const texts = [];
  for (let n = 0; n <= Math.max(0, max); n++) texts.push(numberToWords(n));
  return preloadVoice(texts);
}

// ---------- text -> clip resolution ----------

// Greedy longest-match over the manifest. Because every fragment in the
// manifest came from the same corpus the app speaks from, a greedy walk
// reconstructs any generated sentence exactly. Returns null on the first
// unknown word so we fall back cleanly rather than speaking half a sentence.
function resolveWords(words, depth = 0) {
  const out = [];
  let i = 0;
  while (i < words.length) {
    let matched = 0;
    const window = Math.min(maxPhraseWords, words.length - i);
    for (let len = window; len >= 1; len--) {
      const key = words.slice(i, i + len).join(" ");
      if (clips.has(key)) {
        out.push(key);
        matched = len;
        break;
      }
    }
    if (matched) {
      i += matched;
      continue;
    }

    // Digits in fun messages ("23 pushups down...") — spell them out and
    // resolve the spelled form through the same matcher.
    if (depth === 0 && /^\d+$/.test(words[i])) {
      const spelled = normalizeSpoken(numberToWords(Number(words[i])));
      if (spelled && spelled !== words[i]) {
        const sub = resolveWords(spelled.split(" "), depth + 1);
        if (sub) {
          out.push(...sub);
          i += 1;
          continue;
        }
      }
    }
    return null;
  }
  return out.length ? out : null;
}

function resolve(text) {
  const words = normalizeSpoken(text).split(" ").filter(Boolean);
  if (!words.length) return null;
  return resolveWords(words);
}

// ---------- playback ----------

function clearActiveSources() {
  for (const src of activeSources) {
    try { src.stop(); } catch (e) { /* already ended */ }
  }
  activeSources = [];
}

function clearMediaPlayback(force = false) {
  if (mediaGapTimer) {
    clearTimeout(mediaGapTimer);
    mediaGapTimer = null;
  }
  if (!mediaVoiceEl) return;
  if (!mediaVoiceActive && !force) return;
  mediaVoiceActive = false;
  mediaVoiceSignature = "";
  mediaVoiceEl.onended = null;
  mediaVoiceEl.onerror = null;
  try {
    mediaVoiceEl.pause();
    mediaVoiceEl.currentTime = 0;
  } catch (e) { /* already stopped */ }
}

export function stopVoice() {
  generation++;
  clearActiveSources();
  clearMediaPlayback();
}

// Release the persistent iOS audio route when voice is disabled. The looping
// silent media element is necessary to keep Web Audio audible on some iPhones,
// but leaving it running also keeps background audio (such as Podcasts)
// interrupted even though this page is no longer speaking.
export function deactivateVoice() {
  if (routeReleaseTimer) { clearTimeout(routeReleaseTimer); routeReleaseTimer = null; }
  unlocked = false;
  generation++;
  clearActiveSources();
  clearMediaPlayback(true);
  if (unlockAudioEl) {
    try {
      unlockAudioEl.pause();
      unlockAudioEl.currentTime = 0;
    } catch (e) { /* audio release is best effort */ }
  }
  if ("speechSynthesis" in window) {
    try {
      if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
    } catch (e) { /* speech release is best effort */ }
  }
  if (ctx?.state === "running") {
    try {
      const p = ctx.suspend();
      if (p?.catch) p.catch(() => {});
    } catch (e) { /* context release is best effort */ }
  }
}

// Installed iOS web apps have a long-standing failure mode where Web Audio's
// clock keeps reporting "running" after the app resumes while no samples
// reach the speaker. The HTMLMediaElement used to unlock the route does not
// share that frozen-clock failure, so use it for the pre-rendered voice clips
// in that environment. Keeping the page's AudioSession ambient lets these
// clips mix with Music/Podcasts instead of interrupting them.
function playMediaSequence(keys, text) {
  const signature = keys.join("\u0000");
  if (mediaVoiceActive && mediaVoiceSignature === signature) return true;
  unlockVoice();
  if (!mediaVoiceEl || !unlocked) return false;

  stopVoice();
  const gen = generation;
  let index = 0;
  mediaVoiceActive = true;
  mediaVoiceSignature = signature;

  const fail = () => {
    if (gen !== generation) return;
    clearMediaPlayback();
    speakFallback(text);
  };

  const next = () => {
    mediaGapTimer = null;
    if (gen !== generation || !unlocked) return;
    if (index >= keys.length) {
      clearMediaPlayback();
      return;
    }

    const file = clips.get(keys[index++]);
    if (!file) {
      fail();
      return;
    }

    try {
      mediaVoiceEl.onended = () => {
        if (gen !== generation) return;
        mediaGapTimer = setTimeout(next, SEGMENT_GAP * 1000);
      };
      mediaVoiceEl.onerror = fail;
      mediaVoiceEl.loop = false;
      mediaVoiceEl.volume = 1;
      mediaVoiceEl.src = clipDir() + file;
      mediaVoiceEl.currentTime = 0;
      const p = mediaVoiceEl.play();
      if (p?.catch) p.catch(fail);
    } catch (e) {
      fail();
    }
  };

  next();
  return true;
}

function play(bufs) {
  let when = ctx.currentTime + 0.02;
  for (const buf of bufs) {
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(masterGain);
      src.start(when);
      when += buf.duration + SEGMENT_GAP;
      activeSources.push(src);
    } catch (e) { /* skip a source that cannot start */ }
  }
  scheduleRouteRelease((when - ctx.currentTime) * 1000);
}

/**
 * Speak `text` using pre-rendered clips.
 * Returns true if it was handled here, false if the caller should fall back
 * to speechSynthesis. Like speechSynthesis.cancel()+speak(), a new call
 * interrupts whatever is currently playing.
 */
export function speakClips(text) {
  if (!ready || !ctx) {
    return false;
  }

  const keys = resolve(text);
  if (!keys) {
    return false;
  }

  unlockVoice();

  // iOS: the *first* real ctx.resume() after a cold "suspended" start can take
  // 100+ms to actually take effect, even though it's already been called.
  // Anything scheduled via source.start() before it resolves is silently
  // dropped — ctx.state still reads "suspended" at schedule time even a few
  // ms before it flips. So both paths below funnel through this gate rather
  // than assuming "resume() was called" means "safe to play now".
  const playWhenReady = (bufs, bumpGeneration) => {
    const fire = () => {
      if (!unlocked) return;
      if (bumpGeneration) stopVoice(); else clearActiveSources();
      play(bufs);
    };
    if (ctx.state === "running") {
      fire();
      return;
    }
    ctx.resume().then(() => {
      if (!unlocked) {
        ctx.suspend().catch(() => {});
        return;
      }
      fire();
    }).catch(() => {});
  };

  // Fast path: everything already decoded, so a rep lands with no latency
  // and no promise hop at all (once the context is actually running).
  const cached = keys.map((k) => buffers.get(k));
  if (cached.every((b) => b && typeof b.duration === "number")) {
    playWhenReady(cached, true);
    return true;
  }

  const gen = ++generation;
  Promise.all(keys.map(loadClip)).then((bufs) => {
    if (gen !== generation) {
      return;
    }
    if (bufs.some((b) => !b)) {
      speakFallback(text);
      return;
    }
    playWhenReady(bufs, false);
  });
  return true;
}

export function speakFallback(text) {
  if (!("speechSynthesis" in window)) return;
  try {
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.onend = () => scheduleRouteRelease(0);
    speechSynthesis.speak(u);
    // Safety net: speechSynthesis.onend is a known flake, so also schedule
    // from a fixed budget in case it never fires.
    scheduleRouteRelease(15000);
  } catch (e) { /* speech synthesis is best effort */ }
}

// Zen deliberately avoids the energetic pre-rendered voice pack. The system
// voice at a slower pace gives the one completion line a quieter character.
export function speakCalm(text) {
  stopVoice();
  if (!("speechSynthesis" in window)) return;
  try {
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.82;
    u.pitch = 0.9;
    u.volume = 0.78;
    u.onend = () => scheduleRouteRelease(0);
    speechSynthesis.speak(u);
    // Safety net: speechSynthesis.onend is a known flake, so also schedule
    // from a fixed budget in case it never fires.
    scheduleRouteRelease(15000);
  } catch (e) { /* speech synthesis is best effort */ }
}

// A short synthesized meditation-gong avoids another network/asset dependency
// and works offline through the already-unlocked workout AudioContext.
export function playZenGong() {
  if (!ctx || !masterGain) return 0;
  unlockVoice();
  try {
    const start = ctx.currentTime + 0.02;
    const partials = [
      [174, 0.18, 3.2],
      [228, 0.1, 2.7],
      [311, 0.055, 2.1],
      [419, 0.025, 1.5],
    ];
    for (const [frequency, volume, duration] of partials) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.985, start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(masterGain);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
      activeSources.push(oscillator);
    }
    scheduleRouteRelease(3500);
    return 1150;
  } catch (e) {
    return 0;
  }
}

// A compact bow-release, impact thump, and bright bullseye ping. Synthesized
// through the already-unlocked workout audio graph so it remains instant and
// available offline without adding a separate sound asset.
export function playSharpshooterHit() {
  if (!ctx || !masterGain) return 0;
  unlockVoice();
  try {
    const start = ctx.currentTime + 0.01;
    const strike = ctx.createOscillator();
    const strikeGain = ctx.createGain();
    strike.type = "triangle";
    strike.frequency.setValueAtTime(185, start);
    strike.frequency.exponentialRampToValueAtTime(58, start + 0.16);
    strikeGain.gain.setValueAtTime(0.0001, start);
    strikeGain.gain.exponentialRampToValueAtTime(0.28, start + 0.008);
    strikeGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    strike.connect(strikeGain);
    strikeGain.connect(masterGain);
    strike.start(start);
    strike.stop(start + 0.22);
    activeSources.push(strike);

    const ping = ctx.createOscillator();
    const pingGain = ctx.createGain();
    ping.type = "sine";
    ping.frequency.setValueAtTime(980, start + 0.045);
    ping.frequency.exponentialRampToValueAtTime(1320, start + 0.28);
    pingGain.gain.setValueAtTime(0.0001, start + 0.045);
    pingGain.gain.exponentialRampToValueAtTime(0.12, start + 0.06);
    pingGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
    ping.connect(pingGain);
    pingGain.connect(masterGain);
    ping.start(start + 0.045);
    ping.stop(start + 0.36);
    activeSources.push(ping);
    scheduleRouteRelease(400);
    return 260;
  } catch (e) {
    return 0;
  }
}
