// ===========================================================
// Boys Push Up Bonanza — app logic
// Vanilla JS, no build step. Face detection via MediaPipe Tasks Vision (CDN).
// ===========================================================

import {
  CARD_RANK_SPOKEN,
  CHASE_CHAOS_LINES,
  CHASE_FINISH_AHEAD_LINE,
  CHASE_FINISH_BEHIND_LINE,
  CHASE_GAP_LINES,
  CHASE_LEAD_MARGIN_LINE,
  CHASE_TOOK_LEAD_LINE,
  ENCOURAGE_LINES,
  FIXED_PHRASES,
  FUN_MESSAGES,
  FUN_MESSAGES_PLANK,
  LADDER_CHEER_LINES,
  LADDER_RIVAL_APPROACHING_LINE,
  LADDER_RIVAL_MATCHED_LINE,
  LADDER_RIVAL_PASSED_LINE,
  POKER_CALLOUTS,
  PYRAMID_APEX_LINE,
  PYRAMID_COMPLETE_LINE,
  PYRAMID_ROW_CHEER_LINES,
  PYRAMID_TURNAROUND_LINE,
  SHARPSHOOTER_HIT_LINES,
  SQUAT_CHEER_LINES,
  SQUAT_RECORD_LINE,
  SQUAT_START_LINES,
  FUN_MESSAGES_SQUAT,
  VOICE_PRESETS,
  WHEEL_DOUBLE_PREFIX,
  WHEEL_BOSS_LINE,
  WHEEL_FREEBIE_LINE,
  WHEEL_BUST_LINE,
  WHEEL_TEMPO_LINE,
  numberToWords,
  zenCompletionLine,
} from "./voice-lines.js?v=135";
import {
  deactivateVoice,
  getVoicePreset,
  initVoice,
  preloadCountingRange,
  preloadVoice,
  playZenGong,
  playSharpshooterHit,
  setVoicePreset,
  speakCalm,
  speakClips,
  speakFallback,
  unlockVoice,
} from "./voice.js?v=148";
import { buildChasePlan, chaseProgress, crossedLeadMilestone } from "./chase.js";
import { buildLadderRivals, ladderRivalMilestones, shouldCompactLadderRivals } from "./ladder-rivals.js";
import { WHEEL_SEGMENTS, displaySegments, resolveWheelSpin, numberRangeMidpoint } from "./wheel-mode.js?v=4";
import { createWorkerApi, isRetryableError } from "./api.js";
import { createJsonStorage, normalizeSharedData } from "./storage.js";
import { createMutationQueue } from "./sync.js";
import { createRepCounter } from "./rep-counter.js";
import { createCameraController } from "./camera.js";
import { bestFor, computeStreakCore as calculateStreak, filterByMode, periodStart, weightedMultiplier } from "./stats.js";
import { chaseSummaryResult, chaseSummaryText, correctedSummaryTotals, weightedSummaryText } from "./screens/summary.js";
import { personalStatsModel } from "./screens/dashboard.js";
import { modeStatsModel } from "./screens/mode-stats.js?v=133";
import { modeBreakdownModel } from "./screens/mode-breakdown.js?v=1";
import { comparisonModel } from "./screens/comparison.js?v=132";
import { challengeLeaderboardRows, challengeOverviewStats, challengeShareContext, challengeStatus, challengeStatusLabel, challengeWindow, daysLeft, daysUntilStart, formatChallengeDates, progressThermometerModel, recentChallengeSessions } from "./screens/challenges.js";
import { weightModifierText } from "./screens/settings.js";
import { EXPLORE_MODES, exploreModesModel } from "./screens/explore-modes.js?v=138";
import { MODIFIERS, RESOLVABLE_MODIFIER_IDS, resolveModifier } from "./screens/modifiers.js?v=100";
import { orderedUserNames, renameCachedIdentity, userSelectionModel, visibleUserSessions } from "./screens/users.js";
import { sessionBadges, sessionKeyMetrics, sessionModeLabel, sessionRings } from "./screens/session-detail.js?v=2";
import { ladderRungRows, workoutHeroModel, workoutHudModel } from "./workout-modes.js?v=150";
import { applyTurn, createHorseGame, currentTurnPlayer, horsePlayerRows, horseTargetLabel, isTurnStalled } from "./horse.js";
import { horseSummaryRows, horseTurnHeroCopy, horseWordChips } from "./screens/horse.js";
import { randomHorseWord } from "./horse-words.js";
import { bestPokerRank, evaluatePokerHand, pokerAchievementIds, pokerAchievementsFromSessions, POKER_HANDS } from "./poker.js";
import {
  formatTerritoryLocation,
  normalizeDeviceLocationProfile,
  normalizeTerritoryLocation,
  snapshotTerritoryLocation,
} from "./territory-location.js";
import {
  buildRoadtripTerritories,
  detectRoadtripConquests,
  roadtripConquestShareMessage,
  roadtripDetailRows,
  roadtripOverviewRows,
} from "./roadtrip.js";
import { deriveSquatThresholds, median, squatCalibrationValid } from "./modes/squat.js";

const FACE_DETECTOR_MODULE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";
const FACE_DETECTOR_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const FACE_DETECTOR_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

// Every device talks to this one Worker instead of GitHub directly — it
// holds the GitHub token server-side so no one has to paste a token in.
// Replace with your deployed Worker URL (see README) before shipping.
const WORKER_URL = "https://boys-pushup-bonanza-worker.jhenningbuchholz.workers.dev";
// Must match the APP_KEY secret set on the Worker. Not real security (it's
// visible in this public source) — just a deterrent against casual randoms
// who stumble on the Worker URL.
const APP_KEY = "Bonanza";
const workerApi = createWorkerApi({ baseUrl: WORKER_URL, appKey: APP_KEY });
const jsonStorage = createJsonStorage(localStorage);

const LS = {
  theme: "bpb-theme",
  lastUser: "bpb-last-user",
  lastAvatar: "bpb-last-avatar",
  thresholdDown: "bpb-threshold-down",
  thresholdUp: "bpb-threshold-up",
  showHighscore: "bpb-show-highscore",
  pendingQueue: "bpb-pending-queue",
  cacheData: "bpb-cache-data",
  plankUnlocked: "bpb-plank-unlocked",
  soundEnabled: "bpb-sound-enabled",
  weightedProfiles: "bpb-weighted-profiles",
  cardDeck: "bpb-card-deck",
  pokerDeck: "bpb-poker-deck",
  showCameraPreview: "bpb-show-camera-preview",
  cameraPreviewOffMigration: "bpb-camera-preview-off-v1",
  hasCameraStarted: "bpb-camera-started",
  cameraPermissionIssue: "bpb-camera-permission-issue",
  formCueIndex: "bpb-form-cue-index",
  leaderboardMode: "bpb-leaderboard-mode",
  deviceLocation: "bpb-device-location",
  roadtripPeriod: "bpb-roadtrip-period",
  roadtripTier: "bpb-roadtrip-tier",
  roadtripPrompted: "bpb-roadtrip-location-prompted",
  squatCal: "bpb-squat-cal",
};

// One-time shipped migration: every existing device starts this release with
// the visual preview covered. Users can explicitly turn it back on afterward.
if (localStorage.getItem(LS.cameraPreviewOffMigration) !== "1") {
  localStorage.setItem(LS.showCameraPreview, "0");
  localStorage.setItem(LS.cameraPreviewOffMigration, "1");
}

const DEFAULT_DOWN = 0.55;
const DEFAULT_UP = 0.32;
const FACE_LOST_TIMEOUT_MS = 3000;
// Below this gap between reps, the count is spoken every 5th rep instead of
// every rep, so numbers aren't cut off mid-word at sprint pace.
const REP_SPEECH_MIN_GAP_MS = 1200;

const LEADERBOARD_MODE_OPTIONS = [
  { id: "all", label: "All" },
  { id: "classic", label: "Classic" },
  { id: "countdown", label: "Countdown" },
  { id: "cards", label: "Cards" },
  { id: "poker", label: "Poker" },
  { id: "dice", label: "Dice" },
  { id: "ladder", label: "Ladder" },
  { id: "fortune", label: "Fortune" },
  { id: "chase", label: "Chase" },
  { id: "sharpshooter", label: "Sharpshooter" },
  { id: "pyramid", label: "Pyramid" },
  { id: "planks", label: "Planks" },
];
const LEADERBOARD_MODE_IDS = new Set(LEADERBOARD_MODE_OPTIONS.map((option) => option.id));

function savedLeaderboardMode() {
  const saved = localStorage.getItem(LS.leaderboardMode) || "all";
  return LEADERBOARD_MODE_IDS.has(saved) ? saved : "all";
}

const AVATARS = [
  { id: "flex", emoji: "💪", bg: "#c9852f" },
  { id: "fire", emoji: "🔥", bg: "#b5482f" },
  { id: "goat", emoji: "🐐", bg: "#7a9b57" },
  { id: "gorilla", emoji: "🦍", bg: "#8a6a3a" },
  { id: "bolt", emoji: "⚡", bg: "#e8c468" },
  { id: "trophy", emoji: "🏆", bg: "#a9781f" },
  { id: "crown", emoji: "👑", bg: "#b9822f" },
  { id: "mech", emoji: "🦾", bg: "#6b5a3e" },
  { id: "hot", emoji: "😤", bg: "#cf6a2e" },
  { id: "rocket", emoji: "🚀", bg: "#9c5a3c" },
  { id: "clown", emoji: "🤡", bg: "#a8493f" },
  { id: "orangutan", emoji: "🦧", bg: "#96632e" },
  { id: "boxing", emoji: "🥊", bg: "#8a3a2e" },
  { id: "lifter", emoji: "🏋️", bg: "#5c4f3a" },
  { id: "cartwheel", emoji: "🤸", bg: "#6f8a52" },
  { id: "turtle", emoji: "🐢", bg: "#587a4a" },
  { id: "chicken", emoji: "🐔", bg: "#c79a3a" },
  { id: "brain", emoji: "🧠", bg: "#9c6b5a" },
  { id: "sweat", emoji: "🥵", bg: "#d1652e" },
  { id: "zany", emoji: "🤪", bg: "#c98a3a" },
  { id: "devil", emoji: "😈", bg: "#7a2e2e" },
  { id: "burger", emoji: "🍔", bg: "#a0692e" },
  { id: "hotdog", emoji: "🌭", bg: "#b8622e" },
  { id: "cheese", emoji: "🧀", bg: "#d1a23a" },
  { id: "beer", emoji: "🍺", bg: "#c9982e" },
  { id: "beers", emoji: "🍻", bg: "#d4a83a" },
  { id: "cheers", emoji: "🥂", bg: "#d9b66a" },
  { id: "eggplant", emoji: "🍆", bg: "#5e3d7a" },
];

// Prepopulated challenge calendar — static, curated via git, never mutated
// by the client. Only participant lists (in the shared data store) change.
const CHALLENGES_URL = "challenges.json";
let challengeDefs = [];
async function loadChallenges() {
  let staticChallenges = [];
  try {
    const res = await fetch(CHALLENGES_URL, { cache: "no-cache" });
    const json = await res.json();
    staticChallenges = Array.isArray(json.challenges) ? json.challenges : [];
  } catch (e) {
    // keep whatever static list we had before; an empty list just renders empty states
  }
  const custom = getCachedData().customChallenges || [];
  challengeDefs = [...staticChallenges, ...custom];
}

// Icon choices offered when creating a custom challenge.
const CHALLENGE_ICONS = [
  "🎯", "🔥", "💪", "🏆", "🚀", "⚡", "🎉", "🎃", "🎄", "🎆",
  "🏈", "⚽", "🏀", "🏋️", "🥊", "🧗", "🏃", "🚴", "🏊", "🥇",
  "👑", "💥", "🌪️", "🌊", "🏔️", "🎖️", "🍺", "🍕", "🌮", "🌶️",
  "🦾", "😤", "🥵", "🤸", "🤘", "🦍", "🐐", "🦁", "🐺", "🦅",
  "🌶", "🍔", "🧀", "🥃", "🍻", "🎸", "🏁", "🎲", "🃏", "🧨",
  "🛠️", "⚔️", "🛡️", "🧊", "☀️", "🌙", "⭐", "🌟", "🎇", "🥶",
  "🦖", "🦈", "🐉", "🦂", "🕷️", "🥷", "🤠", "🎅", "🦃", "🐢",
];

// Deterministic color pair per icon, so custom challenges get a consistent
// gradient without the user having to pick colors themselves.
const CHALLENGE_GRADIENTS = [
  ["#1a5c2e", "#7ec850"],
  ["#8a3a2e", "#e8a04a"],
  ["#c9982e", "#f5e19a"],
  ["#4a2a5e", "#e8762e"],
  ["#2e4a2e", "#a83232"],
  ["#6b4a2e", "#c98a3a"],
  ["#8a5a2e", "#d99a4a"],
  ["#8a2e2e", "#2e6b3a"],
  ["#b5482f", "#e8c468"],
  ["#7a4a2e", "#d9b66a"],
  ["#2e5e3a", "#8a6a3a"],
  ["#2e5e5e", "#7ac8a8"],
  ["#8a2e2e", "#2e3a8a"],
  ["#3a4a2e", "#a8b45e"],
];
function gradientForIcon(emoji) {
  let hash = 0;
  for (const ch of emoji) hash = (hash * 31 + ch.codePointAt(0)) % 100000;
  return CHALLENGE_GRADIENTS[hash % CHALLENGE_GRADIENTS.length];
}

// ------------------- small helpers -------------------

function $(id) { return document.getElementById(id); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getAvatar(id) {
  return AVATARS.find((a) => a.id === id) || AVATARS[hashString(id || "") % AVATARS.length];
}

// A user's avatar is: an explicit override set from Settings, else whatever
// they last picked (derived from their most recent synced session), else a
// name-based fallback so even sessions saved before this feature still get
// a consistent-looking avatar.
function avatarForUser(name) {
  const override = getCachedData().avatars?.[name];
  if (override) return getAvatar(override);
  getAllSessionsForDisplay();
  const sessions = indexedSessionsForUser(name)
    .filter((s) => s.avatar)
    .sort((a, b) => sessionTimestamp(b) - sessionTimestamp(a));
  if (sessions.length) return getAvatar(sessions[0].avatar);
  return AVATARS[hashString(name) % AVATARS.length];
}

function avatarCircleHTML(avatar, size) {
  return `<span class="avatar-circle" style="background:${avatar.bg};width:${size};height:${size};font-size:calc(${size} * 0.55)">${avatar.emoji}</span>`;
}

function setAvatarEl(el, avatarId, size) {
  const a = getAvatar(avatarId);
  el.textContent = a.emoji;
  el.style.background = a.bg;
  if (size) {
    el.style.width = size;
    el.style.height = size;
    el.style.fontSize = `calc(${size} * 0.55)`;
  }
}

function toast(msg, ms = 2600) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), ms);
}

// Prefers the pre-rendered clips in assets/voice (see voice.js); falls back to
// the browser's built-in speech synth for anything not in the shipped corpus.
function soundIsEnabled() {
  return localStorage.getItem(LS.soundEnabled) !== "0";
}

function speak(text) {
  if (!soundIsEnabled()) return;
  if (speakClips(text)) return;
  speakFallback(text);
}

// Same as speak(), but degrades to the slow/quiet system-voice settings
// (speakCalm) instead of the peppier default fallback if the "zen" clip
// somehow isn't available — preserving Zen's quieter character even in
// that edge case, rather than only when the custom clip has been generated.
function speakZen(text) {
  if (!soundIsEnabled()) return;
  if (speakClips(text)) return;
  speakCalm(text);
}

function vibrate(ms) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (e) { /* ignore */ }
  }
}

function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatNumber(n) {
  return Number(n).toLocaleString("en-US");
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// ------------------- theme -------------------

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelectorAll("#theme-select .segment").forEach((s) => {
    s.classList.toggle("active", s.dataset.theme === theme);
  });
  // Card art is per-theme and its URL is set in JS, so a theme switch during a
  // Cards session would otherwise leave the wrong art up until the next flip.
  if (state.currentCard) {
    setCardFace($("card-face-front"), state.currentCard);
    setCardFace($("card-face-back"), state.currentCard);
  }
  // Same idea for Fortune Cookie's own per-theme art — each frame's src is
  // swapped as a whole (never a mid-crossfade blend of both themes), so a
  // theme change mid-reveal still only ever shows one theme at a time.
  if (state.pushupMode === "fortune") {
    preloadFortuneAssets(theme).catch(() => {});
    renderFortuneStage();
  }
}

function initTheme() {
  const saved = localStorage.getItem(LS.theme) || "dark";
  applyTheme(saved);
  $("theme-select").addEventListener("click", (e) => {
    const btn = e.target.closest(".segment");
    if (!btn) return;
    const next = btn.dataset.theme;
    localStorage.setItem(LS.theme, next);
    applyTheme(next);
  });
}

// ------------------- shared data (via Worker) -------------------

function workerConfigured() {
  return workerApi.configured();
}

function announce(message) {
  const el = $("a11y-announcer");
  el.textContent = "";
  requestAnimationFrame(() => { el.textContent = message; });
}

function syncAccessibilityState() {
  document.querySelectorAll('[role="tablist"] .segment').forEach((tab) => {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(tab.classList.contains("active")));
  });
}
document.addEventListener("click", () => queueMicrotask(syncAccessibilityState));

async function workerFetchData() {
  return normalizeSharedData(await workerApi.fetchData());
}

async function workerResolveLocation(position) {
  return workerApi.resolveLocation(position);
}

async function workerSearchLocations(query) {
  return workerApi.searchLocations(query);
}

async function workerSetAvatar(user, avatar) {
  return workerApi.setAvatar(user, avatar);
}

async function workerRenameUser(oldName, newName) {
  return workerApi.renameUser(oldName, newName);
}

async function workerPostSession(session) {
  return workerApi.postSession(session);
}

async function deleteUserRemote(name) {
  return workerApi.deleteUser(name);
}

async function deleteSessionRemote(id) {
  return workerApi.deleteSession(id);
}

async function workerJoinChallenge(user, challengeId) {
  return workerApi.joinChallenge(user, challengeId);
}

async function workerCreateChallenge(challenge) {
  return workerApi.createChallenge(challenge);
}

async function workerCreateHorseGame(input) {
  return workerApi.createHorseGame(input);
}
async function workerPostHorseTurn(payload) {
  return workerApi.postHorseTurn(payload);
}
async function workerSkipHorseGame(gameId) {
  return workerApi.skipHorseGame(gameId);
}
async function workerDeclineHorseInvite(gameId, user) {
  return workerApi.declineHorseInvite(gameId, user);
}

// Splices a Horse game into cached shared data immediately (so the bell and
// any open Horse screen reflect it right away) instead of waiting for the
// next full /data refresh.
function upsertLocalHorseGame(game) {
  const cached = getCachedData();
  const idx = cached.horseGames.findIndex((g) => g.id === game.id);
  if (idx === -1) cached.horseGames.push(game);
  else cached.horseGames[idx] = game;
  cacheData(cached);
}

let sessionIndex = null;
let challengeSessionCache = new Map();

function invalidateSessionIndex() {
  sessionIndex = null;
  challengeSessionCache.clear();
}

function buildSessionIndex(sessions) {
  const byUser = new Map();
  const byActivity = { pushups: [], planks: [], squats: [] };
  const byUserActivity = new Map();
  const byLeaderboardMode = Object.fromEntries(LEADERBOARD_MODE_OPTIONS.map((option) => [option.id, []]));
  const byUserLeaderboardMode = new Map();
  const timestampBySession = new WeakMap();

  for (const session of sessions) {
    const activity = session.type === "plank" ? "planks" : session.type === "squat" ? "squats" : "pushups";
    const timestamp = Date.parse(session.timestamp);
    timestampBySession.set(session, Number.isFinite(timestamp) ? timestamp : 0);

    if (!byUser.has(session.user)) byUser.set(session.user, []);
    byUser.get(session.user).push(session);
    byActivity[activity].push(session);

    // Squat sessions deliberately skip the shared leaderboard modes (its own
    // screen/per-user best, minimal integration — see docs/squat-mode-plan.md)
    // so they never land in byLeaderboardMode/byUserLeaderboardMode at all.
    const leaderboardModes = session.type === "plank"
      ? ["planks"]
      : session.type === "squat"
      ? []
      : ["all", session.mode || "classic"];
    for (const mode of leaderboardModes) {
      if (!byLeaderboardMode[mode]) continue;
      byLeaderboardMode[mode].push(session);
      const userModeKey = `${mode}\0${session.user}`;
      if (!byUserLeaderboardMode.has(userModeKey)) byUserLeaderboardMode.set(userModeKey, []);
      byUserLeaderboardMode.get(userModeKey).push(session);
    }

    const userActivityKey = `${activity}\0${session.user}`;
    if (!byUserActivity.has(userActivityKey)) byUserActivity.set(userActivityKey, []);
    byUserActivity.get(userActivityKey).push(session);
  }

  const newestFirst = [...sessions].sort((a, b) =>
    (timestampBySession.get(b) || 0) - (timestampBySession.get(a) || 0)
  );
  return { sessions, byUser, byActivity, byUserActivity, byLeaderboardMode, byUserLeaderboardMode, timestampBySession, newestFirst };
}

function indexSessions(sessions) {
  sessionIndex = buildSessionIndex(sessions);
  return sessionIndex;
}

function sessionTimestamp(session) {
  const indexed = sessionIndex?.timestampBySession.get(session);
  if (indexed !== undefined) return indexed;
  const parsed = Date.parse(session.timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
}

function indexedSessionsForUser(user, activity = null) {
  if (!sessionIndex) getAllSessionsForDisplay();
  if (activity) return sessionIndex.byUserActivity.get(`${activity}\0${user}`) || [];
  return sessionIndex.byUser.get(user) || [];
}

function indexedSessionsForUserMode(user, mode = state.leaderboardMode) {
  if (!sessionIndex) getAllSessionsForDisplay();
  return sessionIndex.byUserLeaderboardMode.get(`${mode}\0${user}`) || [];
}

function cacheData(data) {
  invalidateSessionIndex();
  jsonStorage.write(LS.cacheData, normalizeSharedData(data));
}
function getCachedData() {
  return normalizeSharedData(jsonStorage.read(LS.cacheData, {}));
}

const mutationQueue = createMutationQueue({ jsonStorage, key: LS.pendingQueue });

function getQueue() {
  return mutationQueue.read();
}
function setQueue(q) {
  invalidateSessionIndex();
  mutationQueue.write(q);
}
function enqueueSession(session) {
  invalidateSessionIndex();
  return mutationQueue.enqueue("session", session, { id: `session:${session.id}` });
}
function enqueueMutation(type, payload, id) {
  invalidateSessionIndex();
  return mutationQueue.enqueue(type, payload, { id });
}

// Weighted mode: each user's bodyweight + today's added weight (vest, kid on
// back, etc.) lives locally per-user, never synced — it only feeds the
// multiplier applied to that user's own pushup counts before they're shared.
function getWeightedProfiles() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS.weightedProfiles) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch (e) {
    return {};
  }
}
function getWeightedProfile(user) {
  const profiles = getWeightedProfiles();
  return profiles[user] || { bodyweightLbs: 0, addedWeightLbs: 0, enabled: false };
}
function saveWeightedProfile(user, profile) {
  const profiles = getWeightedProfiles();
  profiles[user] = profile;
  localStorage.setItem(LS.weightedProfiles, JSON.stringify(profiles));
}
// The bonus this awards is added weight's fraction of bodyweight, doubled —
// users found the original 1:1 version (bodyweight + added) / bodyweight
// too conservative to feel worth toggling on.

// Sends a session to the Worker (which handles the GitHub merge/retry
// server-side). A couple of client-side retries just for network flakiness.
async function commitSession(session, attempts = 2) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      await workerPostSession(session);
      return true;
    } catch (e) {
      lastErr = e;
      await sleep(350 * (i + 1));
    }
  }
  throw lastErr;
}

// Retries anything queued locally from failed writes. Safe to call often.
let flushQueuePromise = null;
async function flushQueue() {
  if (!workerConfigured()) return { flushed: 0, remaining: getQueue().length };
  if (flushQueuePromise) return flushQueuePromise;
  flushQueuePromise = mutationQueue.flush(async (operation) => {
    const payload = operation.payload;
    if (operation.type === "session") return commitSession(payload);
    if (operation.type === "avatar") return workerSetAvatar(payload.user, payload.avatar);
    if (operation.type === "rename-user") return workerRenameUser(payload.oldName, payload.newName);
    if (operation.type === "join-challenge") return workerJoinChallenge(payload.user, payload.challengeId);
    if (operation.type === "create-challenge") return workerCreateChallenge(payload);
    throw new Error(`Unknown queued mutation: ${operation.type}`);
  });
  try {
    return await flushQueuePromise;
  } finally {
    flushQueuePromise = null;
    renderPendingStatus();
  }
}

// All sessions currently known to this device: last successful remote fetch,
// unioned with anything still queued (not yet confirmed written remotely).
function getAllSessionsForDisplay() {
  if (sessionIndex) return sessionIndex.sessions;
  const cached = getCachedData().sessions;
  const queued = getQueue().filter((operation) => operation.type === "session").map((operation) => operation.payload);
  const byId = new Map();
  for (const s of cached) byId.set(s.id, s);
  for (const s of queued) byId.set(s.id, s);
  return indexSessions(Array.from(byId.values())).sessions;
}

async function refreshFromRemote() {
  if (!workerConfigured()) return getAllSessionsForDisplay();
  try {
    const data = await workerFetchData();
    cacheData(data);
  } catch (e) {
    // offline or Worker unreachable — fall back to cache silently
  }
  return getAllSessionsForDisplay();
}

function chaseLeaderLabel(stage) {
  return stage.leaderNames[0] || "the leader";
}

function prepareChaseFromSessions(sessions, offline = false) {
  const plan = buildChasePlan(sessions, state.currentUser, new Date());
  const first = plan.target || null;
  state.chasePrepared = { plan, offline, eligible: !!first, first };
  return state.chasePrepared;
}

async function refreshChaseAvailability() {
  let offline = !workerConfigured();
  if (workerConfigured()) {
    try {
      const data = await workerFetchData();
      cacheData(data);
    } catch (e) {
      offline = true;
    }
  }
  return prepareChaseFromSessions(getAllSessionsForDisplay(), offline);
}

function prepareLadderRivalsFromSessions(sessions, offline = false) {
  state.ladderRivals = buildLadderRivals(sessions, state.currentUser).map((rival) => ({
    ...rival,
    users: rival.names.map((name) => ({ name, avatar: avatarForUser(name) })),
  }));
  state.ladderRivalsOffline = offline;
  return state.ladderRivals;
}

async function refreshLadderRivals() {
  let offline = !workerConfigured();
  if (workerConfigured()) {
    try {
      const data = await workerFetchData();
      cacheData(data);
    } catch (e) {
      offline = true;
    }
  }
  return prepareLadderRivalsFromSessions(getAllSessionsForDisplay(), offline);
}

// ------------------- cards mode: deck -------------------

// Row order must match the sprite sheet (spades, hearts, diamonds, clubs
// top-to-bottom); column order must match too (A,2..10,J,Q,K left-to-right).
const CARD_RANKS = [
  { label: "A", value: 1 }, { label: "2", value: 2 }, { label: "3", value: 3 }, { label: "4", value: 4 },
  { label: "5", value: 5 }, { label: "6", value: 6 }, { label: "7", value: 7 }, { label: "8", value: 8 },
  { label: "9", value: 9 }, { label: "10", value: 10 }, { label: "J", value: 11 }, { label: "Q", value: 12 }, { label: "K", value: 13 },
];
const CARD_SUITS = ["spades", "hearts", "diamonds", "clubs"];

function buildFreshDeck() {
  const deck = [];
  for (let row = 0; row < CARD_SUITS.length; row++) {
    for (let col = 0; col < CARD_RANKS.length; col++) deck.push({ col, row });
  }
  return shuffleArray(deck);
}

// Pure: given a persisted deck array, pops the next card, reshuffling a
// fresh 52 first if it's empty. No localStorage touched here — kept
// separate and testable like createRepCounter.
function drawFromDeck(deck) {
  const source = deck.length ? deck : buildFreshDeck();
  const [card, ...rest] = source;
  return { card, rest };
}

function cardAt(col, row) {
  const rank = CARD_RANKS[col];
  return { col, row, suit: CARD_SUITS[row], label: rank.label, value: rank.value };
}

function getPersistedDeck() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS.cardDeck) || "[]");
    return Array.isArray(raw) ? raw.filter((c) => c && Number.isInteger(c.col) && Number.isInteger(c.row)) : [];
  } catch (e) {
    return [];
  }
}
function setPersistedDeck(deck) {
  localStorage.setItem(LS.cardDeck, JSON.stringify(deck));
}

// Draws the next card and immediately persists the remainder, so a
// mid-session app kill can't cause duplicate or skipped cards.
function drawNextCard() {
  const { card, rest } = drawFromDeck(getPersistedDeck());
  setPersistedDeck(rest);
  return cardAt(card.col, card.row);
}

// ------------------- dice mode -------------------
// Simpler than Cards: real dice can repeat, so there's no deck/no-repeat
// persistence — just an independent roll each time (confirmed mechanic:
// sum-as-target, re-roll immediately once hit, no timer).

function rollDice() {
  const a = 1 + Math.floor(Math.random() * 6);
  const b = 1 + Math.floor(Math.random() * 6);
  return { a, b, sum: a + b };
}

function diceImageUrl(n) {
  return `assets/dice/dice-${n}.png`;
}

function setDiceFaces(dice) {
  $("die-1").src = diceImageUrl(dice.a);
  $("die-2").src = diceImageUrl(dice.b);
}

// A random whole-turn spin (so the pips always land right-side up) plus a
// horizontal kick, fed into dice-tumble's --tumble-rot/--tumble-x custom
// properties. Direction and turn count are picked independently per die per
// roll so the pair never reads as one synchronized object.
function randomTumble() {
  const turns = 2 + Math.floor(Math.random() * 3); // 2-4 full spins
  const sign = Math.random() < 0.5 ? -1 : 1;
  const x = (Math.random() * 2.4 - 1.2).toFixed(2); // -1.2rem .. 1.2rem
  return { rot: `${sign * turns * 360}deg`, x: `${x}rem` };
}

let diceRollTimer = null;
// Swaps both faces immediately and plays a per-die tumble. Faces show the
// new value spinning in rather than being hidden until the animation ends —
// simpler than Cards' true 3D flip and just as readable. Guards against a
// roll landing mid-animation (fast reps hitting back-to-back low sums) the
// same way playCardFlip does: clear any pending cleanup and force a reflow
// so the class always restarts cleanly.
function playDiceRoll(dice) {
  const die1 = $("die-1");
  const die2 = $("die-2");
  clearTimeout(diceRollTimer);
  setDiceFaces(dice);

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  die1.classList.remove("rolling");
  die2.classList.remove("rolling");
  const t1 = randomTumble();
  const t2 = randomTumble();
  die1.style.setProperty("--tumble-rot", t1.rot);
  die1.style.setProperty("--tumble-x", t1.x);
  die2.style.setProperty("--tumble-rot", t2.rot);
  die2.style.setProperty("--tumble-x", t2.x);
  void die1.offsetWidth;
  die1.classList.add("rolling");
  die2.classList.add("rolling");
  diceRollTimer = setTimeout(() => {
    die1.classList.remove("rolling");
    die2.classList.remove("rolling");
  }, 800);
}

// Rolls again, plays the tumble, and resets the per-roll rep count. Mirrors
// advanceToNextCard — detection/counting never waits on this.
function advanceToNextRoll() {
  const next = rollDice();
  // The outgoing roll was just cleared — record it for the end-of-session share.
  if (state.currentDice) state.diceRollsCleared.push(state.currentDice);
  playDiceRoll(next);
  state.currentDice = next;
  state.diceTarget = next.sum;
  state.diceRepsDone = 0;
  return next;
}

// ------------------- wheel mode -------------------
// Endless, auto-advancing: a spin starts automatically at session start and
// again the instant each set finishes (no manual Spin tap). The dial is
// drawn as 12 EQUAL-size slices (see wheel-mode.js's displaySegments) even
// though the underlying odds stay weighted toward common outcomes — slice
// size is purely visual now, not a probability tell.

function initializeWheelDial() {
  const dial = $("wheel-dial");
  const segments = displaySegments();

  // Each spoke is a chip (dark pill, short label/icon) sitting inside the
  // colored wedge — not a bare floating emoji. Only two neutral tones split
  // the wedges (alternating by index); the landed wedge's own solid
  // accent-orange fill comes from the separate #wheel-landed-highlight
  // overlay (always centered at 0deg post-rotation — see playWheelSpin),
  // and its chip flips to the exact segmented-control "selected" look
  // (solid var(--primary) fill, var(--text-on-accent) text — see
  // .segment.active in style.css) via the .landed class toggled in
  // playWheelSpin's completion handler.
  // Number spokes show a real (representative, not random-flickering)
  // value scaled off the user's PR instead of a generic 🔢 — five
  // identical emoji gave no sense of which spoke was "the big one".
  const pr = getHighScore(state.currentUser);
  dial.innerHTML = segments.map((seg) => {
    const rotDeg = seg.midDeg;
    const content = seg.type === "number" ? String(numberRangeMidpoint(pr, seg.numRange)) : (seg.chip || seg.icon);
    return `<span class="wheel-chip" data-seg-id="${seg.id}" style="transform: rotate(${rotDeg}deg) translateY(-6.1rem) rotate(${-rotDeg}deg)" aria-hidden="true">${content}</span>`;
  }).join("");

  const neutralTones = ["var(--bg-elevated)", "var(--bg-elevated-2)"];
  const gradientStops = segments.map((seg, idx) => `${neutralTones[idx % 2]} ${seg.startDeg}deg ${seg.endDeg}deg`);

  dial.style.background = `conic-gradient(from 0deg, ${gradientStops.join(", ")})`;
  dial.style.transitionDuration = "0ms";
  dial.style.transform = "rotate(0deg)";
  $("wheel-landed-highlight").classList.remove("show");
}

let wheelSpinTimer = null;
let wheelRotationTotal = 0; // accumulates so each landing spins further, never resets to 0

// A landed segment's midpoint always ends up rotated to exactly 0deg (the
// fixed pointer position) — see the rotation math below — so the "you
// landed here" highlight is just a static wedge at the top of the dial
// that fades in on completion, no per-landing angle math needed for it.
function wheelSpokenForResult(result) {
  const finalType = result.landings[result.landings.length - 1].type;
  const hadDouble = result.landings.some((l) => l.type === "double");
  const n = numberToWords(result.targetReps);
  let line;
  if (finalType === "boss") line = WHEEL_BOSS_LINE(n);
  else if (finalType === "freebie") line = WHEEL_FREEBIE_LINE(n);
  else if (finalType === "bust") line = WHEEL_BUST_LINE(n);
  else if (finalType === "grip") {
    const gripLabel = MODIFIERS.find((m) => m.id === result.modifierId)?.cueLabel || "Grip switch";
    line = `${gripLabel}! ${n}!`;
  } else if (finalType === "tempo") line = WHEEL_TEMPO_LINE(n);
  else line = `${n}!`;
  return hadDouble ? `${WHEEL_DOUBLE_PREFIX} ${line}` : line;
}

// Animates the dial through the landings array in sequence, then commits
// the final target/modifier/cue to state. Rotation is applied directly to
// `transform` (not a class-toggled keyframe animation) so the landed angle
// is still showing once the CSS transition finishes — a "forwards"-filled
// animation's end state disappears the instant its triggering class is
// removed, which made the dial snap back to 0deg after every landing.
function playWheelSpin(result) {
  const landings = result.landings;
  const dial = $("wheel-dial");
  const highlight = $("wheel-landed-highlight");

  clearTimeout(wheelSpinTimer);
  highlight.classList.remove("show");

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let landingIndex = 0;

  function animateNextLanding() {
    if (landingIndex >= landings.length) {
      // All landings done, commit the final result
      state.wheelTarget = result.targetReps;
      state.wheelRepsDone = 0;
      state.wheelSetModifier = result.modifierId;
      const gripModifier = result.modifierId ? MODIFIERS.find((m) => m.id === result.modifierId) : null;
      state.wheelCue = {
        label: result.cueLabel || gripModifier?.cueLabel || null,
        sub: result.cueSub || gripModifier?.cueSub || null,
        targetReps: result.targetReps,
      };
      state.wheelSpinning = false;
      renderWheel();
      highlight.classList.add("show");
      const finalSegId = landings[landings.length - 1].id;
      dial.querySelectorAll(".wheel-chip").forEach((el) => {
        el.classList.toggle("landed", el.dataset.segId === finalSegId);
      });
      speak(wheelSpokenForResult(result));
      return;
    }

    const landing = landings[landingIndex];
    const segments = displaySegments();
    const segment = segments.find((s) => s.id === landing.id);

    if (!segment) {
      landingIndex++;
      animateNextLanding();
      return;
    }

    const isFinal = landingIndex === landings.length - 1;
    const fullSpins = isFinal ? (3 + Math.floor(Math.random() * 3)) : (1 + Math.floor(Math.random() * 2));
    // Advance past the current total by full spins, then land on this
    // segment's mid-angle (pointer is fixed at the top / 0deg).
    const base = Math.ceil(wheelRotationTotal / 360) * 360;
    wheelRotationTotal = base + (fullSpins * 360) + (360 - segment.midDeg);

    const duration = reduceMotion ? 0 : (isFinal ? 1100 : 400);
    dial.style.transitionDuration = `${duration}ms`;
    dial.style.transform = `rotate(${wheelRotationTotal}deg)`;

    const gap = reduceMotion ? 50 : 100;
    wheelSpinTimer = setTimeout(() => {
      landingIndex++;
      animateNextLanding();
    }, duration + gap);
  }

  animateNextLanding();
}

// Resolves + animates one full spin. Called automatically at session start
// and again the instant a set finishes (see setupWorkoutModeState and
// onRepCounted) — there is no manual Spin control.
function advanceWheelSpin() {
  const pr = getHighScore(state.currentUser);
  const pickRandomModifier = (rnd) => RESOLVABLE_MODIFIER_IDS[Math.floor(rnd() * RESOLVABLE_MODIFIER_IDS.length)];
  const result = resolveWheelSpin({ pr, lastTarget: state.wheelLastTarget, pickRandomModifier });
  state.wheelSpinning = true;
  $("wheel-landed-highlight").classList.remove("show");
  $("wheel-dial").querySelectorAll(".wheel-chip.landed").forEach((el) => el.classList.remove("landed"));
  playWheelSpin(result);
}

function renderWheel() {
  const wheelCueEl = $("wheel-cue");
  if (state.wheelCue) {
    const { label, sub, targetReps } = state.wheelCue;
    wheelCueEl.textContent = label ? `${label} — ${formatNumber(targetReps)}` : `${formatNumber(targetReps)} reps`;
    wheelCueEl.title = sub || "";
    wheelCueEl.classList.remove("hidden");
  } else {
    wheelCueEl.classList.add("hidden");
  }
}

// ------------------- app state -------------------

const state = {
  currentUser: localStorage.getItem(LS.lastUser) || "",
  currentAvatar: "",
  screen: "screen-user",
  workoutActive: false,
  pushupMode: "classic",
  countdownTarget: 0,
  currentCard: null,
  cardTarget: 0,
  cardRepsDone: 0,
  cardsCleared: [],
  pokerHand: [],
  pokerCardIndex: 0,
  pokerCardTarget: 0,
  pokerCardRepsDone: 0,
  pokerHandsCompleted: [],
  pokerAchievementsUnlocked: [],
  pokerResolving: false,
  currentDice: null,
  diceTarget: 0,
  diceRepsDone: 0,
  diceRollsCleared: [],
  wheelTarget: 0,
  wheelRepsDone: 0,
  wheelLastTarget: 0,
  wheelSetModifier: null,
  wheelCue: null,
  wheelSpinning: false,
  wheelLandings: [],
  ladderRung: 1,
  ladderRepsDone: 0,
  ladderMaxRungCleared: 0,
  sharpshooterTarget: 0,
  sharpshooterRepsDone: 0,
  sharpshooterTargetsDestroyed: 0,
  sharpshooterLongestShot: 0,
  sharpshooterAnimationTimer: null,
  pyramidSize: 10,
  pyramidDirection: "up",
  pyramidRow: 0,
  pyramidRepsDone: 0,
  pyramidPhase: "descending",
  pyramidPeakReached: false,
  pyramidCompleted: false,
  pyramidTotalReps: 0,
  modifier: null,
  resolvedModifier: null,
  ladderRivals: [],
  ladderRivalsOffline: false,
  fortuneRevealState: "closed",
  fortuneRevealing: false,
  fortuneChallenge: null,
  wakeLock: null,
  lastSessionResult: null,
  dashboardPeriod: "day",
  historyView: "recent",
  highScore: 0,
  bonanzaMode: "mine",
  modeBreakdownScope: "group",
  modeBreakdownPeriod: "week",
  lastSessions: [],
  mySessionsShown: 5,
  sessionStartedAt: null,
  challengeTab: "active",
  openChallengeId: null,
  justJoinedChallengeId: null,
  leaderboardMode: savedLeaderboardMode(),
  activityType: savedLeaderboardMode() === "planks" ? "planks" : "pushups",
  lastSessionType: "pushup",
  plankActive: false,
  plankBest: 0,
  plankStartedAt: null,
  squatActive: false,
  squatBest: 0,
  squatStartedAt: null,
  squatSessionLocation: null,
  summarySessionId: null,
  summaryBaseCount: 0,
  summaryExtra: 0,
  summaryMultiplier: 1,
  summaryWeightLbs: 0,
  summaryPrAchieved: null,
  chasePrepared: null,
  chasePlan: null,
  chaseProgress: null,
  chasePreviousLead: 0,
  chaseNextShoutAt: 0,
  chaseMultiplier: 1,
  summaryChaseResult: null,
  summaryRoadtripConquests: [],
  roadtripPeriod: ["day", "week", "month", "year"].includes(localStorage.getItem(LS.roadtripPeriod)) ? localStorage.getItem(LS.roadtripPeriod) : "week",
  roadtripTier: ["neighborhood", "city", "country"].includes(localStorage.getItem(LS.roadtripTier)) ? localStorage.getItem(LS.roadtripTier) : "city",
  roadtripTerritories: [],
  roadtripDetailId: null,
  compareUser: "",
  compareMode: "all",
  sessionDetailSession: null,
  sessionDetailOrigin: "screen-dashboard",
  createGoalType: "individual",
  // A brand-new device is willing to refresh only if the browser already has
  // permission. An explicit Clear stores `unknown`, which disables that refresh.
  deviceLocationProfile: normalizeDeviceLocationProfile(jsonStorage.read(LS.deviceLocation, { mode: "automatic", location: null })),
  sessionLocation: null,
  plankSessionLocation: null,
  horseGame: null,
  horseWordMode: "classic",
  horseWord: "HORSE",
  horseSessionType: "live",
  horseSetupPlayers: [],
  horseLetterEvent: null,
};
let summaryReconcileTimer = null;

const TRACE_MAX_SAMPLES = 4000; // ~2 min at 30 fps

const repState = {
  counter: null,
  phase: "up",
  count: 0,
  smoothedRatio: null,
  lastSeenAt: 0,
  lastRepSpokenAt: 0,
  paused: false,
  lastCheerAtCount: 0,
  recordBroken: false,
  ladderRecordSpoken: false,
  trace: [],
};

const plankState = {
  seconds: 0,
  lastCheerAtSecond: 0,
  intervalId: null,
  recordBroken: false,
};

// Sampling window used for each of the 2-tap calibration steps.
const SQUAT_CAL_SAMPLE_MS = 1500;

const squatState = {
  counter: null,
  phase: "up",
  count: 0,
  lastSeenAt: 0,
  lastRepSpokenAt: 0,
  paused: false,
  lastCheerAtCount: 0,
  recordBroken: false,
  // "idle" | "cal-stand" | "cal-squat" | "counting" — read by the shared
  // camera controller's onDetection to decide what to do with each frame.
  stage: "idle",
  calSamples: [],
  calStandY: null,
  calSquatY: null,
  down: DEFAULT_DOWN,
  up: DEFAULT_UP,
};

function getSquatCalibration() {
  return jsonStorage.read(LS.squatCal, null);
}
function saveSquatCalibration(standY, squatY, thresholds) {
  jsonStorage.write(LS.squatCal, {
    standY, squatY, down: thresholds.down, up: thresholds.up, calibratedAt: new Date().toISOString(),
  });
}

function getThresholdDown() {
  const v = parseFloat(localStorage.getItem(LS.thresholdDown));
  return Number.isFinite(v) ? v : DEFAULT_DOWN;
}
function getThresholdUp() {
  const v = parseFloat(localStorage.getItem(LS.thresholdUp));
  return Number.isFinite(v) ? v : DEFAULT_UP;
}

// ------------------- screen navigation -------------------

function renderStreakBadge() {
  const el = $("streak-badge");
  if (!state.currentUser) {
    el.classList.add("hidden");
    return;
  }
  const mine = indexedSessionsForUser(state.currentUser, "pushups");
  const { streak, restDays } = computeStreakCore(mine);
  el.classList.remove("hidden");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const restDaySavedStreak = restDays.some((d) => d.toDateString() === yesterday.toDateString());
  el.classList.toggle("streak-badge-rest", restDaySavedStreak);
  if (streak > 0) {
    const restBadge = restDaySavedStreak ? `<span class="streak-rest-badge">🛌</span>` : "";
    el.innerHTML = `🔥${restBadge}<span class="streak-num">${streak}</span>`;
    el.title = restDaySavedStreak ? "Rest day used — streak saved!" : "";
  } else {
    el.innerHTML = `❄️<span class="streak-num streak-zero">0</span>`;
    el.title = "";
  }
}

// Which bottom tab lights up for a given screen — every screen not listed
// here (workout, summary, challenge detail, etc.) is reached BY tapping a
// tab and doesn't need its own entry.
const TAB_FOR_SCREEN = {
  "screen-user": "btn-nav-home",
  "screen-workout": "btn-nav-home",
  "screen-explore-modes": "btn-nav-home",
  "screen-pyramid-setup": "btn-nav-home",
  "screen-horse-setup": "btn-nav-home",
  "screen-horse-turn-order": "btn-nav-home",
  "screen-horse-letter": "btn-nav-home",
  "screen-horse-summary": "btn-nav-home",
  "screen-modifier-picker": "btn-nav-home",
  "screen-plank-workout": "btn-nav-home",
  "screen-plank-unlock": "btn-nav-home",
  "screen-squat-workout": "btn-nav-home",
  "screen-summary": "btn-nav-home",
  "screen-dashboard": "btn-nav-dashboard",
  "screen-user-compare": "btn-nav-dashboard",
  "screen-challenges": "btn-nav-challenges",
  "screen-challenge-detail": "btn-nav-challenges",
  "screen-challenge-create": "btn-nav-challenges",
  "screen-roadtrip": "btn-nav-roadtrip",
  "screen-roadtrip-detail": "btn-nav-roadtrip",
  "screen-settings": "btn-nav-settings",
  "screen-edit-profile": "btn-nav-settings",
  "screen-mode-breakdown": "btn-nav-settings",
};

// Header and tab bar always minimize/hide together — an active rep-counting
// or plank session flips this directly (mid-session, no showScreen() call),
// while every other transition goes through showScreen() below.
function setChromeMinimized(minimized) {
  $("app-header").classList.toggle("minimized", minimized);
  $("tab-bar").classList.toggle("hidden", minimized);
}

function showScreen(id) {
  // The Settings capture-test camera has no place to keep running once the
  // screen it's shown on goes away.
  if (id !== "screen-settings" && squatTraceState.running) stopSquatCaptureTest();
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
  state.screen = id;
  const minimized = (id === "screen-workout" && state.workoutActive) ||
    (id === "screen-plank-workout" && state.plankActive) ||
    (id === "screen-squat-workout" && state.squatActive);
  setChromeMinimized(minimized);
  const activeTab = id === "screen-session-detail" ? TAB_FOR_SCREEN[state.sessionDetailOrigin] : TAB_FOR_SCREEN[id];
  document.querySelectorAll("#tab-bar .tab-item").forEach((btn) => {
    btn.classList.toggle("active", btn.id === activeTab);
    if (btn.id === activeTab) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });
  syncAccessibilityState();
  renderStreakBadge();
  renderHorseBellDropdown();

  if (id === "screen-user") {
    userSelectionExpanded = false;
    userCreationOpen = false;
    renderUserList();
    renderDeviceLocation();
  }
  if (id === "screen-dashboard") renderDashboard();
  if (id === "screen-session-detail") renderSessionDetail();
  if (id === "screen-challenges") renderChallengesScreen();
  if (id === "screen-roadtrip") renderRoadtrip();
  if (id === "screen-roadtrip-detail") renderRoadtripDetail();
  if (id === "screen-settings") renderSettings();
  if (id === "screen-explore-modes") renderExploreModesScreen();
  if (id === "screen-workout" && !state.workoutActive) {
    $("workout-username").textContent = state.currentUser || "Friend";
    setAvatarEl($("workout-avatar"), state.currentAvatar, "2rem");
    renderWeightedQuickToggle();
    renderWorkoutInstructionLine();
    // Fresh Home visits always reset to Classic; arriving pre-selected from
    // Explore Modes (openPushupModeFromExplore) skips this exactly once.
    if (!preserveNextModeSelection) state.pushupMode = "classic";
    preserveNextModeSelection = false;
    renderPushupModePicker();
    renderModifierSlot();
    if (state.pushupMode === "fortune") resetFortuneStage();
    renderFortuneIdleUI();
  }
  if (id === "screen-plank-workout" && !state.plankActive) {
    $("plank-username").textContent = state.currentUser || "Friend";
    setAvatarEl($("plank-avatar"), state.currentAvatar, "2rem");
  }
  if (id === "screen-squat-workout" && !state.squatActive) {
    $("squat-username").textContent = state.currentUser || "Friend";
    setAvatarEl($("squat-avatar"), state.currentAvatar, "2rem");
    $("btn-squat-use-last-cal").classList.toggle("hidden", !getSquatCalibration());
  }
}

function guardLeaveWorkout(next) {
  if (state.screen === "screen-workout" && state.workoutActive) {
    const ok = confirm("Leave this workout? Your in-progress reps won't be saved.");
    if (!ok) return;
    stopWorkoutHard();
  } else if (state.screen === "screen-plank-workout" && state.plankActive) {
    const ok = confirm("Leave this plank? Your in-progress time won't be saved.");
    if (!ok) return;
    stopPlankHard();
  } else if (state.screen === "screen-squat-workout" && state.squatActive) {
    const ok = confirm("Leave this squat set? Your in-progress reps won't be saved.");
    if (!ok) return;
    stopSquatHard();
  }
  next();
}

function goToDashboard(mode) {
  state.bonanzaMode = mode;
  document.querySelectorAll("#bonanza-mode-select .segment").forEach((s) => {
    s.classList.toggle("active", s.dataset.mode === mode);
  });
  $("boys-bonanza-view").classList.toggle("hidden", mode !== "boys");
  $("my-bonanza-view").classList.toggle("hidden", mode !== "mine");
  showScreen("screen-dashboard");
}

$("btn-home").addEventListener("click", () => guardLeaveWorkout(() => showScreen("screen-user")));
$("btn-nav-home").addEventListener("click", () => guardLeaveWorkout(() => showScreen("screen-user")));
$("streak-badge").addEventListener("click", () => guardLeaveWorkout(() => goToDashboard("mine")));
$("btn-nav-challenges").addEventListener("click", () => guardLeaveWorkout(() => showScreen("screen-challenges")));
$("btn-nav-dashboard").addEventListener("click", () => guardLeaveWorkout(() => goToDashboard("boys")));
$("btn-nav-roadtrip").addEventListener("click", () => guardLeaveWorkout(openRoadtrip));
$("btn-nav-settings").addEventListener("click", () => guardLeaveWorkout(() => showScreen("screen-settings")));

// ------------------- user select screen -------------------

let userSelectionExpanded = false;
let userCreationOpen = false;
let userCreationReturnExpanded = false;

function userChoiceButton(name, selected = false) {
  const avatar = avatarForUser(name);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "user-chip" + (selected ? " selected" : "");
  btn.innerHTML = `${avatarCircleHTML(avatar, "1.7rem")}<span>${escapeHtml(name)}</span>`;
  btn.addEventListener("click", () => selectUser(name));
  return btn;
}

function openNewUserForm() {
  userCreationReturnExpanded = userSelectionExpanded;
  userCreationOpen = true;
  renderUserList();
  $("new-user-input").focus();
}

function renderUserList() {
  const sessions = getAllSessionsForDisplay();
  const names = orderedUserNames(sessions, state.currentUser);
  const savedLastUser = localStorage.getItem(LS.lastUser) || "";
  const model = userSelectionModel(names, savedLastUser, { expanded: userSelectionExpanded, creating: userCreationOpen });
  if (model.staleRecentUser) {
    localStorage.removeItem(LS.lastUser);
    if (state.currentUser === savedLastUser) state.currentUser = "";
  }
  const list = $("user-list");
  list.innerHTML = "";
  list.classList.toggle("hidden", model.creating);

  if (!model.creating && model.recentUser) {
    list.appendChild(userChoiceButton(model.recentUser, true));
    const moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "user-chip user-more-chip";
    moreBtn.innerHTML = `<span class="dot-grid-icon" aria-hidden="true"></span><span>More</span>`;
    moreBtn.addEventListener("click", () => {
      userSelectionExpanded = true;
      renderUserList();
    });
    list.appendChild(moreBtn);
  }

  if (!model.creating && !names.length) {
    const p = document.createElement("p");
    p.className = "screen-sub";
    p.textContent = "No one's flexed yet — be the first!";
    list.appendChild(p);
  }
  if (!model.creating) {
    for (const name of model.visibleUsers) list.appendChild(userChoiceButton(name));
    const newBtn = document.createElement("button");
    newBtn.type = "button";
    newBtn.className = "user-chip new-user-chip centered-user-chip";
    newBtn.innerHTML = `<span class="new-user-plus">＋</span><span>New user</span>`;
    newBtn.addEventListener("click", openNewUserForm);
    list.appendChild(newBtn);
  }

  $("new-user-form").classList.toggle("hidden", !model.creating);
  if (!model.creating) $("new-user-input").value = "";
  populateAvatarSelect();

}

function populateAvatarSelect() {
  const sel = $("new-user-avatar");
  if (sel.options.length === 0) {
    sel.innerHTML = AVATARS.map((a) => `<option value="${a.id}">${a.emoji}</option>`).join("");
    sel.addEventListener("change", () => {
      updateAvatarSelectSwatch();
      localStorage.setItem(LS.lastAvatar, sel.value);
    });
  }
  const last = localStorage.getItem(LS.lastAvatar);
  sel.value = AVATARS.some((a) => a.id === last) ? last : AVATARS[0].id;
  updateAvatarSelectSwatch();
}

function updateAvatarSelectSwatch() {
  const sel = $("new-user-avatar");
  sel.style.background = getAvatar(sel.value).bg;
}

function selectUser(name, avatarId) {
  state.currentUser = name;
  state.currentAvatar = avatarId || avatarForUser(name).id;
  localStorage.setItem(LS.lastUser, name);
  showScreen("screen-workout");
}

$("new-user-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("new-user-input").value.trim();
  if (!name) return;
  selectUser(name, $("new-user-avatar").value);
});

// ------------------- device-wide session location -------------------

function persistDeviceLocationProfile(mode, location) {
  state.deviceLocationProfile = normalizeDeviceLocationProfile({ mode, location });
  jsonStorage.write(LS.deviceLocation, state.deviceLocationProfile);
  renderDeviceLocation();
  if (state.screen === "screen-roadtrip") renderRoadtrip();
}

function renderDeviceLocation() {
  const label = formatTerritoryLocation(state.deviceLocationProfile.location);
  $("device-location-label").textContent = label;
  $("location-sheet-current").textContent = label;
}

function currentSessionLocationSnapshot() {
  return snapshotTerritoryLocation(state.deviceLocationProfile.location);
}

function setLocationControlsBusy(busy) {
  $("btn-location-current").disabled = busy;
  $("btn-location-search").disabled = busy;
  $("btn-location-clear").disabled = busy;
  $("btn-location-search-submit").disabled = busy;
}

function resetLocationSearch() {
  $("location-search-form").classList.add("hidden");
  $("location-search-status").textContent = "";
  $("location-search-results").innerHTML = "";
}

function openLocationSheet() {
  renderDeviceLocation();
  resetLocationSearch();
  $("location-sheet-backdrop").classList.remove("hidden");
  $("btn-location-close").focus();
}

function closeLocationSheet() {
  $("location-sheet-backdrop").classList.add("hidden");
  resetLocationSearch();
  if (state.screen === "screen-user") $("device-location-row").focus();
  else if (state.screen === "screen-roadtrip") $("btn-roadtrip-location").focus();
}

function browserPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not supported on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0,
    });
  });
}

function positionErrorMessage(error) {
  if (error?.code === 1) return "Location permission was not granted.";
  if (error?.code === 2) return "Your location could not be determined.";
  if (error?.code === 3) return "Finding your location timed out.";
  return error?.message || "Your location could not be determined.";
}

async function updateFromCurrentLocation({ interactive = false } = {}) {
  if (interactive) {
    setLocationControlsBusy(true);
    $("btn-location-current").textContent = "Finding location…";
  }
  try {
    const position = await browserPosition();
    const payload = await workerResolveLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyM: position.coords.accuracy,
    });
    const location = normalizeTerritoryLocation(payload.location);
    if (!location) throw new Error("That location could not be resolved.");
    persistDeviceLocationProfile("automatic", location);
    if (interactive) {
      closeLocationSheet();
      toast(`Location set to ${formatTerritoryLocation(location)}.`);
    }
    return location;
  } catch (error) {
    if (interactive) toast(positionErrorMessage(error), 4000);
    return null;
  } finally {
    if (interactive) {
      setLocationControlsBusy(false);
      $("btn-location-current").textContent = "Use current location";
    }
  }
}

async function refreshAutomaticDeviceLocation() {
  if (state.deviceLocationProfile.mode !== "automatic" || !navigator.permissions?.query) return;
  try {
    const permission = await navigator.permissions.query({ name: "geolocation" });
    if (permission.state === "granted") await updateFromCurrentLocation();
  } catch (e) {
    // Do not call geolocation when permission state cannot be checked: that
    // could trigger an unexpected prompt during app launch.
  }
}

function renderLocationSearchResults(results) {
  const container = $("location-search-results");
  container.innerHTML = "";
  for (const candidate of results) {
    const location = normalizeTerritoryLocation(candidate);
    if (!location) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "location-result";
    button.textContent = formatTerritoryLocation(location);
    button.addEventListener("click", () => {
      persistDeviceLocationProfile("manual", location);
      closeLocationSheet();
      toast(`Location set to ${formatTerritoryLocation(location)}.`);
    });
    container.appendChild(button);
  }
  return container.childElementCount;
}

$("device-location-row").addEventListener("click", openLocationSheet);
$("btn-location-close").addEventListener("click", closeLocationSheet);
$("location-sheet-backdrop").addEventListener("click", (event) => {
  if (event.target === $("location-sheet-backdrop")) closeLocationSheet();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("location-sheet-backdrop").classList.contains("hidden")) closeLocationSheet();
});
$("btn-location-current").addEventListener("click", () => updateFromCurrentLocation({ interactive: true }));
$("btn-location-search").addEventListener("click", () => {
  $("location-search-form").classList.remove("hidden");
  $("location-search-input").focus();
});
$("btn-location-clear").addEventListener("click", () => {
  persistDeviceLocationProfile("unknown", null);
  closeLocationSheet();
  toast("Location cleared.");
});
$("location-search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = $("location-search-input").value.trim();
  if (query.length < 2) {
    $("location-search-status").textContent = "Enter at least two characters.";
    return;
  }
  setLocationControlsBusy(true);
  $("location-search-status").textContent = "Searching…";
  $("location-search-results").innerHTML = "";
  try {
    const payload = await workerSearchLocations(query);
    const count = renderLocationSearchResults(Array.isArray(payload.results) ? payload.results : []);
    $("location-search-status").textContent = count ? "Choose the best match." : "No matching locations found.";
  } catch (error) {
    $("location-search-status").textContent = "Location search is unavailable right now.";
  } finally {
    setLocationControlsBusy(false);
  }
});

// ------------------- settings screen -------------------

function renderSettings() {
  $("range-down").value = getThresholdDown();
  $("range-up").value = getThresholdUp();
  $("val-down").textContent = getThresholdDown().toFixed(2);
  $("val-up").textContent = getThresholdUp().toFixed(2);
  $("chk-highscore-message").checked = localStorage.getItem(LS.showHighscore) !== "0";
  $("chk-sound-enabled").checked = localStorage.getItem(LS.soundEnabled) !== "0";
  renderVoicePresetSelect();
  $("chk-camera-preview").checked = localStorage.getItem(LS.showCameraPreview) === "1";
  $("btn-download-trace").classList.toggle("hidden", !repState.trace.length);
  $("btn-download-squat-trace").classList.toggle("hidden", !squatTraceState.trace.length);
  renderWeightedSettings();

  renderPendingStatus();
  testSyncConnection();
  renderManageUsers();
  state.mySessionsShown = 5;
  renderMySessions();
}

function renderWeightedSettings() {
  const profile = getWeightedProfile(state.currentUser);
  $("input-bodyweight").value = profile.bodyweightLbs || "";
  $("weight-amount").textContent = String(profile.addedWeightLbs || 0);
  $("chk-weighted-enabled").checked = !!profile.enabled;
  $("chk-weighted-enabled").disabled = !profile.bodyweightLbs;
  updateWeightModifierReadout(profile);
}

function updateWeightModifierReadout(profile) {
  const el = $("weight-modifier-readout");
  el.textContent = weightModifierText(profile, weightedMultiplier(profile));
}

$("input-bodyweight").addEventListener("change", (e) => {
  const profile = getWeightedProfile(state.currentUser);
  const val = Math.max(0, Math.round(Number(e.target.value) || 0));
  profile.bodyweightLbs = val;
  if (!val) profile.enabled = false;
  saveWeightedProfile(state.currentUser, profile);
  renderWeightedSettings();
});

function adjustAddedWeight(delta) {
  const profile = getWeightedProfile(state.currentUser);
  profile.addedWeightLbs = Math.max(0, (profile.addedWeightLbs || 0) + delta);
  saveWeightedProfile(state.currentUser, profile);
  renderWeightedSettings();
}
$("btn-weight-plus").addEventListener("click", () => adjustAddedWeight(5));
$("btn-weight-minus").addEventListener("click", () => adjustAddedWeight(-5));

$("chk-weighted-enabled").addEventListener("change", (e) => {
  const profile = getWeightedProfile(state.currentUser);
  profile.enabled = e.target.checked && !!profile.bodyweightLbs;
  saveWeightedProfile(state.currentUser, profile);
  renderWeightedSettings();
});

// Quick on/off toggle on the workout start screen mirrors the same profile,
// so you don't have to dig into Settings to turn weighted mode on/off before
// a session — but bodyweight itself is still only set up there.
function renderWeightedQuickToggle() {
  const profile = getWeightedProfile(state.currentUser);
  const btn = $("btn-weighted-quick");
  if (!profile.bodyweightLbs || profile.bodyweightLbs <= 0) {
    btn.classList.add("hidden");
    return;
  }
  btn.classList.remove("hidden");
  btn.classList.toggle("active", !!profile.enabled);
  btn.textContent = profile.enabled
    ? `🏋️ Weighted +${profile.addedWeightLbs || 0} lbs`
    : "🏋️ Weighted mode off";
}
$("btn-weighted-quick").addEventListener("click", () => {
  const profile = getWeightedProfile(state.currentUser);
  profile.enabled = !profile.enabled;
  saveWeightedProfile(state.currentUser, profile);
  renderWeightedQuickToggle();
});

// Set by openPushupModeFromExplore so the very next screen-workout render
// keeps the mode it just pre-selected instead of resetting to Classic.
let preserveNextModeSelection = false;

// ------------------- Home/Start coaching cue -------------------
// The setup line ("Phone flat on the floor...") is a one-time/fallback
// state, not a permanent fixture: once a user has actually started the
// camera successfully, that slot permanently shows a rotating pushup-form
// tip instead — reverting to the literal setup text only for a brand-new
// user (never started camera) or right after a failed camera attempt (see
// the getUserMedia catch in startWorkout), since something just needs
// re-explaining in that case.
const PUSHUP_FORM_CUES = [
  "Squeeze your chest at the top.",
  "Keep elbows at roughly 45°.",
  "Brace your core.",
  "Don't let your hips sag.",
  "Control every lowering phase.",
  "Look slightly ahead.",
];

// Cycles through the library in a fixed order via a persisted index, so
// every cue is shown before any repeat (true least-recently-shown) rather
// than a random pick that could repeat back-to-back. Advances every call —
// callers re-roll once per idle Start-screen visit (see showScreen).
function nextFormCue() {
  const i = Math.max(0, parseInt(localStorage.getItem(LS.formCueIndex), 10) || 0);
  localStorage.setItem(LS.formCueIndex, String(i + 1));
  return PUSHUP_FORM_CUES[i % PUSHUP_FORM_CUES.length];
}

function renderWorkoutInstructionLine() {
  const el = $("workout-instructions");
  const hasCameraStarted = localStorage.getItem(LS.hasCameraStarted) === "1";
  const hasPermissionIssue = localStorage.getItem(LS.cameraPermissionIssue) === "1";
  if (!hasCameraStarted || hasPermissionIssue) {
    el.textContent = "Phone flat on the floor, screen up. Face over the camera.";
    el.classList.remove("is-cue");
    return;
  }
  el.innerHTML = `<span class="cue-icon" aria-hidden="true">💡</span>${escapeHtml(nextFormCue())}`;
  el.classList.add("is-cue");
}

// Fortune Cookie's idle-screen flow (tap cookie -> reveal -> Start Set)
// replaces the normal coaching-cue line and START button entirely, since its
// own "Start Set" button is what calls startWorkout() for this mode. Purely
// visibility toggling — resetFortuneStage() (called separately, at the
// actual mode-selection transition) is what clears any in-progress reveal.
function renderFortuneIdleUI() {
  const isFortune = state.pushupMode === "fortune";
  $("fortune-idle-stage").classList.toggle("hidden", !isFortune);
  $("workout-eyebrow").classList.toggle("hidden", isFortune);
  $("workout-hello").classList.toggle("hidden", isFortune);
  $("workout-instructions").classList.toggle("hidden", isFortune);
  // The mode picker itself is hidden too — this screen becomes a focused
  // reveal ritual. Switching away still works: the tab bar's Home button
  // routes through the user picker, and a fresh Home visit always resets
  // back to Classic (see showScreen's screen-workout branch).
  $("pushup-mode-select").classList.toggle("hidden", isFortune);
  $("btn-start").classList.toggle("hidden", isFortune);
  $("workout-hint").classList.toggle("hidden", isFortune);
  if (isFortune) {
    loadFortuneMode().catch(() => {});
    preloadFortuneAssets(fortuneTheme());
  }
}

// Reflects whatever state.pushupMode currently is as the active segment.
// Does NOT touch state.pushupMode itself — callers decide whether this is a
// fresh Home visit (reset to Classic) or arriving with a mode pre-selected
// from Explore Modes (see openPushupModeFromExplore).
function renderPushupModePicker() {
  const current = $("pmode-current");
  const selected = state.pushupMode === "classic"
    ? { id: "classic", title: "Classic", icon: "" }
    : EXPLORE_MODES.find((mode) => mode.id === state.pushupMode);
  const compactTitles = { dice: "Dice", wheel: "Wheel", fortune: "Fortune", chase: "Chase", poker: "Poker", zen: "Zen" };
  const selectedTitle = selected ? (compactTitles[selected.id] || selected.title) : "Classic";
  current.dataset.pmode = selected?.id || "classic";
  current.textContent = selected ? `${selected.icon ? `${selected.icon} ` : ""}${selectedTitle}` : "Classic";
  current.title = selected?.title || "Classic";
  document.querySelectorAll("#pushup-mode-select .segment[data-pmode]").forEach((s) => {
    s.classList.toggle("active", s.dataset.pmode === state.pushupMode);
  });
}

// Home's 3rd fixed slot: independent of pushupMode entirely (a Modifier can
// be set while Classic, Cards, Countdown, etc. are active in turn — it only
// resets on a full app reload, never on a mode change). Disabled while Zen
// is selected, since Zen deliberately strips down feedback/coaching.
function renderModifierSlot() {
  const btn = $("pmode-modifier");
  const picked = state.modifier ? MODIFIERS.find((m) => m.id === state.modifier) : null;
  btn.textContent = picked ? `${picked.icon} ${picked.title}` : "Modifier";
  btn.classList.toggle("active", !!picked);
  const disabled = state.pushupMode === "zen";
  btn.classList.toggle("segment-disabled", disabled);
  btn.setAttribute("aria-disabled", String(disabled));
}

function renderModifierPicker() {
  const list = $("modifier-list");
  list.innerHTML = MODIFIERS.map((m) => {
    const selected = m.id === state.modifier;
    const badge = selected
      ? '<span class="modifier-row-check" aria-hidden="true">✓</span>'
      : '<span class="explore-mode-chev">›</span>';
    return `
    <div class="explore-mode-row${selected ? " selected" : ""}" data-modifier-id="${m.id}">
      <div class="explore-mode-icon">${m.icon}</div>
      <div class="explore-mode-copy">
        <div class="explore-mode-title">${escapeHtml(m.title)}</div>
        <div class="explore-mode-tagline">${escapeHtml(m.sub)}</div>
      </div>
      ${badge}
    </div>
  `;
  }).join("");
}

$("modifier-list").addEventListener("click", (e) => {
  const row = e.target.closest(".explore-mode-row");
  if (!row) return;
  const id = row.dataset.modifierId;
  state.modifier = id === state.modifier ? null : id;
  showScreen("screen-workout");
});

$("pmode-modifier").addEventListener("click", () => {
  if ($("pmode-modifier").classList.contains("segment-disabled")) return;
  renderModifierPicker();
  guardLeaveWorkout(() => showScreen("screen-modifier-picker"));
});

$("pushup-mode-select").addEventListener("click", (e) => {
  if (e.target.closest("#pmode-more")) {
    showScreen("screen-explore-modes");
    return;
  }
  const btn = e.target.closest(".segment[data-pmode]");
  if (!btn || btn.classList.contains("segment-disabled")) return;
  document.querySelectorAll("#pushup-mode-select .segment[data-pmode]").forEach((s) => s.classList.remove("active"));
  btn.classList.add("active");
  state.pushupMode = btn.dataset.pmode;
  if (state.pushupMode === "fortune") resetFortuneStage();
  renderFortuneIdleUI();
  renderModifierSlot();
});

// Full mode catalog for the Explore Modes screen — the live modes above plus
// the announced-but-not-built roadmap, shown disabled so the group can see
// what's coming without being able to tap into nothing. Countdown is only
// truly playable once a user has a first session logged (it counts down to
// beating that personal best), so it's gated dynamically in
// renderExploreModesScreen rather than being statically "live" here.
let chaseAvailabilityRequest = 0;
function renderExploreModesScreen(refresh = true) {
  const list = $("explore-modes-list");
  const hasPR = getHighScore(state.currentUser) >= 1;
  const items = exploreModesModel({ sessions: getAllSessionsForDisplay(), hasPR, refresh, chasePrepared: state.chasePrepared, chaseLeaderLabel });
  const sectionLabels = { pushups: "Pushups", other: "Other exercises" };
  let lastSection = null;
  list.innerHTML = items.map((item) => {
    const m = item.mode;
    const live = item.playable;
    const badge = live
      ? '<span class="explore-mode-chev">›</span>'
      : `<span class="explore-mode-soon">${item.status}</span>`;
    const header = item.section !== lastSection ? `<p class="explore-mode-section-label">${sectionLabels[item.section]}</p>` : "";
    lastSection = item.section;
    return `
    ${header}
    <div class="explore-mode-row${live ? "" : " disabled"}" data-explore-mode="${m.id}">
      <div class="explore-mode-icon">${m.icon}</div>
      <div class="explore-mode-copy">
        <div class="explore-mode-title">${escapeHtml(m.title)}</div>
        <div class="explore-mode-tagline">${escapeHtml(item.tagline)}</div>
      </div>
      ${badge}
    </div>
  `;
  }).join("");
  if (refresh) {
    const request = ++chaseAvailabilityRequest;
    refreshChaseAvailability().then(() => {
      if (request === chaseAvailabilityRequest && state.screen === "screen-explore-modes") renderExploreModesScreen(false);
    });
  }
}

// Jumps to the workout start screen with a specific mode pre-selected,
// bypassing the normal reset-to-Classic that a fresh Home visit gets.
let pyramidModePromise = null;
let pyramidMode = null;
function loadPyramidMode() {
  if (!pyramidModePromise) pyramidModePromise = import("./modes/pyramid.js?v=148").then((module) => (pyramidMode = module));
  return pyramidModePromise;
}

let sharpshooterModePromise = null;
let sharpshooterMode = null;
function loadSharpshooterMode() {
  if (!sharpshooterModePromise) sharpshooterModePromise = import("./modes/sharpshooter.js?v=148").then((module) => (sharpshooterMode = module));
  return sharpshooterModePromise;
}

function openPushupModeFromExplore(modeId) {
  state.pushupMode = modeId;
  if (modeId === "fortune") loadFortuneMode().catch(() => {});
  if (modeId === "sharpshooter") loadSharpshooterMode().catch(() => {});
  preserveNextModeSelection = true;
  guardLeaveWorkout(() => showScreen("screen-workout"));
}

// Base row bar-chart icon (n bars, tallest = base) — no separate image asset,
// mirrors the mockup's simple bar icon per size tier.
function pyramidSizeIconHTML(base) {
  const bars = 4;
  let html = "";
  for (let i = 0; i < bars; i += 1) {
    const h = 30 + (i / (bars - 1)) * 70;
    html += `<span style="height:${h}%"></span>`;
  }
  return html;
}

function renderPyramidSetup() {
  const sizeList = $("pyramid-size-list");
  sizeList.innerHTML = pyramidMode.PYRAMID_SIZES.map((tier) => {
    const selected = tier.base === state.pyramidSize;
    const reps = pyramidMode.pyramidUpOnlyReps(tier.base);
    return `
    <button type="button" class="pyramid-card${selected ? " selected" : ""}" data-pyramid-size="${tier.base}">
      <span class="pyramid-card-icon" aria-hidden="true">${pyramidSizeIconHTML(tier.base)}</span>
      <span class="pyramid-card-body">
        <span class="pyramid-card-title">${escapeHtml(tier.label)}</span>
        <span class="pyramid-card-sub">${tier.base} down to 1 — ${reps} reps</span>
      </span>
      <span class="pyramid-card-check" aria-hidden="true">✓</span>
    </button>
  `;
  }).join("");

  const directionList = $("pyramid-direction-list");
  const base = state.pyramidSize;
  const directions = [
    { id: "up", title: "Up only", sub: `Descend the ladder once, base to apex — ${pyramidMode.pyramidTotalReps(base, "up")} reps` },
    { id: "updown", title: "Up & down", sub: `Base to apex, then back down to base — ${pyramidMode.pyramidTotalReps(base, "updown")} reps` },
  ];
  directionList.innerHTML = directions.map((d) => {
    const selected = d.id === state.pyramidDirection;
    return `
    <button type="button" class="pyramid-card${selected ? " selected" : ""}" data-pyramid-direction="${d.id}">
      <span class="pyramid-card-body">
        <span class="pyramid-card-title">${escapeHtml(d.title)}</span>
        <span class="pyramid-card-sub">${escapeHtml(d.sub)}</span>
      </span>
      <span class="pyramid-card-check" aria-hidden="true">✓</span>
    </button>
  `;
  }).join("");

  $("btn-pyramid-start").textContent = `Start pyramid — ${pyramidMode.pyramidTotalReps(base, state.pyramidDirection)} reps`;
}

$("pyramid-size-list").addEventListener("click", (e) => {
  const btn = e.target.closest(".pyramid-card[data-pyramid-size]");
  if (!btn) return;
  state.pyramidSize = Number(btn.dataset.pyramidSize);
  renderPyramidSetup();
});

$("pyramid-direction-list").addEventListener("click", (e) => {
  const btn = e.target.closest(".pyramid-card[data-pyramid-direction]");
  if (!btn) return;
  state.pyramidDirection = btn.dataset.pyramidDirection;
  renderPyramidSetup();
});

$("btn-pyramid-start").addEventListener("click", () => {
  state.pushupMode = "pyramid";
  preserveNextModeSelection = true;
  guardLeaveWorkout(() => showScreen("screen-workout"));
  startWorkout();
});

$("explore-modes-list").addEventListener("click", async (e) => {
  const row = e.target.closest(".explore-mode-row:not(.disabled)");
  if (!row) return;
  const modeId = row.dataset.exploreMode;
  if (modeId === "chase") {
    row.classList.add("disabled");
    const prepared = await refreshChaseAvailability();
    if (!prepared.eligible) {
      renderExploreModesScreen(false);
      toast("You’re leading every board. Disgusting behavior.", 3500);
      return;
    }
  }
  // Plank and Squat are whole separate activities/screens, not pushupMode toggles.
  if (modeId === "plank") {
    guardLeaveWorkout(() => showScreen("screen-plank-workout"));
    return;
  }
  if (modeId === "squat") {
    guardLeaveWorkout(() => showScreen("screen-squat-workout"));
    return;
  }
  // Pyramid needs a size/direction picked before it can start, unlike every
  // other mode (which configures itself automatically) — see screen-pyramid-setup.
  if (modeId === "pyramid") {
    await loadPyramidMode();
    renderPyramidSetup();
    guardLeaveWorkout(() => showScreen("screen-pyramid-setup"));
    return;
  }
  // Horse needs a word/session-type/player picked before it can start — see
  // screen-horse-setup — and is a whole turn-based flow, not a single set.
  if (modeId === "horse") {
    renderHorseSetup();
    guardLeaveWorkout(() => showScreen("screen-horse-setup"));
    return;
  }
  openPushupModeFromExplore(modeId);
});

// ------------------- Horse mode -------------------

function horseWordChipsHTML(word, lettersCollected) {
  return horseWordChips(word, lettersCollected)
    .map((c) => `<span class="horse-word-chip ${c.filled ? "filled" : "empty"}">${escapeHtml(c.letter)}</span>`)
    .join("");
}

function horseMiniStripHTML(word, lettersCollected) {
  return horseWordChips(word, lettersCollected)
    .map((c) => `<span class="horse-mini-chip${c.filled ? " filled" : ""}"></span>`)
    .join("");
}

function renderHorseWordUI() {
  document.querySelectorAll("#horse-word-select .segment[data-horse-word-mode]").forEach((s) => {
    s.classList.toggle("active", s.dataset.horseWordMode === state.horseWordMode);
  });
  $("horse-word-preview").innerHTML = state.horseWord.split("").map((l) => `<span class="horse-word-chip">${escapeHtml(l)}</span>`).join("");
  $("btn-horse-reshuffle").classList.toggle("hidden", state.horseWordMode !== "random");
}

function renderHorseSessionUI() {
  document.querySelectorAll("#horse-session-select .segment[data-horse-session]").forEach((s) => {
    s.classList.toggle("active", s.dataset.horseSession === state.horseSessionType);
  });
  $("horse-session-note").classList.toggle("hidden", state.horseSessionType !== "invite");
}

let horseInviteExpanded = false;

function renderHorsePlayerList() {
  const list = $("horse-player-list");
  list.innerHTML = state.horseSetupPlayers.map((name) => {
    const isSelf = name === state.currentUser;
    const trailing = isSelf
      ? '<span class="horse-player-tag">Starting</span>'
      : `<button type="button" class="icon-btn" data-remove-horse-player="${escapeHtml(name)}" aria-label="Remove ${escapeHtml(name)}">✕</button>`;
    return `
    <div class="tier1-row horse-player-row${isSelf ? " horse-row-active" : ""}">
      <span class="avatar-circle horse-avatar" data-avatar="${avatarForUser(name).id}"></span>
      <span class="horse-player-name">${escapeHtml(name)}</span>
      ${trailing}
    </div>`;
  }).join("");
  list.querySelectorAll(".horse-avatar").forEach((el) => setAvatarEl(el, el.dataset.avatar));

  const known = orderedUserNames(getAllSessionsForDisplay(), state.currentUser)
    .filter((name) => !state.horseSetupPlayers.includes(name));
  const candidates = $("horse-invite-candidates");
  candidates.classList.toggle("hidden", !horseInviteExpanded);
  if (horseInviteExpanded) {
    candidates.innerHTML = known.length
      ? known.map((name) => `
        <button type="button" class="tier1-row horse-player-row horse-candidate-row" data-add-horse-player="${escapeHtml(name)}">
          <span class="avatar-circle horse-avatar" data-avatar="${avatarForUser(name).id}"></span>
          <span class="horse-player-name">${escapeHtml(name)}</span>
        </button>`).join("")
      : `<p class="screen-sub" style="margin:0.8rem 1rem">No other players on this device yet.</p>`;
    candidates.querySelectorAll(".horse-avatar").forEach((el) => setAvatarEl(el, el.dataset.avatar));
  }
  const startBtn = $("btn-horse-start");
  startBtn.disabled = state.horseSetupPlayers.length < 2;
  startBtn.textContent = state.horseSetupPlayers.length < 2 ? "Add at least one more player" : "Do your set — sets the bar";
}

// keepPlayers: true for Rematch, which reuses the same lineup instead of
// resetting to just the current user.
function renderHorseSetup(keepPlayers = false) {
  state.horseWordMode = "classic";
  state.horseWord = "HORSE";
  state.horseSessionType = "live";
  if (!keepPlayers || !state.horseSetupPlayers?.length) state.horseSetupPlayers = [state.currentUser];
  horseInviteExpanded = false;
  renderHorseWordUI();
  renderHorseSessionUI();
  renderHorsePlayerList();
}

$("btn-horse-setup-back").addEventListener("click", () => {
  guardLeaveWorkout(() => showScreen("screen-explore-modes"));
});

$("horse-word-select").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment[data-horse-word-mode]");
  if (!btn) return;
  state.horseWordMode = btn.dataset.horseWordMode;
  state.horseWord = state.horseWordMode === "random" ? randomHorseWord() : "HORSE";
  renderHorseWordUI();
});

$("btn-horse-reshuffle").addEventListener("click", () => {
  state.horseWord = randomHorseWord(state.horseWord);
  renderHorseWordUI();
});

$("horse-session-select").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment[data-horse-session]");
  if (!btn) return;
  state.horseSessionType = btn.dataset.horseSession;
  renderHorseSessionUI();
});

$("horse-player-list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove-horse-player]");
  if (!btn) return;
  state.horseSetupPlayers = state.horseSetupPlayers.filter((n) => n !== btn.dataset.removeHorsePlayer);
  renderHorsePlayerList();
});

$("btn-horse-invite-more").addEventListener("click", () => {
  horseInviteExpanded = !horseInviteExpanded;
  renderHorsePlayerList();
});

$("horse-invite-candidates").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-add-horse-player]");
  if (!btn) return;
  const name = btn.dataset.addHorsePlayer;
  if (!state.horseSetupPlayers.includes(name)) state.horseSetupPlayers.push(name);
  horseInviteExpanded = false;
  renderHorsePlayerList();
});

// Jumps screen-workout to a specific player's turn — pass-the-phone Live
// mode temporarily relabels the shared active-workout screen as theirs
// (name/avatar only; state.currentUser itself is untouched) rather than
// swapping the logged-in profile, since the rest of the app assumes
// state.currentUser is the device owner.
function beginHorseTurn(name) {
  state.pushupMode = "horse";
  preserveNextModeSelection = true;
  guardLeaveWorkout(() => showScreen("screen-workout"));
  $("workout-username").textContent = name;
  setAvatarEl($("workout-avatar"), avatarForUser(name).id, "2rem");
  startWorkout();
}

$("btn-horse-start").addEventListener("click", async () => {
  if (state.horseSetupPlayers.length < 2) return;
  const input = {
    id: `hg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    word: state.horseWord,
    sessionType: state.horseSessionType,
    createdBy: state.currentUser,
    players: state.horseSetupPlayers,
  };
  state.horseLetterEvent = null;
  // Invite games are server-authoritative from the start (other players read
  // them via /data on their own devices) — Live games stay purely local
  // until the game finishes, same as any other pushup mode's session.
  if (state.horseSessionType === "invite") {
    const btn = $("btn-horse-start");
    btn.disabled = true;
    try {
      const { game } = await workerCreateHorseGame(input);
      state.horseGame = game;
      upsertLocalHorseGame(game);
      beginHorseTurn(state.currentUser);
    } catch (e) {
      toast("Couldn't create the game — check your connection and try again.", 4000);
    } finally {
      btn.disabled = false;
    }
    return;
  }
  state.horseGame = createHorseGame(input);
  beginHorseTurn(state.currentUser);
});

function renderHorseTurnHero() {
  const game = state.horseGame;
  if (!game) return;
  const user = currentTurnPlayer(game);
  const copy = horseTurnHeroCopy(game);
  const mine = horsePlayerRows(game).find((r) => r.name === user);
  $("horse-letters-pill").textContent = `${mine.letters}/5${mine.letters ? ` · ${mine.wordSoFar}` : ""}`;
  $("horse-target-kicker").textContent = copy.kicker || "";
  $("horse-target-kicker").classList.toggle("hidden", !copy.kicker);
  $("horse-target-value").textContent = copy.value;
  $("horse-target-sub").textContent = copy.sub || "";
  $("horse-target-sub").classList.toggle("hidden", !copy.sub);
}

function renderHorseTurnOrder() {
  const game = state.horseGame;
  const rows = horsePlayerRows(game);
  const stalled = game.sessionType === "invite" && isTurnStalled(game, Date.now());
  $("horse-order-title").textContent = `Horse · Round ${game.round}`;
  const target = horseTargetLabel(game);
  $("horse-order-target-line").textContent = target ? `Beat ${target} to stay clean` : `${escapeHtml(game.turnOrder[0])} sets the bar`;
  $("horse-turn-order-list").innerHTML = rows.map((row) => {
    const statusHTML = row.status === "out"
      ? '<span class="horse-player-status-out">OUT</span>'
      : row.status === "up"
        ? '<span class="horse-player-tag">Up now</span>'
        : '<span class="horse-player-status-waiting">Waiting</span>';
    const skipHTML = row.status === "up" && stalled
      ? '<button type="button" class="icon-btn" data-skip-horse-game aria-label="Skip stalled turn">⏭</button>'
      : "";
    return `
    <div class="tier1-row horse-player-row${row.status === "up" ? " horse-row-active" : ""}${row.status === "out" ? " horse-row-out" : ""}">
      <span class="avatar-circle horse-avatar" data-avatar="${avatarForUser(row.name).id}"></span>
      <span class="horse-player-name${row.status === "out" ? " horse-summary-name-out" : ""}">${escapeHtml(row.name)}</span>
      <span class="horse-mini-strip">${horseMiniStripHTML(game.word, row.letters)}</span>
      ${statusHTML}
      ${skipHTML}
    </div>`;
  }).join("");
  $("horse-turn-order-list").querySelectorAll(".horse-avatar").forEach((el) => setAvatarEl(el, el.dataset.avatar));
  const upNow = currentTurnPlayer(game);
  const canTakeTurn = game.sessionType === "live" || upNow === state.currentUser;
  $("btn-horse-take-turn").classList.toggle("hidden", !canTakeTurn);
  $("btn-horse-take-turn").textContent = upNow === state.currentUser ? "Do your set" : `Pass the phone to ${upNow} — do your set`;
}

// Async (invite) games refresh from the server once on entry — see
// HORSE_PLAN.md's "in-app polling only" decision, no live interval polling.
async function openHorseTurnOrder() {
  const game = state.horseGame;
  if (game && game.sessionType === "invite") {
    await refreshFromRemote();
    const fresh = getCachedData().horseGames.find((g) => g.id === game.id);
    if (fresh) state.horseGame = fresh;
  }
  if (state.horseGame.status === "complete") {
    renderHorseSummary();
    showScreen("screen-horse-summary");
    return;
  }
  renderHorseTurnOrder();
  showScreen("screen-horse-turn-order");
}

$("btn-horse-take-turn").addEventListener("click", () => {
  beginHorseTurn(currentTurnPlayer(state.horseGame));
});

$("horse-turn-order-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-skip-horse-game]");
  if (!btn) return;
  btn.disabled = true;
  try {
    const res = await workerSkipHorseGame(state.horseGame.id);
    state.horseGame = res.game;
    upsertLocalHorseGame(res.game);
    if (res.game.status === "complete") {
      renderHorseSummary();
      showScreen("screen-horse-summary");
      return;
    }
    renderHorseTurnOrder();
  } catch (err) {
    toast("Couldn't skip — check your connection.", 3500);
    btn.disabled = false;
  }
});

function renderHorseLetterScreen() {
  const evt = state.horseLetterEvent;
  const game = state.horseGame;
  $("horse-letter-summary-line").textContent = evt.needed == null ? `You got ${evt.reps}` : `Needed ${evt.needed}+ · you got ${evt.reps}`;
  const collected = 5 - evt.lettersLeft;
  const letter = game.word[collected - 1];
  $("horse-letter-badge").textContent = letter;
  $("horse-letter-headline").textContent = `${evt.forUser === state.currentUser ? "You" : evt.forUser} picked up letter ${letter}`;
  $("horse-letter-word").innerHTML = horseWordChipsHTML(game.word, collected);
  $("horse-letter-sub").textContent = evt.justWentOut
    ? `${evt.forUser === state.currentUser ? "You're" : `${evt.forUser} is`} OUT — spelled the whole word.`
    : `${evt.lettersLeft} letter${evt.lettersLeft === 1 ? "" : "s"} left before ${evt.forUser === state.currentUser ? "you're" : `${evt.forUser} is`} out`;
}

$("btn-horse-letter-continue").addEventListener("click", async () => {
  if (state.horseGame.status === "complete") {
    renderHorseSummary();
    showScreen("screen-horse-summary");
  } else {
    await openHorseTurnOrder();
  }
});

function renderHorseSummary() {
  const game = state.horseGame;
  const rows = horseSummaryRows(game);
  $("horse-summary-crown").innerHTML = `👑 ${escapeHtml(game.winner)} wins`;
  $("horse-summary-list").innerHTML = rows.map((row) => {
    const subtitle = row.isWinner ? `Winner${row.letters === 0 ? " · never spelled a letter" : ""}` : `OUT · ${row.wordSoFar}`;
    return `
    <div class="tier1-row horse-player-row${row.isWinner ? " horse-summary-row-winner" : ""}">
      <span class="avatar-circle horse-avatar" data-avatar="${avatarForUser(row.name).id}"></span>
      <span class="horse-summary-name-col">
        <span class="horse-summary-name${row.isWinner ? "" : " horse-summary-name-out"}">${escapeHtml(row.name)}</span>
        <span class="horse-summary-subtitle">${escapeHtml(subtitle)}</span>
      </span>
    </div>`;
  }).join("");
  $("horse-summary-list").querySelectorAll(".horse-avatar").forEach((el) => setAvatarEl(el, el.dataset.avatar));
}

$("btn-horse-rematch").addEventListener("click", () => {
  state.horseSetupPlayers = state.horseGame ? [...state.horseGame.turnOrder] : [state.currentUser];
  renderHorseSetup(true);
  guardLeaveWorkout(() => showScreen("screen-horse-setup"));
});

$("btn-horse-share").addEventListener("click", async () => {
  const game = state.horseGame;
  if (!game) return;
  const rows = horseSummaryRows(game);
  const text = `🐴 Horse: ${game.winner} wins!\n${rows.map((r) => `${r.isWinner ? "👑" : "❌"} ${r.name} — ${r.isWinner ? "Winner" : `OUT · ${r.wordSoFar}`}`).join("\n")}`;
  if (navigator.share) {
    try { await navigator.share({ text }); } catch (e) { /* user cancelled the share sheet */ }
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    toast("Copied results to clipboard", 2500);
  }
});

// ------------------- Horse mode: Home bell (async invite notifications) -------------------
// Only invite/async games ever need a bell entry — Live pass-the-phone games
// are entirely resolved within the single active session they're started in.
function pendingHorseItems() {
  const user = state.currentUser;
  if (!user) return [];
  const games = getCachedData().horseGames || [];
  const items = [];
  for (const game of games) {
    if (game.status !== "active" || game.sessionType !== "invite") continue;
    if (!game.turnOrder.includes(user)) continue;
    if (currentTurnPlayer(game) === user) {
      items.push({ kind: "turn", gameId: game.id, targetLabel: horseTargetLabel(game) });
    } else if (user !== game.createdBy && !game.sets.some((s) => s.user === user)) {
      items.push({ kind: "invite", gameId: game.id, from: game.createdBy });
    }
  }
  return items;
}

function renderHorseBellDropdown() {
  $("btn-horse-bell").classList.toggle("hidden", !state.currentUser);
  const items = pendingHorseItems();
  $("horse-bell-dot").classList.toggle("hidden", items.length === 0);
  const list = $("horse-bell-list");
  list.innerHTML = items.length ? items.map((item) => item.kind === "turn"
    ? `<button type="button" class="tier1-row horse-player-row horse-bell-row" data-bell-turn="${item.gameId}">
        <span aria-hidden="true">🐴</span>
        <span class="horse-player-name">Your turn in Horse${item.targetLabel ? ` · beat ${escapeHtml(item.targetLabel)}` : ""}</span>
      </button>`
    : `
      <div class="tier1-row horse-player-row">
        <span aria-hidden="true">🐴</span>
        <span class="horse-player-name">${escapeHtml(item.from)} invited you to Horse</span>
        <button type="button" class="icon-btn" data-bell-join="${item.gameId}" aria-label="Join">→</button>
        <button type="button" class="icon-btn" data-bell-decline="${item.gameId}" aria-label="Decline">✕</button>
      </div>`
  ).join("") : `<p class="screen-sub horse-bell-empty">Nothing pending.</p>`;
}

$("btn-horse-bell").addEventListener("click", async () => {
  const dropdown = $("horse-bell-dropdown");
  const opening = dropdown.classList.contains("hidden");
  dropdown.classList.toggle("hidden", !opening);
  if (opening) {
    await refreshFromRemote();
    renderHorseBellDropdown();
  }
});

document.addEventListener("click", (e) => {
  if (!$("horse-bell-dropdown").classList.contains("hidden") && !e.target.closest(".horse-bell-wrap")) {
    $("horse-bell-dropdown").classList.add("hidden");
  }
});

$("horse-bell-list").addEventListener("click", async (e) => {
  const turnBtn = e.target.closest("[data-bell-turn]");
  if (turnBtn) {
    const game = getCachedData().horseGames.find((g) => g.id === turnBtn.dataset.bellTurn);
    if (game) {
      state.horseGame = game;
      $("horse-bell-dropdown").classList.add("hidden");
      beginHorseTurn(state.currentUser);
    }
    return;
  }
  const joinBtn = e.target.closest("[data-bell-join]");
  if (joinBtn) {
    const game = getCachedData().horseGames.find((g) => g.id === joinBtn.dataset.bellJoin);
    if (game) {
      state.horseGame = game;
      $("horse-bell-dropdown").classList.add("hidden");
      await openHorseTurnOrder();
    }
    return;
  }
  const declineBtn = e.target.closest("[data-bell-decline]");
  if (declineBtn) {
    declineBtn.disabled = true;
    try {
      const res = await workerDeclineHorseInvite(declineBtn.dataset.bellDecline, state.currentUser);
      upsertLocalHorseGame(res.game);
      renderHorseBellDropdown();
    } catch (err) {
      toast("Couldn't decline — check your connection.", 3500);
      declineBtn.disabled = false;
    }
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.currentUser) {
    refreshFromRemote().then(() => renderHorseBellDropdown());
  }
});

function renderManageUsers() {
  const sessions = getAllSessionsForDisplay();
  const names = orderedUserNames(sessions, state.currentUser, { alphabetical: true });
  const list = $("manage-users-list");
  list.innerHTML = "";
  if (!names.length) {
    list.innerHTML = '<p class="settings-hint">No users yet.</p>';
    return;
  }
  for (const name of names) {
    const isYou = name === state.currentUser;
    const avatar = avatarForUser(name);
    const row = document.createElement("div");
    row.className = "manage-user-row";
    row.innerHTML = `
      <select class="avatar-select manage-avatar-select" aria-label="Change ${escapeHtml(name)}'s avatar"></select>
      <span class="manage-user-name">${escapeHtml(name)}</span>
      ${isYou ? '<span class="you-badge">You</span>' : ""}
      ${isYou
        ? '<button type="button" class="btn-edit-profile">Edit <span class="chev">›</span></button>'
        : `<button type="button" class="btn-delete-user" aria-label="Delete ${escapeHtml(name)}">🗑️</button>`}
    `;
    const avatarSelect = row.querySelector(".manage-avatar-select");
    avatarSelect.innerHTML = AVATARS.map((a) => `<option value="${a.id}">${a.emoji}</option>`).join("");
    avatarSelect.value = avatar.id;
    avatarSelect.style.background = avatar.bg;
    avatarSelect.addEventListener("change", () => {
      avatarSelect.style.background = getAvatar(avatarSelect.value).bg;
      changeUserAvatar(name, avatarSelect.value);
    });
    if (isYou) {
      row.querySelector(".btn-edit-profile").addEventListener("click", () => openEditProfile());
    } else {
      row.querySelector(".btn-delete-user").addEventListener("click", () => confirmDeleteUser(name));
    }
    list.appendChild(row);
  }
}

async function changeUserAvatar(name, avatarId) {
  const cached = getCachedData();
  const previousAvatar = cached.avatars[name];
  cached.avatars[name] = avatarId;
  cacheData(cached);
  try {
    await workerSetAvatar(name, avatarId);
  } catch (e) {
    if (!isRetryableError(e)) {
      if (previousAvatar) cached.avatars[name] = previousAvatar;
      else delete cached.avatars[name];
      cacheData(cached);
      toast(`Couldn't update avatar.`, 4000);
      return false;
    }
    enqueueMutation("avatar", { user: name, avatar: avatarId }, `avatar:${name}`);
    toast(`Avatar saved on this device — waiting to sync.`, 4000);
    renderPendingStatus();
    return true;
  }
  toast(`Updated ${name}'s avatar.`);
  return true;
}

async function confirmDeleteUser(name) {
  const ok = confirm(`Delete all of ${name}'s sessions from the shared leaderboard? This can't be undone.`);
  if (!ok) return;
  if (!navigator.onLine) {
    toast("Deleting a user requires a live connection.", 4000);
    return;
  }
  try {
    await deleteUserRemote(name);
  } catch (e) {
    toast(`Couldn't delete right now — check your connection.`, 4000);
    return;
  }
  const cached = getCachedData();
  cached.sessions = cached.sessions.filter((s) => s.user !== name);
  if (cached.avatars) delete cached.avatars[name];
  cacheData(cached);
  setQueue(getQueue().filter((operation) => operation.payload?.user !== name && operation.payload?.oldName !== name));
  if (state.currentUser === name) {
    state.currentUser = "";
    localStorage.removeItem(LS.lastUser);
  }
  toast(`Deleted ${name}'s sessions.`);
  renderManageUsers();
}

// ------------------- edit profile -------------------

let editProfileSelectedAvatar = null;

function openEditProfile() {
  const avatar = avatarForUser(state.currentUser);
  editProfileSelectedAvatar = avatar.id;
  $("edit-profile-avatar").textContent = avatar.emoji;
  $("edit-profile-avatar").style.background = avatar.bg;
  $("edit-profile-name").value = state.currentUser;
  $("edit-profile-error").classList.add("hidden");

  const grid = $("edit-profile-swatch-grid");
  grid.innerHTML = AVATARS.map((a) => `<button type="button" class="edit-profile-swatch${a.id === avatar.id ? " selected" : ""}" data-avatar="${a.id}" style="background:${a.bg}" aria-label="${a.emoji}">${a.emoji}</button>`).join("");
  grid.querySelectorAll(".edit-profile-swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      editProfileSelectedAvatar = btn.dataset.avatar;
      grid.querySelectorAll(".edit-profile-swatch").forEach((b) => b.classList.toggle("selected", b === btn));
      const picked = getAvatar(editProfileSelectedAvatar);
      $("edit-profile-avatar").textContent = picked.emoji;
      $("edit-profile-avatar").style.background = picked.bg;
    });
  });

  showScreen("screen-edit-profile");
}

async function saveEditProfile() {
  const oldName = state.currentUser;
  const newName = $("edit-profile-name").value.trim();
  const errEl = $("edit-profile-error");
  errEl.classList.add("hidden");

  if (!newName) {
    errEl.textContent = "Name can't be empty.";
    errEl.classList.remove("hidden");
    return;
  }

  const saveBtn = $("btn-edit-profile-save");
  saveBtn.disabled = true;
  try {
    if (newName !== oldName) {
      try {
        await workerRenameUser(oldName, newName);
      } catch (e) {
        if (!isRetryableError(e)) throw e;
        enqueueMutation("rename-user", { oldName, newName }, `rename-user:${oldName}`);
      }
      const cached = renameCachedIdentity(getCachedData(), oldName, newName);
      cacheData(cached);
      setQueue(getQueue().map((operation) => {
        const payload = { ...operation.payload };
        if (payload.user === oldName) payload.user = newName;
        return { ...operation, payload };
      }));
      state.currentUser = newName;
      localStorage.setItem(LS.lastUser, newName);
    }
    if (editProfileSelectedAvatar && editProfileSelectedAvatar !== avatarForUser(newName).id) {
      const updated = await changeUserAvatar(newName, editProfileSelectedAvatar);
      if (!updated) throw new Error("avatar update failed");
    }
    toast("Profile updated.");
    showScreen("screen-settings");
  } catch (e) {
    errEl.textContent = e.message.includes("already in use") ? `"${newName}" is already in use by someone else.` : "Couldn't save — check your connection.";
    errEl.classList.remove("hidden");
  } finally {
    saveBtn.disabled = false;
  }
}

$("btn-edit-profile-back").addEventListener("click", () => showScreen("screen-settings"));
$("btn-edit-profile-save").addEventListener("click", saveEditProfile);
$("btn-edit-profile-save-shortcut").addEventListener("click", saveEditProfile);

function renderMySessions() {
  const model = visibleUserSessions(getAllSessionsForDisplay(), state.currentUser, state.mySessionsShown);
  const list = $("my-sessions-list");
  list.innerHTML = "";
  if (!model.total) {
    list.innerHTML = '<p class="settings-hint">No sessions yet.</p>';
    $("btn-my-sessions-more").classList.add("hidden");
    return;
  }
  for (const s of model.sessions) {
    const row = document.createElement("div");
    row.className = "my-session-row compare-clickable";
    row.innerHTML = `
      <span>${formatDateTime(s.timestamp)}</span>
      <span class="my-session-count">${s.type === "plank" ? `🪵 ${formatDuration(s.count * 1000)}` : s.type === "squat" ? `🦵 ${formatNumber(s.count)}` : formatNumber(s.count)}${s.weightLbs ? " 🏋️" : ""}</span>
      <button type="button" class="btn-delete-user" aria-label="Delete session">🗑️</button>
    `;
    row.querySelector(".btn-delete-user").addEventListener("click", (e) => {
      e.stopPropagation();
      confirmDeleteSession(s.id);
    });
    row.addEventListener("click", () => openSessionDetail(s, "screen-settings"));
    list.appendChild(row);
  }
  $("btn-my-sessions-more").classList.toggle("hidden", !model.hasMore);
}

$("btn-my-sessions-more").addEventListener("click", () => {
  state.mySessionsShown += 5;
  renderMySessions();
});

async function confirmDeleteSession(id) {
  const ok = confirm("Delete this session from the shared leaderboard? This can't be undone.");
  if (!ok) return;
  if (!navigator.onLine) {
    toast("Deleting a session requires a live connection.", 4000);
    return;
  }
  try {
    await deleteSessionRemote(id);
  } catch (e) {
    toast("Couldn't delete right now — check your connection.", 4000);
    return;
  }
  const cached = getCachedData();
  cached.sessions = cached.sessions.filter((s) => s.id !== id);
  cacheData(cached);
  setQueue(getQueue().filter((operation) => !(operation.type === "session" && operation.payload?.id === id)));
  toast("Session deleted.");
  renderMySessions();
  renderStreakBadge();
}

function renderPendingStatus() {
  const n = getQueue().length;
  $("pending-status").textContent = n > 0
    ? `${n} change${n === 1 ? "" : "s"} saved locally, waiting to sync…`
    : "";
}

async function testSyncConnection() {
  const statusEl = $("gh-status");
  if (!workerConfigured()) {
    statusEl.textContent = "Shared leaderboard isn't set up yet.";
    statusEl.className = "settings-status err";
    return;
  }
  statusEl.textContent = "Checking connection…";
  statusEl.className = "settings-status";
  try {
    const data = await workerFetchData();
    cacheData(data);
    statusEl.textContent = `Connected — found ${data.sessions.length} session(s).`;
    statusEl.className = "settings-status ok";
    const flushResult = await flushQueue();
    if (flushResult.flushed) toast(`Synced ${flushResult.flushed} queued change(s).`);
    renderPendingStatus();
  } catch (e) {
    statusEl.textContent = "Can't reach the shared leaderboard right now.";
    statusEl.className = "settings-status err";
  }
}

$("btn-gh-test").addEventListener("click", testSyncConnection);

$("range-down").addEventListener("input", (e) => {
  localStorage.setItem(LS.thresholdDown, e.target.value);
  $("val-down").textContent = parseFloat(e.target.value).toFixed(2);
});
$("range-up").addEventListener("input", (e) => {
  localStorage.setItem(LS.thresholdUp, e.target.value);
  $("val-up").textContent = parseFloat(e.target.value).toFixed(2);
});
$("chk-highscore-message").addEventListener("change", (e) => {
  localStorage.setItem(LS.showHighscore, e.target.checked ? "1" : "0");
});
$("chk-sound-enabled").addEventListener("change", (e) => {
  const enabled = e.target.checked;
  localStorage.setItem(LS.soundEnabled, enabled ? "1" : "0");
  if (!enabled) deactivateVoice();
});

// ------------------- Roadtrip -------------------

const ROADTRIP_PERIOD_LABELS = { day: "Day", week: "Week", month: "Month", year: "Year" };
const ROADTRIP_TIER_LABELS = { neighborhood: "Neighborhood", city: "City", country: "Country" };

// Words swapped into the roadtrip share templates below so the same joke
// reads right whether it's about a block, a whole city, or a country.
const TIER_SHARE_FLAVOR = {
  neighborhood: { turf: "block", scope: "neighborhood", ruler: "block captain" },
  city: { turf: "city", scope: "city", ruler: "mayor" },
  country: { turf: "country", scope: "nation", ruler: "head of state" },
};

function capitalize(word) {
  return word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word;
}

function setRoadtripPeriodMenuOpen(open) {
  $("roadtrip-period-trigger").setAttribute("aria-expanded", String(open));
  $("roadtrip-period-menu").classList.toggle("hidden", !open);
}

async function openRoadtrip() {
  showScreen("screen-roadtrip");
  await refreshFromRemote();
  if (state.screen !== "screen-roadtrip") return;
  renderRoadtrip();
  if (!state.deviceLocationProfile.location && localStorage.getItem(LS.roadtripPrompted) !== "1") {
    localStorage.setItem(LS.roadtripPrompted, "1");
    const location = await updateFromCurrentLocation({ interactive: true });
    if (!location && state.screen === "screen-roadtrip") renderRoadtrip();
  }
}

function roadtripAge(timestamp) {
  if (!timestamp) return "just now";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
}

function roadtripPlaceLabel(row) {
  const prefix = row.flag ? `${row.flag} ` : "";
  return `${prefix}${escapeHtml(row.name)}`;
}

function roadtripOverviewRow(row, { pinned = false } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `roadtrip-row${row.rank === 1 ? " rank-1" : ""}${pinned ? " pinned" : ""}`;
  button.innerHTML = `
    <span class="leaderboard-rank">${row.rank}</span>
    <span class="roadtrip-place">
      <span class="roadtrip-place-name">${roadtripPlaceLabel(row)}${row.rank === 1 ? " 👑" : ""}</span>
      ${row.parent ? `<span class="roadtrip-parent">${escapeHtml(row.parent)}</span>` : ""}
    </span>
    ${state.roadtripTier === "neighborhood" ? "" : `<span class="roadtrip-users">${formatNumber(row.contributorCount)} ${row.contributorCount === 1 ? "user" : "users"}</span>`}
    <span class="roadtrip-score">${formatNumber(row.total)}</span>`;
  button.addEventListener("click", () => {
    state.roadtripDetailId = row.id;
    showScreen("screen-roadtrip-detail");
  });
  return button;
}

function renderRoadtrip() {
  $("roadtrip-period-label").textContent = ROADTRIP_PERIOD_LABELS[state.roadtripPeriod];
  document.querySelectorAll("[data-roadtrip-period]").forEach((option) => {
    const selected = option.dataset.roadtripPeriod === state.roadtripPeriod;
    option.classList.toggle("selected", selected);
    option.setAttribute("aria-selected", String(selected));
  });
  document.querySelectorAll("[data-roadtrip-tier]").forEach((option) => option.classList.toggle("active", option.dataset.roadtripTier === state.roadtripTier));
  const locationMissing = !state.deviceLocationProfile.location;
  $("roadtrip-location-needed").classList.toggle("hidden", !locationMissing);
  const list = $("roadtrip-list");
  list.innerHTML = "";
  state.roadtripTerritories = buildRoadtripTerritories(getAllSessionsForDisplay(), {
    tier: state.roadtripTier,
    period: state.roadtripPeriod,
  });
  const { top, pinned } = roadtripOverviewRows(state.roadtripTerritories, state.deviceLocationProfile.location, state.roadtripTier, 10);
  if (!top.length) {
    list.innerHTML = `<div class="roadtrip-empty"><div class="roadtrip-empty-icon">🛣️</div><strong>No turf claimed ${ROADTRIP_PERIOD_LABELS[state.roadtripPeriod].toLowerCase()}</strong><span>One pushup with a selected location can fix that.</span></div>`;
    return;
  }
  const group = document.createElement("div");
  group.className = "roadtrip-ranked-list";
  top.forEach((row) => group.appendChild(roadtripOverviewRow(row)));
  list.appendChild(group);
  if (pinned) {
    const label = document.createElement("div");
    label.className = "roadtrip-pinned-label";
    label.textContent = "Your turf";
    list.append(label, roadtripOverviewRow(pinned, { pinned: true }));
  }
}

function renderRoadtripDetail() {
  const territory = state.roadtripTerritories.find((row) => row.id === state.roadtripDetailId);
  if (!territory) {
    showScreen("screen-roadtrip");
    return;
  }
  const tierLabel = ROADTRIP_TIER_LABELS[territory.tier].toLowerCase();
  const context = territory.parent ? ` · ${territory.parent}` : "";
  $("roadtrip-detail-title").textContent = `${territory.flag ? `${territory.flag} ` : ""}${territory.name}${context}`;
  $("roadtrip-detail-summary").innerHTML = `
    <div class="roadtrip-crown">👑</div>
    <div class="roadtrip-summary-copy">
      <strong>${formatNumber(territory.total)}</strong>
      <span>total reps · ${formatNumber(territory.contributorCount)} ${territory.contributorCount === 1 ? "flexer" : "flexers"} · #${territory.rank} ${tierLabel}</span>
      <span>${escapeHtml(territory.holder)} ${territory.claimedAt === territory.conqueredAt ? "claimed" : "conquered"} it ${roadtripAge(territory.conqueredAt)}</span>
    </div>`;
  const list = $("roadtrip-detail-list");
  list.innerHTML = "";
  const { top, pinned } = roadtripDetailRows(territory, state.currentUser, territory.users.length);
  const appendUser = (row, isPinned = false) => {
    const el = document.createElement("div");
    el.className = `leaderboard-row${row.rank === 1 ? " rank-1" : ""}${isPinned ? " roadtrip-user-pinned" : ""}`;
    el.innerHTML = `<div class="leaderboard-rank">${row.rank}</div>${avatarCircleHTML(avatarForUser(row.name), "2rem")}<div class="leaderboard-name">${escapeHtml(row.name)}${row.name === state.currentUser ? " <span class=\"roadtrip-you\">You</span>" : ""}</div><div class="leaderboard-total">${formatNumber(row.total)}</div>`;
    makeNameCompareClickable(el.querySelector(".leaderboard-name"), row.name);
    list.appendChild(el);
  };
  top.forEach((row) => appendUser(row));
  if (pinned) appendUser(pinned, true);
}

// ------------------- roadtrip share -------------------

const ROADTRIP_SHARE_GENERIC = [
  (ctx) => `Sitting ${ctx.rankOrdinal} in ${ctx.placeLabel} 🗺️ ${ctx.scoreText} reps staked into this ${ctx.turf} so far.`,
  (ctx) => `${ctx.rankOrdinal} of ${ctx.participants} across ${ctx.placeLabel} 📍 ${ctx.scoreText} reps and I haven't even started being annoying about it.`,
  (ctx) => `Claimed a chunk of ${ctx.placeLabel} 🚩 ${ctx.rankOrdinal} place, ${ctx.scoreText} reps, one ${ctx.turf} inching closer to mine.`,
  (ctx) => `${ctx.scoreText} reps deep into ${ctx.placeLabel} 🏗️ ${ctx.rankOrdinal} place and building an empire nobody asked for.`,
  (ctx) => `The ${ctx.scope} of ${ctx.placeLabel} has no idea what's coming 😈 ${ctx.rankOrdinal} place with ${ctx.scoreText} reps, patiently plotting.`,
  (ctx) => `${ctx.rankOrdinal} in ${ctx.placeLabel} 🧨 ${ctx.scoreText} reps logged and I've started calling this ${ctx.turf} "mine" out loud, unprompted.`,
  (ctx) => `Currently ${ctx.rankOrdinal} of ${ctx.participants} in ${ctx.placeLabel} 🐺 Hunting the ${ctx.ruler} in packs of one.`,
  (ctx) => `${ctx.scoreText} reps into ${ctx.placeLabel}'s board 📈 ${ctx.rankOrdinal} place. The ${ctx.ruler} should be checking the locks.`,
  (ctx) => `${ctx.rankOrdinal} place in ${ctx.placeLabel} 🦴 ${ctx.scoreText} reps buried like evidence. More coming.`,
  (ctx) => `${ctx.placeLabel}: ${ctx.rankOrdinal} of ${ctx.participants}, ${ctx.scoreText} reps 🌋 This ${ctx.turf} is about to have a very bad geological event.`,
  (ctx) => `${ctx.scoreText} reps in ${ctx.placeLabel} and only ${ctx.rankOrdinal} 😤 Unacceptable. Rectifying immediately.`,
  (ctx) => `${ctx.rankOrdinal} in ${ctx.placeLabel} 🕸️ Quietly weaving myself into every corner of this ${ctx.turf}.`,
  (ctx) => `${ctx.scoreText} reps toward owning ${ctx.placeLabel} 🏹 ${ctx.rankOrdinal} place. The ${ctx.ruler} is now a target, not a title.`,
  (ctx) => `${ctx.rankOrdinal} of ${ctx.participants} in ${ctx.placeLabel} 🌪️ ${ctx.scoreText} reps and a full personality disorder about winning.`,
];

const ROADTRIP_SHARE_LEADING = [
  (ctx) => `👑 ${ctx.ruler} of ${ctx.placeLabel}. ${ctx.scoreText} reps and I will be taking questions never.`,
  (ctx) => `Running ${ctx.placeLabel} like it owes me rent 🏆 ${ctx.scoreText} reps, ${ctx.participants} pretenders behind me.`,
  (ctx) => `${ctx.scoreText} reps and the whole ${ctx.turf} answers to me now 🗿 ${ctx.placeLabel} has a new landlord.`,
  (ctx) => `#1 in ${ctx.placeLabel} 🥇 ${ctx.scoreText} reps. The ${ctx.ruler}'s office has my name on it, informally, in my own handwriting.`,
  (ctx) => `Top of ${ctx.placeLabel} 🔥 ${ctx.scoreText} reps. This ${ctx.turf} pays tribute in pushups now.`,
  (ctx) => `${ctx.placeLabel} is mine 🚨 ${ctx.scoreText} reps, ${Math.max(ctx.participants - 1, 0)} other guys watching from a safe distance.`,
  (ctx) => `${capitalize(ctx.ruler)} energy only 👑 ${ctx.scoreText} reps atop ${ctx.placeLabel}. Bow, or at least do a rep about it.`,
  (ctx) => `Undisputed in ${ctx.placeLabel} 🏔️ ${ctx.scoreText} reps. The view from #1 smells like victory and mild deltoid soreness.`,
  (ctx) => `${ctx.scoreText} reps, #1 in ${ctx.placeLabel} 😌 I'd like to thank the ${ctx.turf} for its continued cooperation.`,
  (ctx) => `Conquered ${ctx.placeLabel} 🌍 ${ctx.scoreText} reps and a throne nobody can afford to challenge.`,
];

const ROADTRIP_SHARE_ABSENT = [
  (ctx) => `${ctx.holderName} runs ${ctx.placeLabel} with ${ctx.holderScoreText} reps 👑 ${ctx.runnerUpName}'s only ${ctx.gapText} behind. Someone go save this ${ctx.turf}.`,
  (ctx) => `${ctx.placeLabel}: ${ctx.holderName} on top with ${ctx.holderScoreText}, ${ctx.runnerUpName} breathing down their neck at ${ctx.runnerUpScoreText} 😤 Where's everybody else?`,
  (ctx) => `The ${ctx.ruler} of ${ctx.placeLabel} is ${ctx.holderName} (${ctx.holderScoreText} reps) 🏆 ${ctx.runnerUpName}'s closing the gap. This ${ctx.turf} needs a third option. Could be you.`,
  (ctx) => `${ctx.holderName} vs ${ctx.runnerUpName} for ${ctx.placeLabel} 🥊 ${ctx.gapText} reps apart. Genuinely nobody is stepping in. Cowardly.`,
  (ctx) => `${ctx.placeLabel} standings: ${ctx.holderName} #1 (${ctx.holderScoreText}), ${ctx.runnerUpName} #2 (${ctx.runnerUpScoreText}) 📊 A whole ${ctx.turf} and only two people showed up to fight for it.`,
  (ctx) => `${ctx.holderName} is squatting on ${ctx.placeLabel} with ${ctx.holderScoreText} reps 🏚️ ${ctx.runnerUpName}'s ${ctx.gapText} behind and gaining. You could be the plot twist.`,
  (ctx) => `${ctx.placeLabel} has a ${ctx.ruler}: ${ctx.holderName}, ${ctx.holderScoreText} reps 👑 ${ctx.runnerUpName} is quietly assembling an uprising. Join it.`,
  (ctx) => `Two-man war for ${ctx.placeLabel} 🗡️ ${ctx.holderName} (${ctx.holderScoreText}) vs ${ctx.runnerUpName} (${ctx.runnerUpScoreText}). This ${ctx.turf} deserves better competition. Bring some.`,
  (ctx) => `${ctx.holderName} leads ${ctx.placeLabel} by ${ctx.gapText} over ${ctx.runnerUpName} 📉📈 The ${ctx.scope} is one bad week away from a coup.`,
  (ctx) => `${ctx.placeLabel} is currently a ${ctx.holderName}-${ctx.runnerUpName} rivalry and nothing else 😐 Show up and make it a trilogy.`,
  (ctx) => `${ctx.holderName} holds ${ctx.placeLabel} at ${ctx.holderScoreText} reps, ${ctx.runnerUpName} is ${ctx.gapText} back and closing 🔥 Grab a floor, this ${ctx.turf} is up for grabs.`,
  (ctx) => `${capitalize(ctx.ruler)} race in ${ctx.placeLabel}: ${ctx.holderName} (${ctx.holderScoreText}) narrowly ahead of ${ctx.runnerUpName} (${ctx.runnerUpScoreText}) 🏁 Get in there before it's decided without you.`,
];

const ROADTRIP_SHARE_ABSENT_SOLO = [
  (ctx) => `${ctx.holderName} owns all of ${ctx.placeLabel} uncontested 👑 ${ctx.holderScoreText} reps and literally nobody else showed up. Embarrassing for the rest of the ${ctx.turf}.`,
  (ctx) => `${ctx.placeLabel} has a ${ctx.ruler} — ${ctx.holderName}, ${ctx.holderScoreText} reps 🏰 — and zero challengers. This is a dictatorship at this point.`,
  (ctx) => `${ctx.holderName} is the entire leaderboard for ${ctx.placeLabel} 😳 ${ctx.holderScoreText} reps of pure, unchallenged tyranny. Someone stop them.`,
  (ctx) => `Solo run in ${ctx.placeLabel}: ${ctx.holderName}, ${ctx.holderScoreText} reps 🎪 The rest of the ${ctx.scope} is apparently allergic to floors.`,
  (ctx) => `${ctx.holderName} claimed ${ctx.placeLabel} by default 🚩 ${ctx.holderScoreText} reps. This ${ctx.turf} is one pushup away from having competition.`,
  (ctx) => `${ctx.placeLabel}'s throne, occupied by ${ctx.holderName} alone, ${ctx.holderScoreText} reps 👑 An empty kingdom is still a kingdom. Come contest it.`,
];

// Same no-immediate-repeat guard as the main leaderboard share, kept separate
// since this pool mixes four different template arrays.
let lastRoadtripShareTemplate = null;
function pickRoadtripShareTemplate(pool) {
  let template, guard = 0;
  do {
    template = pickFrom(pool);
  } while (template === lastRoadtripShareTemplate && pool.length > 1 && ++guard < 10);
  lastRoadtripShareTemplate = template;
  return template;
}

async function shareRoadtripDetail() {
  const territory = state.roadtripTerritories.find((row) => row.id === state.roadtripDetailId);
  if (!territory) return;
  const flavor = TIER_SHARE_FLAVOR[territory.tier] || TIER_SHARE_FLAVOR.city;
  const placeLabel = `${territory.flag ? `${territory.flag} ` : ""}${territory.name}`;
  const base = { placeLabel, turf: flavor.turf, scope: flavor.scope, ruler: flavor.ruler };
  const ranked = territory.users.map((u, i) => ({ ...u, rank: i + 1 }));
  const mine = ranked.find((u) => u.name === state.currentUser);

  let message;
  if (mine) {
    const ctx = { ...base, rankOrdinal: ordinal(mine.rank), scoreText: formatNumber(mine.total), participants: ranked.length };
    const pool = mine.rank === 1 ? [...ROADTRIP_SHARE_LEADING, ...ROADTRIP_SHARE_GENERIC] : ROADTRIP_SHARE_GENERIC;
    message = pickRoadtripShareTemplate(pool)(ctx);
  } else {
    const holder = ranked[0];
    const runnerUp = ranked[1];
    if (!holder) return;
    if (runnerUp) {
      const ctx = {
        ...base,
        holderName: holder.name,
        holderScoreText: formatNumber(holder.total),
        runnerUpName: runnerUp.name,
        runnerUpScoreText: formatNumber(runnerUp.total),
        gapText: formatNumber(holder.total - runnerUp.total),
      };
      message = pickRoadtripShareTemplate(ROADTRIP_SHARE_ABSENT)(ctx);
    } else {
      const ctx = { ...base, holderName: holder.name, holderScoreText: formatNumber(holder.total) };
      message = pickRoadtripShareTemplate(ROADTRIP_SHARE_ABSENT_SOLO)(ctx);
    }
  }

  const url = location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Boys Pushup Bonanza", text: message, url });
    } catch (e) {
      // user cancelled the share sheet — not an error
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${message} ${url}`);
    toast("Copied to clipboard — paste it in the group chat!");
  } catch (e) {
    toast("Couldn't share automatically — copy your result manually.", 4000);
  }
}
$("btn-roadtrip-share").addEventListener("click", shareRoadtripDetail);

$("roadtrip-tier-select").addEventListener("click", (event) => {
  const option = event.target.closest("[data-roadtrip-tier]");
  if (!option) return;
  state.roadtripTier = option.dataset.roadtripTier;
  localStorage.setItem(LS.roadtripTier, state.roadtripTier);
  renderRoadtrip();
});
$("roadtrip-period-trigger").addEventListener("click", () => setRoadtripPeriodMenuOpen($("roadtrip-period-trigger").getAttribute("aria-expanded") !== "true"));
$("roadtrip-period-menu").addEventListener("click", (event) => {
  const option = event.target.closest("[data-roadtrip-period]");
  if (!option) return;
  state.roadtripPeriod = option.dataset.roadtripPeriod;
  localStorage.setItem(LS.roadtripPeriod, state.roadtripPeriod);
  setRoadtripPeriodMenuOpen(false);
  renderRoadtrip();
});
document.addEventListener("click", (event) => {
  if (!event.target.closest("#roadtrip-period-picker")) setRoadtripPeriodMenuOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setRoadtripPeriodMenuOpen(false);
});
$("btn-roadtrip-location").addEventListener("click", openLocationSheet);
$("btn-roadtrip-back").addEventListener("click", () => showScreen("screen-roadtrip"));
function renderVoicePresetSelect() {
  const select = $("voice-preset-select");
  if (!select.options.length) {
    select.innerHTML = VOICE_PRESETS.map((p) => `<option value="${p.id}">${escapeHtml(p.label)}</option>`).join("");
  }
  select.value = getVoicePreset();
}
$("voice-preset-select").addEventListener("change", (e) => {
  setVoicePreset(e.target.value);
});
$("chk-camera-preview").addEventListener("change", (e) => {
  localStorage.setItem(LS.showCameraPreview, e.target.checked ? "1" : "0");
  applyCameraPreviewSetting();
});
$("btn-calibration-defaults").addEventListener("click", () => {
  localStorage.setItem(LS.thresholdDown, DEFAULT_DOWN);
  localStorage.setItem(LS.thresholdUp, DEFAULT_UP);
  renderSettings();
});

$("btn-download-trace").addEventListener("click", () => {
  if (!repState.trace.length) return;
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), samples: repState.trace }, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `bpb-trace-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// ------------------- squat mode: Phase 0 capture-test spike -------------------
// Standalone camera controller for the Settings "Squat capture test" row,
// independent of the live Squat workout screen's own controller — this row
// exists to answer the go/no-go question (face detected reliably at a
// couple meters, stand->squat swing big enough) before the real screen is
// built, per docs/squat-mode-plan.md. Face vertical position is the signal:
// standing keeps the face near the top of frame, squatting drops it lower.
const squatTraceState = { trace: [], running: false };

function squatCenterY(bbox, video) {
  return (bbox.originY + bbox.height / 2) / video.videoHeight;
}

function updateSquatTestFaceBox(bbox) {
  const video = $("squat-capture-test-video");
  const container = $("squat-capture-test-wrap");
  const cw = container.clientWidth, ch = container.clientHeight;
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.max(cw / vw, ch / vh);
  const offsetX = (cw - vw * scale) / 2, offsetY = (ch - vh * scale) / 2;
  const box = $("squat-capture-test-face-box");
  box.style.left = `${bbox.originX * scale + offsetX}px`;
  box.style.top = `${bbox.originY * scale + offsetY}px`;
  box.style.width = `${bbox.width * scale}px`;
  box.style.height = `${bbox.height * scale}px`;
  box.classList.remove("hidden");
}

const squatTestCamera = createCameraController({
  moduleUrl: FACE_DETECTOR_MODULE_URL,
  wasmUrl: FACE_DETECTOR_WASM_URL,
  modelUrl: FACE_DETECTOR_MODEL_URL,
  getVideo: () => $("squat-capture-test-video"),
  onDetection(bbox, inferenceMs) {
    const video = $("squat-capture-test-video");
    updateSquatTestFaceBox(bbox);
    squatTraceState.trace.push({
      t: Math.round(performance.now()),
      centerY: +squatCenterY(bbox, video).toFixed(4),
      bboxHeight: +(bbox.height / video.videoHeight).toFixed(4),
      inferenceMs: Math.round(inferenceMs || 0),
    });
    if (squatTraceState.trace.length > TRACE_MAX_SAMPLES) squatTraceState.trace.shift();
  },
  onNoDetection(inferenceMs, startedAt) {
    $("squat-capture-test-face-box").classList.add("hidden");
    squatTraceState.trace.push({ t: Math.round(startedAt), centerY: null, bboxHeight: null, inferenceMs: Math.round(inferenceMs || 0) });
    if (squatTraceState.trace.length > TRACE_MAX_SAMPLES) squatTraceState.trace.shift();
  },
});

async function startSquatCaptureTest() {
  if (squatTraceState.running) return;
  $("squat-capture-test-status").textContent = "Requesting camera…";
  let stream;
  try {
    stream = await squatTestCamera.requestStream();
  } catch (e) {
    $("squat-capture-test-status").textContent = "Camera access denied.";
    return;
  }
  $("squat-capture-test-status").textContent = "Loading face detector…";
  try {
    await squatTestCamera.ensureDetector();
  } catch (e) {
    $("squat-capture-test-status").textContent = "Couldn't load the face detection model.";
    stream.getTracks().forEach((t) => t.stop());
    return;
  }
  const video = $("squat-capture-test-video");
  video.srcObject = stream;
  try { await video.play(); } catch (e) { /* autoplay quirks */ }
  squatTraceState.trace = [];
  squatTraceState.running = true;
  $("squat-capture-test-wrap").classList.remove("hidden");
  $("btn-squat-capture-test").textContent = "Stop capture test";
  $("squat-capture-test-status").textContent = "Capturing — prop against a wall, stand back, do ten squats.";
  $("btn-download-squat-trace").classList.add("hidden");
  squatTestCamera.startDetection();
}

function stopSquatCaptureTest() {
  if (!squatTraceState.running) return;
  squatTestCamera.stop();
  squatTraceState.running = false;
  $("squat-capture-test-wrap").classList.add("hidden");
  $("btn-squat-capture-test").textContent = "Squat capture test";
  const total = squatTraceState.trace.length;
  const detected = squatTraceState.trace.filter((s) => s.centerY != null).length;
  const rate = total ? Math.round((detected / total) * 100) : 0;
  $("squat-capture-test-status").textContent = total
    ? `Captured ${total} samples, ${rate}% with a detected face.`
    : "";
  $("btn-download-squat-trace").classList.toggle("hidden", !total);
}

$("btn-squat-capture-test").addEventListener("click", () => {
  if (squatTraceState.running) stopSquatCaptureTest();
  else startSquatCaptureTest();
});

$("btn-download-squat-trace").addEventListener("click", () => {
  if (!squatTraceState.trace.length) return;
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), samples: squatTraceState.trace }, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `bpb-squat-trace-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// ------------------- dashboard / leaderboard -------------------

async function renderDashboard() {
  await flushQueue().catch(() => {});
  const sessions = await refreshFromRemote();
  state.lastSessions = sessions;
  renderPendingStatus();
  $("leaderboard-mode-picker").classList.remove("hidden");
  syncLeaderboardModeControl();
  paintActiveBonanzaView();
  renderStreakBadge();
}

// Every leaderboard surface uses the same mode slice. Sessions without a
// pushup mode tag are Classic; All includes every non-plank session.
function filterByLeaderboardMode(sessions) {
  const mode = state.leaderboardMode;
  if (sessionIndex && sessions === sessionIndex.sessions) return sessionIndex.byLeaderboardMode[mode];
  return filterByMode(sessions, mode);
}

function paintActiveBonanzaView() {
  const typed = filterByLeaderboardMode(state.lastSessions);
  if (state.bonanzaMode === "mine") paintMyBonanza(typed);
  else paintDashboard(typed);
}

$("bonanza-mode-select").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment");
  if (!btn) return;
  document.querySelectorAll("#bonanza-mode-select .segment").forEach((s) => s.classList.remove("active"));
  btn.classList.add("active");
  state.bonanzaMode = btn.dataset.mode;
  $("boys-bonanza-view").classList.toggle("hidden", state.bonanzaMode !== "boys");
  $("my-bonanza-view").classList.toggle("hidden", state.bonanzaMode !== "mine");
  paintActiveBonanzaView();
});

function syncLeaderboardModeControl() {
  const selected = LEADERBOARD_MODE_OPTIONS.find((option) => option.id === state.leaderboardMode) || LEADERBOARD_MODE_OPTIONS[0];
  $("leaderboard-mode-label").textContent = selected.label;
  document.querySelectorAll(".leaderboard-mode-option").forEach((option) => {
    const isSelected = option.dataset.leaderboardMode === selected.id;
    option.classList.toggle("selected", isSelected);
    option.setAttribute("aria-selected", String(isSelected));
  });
}

function setLeaderboardModeMenuOpen(open, focusSelected = false) {
  $("leaderboard-mode-trigger").setAttribute("aria-expanded", String(open));
  $("leaderboard-mode-menu").classList.toggle("hidden", !open);
  if (open && focusSelected) {
    $("leaderboard-mode-menu").querySelector(`[data-leaderboard-mode="${state.leaderboardMode}"]`)?.focus();
  }
}

function selectLeaderboardMode(mode) {
  if (!LEADERBOARD_MODE_IDS.has(mode)) return;
  state.leaderboardMode = mode;
  state.activityType = mode === "planks" ? "planks" : "pushups";
  localStorage.setItem(LS.leaderboardMode, mode);
  syncLeaderboardModeControl();
  setLeaderboardModeMenuOpen(false);
  paintActiveBonanzaView();
}

$("leaderboard-mode-trigger").addEventListener("click", () => {
  const open = $("leaderboard-mode-trigger").getAttribute("aria-expanded") !== "true";
  setLeaderboardModeMenuOpen(open, open);
});

$("new-user-cancel").addEventListener("click", () => {
  userCreationOpen = false;
  userSelectionExpanded = userCreationReturnExpanded;
  renderUserList();
});

$("leaderboard-mode-trigger").addEventListener("keydown", (event) => {
  if (["ArrowDown", "Enter", " "].includes(event.key)) {
    event.preventDefault();
    setLeaderboardModeMenuOpen(true, true);
  }
});

$("leaderboard-mode-menu").addEventListener("click", (event) => {
  const option = event.target.closest(".leaderboard-mode-option");
  if (option) selectLeaderboardMode(option.dataset.leaderboardMode);
});

$("leaderboard-mode-menu").addEventListener("keydown", (event) => {
  const options = Array.from(document.querySelectorAll(".leaderboard-mode-option"));
  const current = options.indexOf(document.activeElement);
  if (event.key === "Escape") {
    event.preventDefault();
    setLeaderboardModeMenuOpen(false);
    $("leaderboard-mode-trigger").focus();
  } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    let next = current;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else if (event.key === "ArrowDown") next = (current + 1 + options.length) % options.length;
    else next = (current - 1 + options.length) % options.length;
    options[next].focus();
  } else if (["Enter", " "].includes(event.key) && current >= 0) {
    event.preventDefault();
    selectLeaderboardMode(options[current].dataset.leaderboardMode);
    $("leaderboard-mode-trigger").focus();
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("#leaderboard-mode-picker")) setLeaderboardModeMenuOpen(false);
});

// Walks backward day by day, counting a streak that forgives one missed
// day per rolling 7-day window (a "rest day"). Rest days only kick in once
// a real streak is already underway, and must be ≥7 days apart from each
// other. Returns the streak count plus the list of forgiven rest-day Dates
// (most-recent first) so callers (e.g. the streak badge) can show an
// indicator when a rest day is currently propping up the streak.
function computeStreakCore(sessionsForUser) {
  return calculateStreak(sessionsForUser, new Date(), sessionTimestamp);
}

function computeStreak(sessionsForUser) {
  return computeStreakCore(sessionsForUser).streak;
}

// Radial progress ring for the streak tile — progress toward a 30-day
// streak, the "richer viz" called for on the metric that means the most.
const STREAK_RING_GOAL_DAYS = 30;
const STREAK_RING_RADIUS = 18;
function streakRingSvg(streak) {
  const circumference = 2 * Math.PI * STREAK_RING_RADIUS;
  const fraction = Math.max(0, Math.min(1, streak / STREAK_RING_GOAL_DAYS));
  const offset = circumference * (1 - fraction);
  return `
    <svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="${STREAK_RING_RADIUS}" fill="none" stroke="var(--bg-elevated-2)" stroke-width="5"/>
      <circle cx="22" cy="22" r="${STREAK_RING_RADIUS}" fill="none" stroke="var(--flame)" stroke-width="5"
        stroke-linecap="round" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
        transform="rotate(-90 22 22)"/>
    </svg>
  `;
}

// Shared by "My Bonanza" (one user's sessions) and "Boys Bonanza" (every
// user's sessions, cumulative) — same 7-day bar chart + trend-vs-prior-week
// line, just fed a different session set.
function renderWeekChart(sessions, chartElId, trendElId, isPlank) {
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
  }
  const dayTotals = days.map((date) => ({ date, total: 0 }));
  const windowStart = days[0].getTime();
  const windowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const priorWeekStart = new Date(days[0].getFullYear(), days[0].getMonth(), days[0].getDate() - 7);
  const priorWeekStartTime = priorWeekStart.getTime();
  const dayIndexByDate = new Map(days.map((date, index) => [date.toDateString(), index]));
  let priorWeekTotal = 0;
  for (const session of sessions) {
    const timestamp = sessionTimestamp(session);
    if (timestamp >= priorWeekStartTime && timestamp < windowStart) {
      priorWeekTotal += session.count;
    } else if (timestamp >= windowStart && timestamp < windowEnd) {
      const dayIndex = dayIndexByDate.get(new Date(timestamp).toDateString());
      if (dayIndex !== undefined) dayTotals[dayIndex].total += session.count;
    }
  }
  const maxTotal = Math.max(1, ...dayTotals.map((d) => d.total));

  $(chartElId).innerHTML = dayTotals.map(({ date, total }) => {
    const isToday = date.toDateString() === now.toDateString();
    const label = isToday ? "Today" : date.toLocaleDateString(undefined, { weekday: "short" });
    const heightPct = total > 0 ? Math.max(6, Math.round((total / maxTotal) * 100)) : 3;
    const valueDisplay = total > 0 ? (isPlank ? formatDuration(total * 1000) : formatNumber(total)) : "";
    return `
      <div class="week-bar-col${isToday ? " week-bar-col-today" : ""}">
        <div class="week-bar-value">${valueDisplay}</div>
        <div class="week-bar" style="height:${heightPct}%"></div>
        <div class="week-bar-label">${label}</div>
      </div>
    `;
  }).join("");

  // Trend vs the 7 days immediately before this window — "are we improving".
  const thisWeekTotal = dayTotals.reduce((sum, d) => sum + d.total, 0);
  const trendEl = $(trendElId);
  if (priorWeekTotal > 0) {
    const pct = Math.round(((thisWeekTotal - priorWeekTotal) / priorWeekTotal) * 100);
    trendEl.textContent = `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs prior week`;
    trendEl.classList.toggle("week-trend-up", pct >= 0);
    trendEl.classList.toggle("week-trend-down", pct < 0);
    trendEl.classList.remove("hidden");
  } else {
    trendEl.classList.add("hidden");
  }
}

// ------------------- head-to-head comparison -------------------

// Any displayed name (leaderboard, recent flexes, session history) becomes a
// tap-to-compare target against the current user — except the current
// user's own name, which has nothing to compare against.
function makeNameCompareClickable(nameEl, user, stopPropagation = false) {
  if (!nameEl || user === state.currentUser) return;
  nameEl.classList.add("compare-clickable");
  nameEl.addEventListener("click", (e) => {
    if (stopPropagation) e.stopPropagation();
    openUserCompare(user);
  });
}

function openUserCompare(otherUser) {
  state.compareUser = otherUser;
  state.compareMode = state.leaderboardMode;
  renderUserCompare();
  showScreen("screen-user-compare");
}

function getPersistedPokerDeck() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS.pokerDeck) || "[]");
    return Array.isArray(raw) ? raw.filter((c) => c && Number.isInteger(c.col) && Number.isInteger(c.row)) : [];
  } catch (e) {
    return [];
  }
  if (state.pokerHand.length) renderPokerHand();
}

function dealPokerHand() {
  let deck = getPersistedPokerDeck();
  if (deck.length < 5) deck = buildFreshDeck();
  const dealt = deck.slice(0, 5).map((card) => cardAt(card.col, card.row));
  localStorage.setItem(LS.pokerDeck, JSON.stringify(deck.slice(5)));
  return dealt;
}

function renderCompareModeControl() {
  const selected = LEADERBOARD_MODE_OPTIONS.find((option) => option.id === state.compareMode) || LEADERBOARD_MODE_OPTIONS[0];
  $("compare-mode-label").textContent = selected.label;
  $("compare-mode-menu").innerHTML = LEADERBOARD_MODE_OPTIONS.map((option) => `
    <button type="button" class="leaderboard-mode-option${option.id === state.compareMode ? " selected" : ""}" role="option" aria-selected="${option.id === state.compareMode}" data-compare-mode="${option.id}"><span>${option.label}</span><span class="leaderboard-mode-check" aria-hidden="true">✓</span></button>
  `).join("");
}

function setCompareModeMenuOpen(open) {
  $("compare-mode-trigger").setAttribute("aria-expanded", String(open));
  $("compare-mode-menu").classList.toggle("hidden", !open);
}

function renderUserCompare() {
  const otherUser = state.compareUser;
  if (!otherUser) return;
  renderCompareModeControl();
  const model = comparisonModel(state.lastSessions || [], {
    userA: state.currentUser,
    userB: otherUser,
    mode: state.compareMode,
    periodStartMs: periodStart(state.dashboardPeriod).getTime(),
    now: new Date(),
  });

  const avatarA = avatarForUser(state.currentUser);
  const avatarB = avatarForUser(otherUser);
  $("compare-avatar-a").textContent = avatarA.emoji;
  $("compare-avatar-a").style.background = avatarA.bg;
  $("compare-avatar-b").textContent = avatarB.emoji;
  $("compare-avatar-b").style.background = avatarB.bg;
  $("compare-name-a").textContent = state.currentUser;
  $("compare-name-b").textContent = otherUser;

  $("compare-table").classList.toggle("hidden", model.empty);
  $("compare-empty").classList.toggle("hidden", !model.empty);
  $("compare-tally").classList.toggle("hidden", model.empty);
  $("compare-table").innerHTML = model.rows.map((row) => {
    const metric = { format: row.format };
    return `
      <div class="compare-row${row.comparable ? "" : " compare-row-unavailable"}">
        <div class="compare-metric-line">
          <div class="compare-row-value${row.aWinner ? " compare-winner" : ""}">${formatModeMetric(metric, row.aValue)}</div>
          <div class="compare-bars">
            <div class="compare-bar-track compare-bar-track-a"><span class="compare-bar-fill${row.aWinner || row.tied ? " is-strong" : ""}" style="width:${row.aPercent}%"></span></div>
            <div class="compare-bar-center"></div>
            <div class="compare-bar-track compare-bar-track-b"><span class="compare-bar-fill${row.bWinner || row.tied ? " is-strong" : ""}" style="width:${row.bPercent}%"></span></div>
          </div>
          <div class="compare-row-value compare-value-b${row.bWinner ? " compare-winner" : ""}">${formatModeMetric(metric, row.bValue)}</div>
        </div>
        <div class="compare-row-label">${row.label}</div>
      </div>
    `;
  }).join("");

  const tallyEl = $("compare-tally");
  if (model.aWins === model.bWins) {
    tallyEl.textContent = `Tied with ${model.aWins} category win${model.aWins === 1 ? "" : "s"} each`;
  } else {
    const leader = model.aWins > model.bWins ? state.currentUser : otherUser;
    const leaderWins = Math.max(model.aWins, model.bWins);
    const available = model.denominator < model.rows.length ? " available" : "";
    tallyEl.textContent = `${leader} leads ${leaderWins} of ${model.denominator}${available} categories`;
  }
}

$("btn-compare-back").addEventListener("click", () => showScreen("screen-dashboard"));
$("compare-mode-trigger").addEventListener("click", () => {
  setCompareModeMenuOpen($("compare-mode-trigger").getAttribute("aria-expanded") !== "true");
});
$("compare-mode-menu").addEventListener("click", (event) => {
  const option = event.target.closest("[data-compare-mode]");
  if (!option) return;
  state.compareMode = option.dataset.compareMode;
  setCompareModeMenuOpen(false);
  renderUserCompare();
});
document.addEventListener("click", (event) => {
  if (!event.target.closest("#compare-mode-picker")) setCompareModeMenuOpen(false);
});

// ------------------- session detail -------------------

// Opened by tapping any session row (leaderboard, challenge recent flexes,
// My sessions) — remembers where it was opened from so the back button
// returns there instead of always landing on the dashboard.
function openSessionDetail(session, originScreenId) {
  state.sessionDetailSession = session;
  state.sessionDetailOrigin = originScreenId;
  showScreen("screen-session-detail");
}

function renderSessionDetail() {
  const session = state.sessionDetailSession;
  if (!session) return;
  const isPlank = session.type === "plank";
  const isSquat = session.type === "squat";

  $("session-detail-user").textContent = `${session.user}'s session`;
  $("session-detail-date").textContent = formatDateTime(session.timestamp);
  $("session-detail-count").textContent = isPlank ? formatDuration(session.count * 1000) : formatNumber(session.count);
  $("session-detail-count-label").textContent = isPlank ? "PLANK HOLD" : isSquat ? "TOTAL SQUATS" : "TOTAL PUSHUPS";

  $("session-detail-badges").innerHTML = sessionBadges(session).map((badge) => `
    <span class="session-badge${badge.tone === "modifier" ? " session-badge-modifier" : ""}${badge.tone === "weighted" ? " session-badge-weighted" : ""}">${badge.icon} ${escapeHtml(badge.label)}</span>
  `).join("");

  const rings = sessionRings(session, getAllSessionsForDisplay());
  $("session-detail-rings").innerHTML = rings.map((ring) => {
    if (!ring.hasData) {
      return `
        <div class="session-ring-item no-data">
          <div class="session-ring"><div class="session-ring-inner">Not enough data</div></div>
          <div class="session-ring-label">${escapeHtml(ring.label)}</div>
        </div>
      `;
    }
    const pct = ring.pct != null ? ring.pct : Math.round(ring.fill * 100);
    const displayText = ring.diffPct != null ? `${ring.diffPct >= 0 ? "+" : ""}${ring.diffPct}%` : `${pct}%`;
    const color = ring.diffPct != null ? (ring.diffPct >= 0 ? "var(--success)" : "var(--danger)") : "var(--gold)";
    return `
      <div class="session-ring-item">
        <div class="session-ring" style="--ring-pct:${Math.round(ring.fill * 100)}%;--ring-color:${color}">
          <div class="session-ring-inner">${displayText}</div>
        </div>
        <div class="session-ring-label">${escapeHtml(ring.label)}</div>
        <div class="session-ring-sub">${formatNumber(ring.value)} vs ${formatNumber(ring.compareValue)}</div>
      </div>
    `;
  }).join("");

  $("session-detail-metrics").innerHTML = sessionKeyMetrics(session).map((metric) => `
    <div class="stats-table-row"><span class="stats-table-label">${metric.label}</span><span class="stats-table-value">${formatSessionMetric(metric)}</span></div>
  `).join("");
}

function formatSessionMetric(metric) {
  if (metric.format === "boolean") return metric.value ? "Yes" : "No";
  if (metric.format === "text") return escapeHtml(String(metric.value));
  return formatModeMetric(metric);
}

async function shareSessionDetail() {
  const session = state.sessionDetailSession;
  if (!session) return;
  const isPlank = session.type === "plank";
  const isSquat = session.type === "squat";
  const countText = isPlank ? `${formatDuration(session.count * 1000)} plank` : isSquat ? `${formatNumber(session.count)} squats` : `${formatNumber(session.count)} pushups`;
  const message = `${session.user}: ${countText} — ${sessionModeLabel(session)} on ${formatDateTime(session.timestamp)}`;
  const url = location.href;
  if (navigator.share) {
    try { await navigator.share({ title: "Boys Pushup Bonanza", text: message, url }); } catch (e) { /* cancelled */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${message} ${url}`);
    toast("Copied to clipboard — paste it in the group chat!");
  } catch (e) {
    toast("Couldn't share automatically — copy your result manually.", 4000);
  }
}

$("btn-session-detail-back").addEventListener("click", () => showScreen(state.sessionDetailOrigin || "screen-dashboard"));
$("btn-session-detail-share").addEventListener("click", shareSessionDetail);

function paintMyBonanza(sessions) {
  const isPlank = state.activityType === "planks";
  const activityWord = isPlank ? "planks" : "pushups";
  const mine = sessionIndex && sessions === sessionIndex.byLeaderboardMode[state.leaderboardMode]
    ? indexedSessionsForUserMode(state.currentUser)
    : sessions.filter((s) => s.user === state.currentUser);

  renderWeekChart(mine, "week-chart", "week-trend", isPlank);

  const tilesEl = $("personal-stats-tiles");
  const statsEl = $("personal-stats");
  if (!mine.length) {
    tilesEl.innerHTML = "";
    statsEl.innerHTML = `<p class="leaderboard-empty">No sessions yet — go do some ${activityWord}! 💪</p>`;
    return;
  }
  const streak = computeStreak(mine);
  const { allTimeTotal, personalBest, avgPerSession } = personalStatsModel(mine, streak);
  const fmt = isPlank ? (n) => formatDuration(n * 1000) : formatNumber;

  // The 4 key metrics always form the 2x2 tile grid, streak first as a ring.
  tilesEl.innerHTML = `
    <div class="stat-tile stat-tile-ring">
      ${streakRingSvg(streak)}
      <div><div class="stat-tile-value">${streak}</div><div class="stat-tile-label">day streak</div></div>
    </div>
    <div class="stat-tile"><div class="stat-tile-value">${fmt(allTimeTotal)}</div><div class="stat-tile-label">all-time total</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${fmt(personalBest)}</div><div class="stat-tile-label">personal best</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${fmt(avgPerSession)}</div><div class="stat-tile-label">avg / session</div></div>
  `;

  const periodStartTime = periodStart(state.dashboardPeriod).getTime();
  const periodMine = mine.filter((s) => sessionTimestamp(s) >= periodStartTime);
  const secondary = modeStatsModel(periodMine, state.leaderboardMode);
  const pokerAchievements = state.leaderboardMode === "poker"
    ? pokerAchievementsFromSessions(mine)
    : [];
  const achievementMarkup = state.leaderboardMode === "poker" ? `
    <div class="poker-achievements">
      <div class="poker-achievements-title">Poker achievements</div>
      <div class="poker-achievement-grid">
        ${POKER_HANDS.slice(1).map((label, index) => {
          const rank = index + 1;
          const unlocked = pokerAchievements.includes(rank);
          return `<div class="poker-achievement ${unlocked ? "unlocked" : "locked"}" title="${unlocked ? "Unlocked" : "Not dealt yet"}"><span>${unlocked ? "♠" : "◇"}</span>${label}</div>`;
        }).join("")}
      </div>
    </div>` : "";
  statsEl.innerHTML = secondary.map((metric) => `
    <div class="stats-table-row"><span class="stats-table-label">${metric.label}</span><span class="stats-table-value">${formatModeMetric(metric)}</span></div>
  `).join("") + achievementMarkup;
}

function paintModeBreakdown() {
  const base = state.modeBreakdownScope === "me"
    ? sessionIndex.sessions.filter((s) => s.user === state.currentUser)
    : sessionIndex.sessions;
  const filtered = state.modeBreakdownPeriod === "all"
    ? base
    : base.filter((s) => sessionTimestamp(s) >= periodStart(state.modeBreakdownPeriod).getTime());

  const rows = modeBreakdownModel(filtered);
  const el = $("mode-breakdown-list");
  if (!rows.length) {
    el.innerHTML = `<p class="leaderboard-empty">No sessions yet for this period.</p>`;
    return;
  }
  const leaderReps = rows[0].reps;
  const showUsers = state.modeBreakdownScope === "group";
  el.innerHTML = rows.map((row, i) => {
    const pct = Math.max((row.reps / leaderReps) * 100, 8);
    const wide = pct > 38;
    const usersLabel = `${row.users} user${row.users === 1 ? "" : "s"}`;
    return `<div class="mode-breakdown-row">
      <div class="mode-breakdown-row-head">
        <span class="mode-breakdown-row-name"><span class="mode-breakdown-rank${i === 0 ? " gold" : ""}">${i + 1}</span>${escapeHtml(row.label)}</span>
        <span class="mode-breakdown-row-meta">${row.sessions} session${row.sessions === 1 ? "" : "s"}</span>
      </div>
      <div class="mode-breakdown-bar-track">
        <div class="mode-breakdown-bar-fill" style="width:${pct}%">
          <span class="mode-breakdown-bar-value">${formatNumber(row.reps)}</span>
          ${showUsers && wide ? `<span class="mode-breakdown-bar-users">${usersLabel}</span>` : ""}
        </div>
        ${showUsers && !wide ? `<span class="mode-breakdown-bar-users outside">${usersLabel}</span>` : ""}
      </div>
    </div>`;
  }).join("");
}

$("btn-open-mode-breakdown").addEventListener("click", () => {
  showScreen("screen-mode-breakdown");
  paintModeBreakdown();
});
$("btn-mode-breakdown-back").addEventListener("click", () => showScreen("screen-settings"));
$("mode-breakdown-scope").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment");
  if (!btn) return;
  document.querySelectorAll("#mode-breakdown-scope .segment").forEach((s) => s.classList.remove("active"));
  btn.classList.add("active");
  state.modeBreakdownScope = btn.dataset.scope;
  paintModeBreakdown();
});
$("mode-breakdown-period").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment");
  if (!btn) return;
  document.querySelectorAll("#mode-breakdown-period .segment").forEach((s) => s.classList.remove("active"));
  btn.classList.add("active");
  state.modeBreakdownPeriod = btn.dataset.period;
  paintModeBreakdown();
});

function formatModeMetric(metric, value = metric.value) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (metric.format === "duration") return formatDuration(value);
  if (metric.format === "seconds") return formatDuration(value * 1000);
  if (metric.format === "pace") return `${value.toFixed(1)}/min`;
  if (metric.format === "percent") return `${Math.round(value * 100)}%`;
  if (metric.format === "decimal") return value.toFixed(1);
  if (metric.format === "decimalPoints") return `${value.toFixed(1)} pts`;
  if (metric.format === "pokerHand") return POKER_HANDS[Math.max(0, Math.min(9, Math.round(value)))] || "—";
  return formatNumber(Math.round(value));
}

function renderBoysModeStats(sessions) {
  const el = $("boys-mode-stats");
  const metrics = modeStatsModel(sessions, state.leaderboardMode);
  el.innerHTML = metrics.map((metric) => {
    if (!metric.available) return `<div class="boys-mode-stat tier2-card"><div class="boys-mode-stat-label">${metric.label}</div><div class="boys-mode-stat-value">—</div><div class="boys-mode-stat-leader">Not enough data yet</div></div>`;
    const leaderNames = metric.leaders.map((entry) => entry.user);
    const avatars = metric.leaders.slice(0, 3).map((entry) => avatarCircleHTML(avatarForUser(entry.user), "1.35rem")).join("");
    const names = leaderNames.length <= 2 ? leaderNames.join(" + ") : `${leaderNames.slice(0, 2).join(" + ")} +${leaderNames.length - 2}`;
    const leaderValue = metric.leaders.length ? formatModeMetric(metric, metric.leaders[0].value) : "—";
    return `<div class="boys-mode-stat tier2-card"><div class="boys-mode-stat-label">${metric.label}</div><div class="boys-mode-stat-value">${formatModeMetric(metric)} <span>${metric.qualifier}</span></div><div class="boys-mode-stat-leader">${avatars}<span>${escapeHtml(names)} leads · ${leaderValue}</span></div></div>`;
  }).join("");
}

function paintDashboard(sessions) {
  const isPlank = state.activityType === "planks";
  const activityWord = isPlank ? "planks" : "pushups";
  const fmtCount = (n) => (isPlank ? formatDuration(n * 1000) : formatNumber(n));

  renderWeekChart(sessions, "boys-week-chart", "boys-week-trend", isPlank);

  const start = periodStart(state.dashboardPeriod);
  const startTime = start.getTime();
  const filtered = sessions.filter((s) => sessionTimestamp(s) >= startTime);

  const totals = new Map();
  for (const s of filtered) {
    totals.set(s.user, (totals.get(s.user) || 0) + s.count);
  }
  const ranked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);

  const lbList = $("leaderboard-list");
  lbList.innerHTML = "";
  if (!ranked.length) {
    lbList.innerHTML = `<p class="leaderboard-empty">No ${activityWord} logged for this period yet. Get moving! 💪</p>`;
  } else {
    ranked.forEach(([user, total], i) => {
      const row = document.createElement("div");
      row.className = "leaderboard-row" + (i < 3 ? ` rank-${i + 1}` : "");
      row.innerHTML = `
        <div class="leaderboard-rank">${i + 1}</div>
        ${avatarCircleHTML(avatarForUser(user), "1.8rem")}
        <div class="leaderboard-name">${escapeHtml(user)}</div>
        <div class="leaderboard-total">${fmtCount(total)}</div>
      `;
      makeNameCompareClickable(row.querySelector(".leaderboard-name"), user);
      lbList.appendChild(row);
    });
  }

  renderBoysModeStats(filtered);

  const historyList = $("history-list");
  historyList.innerHTML = "";
  if (!filtered.length) {
    historyList.innerHTML = '<p class="history-empty">No sessions in this period.</p>';
  } else {
    const byUser = new Map();
    for (const s of filtered) {
      if (!byUser.has(s.user)) byUser.set(s.user, []);
      byUser.get(s.user).push(s);
    }
    const usersSorted = Array.from(byUser.keys()).sort((a, b) => (totals.get(b) || 0) - (totals.get(a) || 0));
    for (const user of usersSorted) {
      const userSessions = byUser.get(user).sort((a, b) => sessionTimestamp(b) - sessionTimestamp(a));
      const group = document.createElement("div");
      group.className = "history-user-group";
      const header = document.createElement("div");
      header.className = "history-user-header";
      header.innerHTML = `<span class="history-user-label">${avatarCircleHTML(avatarForUser(user), "1.7rem")}<span class="history-user-name">${escapeHtml(user)} — ${fmtCount(totals.get(user))} total</span></span><span class="chev">▸</span>`;
      header.addEventListener("click", () => group.classList.toggle("open"));
      makeNameCompareClickable(header.querySelector(".history-user-name"), user, true);
      const sessionsWrap = document.createElement("div");
      sessionsWrap.className = "history-sessions";
      for (const s of userSessions) {
        const sessionRow = document.createElement("div");
        sessionRow.className = "history-session-row compare-clickable";
        sessionRow.innerHTML = `<span>${formatDateTime(s.timestamp)}</span><span class="history-session-count">${fmtCount(s.count)}</span>`;
        sessionRow.addEventListener("click", (e) => {
          e.stopPropagation();
          openSessionDetail(s, "screen-dashboard");
        });
        sessionsWrap.appendChild(sessionRow);
      }
      group.appendChild(header);
      group.appendChild(sessionsWrap);
      historyList.appendChild(group);
    }
  }

  renderRecentList(sessions);
  updateHistoryViewVisibility();
}

function renderRecentList(sessions) {
  const isPlank = state.activityType === "planks";
  const recentList = $("recent-list");
  const recent = [...sessions].sort((a, b) => sessionTimestamp(b) - sessionTimestamp(a)).slice(0, 10);
  recentList.innerHTML = "";
  if (!recent.length) {
    recentList.innerHTML = `<p class="history-empty">No ${isPlank ? "planks" : "pushups"} logged yet. Get moving! 💪</p>`;
    return;
  }
  for (const s of recent) {
    const row = document.createElement("div");
    row.className = "recent-row compare-clickable";
    row.innerHTML = `
      ${avatarCircleHTML(avatarForUser(s.user), "1.8rem")}
      <div class="recent-name">${escapeHtml(s.user)}</div>
      <div class="recent-count">${isPlank ? formatDuration(s.count * 1000) : formatNumber(s.count)}</div>
      <div class="recent-time">${formatDateTime(s.timestamp)}</div>
    `;
    makeNameCompareClickable(row.querySelector(".recent-name"), s.user, true);
    row.addEventListener("click", () => openSessionDetail(s, "screen-dashboard"));
    recentList.appendChild(row);
  }
}

function updateHistoryViewVisibility() {
  $("recent-list").classList.toggle("hidden", state.historyView !== "recent");
  $("history-list").classList.toggle("hidden", state.historyView !== "history");
}

$("history-view-select").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment");
  if (!btn) return;
  document.querySelectorAll("#history-view-select .segment").forEach((s) => s.classList.remove("active"));
  btn.classList.add("active");
  state.historyView = btn.dataset.view;
  updateHistoryViewVisibility();
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

$("period-select").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment");
  if (!btn) return;
  document.querySelectorAll("#period-select .segment").forEach((s) => s.classList.remove("active"));
  btn.classList.add("active");
  state.dashboardPeriod = btn.dataset.period;
  paintActiveBonanzaView();
});

// ------------------- challenges -------------------

// Dates are YYYY-MM-DD, inclusive, in the device's local timezone.

function challengeParticipantsOf(c) {
  return getCachedData().challengeParticipants[c.id] || [];
}

function challengeSessions(c) {
  const cached = challengeSessionCache.get(c.id);
  if (cached) return cached;
  const participants = new Set(challengeParticipantsOf(c));
  if (!participants.size) return [];
  const { startDate, endDate } = challengeWindow(c);
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const activity = c.goalType === "plankGauntlet" ? "planks" : "pushups";
  const sessions = [];
  for (const participant of participants) {
    for (const session of indexedSessionsForUser(participant, activity)) {
      const timestamp = sessionTimestamp(session);
      if (timestamp >= startTime && timestamp <= endTime) sessions.push(session);
    }
  }
  challengeSessionCache.set(c.id, sessions);
  return sessions;
}

function challengeTotal(c) {
  return challengeSessions(c).reduce((sum, s) => sum + s.count, 0);
}

function userChallengeTotal(c, name) {
  return challengeSessions(c)
    .filter((s) => s.user === name)
    .reduce((sum, s) => sum + s.count, 0);
}

// The single "current" number each goal type progresses toward — used for
// the list card's mini progress bar, matching the detail screen's own math.
function challengeListProgress(c) {
  if (c.goalType === "individual") return userChallengeTotal(c, state.currentUser);
  if (c.goalType === "collective") return challengeTotal(c);
  if (c.goalType === "plankGauntlet") return challengeLeaderboard(c).find((row) => row.name === state.currentUser)?.score || 0;
  const { startDate, endDate } = challengeWindow(c);
  return windowStreak(challengeSessions(c), state.currentUser, startDate, endDate).best;
}

// best = longest run of consecutive local days with >=1 session, anywhere in
// the window. current = run ending today (or yesterday if today has none),
// clamped to the window.
function windowStreak(sessions, name, startDate, endDate) {
  const daySet = new Set(sessions.filter((s) => s.user === name).map((s) => new Date(s.timestamp).toDateString()));

  let current = 0;
  let cursor = new Date();
  if (cursor > endDate) cursor = new Date(endDate);
  if (!daySet.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (cursor >= startDate && daySet.has(cursor.toDateString())) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  let best = 0;
  let run = 0;
  const dayCursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const lastDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  while (dayCursor <= lastDay) {
    if (daySet.has(dayCursor.toDateString())) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
    dayCursor.setDate(dayCursor.getDate() + 1);
  }
  return { best, current };
}

// PR baseline: the max single-session pushup count logged before `beforeDate`
// (plank sessions never count toward a pushup PR). This is intentionally NOT
// scoped to the challenge window — it's the user's all-time best set going
// into the challenge, so reps logged during the window can only beat it,
// never quietly raise it out from under them.
function userPriorBestSet(name, beforeDate) {
  const beforeTime = beforeDate.getTime();
  return indexedSessionsForUser(name, "pushups")
    .filter((s) => sessionTimestamp(s) < beforeTime)
    .reduce((max, s) => Math.max(max, s.count), 0);
}

// Per-participant standing for a "pr" challenge: baseline is their best set
// before the window started; achieved flips true at the first in-window
// session that beats it (walked chronologically); bestThisWeek tracks their
// best single-session set anywhere in the window regardless of achievement.
function userPrStanding(c, name) {
  const { startDate } = challengeWindow(c);
  const baseline = userPriorBestSet(name, startDate);
  const sessions = challengeSessions(c)
    .filter((s) => s.user === name)
    .sort((a, b) => sessionTimestamp(a) - sessionTimestamp(b));
  let achieved = false;
  let achievedAt = null;
  let bestThisWeek = 0;
  for (const s of sessions) {
    bestThisWeek = Math.max(bestThisWeek, s.count);
    if (!achieved && s.count > baseline) {
      achieved = true;
      achievedAt = s.timestamp;
    }
  }
  return { name, achieved, achievedAt, bestThisWeek, baseline };
}

function challengeLeaderboard(c) {
  const participants = challengeParticipantsOf(c);
  if (c.goalType === "pr") {
    return participants
      .map((name) => userPrStanding(c, name))
      .sort((a, b) => {
        if (a.achieved !== b.achieved) return a.achieved ? -1 : 1;
        if (a.achieved) return new Date(a.achievedAt) - new Date(b.achievedAt);
        return b.bestThisWeek - a.bestThisWeek;
      })
      .map((row) => ({ ...row, score: row.bestThisWeek }));
  }
  if (c.goalType === "plankGauntlet") {
    const sessions = challengeSessions(c);
    return participants
      .map((name) => {
        const mine = sessions.filter((s) => s.user === name);
        const cumulative = mine.reduce((sum, s) => sum + (Number(s.count) || 0), 0);
        const longest = mine.reduce((max, s) => Math.max(max, Number(s.count) || 0), 0);
        return { name, cumulative, longest, score: cumulative + longest };
      })
      .sort((a, b) => b.score - a.score);
  }
  const sessions = challengeSessions(c);
  const { startDate, endDate } = challengeWindow(c);
  return participants
    .map((name) => ({
      name,
      score: c.goalType === "streak"
        ? windowStreak(sessions, name, startDate, endDate).best
        : sessions.filter((s) => s.user === name).reduce((sum, s) => sum + s.count, 0),
    }))
    .sort((a, b) => b.score - a.score);
}

function challengeWinners(c) {
  const board = challengeLeaderboard(c);
  if (c.goalType === "pr") {
    const achievers = board.filter((row) => row.achieved);
    if (!achievers.length) return [];
    const earliest = achievers[0].achievedAt;
    return achievers.filter((row) => row.achievedAt === earliest).map((row) => row.name);
  }
  if (!board.length || board[0].score <= 0) return [];
  const top = board[0].score;
  return board.filter((row) => row.score === top).map((row) => row.name);
}

async function renderChallengesScreen() {
  await flushQueue().catch(() => {});
  await refreshFromRemote();
  await loadChallenges();
  paintChallengeList();
}

function paintChallengeList() {
  const now = new Date();
  const tab = state.challengeTab;
  const list = challengeDefs.filter((c) => challengeStatus(c, now) === tab);
  if (tab === "active") list.sort((a, b) => daysLeft(a, now) - daysLeft(b, now));
  else if (tab === "upcoming") list.sort((a, b) => daysUntilStart(a, now) - daysUntilStart(b, now));
  else list.sort((a, b) => challengeWindow(b).endDate - challengeWindow(a).endDate);

  const el = $("challenge-list");
  el.innerHTML = "";
  if (!list.length) {
    const msg = tab === "active"
      ? "No challenge running right now — check Upcoming."
      : tab === "upcoming"
        ? "Nothing on the calendar yet. Tell Henning."
        : "No completed challenges yet.";
    el.innerHTML = `<p class="leaderboard-empty">${msg}</p>`;
    return;
  }
  for (const c of list) {
    if (c.id === state.justJoinedChallengeId) el.appendChild(buildJoinedBanner(c, now));
    el.appendChild(buildChallengeCard(c, now));
  }
}

// Success banner directly above the card it confirms, instead of a floating
// toast disconnected from the list. Checkmark glyph built from CSS borders.
function buildJoinedBanner(c, now) {
  const banner = document.createElement("div");
  banner.className = "join-success-banner";
  const text = challengeStatus(c, now) === "upcoming"
    ? `You're in — first flex logs when it starts in ${daysUntilStart(c, now)} day${daysUntilStart(c, now) === 1 ? "" : "s"}`
    : "You're in — first flex logs today";
  banner.innerHTML = `
    <span class="join-success-check" aria-hidden="true"></span>
    <span>${text}</span>
  `;
  return banner;
}

function buildChallengeCard(c, now) {
  const status = challengeStatus(c, now);
  const participants = challengeParticipantsOf(c);
  const joined = participants.includes(state.currentUser);
  const total = challengeTotal(c);

  const card = document.createElement("div");
  card.className = "challenge-card";
  card.style.background = `linear-gradient(135deg, ${c.gradient[0]}, ${c.gradient[1]})`;
  card.addEventListener("click", () => openChallengeDetail(c.id));

  let dateLabel;
  if (status === "active") {
    const d = daysLeft(c, now);
    dateLabel = `${d} day${d === 1 ? "" : "s"} left`;
  } else if (status === "upcoming") {
    const d = daysUntilStart(c, now);
    dateLabel = `Starts in ${d} day${d === 1 ? "" : "s"}`;
  } else {
    dateLabel = `Ended ${challengeWindow(c).endDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }

  let metaLine;
  if (c.goalType === "pr") {
    const achievedCount = challengeLeaderboard(c).filter((row) => row.achieved).length;
    metaLine = `👥 ${participants.length} joined · ${achievedCount} new PR${achievedCount === 1 ? "" : "s"} this week`;
  } else if (c.goalType === "plankGauntlet") {
    metaLine = `👥 ${participants.length} joined · ${formatDuration(total * 1000)} total plank time logged`;
  } else {
    metaLine = `👥 ${participants.length} joined · ${formatNumber(total)} total pushups so far`;
  }

  let html = `
    <div class="challenge-card-emoji">${c.emoji}</div>
    <div class="challenge-card-title">${escapeHtml(c.title)}</div>
    <div class="challenge-card-dates">${formatChallengeDates(c)} <span class="challenge-status-chip">${dateLabel}</span></div>
    <div class="challenge-card-meta">${metaLine}</div>
  `;

  // Mini progress bar so status is scannable from the list without opening.
  // Skipped for "pr" and "plankGauntlet" — the goal is per-person/ranked, so a shared bar doesn't apply.
  if (status !== "past" && c.goalType !== "pr" && c.goalType !== "plankGauntlet") {
    html += buildProgressThermometer(challengeListProgress(c), c.goal);
  }

  if (status !== "past" && joined) {
    html += `<span class="challenge-joined-chip">✓ In</span>`;
  } else if (status === "past") {
    const winners = challengeWinners(c);
    if (winners.length) {
      const board = challengeLeaderboard(c);
      const scoreText = c.goalType === "streak" ? `${formatNumber(board[0].score)} days` : c.goalType === "plankGauntlet" ? formatDuration(board[0].score * 1000) : formatNumber(board[0].score);
      html += `<div class="challenge-winner-line">🥇 ${winners.map(escapeHtml).join(" & ")} — ${scoreText}</div>`;
    }
  }

  card.innerHTML = html;

  if (status !== "past" && !joined) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-primary challenge-join-btn";
    btn.textContent = "JOIN";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      joinChallenge(c.id);
    });
    card.appendChild(btn);
  }

  return card;
}

function openChallengeDetail(id) {
  state.openChallengeId = id;
  history.replaceState(null, "", `#challenge=${id}`);
  renderChallengeDetail();
  showScreen("screen-challenge-detail");
}

// Bundles everything a share message might reference so the variations
// below can freely mix and match without recomputing anything.
function buildChallengeShareContext(c) {
  return challengeShareContext(c, challengeLeaderboard(c), { formatNumber, formatDuration: (seconds) => formatDuration(seconds * 1000) });
}

const CHALLENGE_INVITE_MESSAGES = [
  (ctx) => `Yo, come join ${ctx.titleWithEmoji} 🎯 ${ctx.goalAmountText} by ${ctx.deadlineText}${ctx.hasLeader ? ` — ${ctx.leaderName}'s leading with ${ctx.leaderScoreText} (${ctx.leaderPct}%)` : ""}. Let's go!`,
  (ctx) => `Just jumped into ${ctx.titleWithEmoji} — you in? 💪 ${ctx.goalAmountText} by ${ctx.deadlineText}.`,
  (ctx) => ctx.exceeded
    ? `${ctx.titleWithEmoji} is live and ${ctx.leaderName} already smashed the ${ctx.goalAmountText} goal with ${ctx.leaderScoreText} (${ctx.leaderPct}%) 🔥 Go beat them before it's over!`
    : `${ctx.titleWithEmoji} is live. Get in before it's over 🔥 ${ctx.goalAmountText} by ${ctx.deadlineText}.`,
  (ctx) => `Boys, ${ctx.titleWithEmoji} needs you 🚀 ${ctx.hasLeader ? `${ctx.leaderName}'s out front with ${ctx.leaderScoreText} (${ctx.leaderPct}%) — ` : ""}tap in before ${ctx.deadlineText}.`,
  (ctx) => `Don't sleep on ${ctx.titleWithEmoji} 🏆 ${ctx.goalAmountText} by ${ctx.deadlineText}${ctx.hasLeader ? `, ${ctx.leaderName} leading at ${ctx.leaderPct}%` : ""}.`,
  (ctx) => ctx.exceeded
    ? `${ctx.leaderName} already crushed ${ctx.titleWithEmoji}'s goal (${ctx.leaderScoreText}, ${ctx.leaderPct}%) 😤 Go beat them before it's over!`
    : `${ctx.titleWithEmoji}: ${ctx.goalAmountText} by ${ctx.deadlineText}. Join the bonanza before it's too late 👀`,
];

async function shareChallengeInvite() {
  const c = challengeDefs.find((x) => x.id === state.openChallengeId);
  if (!c) return;
  const ctx = buildChallengeShareContext(c);
  const message = pickFrom(CHALLENGE_INVITE_MESSAGES)(ctx);
  const url = `${location.origin}${location.pathname}#challenge=${c.id}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Boys Pushup Bonanza", text: message, url });
    } catch (e) {
      // user cancelled the share sheet — not an error
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${message} ${url}`);
    toast("Copied to clipboard — paste it in the group chat!");
  } catch (e) {
    toast("Couldn't share automatically — copy the link manually.", 4000);
  }
}

$("btn-challenge-share").addEventListener("click", shareChallengeInvite);

// ------------------- leaderboard share -------------------

function ordinal(n) {
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

const PERIOD_LABELS = { day: "today", week: "this week", month: "this month", quarter: "this quarter", year: "this year" };

function computeMyDayWeekTotals() {
  const mine = indexedSessionsForUserMode(state.currentUser);
  const dayStart = periodStart("day");
  const weekStart = periodStart("week");
  const dayStartTime = dayStart.getTime();
  const weekStartTime = weekStart.getTime();
  const dayTotal = mine.filter((s) => sessionTimestamp(s) >= dayStartTime).reduce((sum, s) => sum + s.count, 0);
  const weekTotal = mine.filter((s) => sessionTimestamp(s) >= weekStartTime).reduce((sum, s) => sum + s.count, 0);
  return { dayTotal, weekTotal };
}

function computeUserPeriodStanding(period) {
  const typed = filterByLeaderboardMode(state.lastSessions);
  const start = periodStart(period);
  const startTime = start.getTime();
  const filtered = typed.filter((s) => sessionTimestamp(s) >= startTime);
  const totals = new Map();
  for (const s of filtered) totals.set(s.user, (totals.get(s.user) || 0) + s.count);
  const ranked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const myIdx = ranked.findIndex(([u]) => u === state.currentUser);
  return {
    total: totals.get(state.currentUser) || 0,
    rank: myIdx === -1 ? null : myIdx + 1,
    participants: ranked.length,
  };
}

const SHARE_MESSAGES_MY_BONANZA = [
  (ctx) => `${ctx.dayText} ${ctx.activityWord} today, ${ctx.weekText} this week 💪 Keeping the bonanza alive.`,
  (ctx) => `Today: ${ctx.dayText}. This week: ${ctx.weekText}. 🔥 Who's catching up?`,
  (ctx) => `${ctx.weekText} ${ctx.activityWord} this week and counting, ${ctx.dayText} of them today 📈`,
  (ctx) => `Put up ${ctx.dayText} ${ctx.activityWord} today 😤 ${ctx.weekText} on the week.`,
  (ctx) => `Weekly grind: ${ctx.weekText} ${ctx.activityWord} 🚀 (${ctx.dayText} today alone)`,
  (ctx) => `Day total ${ctx.dayText}, week total ${ctx.weekText} 🏆 The bonanza never sleeps.`,
  (ctx) => `My floor has a permanent dent shaped like me 🕳️ ${ctx.dayText} today, ${ctx.weekText} this week.`,
  (ctx) => `Gravity filed a restraining order 📄 ${ctx.dayText} today, ${ctx.weekText} on the week.`,
  (ctx) => `${ctx.dayText} today. ${ctx.weekText} this week. My chest has its own gravitational field 🪐`,
  (ctx) => `Doctor said "any more ${ctx.activityWord}?" I said ${ctx.weekText} this week. He left the room 🚪`,
  (ctx) => `${ctx.dayText} ${ctx.activityWord} today 🫡 ${ctx.weekText} this week. I am legally a load-bearing wall now.`,
  (ctx) => `Woke up. Assaulted the floor ${ctx.dayText} times 🥊 ${ctx.weekText} on the week. Floor pressing charges.`,
  (ctx) => `${ctx.weekText} this week 📊 My shadow has visible triceps.`,
  (ctx) => `Today's damage: ${ctx.dayText}. Weekly damage: ${ctx.weekText} 💥 Somebody check on the floorboards.`,
  (ctx) => `${ctx.dayText} today, ${ctx.weekText} this week 🧱 I have transcended the concept of "rest day."`,
  (ctx) => `Pushed the earth down ${ctx.dayText} times today 🌍 ${ctx.weekText} this week. Orbit slightly off now. My bad.`,
  (ctx) => `${ctx.weekText} ${ctx.activityWord} this week 😇 My guardian angel has started lifting too, just to keep up.`,
  (ctx) => `${ctx.dayText} today ⚡ ${ctx.weekText} this week. Mirrors are starting to feel intimidated.`,
];

const SHARE_MESSAGES_BOYS_GENERIC = [
  (ctx) => `${ctx.scoreText} ${ctx.activityWord} ${ctx.periodLabel} — sitting ${ctx.rankOrdinal} place 🏆`,
  (ctx) => `Currently ${ctx.rankOrdinal} on the board ${ctx.periodLabel} with ${ctx.scoreText} ${ctx.activityWord} 😤`,
  (ctx) => `${ctx.scoreText} ${ctx.activityWord} ${ctx.periodLabel}, good for ${ctx.rankOrdinal} of ${ctx.participants} 📊`,
  (ctx) => `Holding ${ctx.rankOrdinal} place ${ctx.periodLabel} 🔥 ${ctx.scoreText} and climbing.`,
  (ctx) => `${ctx.rankOrdinal} place, ${ctx.scoreText} ${ctx.activityWord} ${ctx.periodLabel} 🚀 Come take it from me.`,
  (ctx) => `${ctx.scoreText} ${ctx.activityWord} banked ${ctx.periodLabel} — ${ctx.rankOrdinal} and pushing 💪`,
  (ctx) => `${ctx.rankOrdinal} place ${ctx.periodLabel} 🪜 I can see the guy above me. He should be nervous.`,
  (ctx) => `${ctx.scoreText} ${ctx.activityWord} and only ${ctx.rankOrdinal}?? 😳 This leaderboard is a war crime.`,
  (ctx) => `Sitting ${ctx.rankOrdinal} of ${ctx.participants} ${ctx.periodLabel} 🥲 I'm not mad, I'm just plotting.`,
  (ctx) => `${ctx.rankOrdinal} place with ${ctx.scoreText} 🧗 Climbing this board like a raccoon up a drainpipe.`,
  (ctx) => `${ctx.scoreText} ${ctx.activityWord} ${ctx.periodLabel}, ${ctx.rankOrdinal} overall 🐍 Slowly slithering up the rankings.`,
  (ctx) => `${ctx.rankOrdinal} ${ctx.periodLabel} 📈 ${ctx.scoreText} logged. The comeback arc has officially begun.`,
  (ctx) => `${ctx.scoreText} ${ctx.activityWord} → ${ctx.rankOrdinal} place 🫠 Someone above me is about to have a bad week.`,
  (ctx) => `${ctx.rankOrdinal} of ${ctx.participants} 🎯 ${ctx.scoreText} ${ctx.activityWord}. I've started doing reps out of spite.`,
  (ctx) => `${ctx.scoreText} ${ctx.periodLabel}, ${ctx.rankOrdinal} on the board 👀 Taking names. Mostly the ones above mine.`,
  (ctx) => `${ctx.rankOrdinal} place 🦖 ${ctx.scoreText} ${ctx.activityWord} and an unreasonable amount of rage.`,
];

const SHARE_MESSAGES_BOYS_LEADING = [
  (ctx) => `Leading the pack ${ctx.periodLabel} with ${ctx.scoreText} ${ctx.activityWord} 👑 Catch me if you can.`,
  (ctx) => `#1 ${ctx.periodLabel} 🥇 ${ctx.scoreText} ${ctx.activityWord} and holding the top spot.`,
  (ctx) => `Top of the board ${ctx.periodLabel} — ${ctx.scoreText} ${ctx.activityWord} 🔥 Who's coming for it?`,
  (ctx) => `👑 ${ctx.scoreText} ${ctx.activityWord} ${ctx.periodLabel}. I don't want to talk about it. I want to be worshipped about it.`,
  (ctx) => `#1 with ${ctx.scoreText} ${ctx.activityWord} 🗿 The rest of you are playing for second and it shows.`,
  (ctx) => `${ctx.scoreText} ${ctx.periodLabel}. First place. 🍾 I'd like to thank the floor for its continued cooperation.`,
  (ctx) => `Undisputed 🥇 ${ctx.scoreText} ${ctx.activityWord} ${ctx.periodLabel}. Bow. Genuinely, bow.`,
  (ctx) => `${ctx.scoreText} ${ctx.activityWord} and the throne ${ctx.periodLabel} 👑 Beating ${ctx.participants - 1} other guys who tried their little best.`,
  (ctx) => `Number one ${ctx.periodLabel} 🦅 ${ctx.scoreText} ${ctx.activityWord}. Freedom. Power. Slightly sore wrists.`,
  (ctx) => `${ctx.scoreText} ${ctx.activityWord}, first place, zero humility 😌 ${ctx.periodLabel} belongs to me.`,
  (ctx) => `Top of the leaderboard ${ctx.periodLabel} 🏔️ ${ctx.scoreText} ${ctx.activityWord}. The air is thin up here and smells like victory.`,
];

const SHARE_MESSAGES_BOYS_NO_RANK = [
  (ctx) => `${ctx.scoreText} ${ctx.activityWord} ${ctx.periodLabel} 💪 Get after it, boys.`,
  (ctx) => `${ctx.scoreText} ${ctx.activityWord} logged ${ctx.periodLabel} 🚀 The bonanza continues.`,
  (ctx) => `${ctx.scoreText} ${ctx.activityWord} ${ctx.periodLabel} 🫥 Not on the board yet. Sleeping giant behavior.`,
  (ctx) => `${ctx.scoreText} ${ctx.periodLabel} 🌱 Every empire starts somewhere. This is the somewhere.`,
  (ctx) => `${ctx.scoreText} ${ctx.activityWord} ${ctx.periodLabel} 🐌 Slow start, terrifying finish. You'll see.`,
];

// Leaderboard shares previously used a bare pickFrom(), so the same line could
// come up twice in a row. Mirrors the lastShareTemplate guard used by the
// session-complete share messages.
let lastLeaderboardTemplate = null;
function pickLeaderboardTemplate(pool) {
  let template, guard = 0;
  do {
    template = pickFrom(pool);
  } while (template === lastLeaderboardTemplate && pool.length > 1 && ++guard < 10);
  lastLeaderboardTemplate = template;
  return template;
}

async function shareLeaderboardStats() {
  const isPlank = state.activityType === "planks";
  const activityWord = isPlank ? "planks" : "pushups";
  const fmt = (n) => (isPlank ? formatDuration(n * 1000) : formatNumber(n));

  let message;
  if (state.bonanzaMode === "mine") {
    const { dayTotal, weekTotal } = computeMyDayWeekTotals();
    const ctx = { activityWord, dayText: fmt(dayTotal), weekText: fmt(weekTotal) };
    message = pickLeaderboardTemplate(SHARE_MESSAGES_MY_BONANZA)(ctx);
  } else {
    const { total, rank, participants } = computeUserPeriodStanding(state.dashboardPeriod);
    const periodLabel = PERIOD_LABELS[state.dashboardPeriod] || "recently";
    if (rank) {
      const ctx = { activityWord, periodLabel, scoreText: fmt(total), rankOrdinal: ordinal(rank), participants };
      const pool = rank === 1 ? [...SHARE_MESSAGES_BOYS_LEADING, ...SHARE_MESSAGES_BOYS_GENERIC] : SHARE_MESSAGES_BOYS_GENERIC;
      message = pickLeaderboardTemplate(pool)(ctx);
    } else {
      message = pickLeaderboardTemplate(SHARE_MESSAGES_BOYS_NO_RANK)({ activityWord, periodLabel, scoreText: fmt(total) });
    }
  }

  const url = location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Boys Pushup Bonanza", text: message, url });
    } catch (e) {
      // user cancelled the share sheet — not an error
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${message} ${url}`);
    toast("Copied to clipboard — paste it in the group chat!");
  } catch (e) {
    toast("Couldn't share automatically — copy your result manually.", 4000);
  }
}
$("btn-leaderboard-share").addEventListener("click", shareLeaderboardStats);

// Normally a single-color fill toward the goal. Once `current` exceeds
// `goal`, the bar's 100% becomes `current` itself, split into a green
// "goal" segment and a red "excess" segment, with a flame next to it.
function buildProgressThermometer(current, goal) {
  const model = progressThermometerModel(current, goal);
  if (!model.segmented) return `
    <div class="thermometer-wrap"><div class="thermometer-track">
      <div class="thermometer-fill${model.won ? " thermometer-win" : ""}" style="width:${model.percent}%"></div>
    </div></div>`;
  return `
    <div class="thermometer-wrap thermometer-wrap-flame">
      <div class="thermometer-track thermometer-track-segmented">
        <div class="thermometer-segment thermometer-segment-goal" style="width:${model.goalPercent}%"></div>
        <div class="thermometer-segment thermometer-segment-excess" style="width:${model.excessPercent}%"></div>
      </div><span class="thermometer-flame" aria-hidden="true">🔥</span>
    </div>`;
}

function renderChallengeDetail() {
  const c = challengeDefs.find((x) => x.id === state.openChallengeId);
  const body = $("challenge-detail-body");
  if (!c) {
    body.innerHTML = '<p class="leaderboard-empty">Challenge not found.</p>';
    return;
  }

  const now = new Date();
  const status = challengeStatus(c, now);
  const participants = challengeParticipantsOf(c);
  const joined = participants.includes(state.currentUser);
  const total = challengeTotal(c);
  const sessions = challengeSessions(c);
  const { startDate, endDate } = challengeWindow(c);

  const statusLabel = challengeStatusLabel(c, now);

  let html = `
    <div class="challenge-hero" style="background: linear-gradient(135deg, ${c.gradient[0]}, ${c.gradient[1]})">
      <div class="challenge-hero-emoji">${c.emoji}</div>
      <div class="challenge-hero-title">${escapeHtml(c.title)}</div>
      <div class="challenge-hero-tagline">${escapeHtml(c.tagline)}</div>
      <div class="challenge-hero-dates">${formatChallengeDates(c)} <span class="challenge-status-chip">${statusLabel}</span></div>
    </div>
  `;

  if (status !== "past" && !joined) {
    html += `<button type="button" id="btn-challenge-join" class="btn btn-primary btn-large">JOIN this challenge</button>`;
  }

  if (joined) {
    const daysLeftText = status === "active"
      ? `${daysLeft(c, now)} days left`
      : status === "upcoming"
        ? `starts in ${daysUntilStart(c, now)} days`
        : "ended";
    const daysLeftLabel = `<span class="challenge-days-left">${daysLeftText}</span>`;
    if (c.goalType === "individual") {
      const mine = userChallengeTotal(c, state.currentUser);
      const pctDisplay = Math.round((mine / c.goal) * 100);
      html += `
        <div class="challenge-progress-card">
          <div class="challenge-progress-label">${formatNumber(mine)} / ${formatNumber(c.goal)} (${pctDisplay}%) · ${daysLeftLabel}</div>
          ${buildProgressThermometer(mine, c.goal)}
        </div>
      `;
    } else if (c.goalType === "collective") {
      const mine = userChallengeTotal(c, state.currentUser);
      const pctDisplay = Math.round((total / c.goal) * 100);
      html += `
        <div class="challenge-progress-card">
          <div class="challenge-progress-label">${formatNumber(total)} / ${formatNumber(c.goal)} together (${pctDisplay}%) · ${daysLeftLabel}</div>
          ${buildProgressThermometer(total, c.goal)}
          <div class="challenge-contribution">Your contribution: ${formatNumber(mine)}</div>
        </div>
      `;
    } else if (c.goalType === "pr") {
      const standing = userPrStanding(c, state.currentUser);
      if (standing.achieved) {
        html += `
          <div class="challenge-progress-card challenge-pr-achieved">
            <div class="challenge-pr-achieved-title">🎉 New PR!</div>
            <div class="challenge-pr-achieved-detail">${formatNumber(standing.bestThisWeek)} reps (was ${formatNumber(standing.baseline)}) · ${formatDateTime(standing.achievedAt)}</div>
          </div>
        `;
      } else {
        html += `
          <div class="challenge-progress-card">
            <div class="challenge-progress-label">Your best: ${formatNumber(standing.baseline)} · This week's best set: ${formatNumber(standing.bestThisWeek)} · ${daysLeftLabel}</div>
            ${buildProgressThermometer(standing.bestThisWeek, standing.baseline || 1)}
          </div>
        `;
      }
    } else if (c.goalType === "plankGauntlet") {
      const mine = challengeLeaderboard(c).find((row) => row.name === state.currentUser);
      const cumulativeText = formatDuration((mine?.cumulative || 0) * 1000);
      const longestText = formatDuration((mine?.longest || 0) * 1000);
      const scoreText = formatDuration((mine?.score || 0) * 1000);
      html += `
        <div class="challenge-progress-card">
          <div class="challenge-progress-label">Cumulative: ${cumulativeText} · Longest hold: ${longestText} · Composite: ${scoreText} · ${daysLeftLabel}</div>
        </div>
      `;
    } else {
      const { best, current } = windowStreak(sessions, state.currentUser, startDate, endDate);
      const pctDisplay = Math.round((best / c.goal) * 100);
      html += `
        <div class="challenge-progress-card">
          <div class="challenge-progress-label">Current streak: ${current} day${current === 1 ? "" : "s"} · Best: ${formatNumber(best)} / ${formatNumber(c.goal)} days (${pctDisplay}%)</div>
          ${buildProgressThermometer(best, c.goal)}
        </div>
      `;
    }
  }

  // Mid-challenge, Duration and Days-left already live in the hero card's
  // countdown pill — repeating them here would just be noise, so only the 2
  // numbers that actually change day to day get their own row.
  const challengeStats = challengeOverviewStats(c, {
    participantCount: participants.length,
    total: c.goalType === "plankGauntlet" ? formatDuration(total * 1000) : total,
    now,
    totalLabel: c.goalType === "plankGauntlet" ? "Total plank time" : "Total pushups",
  }).map((stat) => ({ ...stat, value: typeof stat.value === "number" ? formatNumber(stat.value) : stat.value }));

  html += `
    <div class="stats-table">
      ${challengeStats.map((s) => `
        <div class="stats-table-row">
          <span class="stats-table-label">${s.icon} ${s.label}</span>
          <span class="stats-table-value">${s.value}</span>
        </div>
      `).join("")}
    </div>

    <h2 class="section-title">Leaderboard</h2>
    <div id="challenge-leaderboard-list" class="leaderboard-list"></div>

    <h2 class="section-title">Recent flexes</h2>
    <div id="challenge-recent-list" class="challenge-recent-list"></div>
  `;

  body.innerHTML = html;

  if (status !== "past" && !joined) {
    $("btn-challenge-join").addEventListener("click", () => joinChallenge(c.id));
  }

  paintChallengeLeaderboard(c);
  paintChallengeRecent(sessions);
}

function paintChallengeLeaderboard(c) {
  const board = challengeLeaderboard(c);
  const el = $("challenge-leaderboard-list");
  el.innerHTML = "";
  if (!board.length) {
    el.innerHTML = '<p class="leaderboard-empty">No participants yet.</p>';
    return;
  }
  challengeLeaderboardRows(board, c.goalType).forEach((row) => {
    const scoreText = c.goalType === "streak" ? `${formatNumber(row.score)} day${row.score === 1 ? "" : "s"}` : c.goalType === "plankGauntlet" ? formatDuration(row.score * 1000) : formatNumber(row.score);
    const rowEl = document.createElement("div");
    rowEl.className = "leaderboard-row" + (row.topRank ? ` rank-${row.topRank}` : "");
    // "pr" rows show a green check for achievers instead of a numeric rank;
    // non-achievers get their own restart-at-1 numbering since achievers are
    // already visually distinct.
    const rankHtml = `<div class="leaderboard-rank${row.rankIsCheck ? " leaderboard-rank-check" : ""}">${row.displayRank}</div>`;
    rowEl.innerHTML = `
      ${rankHtml}
      ${avatarCircleHTML(avatarForUser(row.name), "1.8rem")}
      <div class="leaderboard-name">${escapeHtml(row.name)}</div>
      <div class="leaderboard-total">${scoreText}</div>
    `;
    makeNameCompareClickable(rowEl.querySelector(".leaderboard-name"), row.name);
    el.appendChild(rowEl);
  });
}

function paintChallengeRecent(sessions) {
  const el = $("challenge-recent-list");
  const recent = recentChallengeSessions(sessions, sessionTimestamp);
  el.innerHTML = "";
  if (!recent.length) {
    el.innerHTML = '<p class="history-empty">No sessions yet.</p>';
    return;
  }
  for (const s of recent) {
    const row = document.createElement("div");
    row.className = "recent-row compare-clickable";
    row.innerHTML = `
      ${avatarCircleHTML(avatarForUser(s.user), "1.8rem")}
      <div class="recent-name">${escapeHtml(s.user)}</div>
      <div class="recent-count">${s.type === "plank" ? formatDuration(s.count * 1000) : formatNumber(s.count)}</div>
      <div class="recent-time">${formatDateTime(s.timestamp)}</div>
    `;
    row.addEventListener("click", () => openSessionDetail(s, "screen-challenge-detail"));
    el.appendChild(row);
  }
}

async function joinChallenge(id) {
  if (!state.currentUser) {
    toast("Pick your name on the home screen first.");
    return;
  }
  const cached = getCachedData();
  if (!cached.challengeParticipants[id]) cached.challengeParticipants[id] = [];
  if (!cached.challengeParticipants[id].includes(state.currentUser)) {
    cached.challengeParticipants[id].push(state.currentUser);
  }
  cacheData(cached);
  let queued = false;
  try {
    await workerJoinChallenge(state.currentUser, id);
  } catch (e) {
    if (!isRetryableError(e)) {
      cached.challengeParticipants[id] = cached.challengeParticipants[id].filter((user) => user !== state.currentUser);
      cacheData(cached);
      toast("Couldn't join this challenge.", 4000);
      return;
    }
    enqueueMutation("join-challenge", { user: state.currentUser, challengeId: id }, `join-challenge:${id}:${state.currentUser}`);
    renderPendingStatus();
    queued = true;
  }
  if (state.screen === "screen-challenge-detail") {
    toast(queued ? "Joined on this device — waiting to sync." : "You're in! 💪");
    renderChallengeDetail();
  } else {
    // Inline banner directly above the joined card, instead of a floating
    // toast disconnected from it — auto-dismisses after a few seconds.
    state.justJoinedChallengeId = id;
    paintChallengeList();
    setTimeout(() => {
      if (state.justJoinedChallengeId === id) {
        state.justJoinedChallengeId = null;
        if (state.screen === "screen-challenges") paintChallengeList();
      }
    }, 6000);
  }
}

$("challenge-tab-select").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment");
  if (!btn) return;
  document.querySelectorAll("#challenge-tab-select .segment").forEach((s) => s.classList.remove("active"));
  btn.classList.add("active");
  state.challengeTab = btn.dataset.ctab;
  paintChallengeList();
});

$("btn-challenge-back").addEventListener("click", () => {
  history.replaceState(null, "", location.pathname + location.search);
  showScreen("screen-challenges");
});

// ------------------- create challenge -------------------

function openCreateChallenge() {
  const select = $("create-emoji");
  select.innerHTML = CHALLENGE_ICONS.map((e) => `<option value="${e}">${e}</option>`).join("");
  $("create-title").value = "";
  $("create-tagline").value = "";
  $("create-goal").value = "";
  state.createGoalType = "individual";
  document.querySelectorAll("#create-goal-type .segment").forEach((s, i) => s.classList.toggle("active", i === 0));

  const today = new Date();
  const inTwoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  $("create-start").value = fmt(today);
  $("create-end").value = fmt(inTwoWeeks);

  showScreen("screen-challenge-create");
}

$("btn-challenge-create").addEventListener("click", () => {
  if (!state.currentUser) {
    toast("Pick your name on the home screen first.");
    return;
  }
  openCreateChallenge();
});
$("btn-create-back").addEventListener("click", () => showScreen("screen-challenges"));

$("create-goal-type").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment");
  if (!btn) return;
  document.querySelectorAll("#create-goal-type .segment").forEach((s) => s.classList.remove("active"));
  btn.classList.add("active");
  state.createGoalType = btn.dataset.goaltype;
});

$("create-challenge-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("create-title").value.trim();
  const tagline = $("create-tagline").value.trim();
  const emoji = $("create-emoji").value;
  const goal = Math.floor(Number($("create-goal").value));
  const start = $("create-start").value;
  const end = $("create-end").value;

  if (!title || !tagline || !goal || goal <= 0) {
    toast("Fill in a title, description, and goal.");
    return;
  }
  if (!start || !end || new Date(end) < new Date(start)) {
    toast("End date must be on or after the start date.");
    return;
  }

  const challenge = {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    tagline,
    emoji,
    goalType: state.createGoalType,
    goal,
    start,
    end,
    gradient: gradientForIcon(emoji),
    createdBy: state.currentUser,
  };

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    let savedChallenge = challenge;
    let queued = false;
    try {
      const res = await workerCreateChallenge(challenge);
      savedChallenge = res.challenge;
    } catch (err) {
      if (!isRetryableError(err)) throw err;
      enqueueMutation("create-challenge", challenge, `create-challenge:${challenge.id}`);
      queued = true;
    }
    const cached = getCachedData();
    if (!cached.customChallenges.some((item) => item.id === savedChallenge.id)) cached.customChallenges.push(savedChallenge);
    cacheData(cached);
    renderPendingStatus();
    toast(queued ? "Challenge saved on this device — waiting to sync." : "Challenge created!");
    await renderChallengesScreen();
    showScreen("screen-challenges");
  } catch (err) {
    toast("Couldn't create the challenge — check your connection.", 4000);
  } finally {
    submitBtn.disabled = false;
  }
});

// ------------------- workout screen: camera + face detection -------------------

async function acquireWakeLock() {
  if (!("wakeLock" in navigator)) {
    toast("Screen auto-lock can't be prevented on this browser — disable auto-lock in Settings if the screen dims.", 4500);
    return;
  }
  try {
    state.wakeLock = await navigator.wakeLock.request("screen");
    state.wakeLock.addEventListener("release", () => { state.wakeLock = null; });
  } catch (e) {
    toast("Couldn't keep the screen awake automatically.", 3500);
  }
}

async function releaseWakeLock() {
  if (state.wakeLock) {
    try { await state.wakeLock.release(); } catch (e) { /* ignore */ }
    state.wakeLock = null;
  }
}

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && state.workoutActive && !state.wakeLock) {
    await acquireWakeLock();
  }
});

function resetRepState() {
  repState.counter = createRepCounter({ down: getThresholdDown(), up: getThresholdUp() });
  repState.phase = "up";
  repState.count = 0;
  repState.smoothedRatio = null;
  repState.lastSeenAt = performance.now();
  repState.lastRepSpokenAt = 0;
  repState.paused = false;
  repState.lastCheerAtCount = 0;
  repState.recordBroken = false;
  repState.ladderRecordSpoken = false;
  repState.trace = [];
  $("rep-count").textContent = "0";
  updateHighscoreMessage(0);
  updateThermometer(0);
  hideStatusBanner();
}

// Keep detection active when the preview is disabled, but clip the complete
// visual out of layout instead of replacing it with a status tile.
function applyCameraPreviewSetting() {
  const show = state.pushupMode !== "chase" && (state.pushupMode === "zen" || localStorage.getItem(LS.showCameraPreview) === "1");
  document.querySelector(".camera-wrap").classList.toggle("preview-hidden", !show);
}

function pickFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Chance of a random cheer, as a function of progress toward personal best
// (0..1+). Low and steady in the first half, then ramps up so cheers land
// more and more often as the record gets close.
function cheerProbability(fraction) {
  const f = Math.max(0, fraction);
  if (f < 0.5) return 0.07;
  return 0.15 + Math.min(1.3, f - 0.5) * 0.5;
}

// Returns a random encouragement line, more likely (and more often) the
// closer `count` is to the user's personal best — else null. A small
// cooldown (in reps) keeps cheers from clustering back-to-back.
function maybeEncourage(count) {
  if (!state.highScore || state.highScore <= 1) return null;
  if (count - repState.lastCheerAtCount < 3) return null;
  if (Math.random() < cheerProbability(count / state.highScore)) {
    repState.lastCheerAtCount = count;
    return pickFrom(ENCOURAGE_LINES);
  }
  return null;
}

function updateThermometer(count) {
  const wrap = $("thermometer-wrap");
  // Countdown mode fills toward the countdown target (PR+1); Classic and
  // Cards both fill toward the plain high score, same as always.
  const goal = state.pushupMode === "countdown" ? state.countdownTarget : state.highScore;
  if (!goal) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  const fill = $("thermometer-fill");
  const pct = Math.min(100, Math.round((count / goal) * 100));
  fill.style.width = `${pct}%`;
  fill.classList.toggle("thermometer-win", count > goal);
}

function getHighScore(name) {
  return bestFor(indexedSessionsForUser(name, "pushups"), name, () => true);
}

// Ladder's own record: the highest rung ever fully cleared, across all past
// Ladder sessions — parallel to getHighScore, but keyed on the explicit
// ladderMaxRung field each Ladder session saves (see completeWorkout).
function getLadderBestRung(name) {
  return bestFor(indexedSessionsForUser(name, "pushups"), name, (s) => s.mode === "ladder", "ladderMaxRung");
}

function getPlankBest(name) {
  return bestFor(indexedSessionsForUser(name, "planks"), name, () => true);
}

function getSquatBest(name) {
  return bestFor(indexedSessionsForUser(name, "squats"), name, () => true);
}

function updateHighscoreMessage(count) {
  const el = $("highscore-message");
  const enabled = localStorage.getItem(LS.showHighscore) !== "0";
  if (!enabled || !state.highScore) {
    el.textContent = "";
    return;
  }
  const remaining = state.highScore - count;
  if (remaining > 0) {
    el.textContent = `${remaining} pushup${remaining === 1 ? "" : "s"} away from your high score!`;
  } else if (remaining === 0) {
    el.textContent = "Tied your high score — one more!";
  } else {
    el.textContent = "New high score! 🔥";
  }
}

function hideStatusBanner() { $("status-banner").classList.add("hidden"); }
function showStatusBanner(text) {
  $("status-banner").textContent = text;
  $("status-banner").classList.remove("hidden");
  announce(text);
}

function updateFaceBox(bbox) {
  const video = $("camera-video");
  const container = document.querySelector(".camera-wrap");
  const cw = container.clientWidth, ch = container.clientHeight;
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.max(cw / vw, ch / vh);
  const scaledW = vw * scale, scaledH = vh * scale;
  const offsetX = (cw - scaledW) / 2, offsetY = (ch - scaledH) / 2;
  const box = $("face-box");
  box.style.left = `${bbox.originX * scale + offsetX}px`;
  box.style.top = `${bbox.originY * scale + offsetY}px`;
  box.style.width = `${bbox.width * scale}px`;
  box.style.height = `${bbox.height * scale}px`;
  box.classList.remove("hidden");
}
function hideFaceBox() { $("face-box").classList.add("hidden"); }

function processRatio(ratio, inferenceMs) {
  const now = performance.now();
  repState.lastSeenAt = now;

  if (repState.paused) {
    repState.paused = false;
    hideStatusBanner();
    if (state.pushupMode !== "zen") speak("Back to it");
  }

  if (!repState.counter) resetRepState();
  repState.counter.setThresholds(getThresholdDown(), getThresholdUp());
  const result = repState.counter.advance(ratio, now);
  repState.smoothedRatio = result.smoothed;
  repState.phase = result.phase;

  repState.trace.push({ t: Math.round(now), raw: +ratio.toFixed(4), s: +result.smoothed.toFixed(4), p: result.phase, ms: Math.round(inferenceMs || 0) });
  if (repState.trace.length > TRACE_MAX_SAMPLES) repState.trace.shift();

  if (result.counted) {
    repState.count = result.count;
    onRepCounted(result.count);
  }
}

// Sets the big hero number + its label for whichever mode is active. Kept
// synchronous (called straight from onRepCounted, off the deferred chain)
// so the number that matters most in each mode updates with zero lag.
function renderHeroForCount(count) {
  const heroEl = $("rep-count");
  const labelEl = $("rep-label");
  const model = workoutHeroModel(state.pushupMode, count, state);
  if (model.kind === "cards") {
    // Cards mode has no giant hero number — the card art itself is the
    // focal point (see setupWorkoutModeState, which hides #rep-count/#rep-label
    // for this mode). Both counts live together in one subordinate line.
    const remaining = model.remaining;
    $("cards-session-total").textContent = `${remaining} left on this card · ${formatNumber(count)} total`;
    updateModeCounterBadge("card-counter-badge", remaining);
  } else if (model.kind === "poker") {
    const remaining = model.remaining;
    const hands = state.pokerHandsCompleted.length;
    const handText = `${hands} hand${hands === 1 ? "" : "s"}`;
    $("poker-session-total").innerHTML = state.pokerResolving
      ? `${handText} completed · <strong>${formatNumber(count)} total</strong>`
      : `${remaining} left on ${state.pokerHand[state.pokerCardIndex]?.label || "card"} · ${handText} · <strong>${formatNumber(count)} total</strong>`;
    if (!state.pokerResolving) updateModeCounterBadge("poker-counter-badge", remaining);
  } else if (model.kind === "dice") {
    // Same subordinate-line pattern as Cards — the dice pair is the focal
    // point (see setupWorkoutModeState), not a giant number.
    const remaining = model.remaining;
    $("dice-session-total").textContent = `${remaining} left this roll · ${formatNumber(count)} total`;
    updateModeCounterBadge("dice-counter-badge", remaining);
  } else if (model.kind === "wheel") {
    // Same subordinate-line pattern as Cards/Dice — the wheel dial is the focal
    // point, not a giant number.
    const remaining = model.remaining;
    $("wheel-session-total").textContent = `${remaining} left this spin · ${formatNumber(count)} total`;
    updateModeCounterBadge("wheel-counter-badge", remaining);
    const pct = state.wheelTarget > 0 ? Math.min(100, (state.wheelRepsDone / state.wheelTarget) * 100) : 0;
    $("wheel-progress-fill").style.width = `${pct}%`;
  } else if (model.kind === "ladder") {
    // Like Cards/Dice, no giant hero number — the rung window itself is the
    // focal visual (see setupWorkoutModeState). Reps-remaining-on-this-rung
    // shows as a pop badge on the active row instead.
    const remaining = model.remaining;
    renderLadderRungWindow();
    updateModeCounterBadge("ladder-counter-badge", remaining);
    $("ladder-session-total").textContent = `${formatNumber(count)} total · Best rung ${getLadderBestRung(state.currentUser)}`;
  } else if (model.kind === "pyramid") {
    // Same focal-visual pattern as Ladder — the pyramid stack is the focal
    // point, reps-remaining-on-this-row shows as a pop badge over the active row.
    const remaining = model.remaining;
    renderPyramidWindow();
    updateModeCounterBadge("pyramid-counter-badge", remaining);
    $("pyramid-session-total").textContent = `${formatNumber(count)} / ${formatNumber(state.pyramidTotalReps)} total`;
  } else if (model.kind === "sharpshooter") {
    const remaining = model.remaining;
    $("sharpshooter-count").textContent = String(remaining);
    const destroyed = state.sharpshooterTargetsDestroyed;
    $("sharpshooter-session-total").textContent = `${formatNumber(count)} total · ${destroyed} target${destroyed === 1 ? "" : "s"} destroyed`;
  } else if (model.kind === "horse") {
    // No giant hero number here — the target-to-beat is the static focal
    // number rendered once by renderHorseTurnHero(); this is just the live
    // running count, same subordinate-line pattern as Cards/Dice/Ladder.
    $("horse-session-total").textContent = `Live count: ${formatNumber(count)}`;
  } else {
    heroEl.textContent = model.display;
    heroEl.classList.toggle("rep-count-over", model.over);
    labelEl.textContent = model.label;
  }
}

// The number that gets spoken per rep is whatever the hero number shows in
// the active mode, not always the raw rep count.
function heroSpokenNumber(count) {
  const model = workoutHeroModel(state.pushupMode, count, state);
  return `${model.spokenPrefix}${numberToWords(model.spokenValue)}`;
}

// Pops the "reps left" badge over the mode's focal art (card or dice pair).
// Re-triggered on every rep by removing/re-adding "pop" with a forced reflow
// in between — the same restart pattern playCardFlip uses for the flip
// transition — so back-to-back reps each get their own full grow-then-fade
// cycle. Shared by Cards (#card-counter-badge) and Dice (#dice-counter-badge).
function updateModeCounterBadge(elId, remaining) {
  const badge = $(elId);
  if (!badge) return;
  badge.textContent = String(remaining);
  badge.classList.remove("pop");
  void badge.offsetWidth;
  badge.classList.add("pop");
}

// A real ladder, not a scrolling window: rungs are grouped into fixed pages
// of 5 (1-5, 6-10, 11-15, ...) and always render bottom-to-top like a real
// ladder (lowest number at the bottom, climbing upward). The active rung
// climbs one slot per rung within its page; the instant it clears the top
// slot, the very next rung is that same page's bottom slot pushed one page
// higher (5p+5 clears -> 5p+6 is slot 0 of the next page) — so the "reset"
// the user asked for (active drops back to the bottom, everything above
// freshly locked) falls straight out of the page-index math below, no
// special-casing needed. This discrete jump (vs. a continuously sliding
// window) is deliberately easy to read mid-set.
// #ladder-counter-badge (a .mode-counter-badge, same component Cards/Dice
// use) isn't part of this markup — it's a persistent element repositioned
// here to sit over whichever row is active, since it needs to survive
// across this function's re-renders to animate its "pop" correctly.
function ladderNames(names) {
  if (names.length <= 1) return names[0] || "the competition";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function ladderRivalCallout(enteredRung) {
  const milestones = ladderRivalMilestones(state.ladderRivals, enteredRung);
  if (!milestones.length) return null;
  return milestones.map((milestone) => {
    const names = ladderNames(milestone.rival.names);
    if (milestone.type === "passed") return LADDER_RIVAL_PASSED_LINE(names);
    if (milestone.type === "matched") return LADDER_RIVAL_MATCHED_LINE(names);
    return LADDER_RIVAL_APPROACHING_LINE(names);
  }).join(" ");
}

function renderLadderRungWindow() {
  const container = $("ladder-rung-window");
  const current = state.ladderRung;
  const renderKey = `${current}|${state.ladderRivals.map((rival) => `${rival.rung}:${rival.names.join(",")}`).join(";")}`;
  if (container.dataset.renderKey === renderKey) return;
  let rows = "";
  // slot 4 (top of the page, highest number) rendered first so it lands at
  // the top of the screen — flex-direction: column stacks first-child-on-top.
  for (const row of ladderRungRows(current, state.ladderRivals, shouldCompactLadderRivals)) {
    const n = row.rung;
    const cls = row.status;
    const rivals = row.rival;
    const compactRivals = row.compactRivals;
    const rivalMarkup = rivals ? `<div class="ladder-rivals ${compactRivals ? "distant" : "near"}" aria-label="${escapeHtml(`Best rung for ${ladderNames(rivals.names)}`)}">
      ${rivals.users.map(({ name, avatar }) => compactRivals
        ? `<span class="ladder-rival-dot" title="${escapeHtml(name)}" style="background:${avatar.bg}">${avatar.emoji}</span>`
        : `<span class="ladder-rival-chip">${avatarCircleHTML(avatar, "1.25rem")}<span>${escapeHtml(name)}</span></span>`).join("")}
    </div>` : '<div class="ladder-rivals"></div>';
    rows += `
      <div class="ladder-rung-row ${cls}">
        <span class="ladder-rung-number">${n}</span>
        ${rivalMarkup}
        <span class="ladder-rung-icon" aria-hidden="true"></span>
      </div>
    `;
  }
  container.innerHTML = rows;
  container.dataset.renderKey = renderKey;

  const activeRow = container.querySelector(".ladder-rung-row.active");
  const badge = $("ladder-counter-badge");
  if (activeRow && badge) {
    const hudRect = $("ladder-hud").getBoundingClientRect();
    const rowRect = activeRow.getBoundingClientRect();
    badge.style.top = `${rowRect.top - hudRect.top + rowRect.height / 2}px`;
    badge.style.left = `${rowRect.left - hudRect.left + rowRect.width / 2}px`;
  }
}

// ------------------- pyramid mode -------------------
// Solo mode: descend base(n)..1, and on Up & Down reclimb 2..n. Unlike Ladder,
// the whole pyramid renders at once (tapered rows, base widest at the
// bottom) and the active row additionally shows one stone per rep so
// progress within the row is visible, not just which row is active.

function renderPyramidWindow() {
  const container = $("pyramid-window");
  const rows = pyramidMode.pyramidRows(state.pyramidSize, state.pyramidDirection, state.pyramidRow, state.pyramidPhase);
  const maxBase = state.pyramidSize;
  const structureKey = `${state.pyramidSize}|${state.pyramidDirection}|${state.pyramidRow}|${state.pyramidPhase}`;
  const structureChanged = container.dataset.renderKey !== structureKey;
  if (structureChanged) {
    let html = "";
    for (const row of rows) {
      const isActive = row.status === "active";
      const phaseClass = isActive ? ` phase-${state.pyramidPhase}` : "";
      const widthPct = 30 + (row.row / maxBase) * 70;
      let stones = "";
      for (let i = 0; i < row.row; i += 1) stones += '<span class="pyramid-stone"></span>';
      html += `<div class="pyramid-row ${row.status}${phaseClass}" style="width:${widthPct}%">${stones}</div>`;
    }
    container.innerHTML = html;
    container.dataset.renderKey = structureKey;
  }

  const activeRow = container.querySelector(".pyramid-row.active");
  if (activeRow) {
    activeRow.querySelectorAll(".pyramid-stone").forEach((stone, index) => {
      stone.classList.toggle("stone-cleared", index < state.pyramidRepsDone);
    });
  }

  // Floating "reps left on this row" badge, same pop-on-rep component and
  // positioning approach as #ladder-counter-badge — repositioned over
  // whichever row is active since the stack reflows every render.
  const badge = $("pyramid-counter-badge");
  if (structureChanged && activeRow && badge) {
    const hudRect = $("pyramid-hud").getBoundingClientRect();
    const rowRect = activeRow.getBoundingClientRect();
    badge.style.top = `${rowRect.top - hudRect.top + rowRect.height / 2}px`;
    badge.style.left = `${rowRect.left - hudRect.left + rowRect.width / 2}px`;
  }
}

// Advances pyramidRow/pyramidPhase after the active row's reps are done.
// Returns a short event tag for the voice/celebration layer to react to.
function advancePyramidRow() {
  state.pyramidRepsDone = 0;
  if (state.pyramidPhase === "descending") {
    if (state.pyramidRow > 1) {
      state.pyramidRow -= 1;
      return "row";
    }
    state.pyramidPeakReached = true;
    if (state.pyramidDirection === "updown") {
      state.pyramidPhase = "ascending";
      state.pyramidRow = 2;
      return "turnaround";
    }
    state.pyramidCompleted = true;
    return "complete";
  }
  if (state.pyramidRow < state.pyramidSize) {
    state.pyramidRow += 1;
    return "row";
  }
  state.pyramidCompleted = true;
  return "complete";
}

function getPyramidBest(user, size, direction) {
  return bestFor(indexedSessionsForUser(user, "pushups"), user, (s) => s.mode === "pyramid" && s.pyramidSize === size && s.pyramidDirection === direction, "count");
}

// ------------------- fortune cookie mode -------------------
// One standard, user-directed push-up set framed by a single revealed
// technique challenge. Unlike Cards/Dice/Ladder, the "flavor" here happens
// entirely on the idle screen BEFORE the camera ever starts: tap the cookie,
// watch the 4-frame reveal, read the challenge, then its own "Start Set"
// button (not the normal #btn-start) calls the same startWorkout() every
// other mode uses. Reps are counted exactly like Classic mode; only the
// challenge framing differs, plus two challenges (No Looking, Silent Set)
// hide the live counter.

function fortuneUserSessions(user) {
  return [...indexedSessionsForUser(user, "pushups")]
    .sort((a, b) => sessionTimestamp(a) - sessionTimestamp(b));
}

let fortuneModePromise = null;
function loadFortuneMode() {
  if (!fortuneModePromise) fortuneModePromise = import("./modes/fortune.js?v=147");
  return fortuneModePromise;
}

async function pickFortuneChallenge(user) {
  const fortuneMode = await loadFortuneMode();
  return fortuneMode.pickFortuneChallenge(fortuneUserSessions(user), {
    excludedCategories: state.modifier ? ["grip"] : [],
  });
}

function fortuneTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}
function fortuneImageUrl(theme, frame) {
  return `assets/fortune/${theme}/${frame}.webp`;
}

const FORTUNE_FRAMES = ["closed", "cracked", "emerging", "revealed"];
const fortuneAssetsPreloaded = { dark: null, light: null };
// Preloads all 4 frames for one theme so the reveal never waits on a
// network fetch OR a decode mid-animation — img.decode() (falling back to
// onload where unsupported) resolves only once the bitmap is actually ready
// to paint, not just downloaded, since decoding a fresh image the first
// time it's asked to composite is a real, measurable jank source on a
// cross-faded/transformed element. The service worker caches each
// same-origin GET on first use, same as Cards'/Dice's art, so this only
// costs a real fetch once per device. Returns (and caches) the in-flight
// promise so a tap arriving before preload finishes awaits the same work
// instead of kicking off a redundant fetch.
function preloadFortuneAssets(theme) {
  if (fortuneAssetsPreloaded[theme]) return fortuneAssetsPreloaded[theme];
  const promise = Promise.all(FORTUNE_FRAMES.map((f) => {
    const img = new Image();
    img.src = fortuneImageUrl(theme, f);
    return (img.decode ? img.decode() : Promise.resolve()).catch(() => new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    }));
  }));
  fortuneAssetsPreloaded[theme] = promise;
  return promise;
}

// Renders whichever reveal frame is active (opacity cross-fade via
// .is-active, see style.css) plus the tap hint / Start Set button / message
// overlay, each shown only in their matching state.
function renderFortuneStage() {
  const theme = fortuneTheme();
  for (const f of FORTUNE_FRAMES) {
    const el = $(`fortune-frame-${f}`);
    if (!el) continue;
    // Same-value writes to .src are normally a no-op, but skipping them
    // outright avoids any risk of that check itself costing a frame during
    // the animation — cheap insurance right when frame budget matters most.
    const url = fortuneImageUrl(theme, f);
    if (el.src !== new URL(url, location.href).href) el.src = url;
    el.classList.toggle("is-active", state.fortuneRevealState === f);
  }
  const revealed = state.fortuneRevealState === "revealed";
  $("fortune-tap-hint").classList.toggle("hidden", state.fortuneRevealState !== "closed");
  $("fortune-message").classList.toggle("hidden", !revealed);
  $("btn-fortune-start-set").classList.toggle("hidden", !revealed);
  if (revealed && state.fortuneChallenge) {
    const c = state.fortuneChallenge.challenge;
    $("fortune-message").innerHTML = `<div class="fortune-title">${escapeHtml(c.title)}</div>` +
      c.lines.map((l) => `<div class="fortune-detail">${escapeHtml(l)}</div>`).join("");
  }
}

// Resets the idle stage back to a fresh closed cookie — called whenever the
// Fortune Cookie idle screen is (re)entered, so switching modes away and
// back (or leaving to Explore Modes) never leaves a stale reveal on screen.
function resetFortuneStage() {
  state.fortuneRevealState = "closed";
  state.fortuneRevealing = false;
  state.fortuneChallenge = null;
  renderFortuneStage();
}

// Timing follows the spec's table: each cross-fade duration below matches
// the CSS transition-duration set on that frame in style.css exactly, then
// a short "hold" lets it sit fully settled before the next cross-fade
// starts — a transition that gets re-targeted before finishing is what
// read as choppy, not the cross-fades themselves. Guards against a
// double-tap starting a second reveal mid-sequence, and against the tap
// landing before this theme's assets have actually finished decoding.
async function revealFortune() {
  if (state.fortuneRevealing || state.fortuneRevealState !== "closed") return;
  state.fortuneRevealing = true;
  state.fortuneChallenge = await pickFortuneChallenge(state.currentUser);
  await preloadFortuneAssets(fortuneTheme());

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    state.fortuneRevealState = "revealed";
    renderFortuneStage();
    state.fortuneRevealing = false;
    return;
  }

  state.fortuneRevealState = "cracked";
  renderFortuneStage();
  await sleep(140); // closed -> cracked transition
  await sleep(120); // cracked hold

  state.fortuneRevealState = "emerging";
  renderFortuneStage();
  await sleep(200); // cracked -> emerging transition
  await sleep(130); // emerging hold

  state.fortuneRevealState = "revealed";
  renderFortuneStage();
  await sleep(300); // emerging -> revealed transition
  state.fortuneRevealing = false;
}

function cardRankSpokenWord(card) {
  return CARD_RANK_SPOKEN[card.label] || numberToWords(card.value);
}

// One high-resolution WebP per card rather than a sprite sheet. Only one or
// two cards are ever on screen, and the service worker caches each card after
// its first fetch.
function cardImageUrl(card) {
  const theme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  return `assets/cards/${theme}/${card.label}${card.suit[0]}.webp`;
}

// Warm the next card while the user is still doing reps on the current one, so
// the flip never waits on a network fetch.
function preloadCard(card) {
  if (!card) return;
  const img = new Image();
  img.src = cardImageUrl(card);
}

function peekNextCard() {
  const deck = getPersistedDeck();
  if (!deck.length) return null;
  const c = deck[0];
  return cardAt(c.col, c.row);
}

function setCardFace(el, card) {
  if (!el || !card) return;
  el.style.backgroundImage = `url("${cardImageUrl(card)}")`;
  el.setAttribute("aria-label", `${card.label} of ${card.suit}`);
}

function renderPokerHand() {
  const hand = $("poker-hand");
  if (!hand) return;
  const offsets = [-7.2, -3.6, 0, 3.6, 7.2];
  const rotations = [-4, -2, 0, 2, 4];
  hand.innerHTML = state.pokerHand.map((card, index) => {
    const status = index < state.pokerCardIndex ? " completed" : index === state.pokerCardIndex ? " active" : "";
    const check = index < state.pokerCardIndex ? '<span class="poker-card-check" aria-hidden="true">✓</span>' : "";
    const counter = index === state.pokerCardIndex ? '<span id="poker-counter-badge" class="mode-counter-badge" aria-hidden="true"></span>' : "";
    return `<div class="poker-card${status}" style="--poker-x:${offsets[index]}rem;--poker-rotate:${rotations[index]}deg;background-image:url('${cardImageUrl(card)}')" aria-label="${card.label} of ${card.suit}${index === state.pokerCardIndex ? ", active" : ""}">${check}${counter}</div>`;
  }).join("");
}

function priorPokerAchievements() {
  const ids = new Set();
  for (const session of indexedSessionsForUser(state.currentUser, "pushups")) {
    if (session.mode !== "poker") continue;
    for (const id of session.pokerAchievementsUnlocked || []) ids.add(id);
    for (const rank of session.pokerHandRanks || []) {
      if (Number(rank) >= 1) ids.add(POKER_HANDS[Number(rank)].toLowerCase().replaceAll(" ", "-"));
    }
  }
  for (const id of state.pokerAchievementsUnlocked) ids.add(id);
  return ids;
}

function pokerCallout(result) {
  const pool = POKER_CALLOUTS[result.id] || [];
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : "";
}

function dealNextPokerHand() {
  state.pokerHand = dealPokerHand();
  state.pokerCardIndex = 0;
  state.pokerCardRepsDone = 0;
  state.pokerCardTarget = state.pokerHand[0].value;
  state.pokerResolving = false;
  $("poker-result").classList.add("hidden");
  renderPokerHand();
  state.pokerHand.forEach(preloadCard);
}

function completePokerHand() {
  const result = evaluatePokerHand(state.pokerHand);
  if (!result) return;
  state.pokerHandsCompleted.push(result);
  state.pokerResolving = true;
  state.pokerCardIndex = 5;
  renderPokerHand();
  const achieved = priorPokerAchievements();
  const newIds = pokerAchievementIds(result.rank).filter((id) => !achieved.has(id));
  state.pokerAchievementsUnlocked.push(...newIds);
  const resultEl = $("poker-result");
  resultEl.className = `poker-result rank-${result.rank}`;
  resultEl.innerHTML = `${result.label}${newIds.length ? "<small>NEW ACHIEVEMENT UNLOCKED</small>" : "<small>HAND COMPLETE</small>"}`;
  announce(`${result.label}${newIds.length ? ", new achievement unlocked" : ""}`);
  if (result.rank >= 1) {
    const line = pokerCallout(result);
    if (line) speak(line);
    launchConfetti("workout-confetti", result.rank >= 6 ? ["♠️", "♥️", "♦️", "♣️", "🔥", "👑"] : ["♠️", "♥️", "♦️", "♣️"], result.rank >= 6 ? 34 : 18);
  }
  setTimeout(() => {
    if (state.workoutActive && state.pushupMode === "poker") {
      dealNextPokerHand();
      renderHeroForCount(repState.count);
    }
  }, 2000);
}

function advancePokerCard() {
  state.pokerCardIndex += 1;
  state.pokerCardRepsDone = 0;
  if (state.pokerCardIndex >= 5) completePokerHand();
  else {
    state.pokerCardTarget = state.pokerHand[state.pokerCardIndex].value;
    renderPokerHand();
  }
}

let cardFlipTimer = null;
let cardFlipRafId = null;
// Single 3D flip: front face shows the outgoing card, back face the
// incoming one. After the transition, the incoming card is swapped onto the
// front and rotation is reset to 0 with transitions off, so the next flip
// always starts from a clean, unflipped state — including if this flip
// interrupts one still finishing (fast reps landing back-to-back on 1-value
// cards can trigger that). The pending rAF is explicitly cancelled by the
// cleanup timeout so a rAF that gets delayed (backgrounded tab, dropped
// frame) can never fire *after* cleanup and re-add "flipped" onto an
// already-settled card.
function playCardFlip(outgoing, incoming) {
  const scene = $("card-flip");
  const front = $("card-face-front");
  const back = $("card-face-back");
  if (!scene) return;
  clearTimeout(cardFlipTimer);
  if (cardFlipRafId != null) {
    cancelAnimationFrame(cardFlipRafId);
    cardFlipRafId = null;
  }

  scene.classList.add("no-transition");
  scene.classList.remove("flipped");
  setCardFace(front, outgoing);
  setCardFace(back, incoming);
  void scene.offsetWidth; // force reflow so the snap above lands before transitions re-enable
  scene.classList.remove("no-transition");

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    setCardFace(front, incoming);
    return;
  }

  cardFlipRafId = requestAnimationFrame(() => {
    cardFlipRafId = null;
    scene.classList.add("flipped");
  });
  cardFlipTimer = setTimeout(() => {
    if (cardFlipRafId != null) {
      cancelAnimationFrame(cardFlipRafId);
      cardFlipRafId = null;
    }
    scene.classList.add("no-transition");
    scene.classList.remove("flipped");
    setCardFace(front, incoming);
    void scene.offsetWidth;
    scene.classList.remove("no-transition");
  }, 460);
}

// Draws the next card, plays its flip, and resets the per-card rep count.
// Detection/counting never waits on this — it's pure DOM/CSS from here.
function advanceToNextCard() {
  const next = drawNextCard();
  // The outgoing card was just cleared — record it for the end-of-session share.
  if (state.currentCard) state.cardsCleared.push(state.currentCard);
  preloadCard(peekNextCard());
  playCardFlip(state.currentCard, next);
  state.currentCard = next;
  state.cardTarget = next.value;
  state.cardRepsDone = 0;
  return next;
}

// Pure ascent, no ceiling: once the current rung's reps are done, record it
// as the highest rung cleared this session (saved onto the session as
// ladderMaxRung — see completeWorkout) and move to the next rung up.
function advanceLadderRung() {
  state.ladderMaxRungCleared = state.ladderRung;
  state.ladderRung += 1;
  state.ladderRepsDone = 0;
}

function loadNextSharpshooterTarget() {
  state.sharpshooterTarget = sharpshooterMode.sharpshooterTargetForBest(state.highScore);
  state.sharpshooterRepsDone = 0;
  return state.sharpshooterTarget;
}

function pulseSharpshooterTarget() {
  const target = $("sharpshooter-target");
  if (!target || target.classList.contains("bullseye")) return;
  target.classList.remove("rep-hit");
  void target.offsetWidth;
  target.classList.add("rep-hit");
}

function celebrateSharpshooterHit() {
  const target = $("sharpshooter-target");
  clearTimeout(state.sharpshooterAnimationTimer);
  target.classList.remove("rep-hit", "bullseye");
  void target.offsetWidth;
  $("sharpshooter-count").textContent = "0";
  target.classList.add("bullseye");
  if (soundIsEnabled()) playSharpshooterHit();
  vibrate(120);
  state.sharpshooterAnimationTimer = setTimeout(() => {
    target.classList.remove("bullseye");
    const remaining = Math.max(0, state.sharpshooterTarget - state.sharpshooterRepsDone);
    $("sharpshooter-count").textContent = String(remaining);
  }, 800);
}

function onRepCounted(count) {
  // Only the counter itself updates synchronously — everything else is
  // deferred off the detection hot path so a burst of fast reps isn't
  // starved of camera samples by speech/DOM work. Card-target bookkeeping
  // stays in this synchronous part too, since a rep landing mid-flip must
  // still count toward the next card immediately.
  let flippedCard = null;
  let rolledDice = null;
  let newRung = null;
  let sharpshooterHit = false;
  let pyramidEvent = null;
  if (state.pushupMode === "cards") {
    state.cardRepsDone += 1;
    if (state.cardRepsDone >= state.cardTarget) {
      flippedCard = advanceToNextCard();
    }
  } else if (state.pushupMode === "poker" && !state.pokerResolving) {
    state.pokerCardRepsDone += 1;
    if (state.pokerCardRepsDone >= state.pokerCardTarget) advancePokerCard();
  } else if (state.pushupMode === "dice") {
    state.diceRepsDone += 1;
    if (state.diceRepsDone >= state.diceTarget) {
      rolledDice = advanceToNextRoll();
    }
  } else if (state.pushupMode === "wheel" && !state.wheelSpinning) {
    // Guarded on !wheelSpinning: wheelTarget is 0 while the dial is
    // mid-animation, and 0 reps would otherwise instantly "complete" a
    // set that hasn't been assigned yet.
    state.wheelRepsDone += 1;
    if (state.wheelRepsDone >= state.wheelTarget) {
      state.wheelLastTarget = state.wheelTarget;
      state.wheelSetModifier = null;
      state.wheelCue = null;
      renderWheel();
      advanceWheelSpin(); // auto-respin immediately, no tap
    }
  } else if (state.pushupMode === "ladder") {
    state.ladderRepsDone += 1;
    if (state.ladderRepsDone >= state.ladderRung) {
      advanceLadderRung();
      newRung = state.ladderRung;
    }
  } else if (state.pushupMode === "sharpshooter") {
    state.sharpshooterRepsDone += 1;
    if (state.sharpshooterRepsDone >= state.sharpshooterTarget) {
      state.sharpshooterTargetsDestroyed += 1;
      state.sharpshooterLongestShot = Math.max(state.sharpshooterLongestShot, state.sharpshooterTarget);
      loadNextSharpshooterTarget();
      sharpshooterHit = true;
    }
  } else if (state.pushupMode === "pyramid") {
    state.pyramidRepsDone += 1;
    if (state.pyramidRepsDone >= state.pyramidRow) {
      pyramidEvent = advancePyramidRow();
    }
  }
  renderHeroForCount(count);
  if (state.pushupMode === "sharpshooter") {
    if (sharpshooterHit) celebrateSharpshooterHit();
    else pulseSharpshooterTarget();
  }
  if (state.pushupMode === "zen") return;
  setTimeout(() => {
    updateHighscoreMessage(count);
    updateThermometer(count);

    let spoken = null;
    let mustSpeak = false;
    const chaseCallout = state.pushupMode === "chase" ? renderChaseProgress(count, true) : null;
    const rivalCallout = state.pushupMode === "ladder" && newRung ? ladderRivalCallout(newRung) : null;
    if (sharpshooterHit) {
      spoken = pickFrom(SHARPSHOOTER_HIT_LINES);
      mustSpeak = true;
    } else if (chaseCallout) {
      spoken = chaseCallout;
      mustSpeak = true;
    } else if (rivalCallout) {
      const isNewRungRecord = newRung > getLadderBestRung(state.currentUser) && !repState.ladderRecordSpoken;
      if (isNewRungRecord) {
        repState.ladderRecordSpoken = true;
        launchConfetti("workout-confetti");
      }
      spoken = `${isNewRungRecord ? "New rung record! " : ""}${rivalCallout}`;
      mustSpeak = true;
    } else if (state.pushupMode !== "chase" && state.highScore && count === state.highScore + 1 && !repState.recordBroken) {
      repState.recordBroken = true;
      spoken = "New personal record! Absolute legend!";
      mustSpeak = true;
      launchConfetti("workout-confetti");
    } else if (flippedCard) {
      spoken = cardRankSpokenWord(flippedCard);
      mustSpeak = true;
    } else if (rolledDice) {
      spoken = numberToWords(rolledDice.sum);
      mustSpeak = true;
    } else if (newRung && newRung > getLadderBestRung(state.currentUser) && !repState.ladderRecordSpoken) {
      repState.ladderRecordSpoken = true;
      spoken = "New rung record!";
      mustSpeak = true;
      launchConfetti("workout-confetti");
    } else if (newRung) {
      // Every other rung gets a short cheer instead of the plain number, so
      // a long climb doesn't just sound like a flat count-up the whole way.
      spoken = newRung % 2 === 0 ? pickFrom(LADDER_CHEER_LINES) : numberToWords(newRung);
      mustSpeak = true;
    } else if (pyramidEvent === "complete") {
      spoken = PYRAMID_COMPLETE_LINE;
      mustSpeak = true;
      launchConfetti("workout-confetti");
    } else if (pyramidEvent === "turnaround") {
      spoken = PYRAMID_TURNAROUND_LINE;
      mustSpeak = true;
    } else if (pyramidEvent === "row" && state.pyramidRow === 1) {
      spoken = PYRAMID_APEX_LINE;
      mustSpeak = true;
    } else if (pyramidEvent === "row") {
      spoken = state.pyramidRow % 2 === 0 ? pickFrom(PYRAMID_ROW_CHEER_LINES) : numberToWords(state.pyramidRow);
      mustSpeak = true;
    } else {
      spoken = maybeEncourage(count);
      if (spoken) mustSpeak = true;
    }

    // At sprint pace a spoken number is still ~0.7s of audio, so back-to-back
    // reps would cut each other off mid-word — speak only every 5th rep unless
    // it's a cheer/record. (The old 1200ms threshold also covered speech-synth
    // startup lag; the pre-rendered clips start instantly, so this is now purely
    // about audio length. Lower REP_SPEECH_MIN_GAP_MS for a chattier count.)
    const now = performance.now();
    const fastPace = now - repState.lastRepSpokenAt < REP_SPEECH_MIN_GAP_MS;
    if (mustSpeak || !fastPace || count % 5 === 0) {
      repState.lastRepSpokenAt = now;
      speak(spoken || heroSpokenNumber(count));
    }
    vibrate(45);
  }, 0);
}

function checkFaceLostTimeout() {
  if (repState.paused) return;
  const now = performance.now();
  if (now - repState.lastSeenAt > FACE_LOST_TIMEOUT_MS) {
    repState.paused = true;
    if (state.pushupMode === "zen") return;
    showStatusBanner("PAUSED — find your face");
    speak("Paused");
  }
}

const camera = createCameraController({
  moduleUrl: FACE_DETECTOR_MODULE_URL,
  wasmUrl: FACE_DETECTOR_WASM_URL,
  modelUrl: FACE_DETECTOR_MODEL_URL,
  getVideo: () => $("camera-video"),
  onDetection(bbox, inferenceMs) {
    const video = $("camera-video");
    updateFaceBox(bbox);
    processRatio(bbox.height / video.videoHeight, inferenceMs);
  },
  onNoDetection(inferenceMs, startedAt) {
    repState.trace.push({ t: Math.round(startedAt), raw: null, ms: Math.round(inferenceMs) });
    if (repState.trace.length > TRACE_MAX_SAMPLES) repState.trace.shift();
    hideFaceBox();
    checkFaceLostTimeout();
  },
});

function creditedChasePoints(rawCount) {
  return Math.round(rawCount * state.chaseMultiplier);
}

function renderChaseProgress(rawCount, announce = false) {
  if (!state.chasePlan) return null;
  const previous = state.chaseProgress;
  const progress = chaseProgress(state.chasePlan, creditedChasePoints(rawCount));
  state.chaseProgress = progress;
  const current = progress.current;
  const displayStage = progress.target;
  if (!displayStage) return null;
  const leading = progress.complete;
  const leader = chaseLeaderLabel(displayStage);
  const identityName = leading ? state.currentUser : leader;
  const identityAvatar = avatarForUser(identityName);
  $("chase-hud").classList.toggle("is-leading", leading);
  $("chase-identity").classList.toggle("is-leading", leading);
  $("chase-identity").innerHTML = `${leading ? '<span class="chase-crown">👑</span>' : ""}${avatarCircleHTML(identityAvatar, "4.75rem")}<div class="chase-identity-name">${escapeHtml(identityName)}</div><div class="chase-identity-role">${leading ? `New ${displayStage.label} leader` : `${displayStage.label} leader`}</div>`;
  $("chase-remaining").textContent = leading ? `+${formatNumber(Math.max(1, displayStage.lead))}` : formatNumber(current.remaining);
  $("chase-remaining").classList.toggle("is-leading", leading);
  $("chase-target-copy").textContent = leading ? "Ahead — extend your lead" : "Points to take the lead";
  $("chase-offline").classList.toggle("hidden", !state.chasePrepared?.offline);
  const adjusted = creditedChasePoints(rawCount);
  const weightedEl = $("chase-weighted-copy");
  weightedEl.classList.toggle("hidden", state.chaseMultiplier === 1);
  weightedEl.textContent = state.chaseMultiplier === 1 ? "" : `${rawCount} physical · ${adjusted} leaderboard points`;
  const thresholdPosition = 82;
  const fillPercent = leading ? 100 : Math.min(thresholdPosition, (adjusted / displayStage.pointsNeeded) * thresholdPosition);
  $("chase-tug-fill").style.width = `${fillPercent}%`;
  $("chase-you-label").textContent = "You";
  $("chase-rival-label").textContent = leading ? `${leader}, trailing` : leader;
  $("chase-session-count").textContent = `${formatNumber(rawCount)} pushup${rawCount === 1 ? "" : "s"} this session`;

  if (!announce || !previous) return null;
  if (progress.complete && !previous.complete) {
    launchConfetti("workout-confetti");
    state.chasePreviousLead = 0;
    return CHASE_TOOK_LEAD_LINE(leader, displayStage.label.toLowerCase());
  }
  if (progress.complete && progress.finalStage) {
    const milestone = crossedLeadMilestone(state.chasePreviousLead, progress.finalStage.lead);
    state.chasePreviousLead = progress.finalStage.lead;
    if (milestone) return milestone === 1
      ? "One point ahead. Crown acquired. Dignity optional."
      : CHASE_LEAD_MARGIN_LINE(milestone, leader);
  }
  if (current && adjusted > 0 && adjusted % 5 === 0) {
    return CHASE_GAP_LINES[Math.floor(adjusted / 5) % CHASE_GAP_LINES.length](current.remaining, leader, displayStage.label.toLowerCase());
  }
  if (rawCount >= state.chaseNextShoutAt) {
    state.chaseNextShoutAt = rawCount + 10 + Math.floor(Math.random() * 6);
    return pickFrom(CHASE_CHAOS_LINES);
  }
  return null;
}

async function startWorkout() {
  // Keep this synchronous with the tap so iOS unlocks audio before any
  // leaderboard refresh awaits below.
  if (soundIsEnabled()) unlockVoice();
  // Resolved once per session start (not once per pick) so "Random" draws a
  // fresh modifier every time — see resolveModifier in screens/modifiers.js.
  // Zen deliberately strips down feedback, so it never gets a modifier.
  state.resolvedModifier = state.pushupMode === "zen" ? null : resolveModifier(state.modifier);
  state.sessionLocation = currentSessionLocationSnapshot();
  if (state.pushupMode === "chase") {
    if (!state.chasePrepared?.eligible || state.chasePrepared.plan.user !== state.currentUser) await refreshChaseAvailability();
    if (!state.chasePrepared?.eligible) {
      toast("You’re leading every board. There’s nobody left to chase.", 3500);
      return;
    }
    state.chasePlan = JSON.parse(JSON.stringify(state.chasePrepared.plan));
    const chaseProfile = getWeightedProfile(state.currentUser);
    state.chaseMultiplier = chaseProfile.enabled && chaseProfile.bodyweightLbs > 0 ? weightedMultiplier(chaseProfile) : 1;
    state.chaseProgress = null;
    state.chasePreviousLead = 0;
    state.chaseNextShoutAt = 10 + Math.floor(Math.random() * 6);
  }
  if (state.pushupMode === "ladder") await refreshLadderRivals();
  // Warm every number this set could realistically reach so the first rep
  // (and every rep after it) plays with zero decode latency.
  try {
    preloadCountingRange(Math.max(60, (state.highScore || 0) + 40)).catch(() => {});
  } catch (e) { /* best-effort preload */ }
  if (state.pushupMode !== "zen") speak("Let's go");

  let stream;
  try {
    stream = await camera.requestStream();
    localStorage.setItem(LS.hasCameraStarted, "1");
    localStorage.removeItem(LS.cameraPermissionIssue);
  } catch (e) {
    localStorage.setItem(LS.cameraPermissionIssue, "1");
    toast("Camera access is required to count reps. Please allow camera permission.", 4000);
    return;
  }

  toast("Loading face detector…", 2000);
  try {
    await camera.ensureDetector();
  } catch (e) {
    toast("Couldn't load the face detection model. Check your connection and try again.", 4500);
    stream.getTracks().forEach((t) => t.stop());
    return;
  }

  const video = $("camera-video");
  video.srcObject = stream;
  try { await video.play(); } catch (e) { /* autoplay quirks */ }
  applyCameraPreviewSetting();

  await acquireWakeLock();

  state.highScore = getHighScore(state.currentUser);
  resetRepState();
  await setupWorkoutModeState();
  state.workoutActive = true;
  state.sessionStartedAt = new Date();
  $("workout-idle").classList.add("hidden");
  $("workout-active").classList.remove("hidden");
  setChromeMinimized(true);

  if (state.pushupMode === "ladder") {
    const openingRivalCallout = ladderRivalCallout(1);
    if (openingRivalCallout) speak(openingRivalCallout);
  }

  camera.startDetection();
}

// Sets up the per-mode session state (countdown target / first card) and
// the HUD to match, once the mode is locked in for this session.
async function setupWorkoutModeState() {
  state.countdownTarget = state.pushupMode === "countdown" ? state.highScore + 1 : 0;
  state.cardRepsDone = 0;
  state.cardsCleared = [];
  const isCards = state.pushupMode === "cards";
  if (isCards) {
    const first = drawNextCard();
    preloadCard(peekNextCard());
    state.currentCard = first;
    state.cardTarget = first.value;
    $("card-flip").classList.remove("flipped", "no-transition");
    setCardFace($("card-face-front"), first);
    setCardFace($("card-face-back"), first);
  } else {
    state.currentCard = null;
    state.cardTarget = 0;
  }
  $("cards-hud").classList.toggle("hidden", !isCards);
  $("cards-session-total").classList.toggle("hidden", !isCards);
  // Scopes the redesigned Classic/Countdown treatment (FAB complete button,
  // hero rep count) away from Cards mode, which is explicitly unchanged.
  $("workout-active").classList.toggle("mode-cards", isCards);

  state.pokerHandsCompleted = [];
  state.pokerAchievementsUnlocked = [];
  state.pokerResolving = false;
  const isPoker = state.pushupMode === "poker";
  if (isPoker) dealNextPokerHand();
  else {
    state.pokerHand = [];
    state.pokerCardIndex = 0;
    state.pokerCardTarget = 0;
    state.pokerCardRepsDone = 0;
  }
  $("poker-hud").classList.toggle("hidden", !isPoker);
  $("poker-session-total").classList.toggle("hidden", !isPoker);
  $("workout-active").classList.toggle("mode-poker", isPoker);

  state.diceRollsCleared = [];
  const isDice = state.pushupMode === "dice";
  if (isDice) {
    const first = rollDice();
    state.currentDice = first;
    state.diceTarget = first.sum;
    $("die-1").classList.remove("rolling");
    $("die-2").classList.remove("rolling");
    setDiceFaces(first);
  } else {
    state.currentDice = null;
    state.diceTarget = 0;
  }
  $("dice-hud").classList.toggle("hidden", !isDice);
  $("dice-session-total").classList.toggle("hidden", !isDice);

  const isWheel = state.pushupMode === "wheel";
  if (isWheel) {
    state.wheelTarget = 0;
    state.wheelRepsDone = 0;
    state.wheelLastTarget = 0;
    state.wheelSetModifier = null;
    state.wheelCue = null;
    state.wheelSpinning = false;
    state.wheelLandings = [];
    wheelRotationTotal = 0;
    initializeWheelDial();
    renderWheel();
    advanceWheelSpin(); // auto-spin the first set, no tap needed
  } else {
    state.wheelTarget = 0;
    state.wheelRepsDone = 0;
  }
  $("wheel-hud").classList.toggle("hidden", !isWheel);
  $("wheel-session-total").classList.toggle("hidden", !isWheel);
  $("wheel-progress-track").classList.toggle("hidden", !isWheel);
  $("wheel-progress-fill").style.width = "0%";

  const isLadder = state.pushupMode === "ladder";
  if (isLadder) {
    state.ladderRung = 1;
    state.ladderRepsDone = 0;
    state.ladderMaxRungCleared = 0;
    delete $("ladder-rung-window").dataset.renderKey;
  }
  $("ladder-hud").classList.toggle("hidden", !isLadder);
  $("ladder-session-total").classList.toggle("hidden", !isLadder);
  $("ladder-rivals-offline").classList.toggle("hidden", !isLadder || !state.ladderRivalsOffline);

  const isSharpshooter = state.pushupMode === "sharpshooter";
  if (isSharpshooter) await loadSharpshooterMode();
  clearTimeout(state.sharpshooterAnimationTimer);
  state.sharpshooterAnimationTimer = null;
  state.sharpshooterTargetsDestroyed = 0;
  state.sharpshooterLongestShot = 0;
  if (isSharpshooter) loadNextSharpshooterTarget();
  else {
    state.sharpshooterTarget = 0;
    state.sharpshooterRepsDone = 0;
  }
  $("sharpshooter-target").classList.remove("rep-hit", "bullseye");
  $("sharpshooter-hud").classList.toggle("hidden", !isSharpshooter);
  $("workout-active").classList.toggle("mode-sharpshooter", isSharpshooter);

  const isPyramid = state.pushupMode === "pyramid";
  if (isPyramid) await loadPyramidMode();
  if (isPyramid) {
    state.pyramidRow = state.pyramidSize;
    state.pyramidRepsDone = 0;
    state.pyramidPhase = "descending";
    state.pyramidPeakReached = false;
    state.pyramidCompleted = false;
    state.pyramidTotalReps = pyramidMode.pyramidTotalReps(state.pyramidSize, state.pyramidDirection);
    delete $("pyramid-window").dataset.renderKey;
    renderPyramidWindow();
  }
  $("pyramid-hud").classList.toggle("hidden", !isPyramid);
  $("pyramid-session-total").classList.toggle("hidden", !isPyramid);

  const isHorse = state.pushupMode === "horse";
  if (isHorse) renderHorseTurnHero();
  $("horse-hud").classList.toggle("hidden", !isHorse);
  $("horse-session-total").classList.toggle("hidden", !isHorse);
  if (isHorse) $("horse-session-total").textContent = "Live count: 0";

  // Fortune Cookie is the odd one out: it reuses Classic's own giant hero
  // number and rep counting unchanged (the challenge was already picked and
  // shown during the idle-screen reveal, not here) — except No Looking and
  // Silent Set, which hide the counter until Complete, and Silent Set, which
  // additionally quiets the high-score callout.
  const isFortune = state.pushupMode === "fortune";
  let fortuneChallengeConfig = null;
  if (isFortune) {
    if (!state.fortuneChallenge) state.fortuneChallenge = await pickFortuneChallenge(state.currentUser); // safety net
    const c = state.fortuneChallenge ? state.fortuneChallenge.challenge : null;
    fortuneChallengeConfig = c;
    $("fortune-session-total").textContent = c ? c.title : "";
  }
  $("fortune-session-total").classList.toggle("hidden", !isFortune);

  const hud = workoutHudModel(state.pushupMode, state.highScore, fortuneChallengeConfig);
  $("chase-hud").classList.toggle("hidden", !hud.chase);
  if (hud.chase) renderChaseProgress(0);

  // Classic/Countdown keep the giant hero number; Cards', Dice's, and
  // Ladder's focal point is their own visual, so the number/label live only
  // in the subordinate line for those three. Fortune keeps it too, unless
  // its own challenge specifically hides it.
  $("workout-active").classList.toggle("mode-zen", hud.zen);
  $("rep-count").classList.toggle("hidden", hud.hideHero);
  $("rep-label").classList.toggle("hidden", hud.hideHero);
  // Dice's own subordinate line already carries the meaningful number, so
  // the high-score countdown (Classic/Countdown framing) doesn't fit there;
  // Silent Set asks for the same quieting on top of hiding the counter.
  $("highscore-message").classList.toggle("hidden", hud.hideHighscore);
  $("thermometer-wrap").classList.toggle("hidden", hud.hideThermometer);
  renderHeroForCount(0);

  const modifierPicked = state.resolvedModifier ? MODIFIERS.find((m) => m.id === state.resolvedModifier) : null;
  $("modifier-cue").classList.toggle("hidden", !modifierPicked);
  if (modifierPicked) {
    $("modifier-cue-icon").textContent = modifierPicked.icon;
    $("modifier-cue-label").textContent = modifierPicked.cueLabel;
    $("modifier-cue-sub").textContent = modifierPicked.cueSub;
  }
}

function stopCameraAndDetection() {
  camera.stop();
}

function stopWorkoutHard() {
  clearTimeout(state.sharpshooterAnimationTimer);
  state.sharpshooterAnimationTimer = null;
  stopCameraAndDetection();
  releaseWakeLock();
  state.workoutActive = false;
  $("workout-active").classList.add("hidden");
  $("workout-idle").classList.remove("hidden");
  setChromeMinimized(false);
}

let lastFunMessageIndex = -1;
function pickFunMessage(n) {
  let idx;
  do {
    idx = Math.floor(Math.random() * FUN_MESSAGES.length);
  } while (idx === lastFunMessageIndex && FUN_MESSAGES.length > 1);
  lastFunMessageIndex = idx;
  return FUN_MESSAGES[idx](n);
}

const CONFETTI_EMOJI = ["🎉", "💪", "🔥", "⭐", "🏆", "😤", "🚀", "👑"];
const PLANK_EMOJI = ["🪵", "🪓", "🧱", "📏", "🪚"];
function launchConfetti(targetId = "confetti", emojiSet = CONFETTI_EMOJI, pieceCount = 24) {
  const el = $(targetId);
  el.innerHTML = "";
  for (let i = 0; i < pieceCount; i++) {
    const span = document.createElement("span");
    span.className = "confetti-piece";
    span.textContent = emojiSet[Math.floor(Math.random() * emojiSet.length)];
    span.style.left = `${Math.random() * 100}%`;
    span.style.fontSize = `${1 + Math.random() * 1.2}rem`;
    span.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
    span.style.animationDelay = `${Math.random() * 0.4}s`;
    el.appendChild(span);
  }
  clearTimeout(launchConfetti._t);
  launchConfetti._t = setTimeout(() => { el.innerHTML = ""; }, 4000);
}

// Detects whether the just-logged session is the specific moment a user
// breaks their own PR in an active "pr" challenge they're enrolled in — i.e.
// no earlier in-window session already beat their baseline, but this one
// does. Guards against re-firing the celebration on every session after the
// PR is already broken. Only the first matching challenge is reported (an
// exceedingly rare edge case if multiple "pr" windows overlap).
function detectPrAchievement(session) {
  const now = new Date();
  const activeChallenges = challengeDefs.filter(
    (c) => c.goalType === "pr" && challengeStatus(c, now) === "active" && challengeParticipantsOf(c).includes(state.currentUser)
  );
  for (const c of activeChallenges) {
    const { startDate } = challengeWindow(c);
    const baseline = userPriorBestSet(state.currentUser, startDate);
    const priorSessionsInWindow = challengeSessions(c).filter((s) => s.user === state.currentUser && s.id !== session.id);
    const alreadyAchieved = priorSessionsInWindow.some((s) => s.count > baseline);
    if (!alreadyAchieved && session.count > baseline) {
      return { title: c.title, newCount: session.count, oldBest: baseline };
    }
  }
  return null;
}

// Horse's completion flow branches off completeWorkout entirely — it saves a
// real session (so it counts toward stats/streaks like every other mode, see
// HORSE_PLAN.md) but then routes into the game's own letter/turn-order/
// summary screens instead of the shared screen-summary.
async function completeHorseTurn(rawCount) {
  clearTimeout(state.sharpshooterAnimationTimer);
  state.sharpshooterAnimationTimer = null;
  stopCameraAndDetection();
  await releaseWakeLock();
  state.workoutActive = false;
  $("workout-active").classList.add("hidden");
  $("workout-idle").classList.remove("hidden");

  const game = state.horseGame;
  const user = currentTurnPlayer(game);
  const lettersBefore = game.players[user].letters;

  const session = {
    id: uuid(),
    user,
    timestamp: new Date().toISOString(),
    count: rawCount,
    avatar: avatarForUser(user).id,
    startedAt: state.sessionStartedAt ? state.sessionStartedAt.toISOString() : undefined,
    mode: "horse",
    horseGameId: game.id,
    horseTarget: game.target,
    ...(state.sessionLocation ? { location: state.sessionLocation } : {}),
  };
  const cached = getCachedData();
  cached.sessions.push(session);
  cacheData(cached);
  try { await commitSession(session); } catch (e) { enqueueSession(session); }

  let updated;
  if (game.sessionType === "invite") {
    try {
      const res = await workerPostHorseTurn({ gameId: game.id, user, reps: rawCount });
      updated = res.game;
    } catch (e) {
      // Best-effort local fallback so this device's UI still progresses —
      // the server stays the source of truth and the next successful
      // refresh (see openHorseTurnOrder) reconciles it.
      toast("Couldn't sync your set — check your connection. Your view may be out of date until it reconnects.", 5000);
      updated = applyTurn(game, { user, reps: rawCount, now: Date.now() });
    }
  } else {
    updated = applyTurn(game, { user, reps: rawCount, now: Date.now() });
  }
  state.horseGame = updated;
  upsertLocalHorseGame(updated);

  const gotLetter = updated.players[user].letters > lettersBefore;
  if (gotLetter) {
    state.horseLetterEvent = {
      forUser: user,
      needed: game.target,
      reps: rawCount,
      lettersLeft: 5 - updated.players[user].letters,
      justWentOut: updated.players[user].out,
    };
    renderHorseLetterScreen();
    showScreen("screen-horse-letter");
    return;
  }
  if (updated.status === "complete") {
    renderHorseSummary();
    showScreen("screen-horse-summary");
    return;
  }
  await openHorseTurnOrder();
}

async function completeWorkout() {
  const rawCount = repState.count;
  if (state.pushupMode === "horse") {
    await completeHorseTurn(rawCount);
    return;
  }
  const isZen = state.pushupMode === "zen";
  clearTimeout(state.sharpshooterAnimationTimer);
  state.sharpshooterAnimationTimer = null;
  stopCameraAndDetection();
  await releaseWakeLock();
  state.workoutActive = false;
  $("workout-active").classList.add("hidden");
  $("workout-idle").classList.remove("hidden");

  const profile = getWeightedProfile(state.currentUser);
  const weighted = profile.enabled && profile.bodyweightLbs > 0;
  const multiplier = weighted ? weightedMultiplier(profile) : 1;
  const count = weighted ? Math.round(rawCount * multiplier) : rawCount;
  const chaseSessionProgress = state.pushupMode === "chase" && state.chasePlan
    ? chaseProgress(state.chasePlan, count)
    : null;
  const chaseTarget = chaseSessionProgress?.target || null;

  const session = {
    id: uuid(),
    user: state.currentUser,
    timestamp: new Date().toISOString(),
    count,
    avatar: state.currentAvatar,
    startedAt: state.sessionStartedAt ? state.sessionStartedAt.toISOString() : undefined,
    ...(weighted ? { rawCount, weightLbs: profile.addedWeightLbs || 0 } : {}),
    ...(state.pushupMode !== "classic" ? { mode: state.pushupMode } : {}),
    ...(state.pushupMode === "ladder" ? { ladderMaxRung: state.ladderMaxRungCleared } : {}),
    ...(state.pushupMode === "pyramid" ? {
      pyramidSize: state.pyramidSize,
      pyramidDirection: state.pyramidDirection,
      pyramidPeakReached: state.pyramidPeakReached,
      pyramidCompleted: state.pyramidCompleted,
    } : {}),
    ...(state.pushupMode === "sharpshooter" ? {
      sharpshooterTargetsDestroyed: state.sharpshooterTargetsDestroyed,
      sharpshooterLongestShot: state.sharpshooterLongestShot,
      sharpshooterCurrentTarget: state.sharpshooterTarget,
      sharpshooterCurrentProgress: state.sharpshooterRepsDone,
    } : {}),
    ...(state.pushupMode === "countdown" ? {
      countdownTarget: state.countdownTarget,
      countdownBeat: count >= state.countdownTarget,
    } : {}),
    ...(state.pushupMode === "cards" ? {
      cardsCleared: state.cardsCleared.length,
      cardsClearedValue: state.cardsCleared.reduce((total, card) => total + (Number(card.value) || 0), 0),
    } : {}),
    ...(state.pushupMode === "poker" ? {
      pokerHandsCompleted: state.pokerHandsCompleted.length,
      ...(state.pokerHandsCompleted.length ? { pokerBestRank: bestPokerRank(state.pokerHandsCompleted) } : {}),
      pokerPremiumHands: state.pokerHandsCompleted.filter((hand) => hand.premium).length,
      pokerHandRanks: state.pokerHandsCompleted.map((hand) => hand.rank),
      pokerAchievementsUnlocked: [...new Set(state.pokerAchievementsUnlocked)],
    } : {}),
    ...(state.pushupMode === "dice" ? {
      diceRollsCleared: state.diceRollsCleared.length,
      diceRollsClearedValue: state.diceRollsCleared.reduce((total, roll) => total + (Number(roll.sum) || 0), 0),
    } : {}),
    ...(state.pushupMode === "fortune" && state.fortuneChallenge ? {
      fortuneChallengeId: state.fortuneChallenge.challenge.id,
      ...(state.fortuneChallenge.gripSide ? { fortuneGripSide: state.fortuneChallenge.gripSide } : {}),
    } : {}),
    ...(chaseSessionProgress && chaseTarget ? {
      chasePeriod: chaseTarget.id,
      chaseRival: chaseTarget.leaderNames?.[0] || "",
      chasePointsNeeded: chaseTarget.pointsNeeded,
      chaseOvertaken: chaseSessionProgress.complete,
      chaseRemaining: chaseSessionProgress.current?.remaining || 0,
      chaseFinalLead: chaseSessionProgress.complete ? Math.max(1, chaseTarget.lead) : 0,
    } : {}),
    ...(state.sessionLocation ? { location: state.sessionLocation } : {}),
    ...(state.resolvedModifier ? { modifier: state.resolvedModifier } : {}),
  };

  // Optimistically reflect it locally right away so it shows up immediately.
  const cached = getCachedData();
  cached.sessions.push(session);
  cacheData(cached);
  state.summaryPrAchieved = detectPrAchievement(session);
  state.summaryRoadtripConquests = detectRoadtripConquests(getAllSessionsForDisplay(), session.id);

  const message = pickFunMessage(count);
  state.lastSessionType = "pushup";
  state.summarySessionId = session.id;
  state.summaryBaseCount = rawCount;
  state.summaryExtra = 0;
  state.summaryMultiplier = multiplier;
  state.summaryWeightLbs = weighted ? (profile.addedWeightLbs || 0) : 0;
  state.summaryChaseResult = null;
  if (state.pushupMode === "chase" && state.chasePlan) {
    state.summaryChaseResult = chaseSummaryResult(chaseSessionProgress);
  }
  $("summary-count").textContent = formatNumber(count);
  $("missed-reps-count").textContent = "0";
  $("missed-reps-wrap").classList.remove("hidden");
  renderSummaryWeightedNote(rawCount, count);
  renderSummaryChaseResult();
  renderSummaryRoadtripResult();
  $("summary-sync-status").textContent = "";
  preloadWorkoutShareMessages();
  showScreen("screen-summary");
  launchConfetti("confetti", isZen ? ["🪷", "🍃", "·"] : CONFETTI_EMOJI, isZen ? 12 : 24);
  const chaseFinish = state.summaryChaseResult;
  if (isZen) {
    const voiceDelay = soundIsEnabled() ? playZenGong() : 0;
    // speakZen(), not speakCalm directly — the "zen" tone clip (see
    // voice-lines.js) now carries the quieter character this line always
    // wanted; speakCalm is only the last-resort net if that clip somehow
    // isn't available yet.
    setTimeout(() => speakZen(zenCompletionLine(count)), voiceDelay);
  } else speak(chaseFinish
    ? chaseFinish.finalLead > 0
      ? CHASE_FINISH_AHEAD_LINE(chaseFinish.finalLead, chaseFinish.rival, chaseFinish.finalStage)
      : CHASE_FINISH_BEHIND_LINE(chaseFinish.remaining, chaseFinish.rival, chaseFinish.currentStage)
    : `Session complete. ${message}`);

  try {
    await commitSession(session);
  } catch (e) {
    enqueueSession(session);
    $("summary-sync-status").textContent = "Saved on this device — will sync automatically when back online.";
  }
}

function renderSummaryChaseResult() {
  const el = $("summary-chase-result");
  const result = state.summaryChaseResult;
  if (!result) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.classList.remove("hidden");
  el.textContent = chaseSummaryText(result);
}

function renderSummaryWeightedNote(rawTotal, adjustedTotal) {
  const el = $("summary-weighted-note");
  if (state.summaryMultiplier === 1) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.classList.remove("hidden");
  el.textContent = weightedSummaryText({ weightLbs: state.summaryWeightLbs, rawTotal, multiplier: state.summaryMultiplier, adjustedTotal, formatNumber });
}

function adjustMissedReps(delta) {
  if (!state.summarySessionId) return;
  const nextExtra = state.summaryExtra + delta;
  if (state.summaryBaseCount + nextExtra < 0) return;
  state.summaryExtra = nextExtra;
  $("missed-reps-count").textContent = String(state.summaryExtra);
  const { rawTotal, adjustedTotal: newTotal } = correctedSummaryTotals(state.summaryBaseCount, state.summaryExtra, state.summaryMultiplier);
  $("summary-count").textContent = formatNumber(newTotal);
  renderSummaryWeightedNote(rawTotal, newTotal);
  if (state.summaryChaseResult && state.chasePlan) {
    const result = chaseProgress(state.chasePlan, newTotal);
    state.summaryChaseResult = chaseSummaryResult(result);
    renderSummaryChaseResult();
  }

  const cached = getCachedData();
  const cachedSession = cached.sessions.find((s) => s.id === state.summarySessionId);
  if (cachedSession) {
    cachedSession.count = newTotal;
    if (state.summaryMultiplier !== 1) {
      cachedSession.rawCount = rawTotal;
      cachedSession.weightLbs = state.summaryWeightLbs;
    }
    cacheData(cached);
  }
  refreshSummaryRoadtripConquests();
  scheduleSummaryReconcile();
}

function scheduleSummaryReconcile() {
  clearTimeout(summaryReconcileTimer);
  summaryReconcileTimer = setTimeout(reconcileSummaryCount, 900);
}

// The Worker's /session endpoint only inserts (no update), so a corrected
// count is synced by deleting the old session id and creating a fresh one.
// If the original never made it past the local queue yet, just patch it
// in place instead — no remote write to undo.
async function reconcileSummaryCount() {
  const id = state.summarySessionId;
  if (!id) return;
  const rawTotal = state.summaryBaseCount + state.summaryExtra;
  const newTotal = Math.round(rawTotal * state.summaryMultiplier);
  const weighted = state.summaryMultiplier !== 1;
  const correctedChase = state.chasePlan ? chaseProgress(state.chasePlan, newTotal) : null;
  const correctedChaseFields = correctedChase?.target ? {
    chaseOvertaken: correctedChase.complete,
    chaseRemaining: correctedChase.current?.remaining || 0,
    chaseFinalLead: correctedChase.complete ? Math.max(1, correctedChase.target.lead) : 0,
  } : {};

  const queue = getQueue();
  const queuedIdx = queue.findIndex((operation) => operation.type === "session" && operation.payload?.id === id);
  if (queuedIdx !== -1) {
    queue[queuedIdx] = {
      ...queue[queuedIdx],
      payload: {
        ...queue[queuedIdx].payload,
        count: newTotal,
        ...(weighted ? { rawCount: rawTotal, weightLbs: state.summaryWeightLbs } : {}),
        ...(queue[queuedIdx].payload?.countdownTarget ? { countdownBeat: newTotal >= queue[queuedIdx].payload.countdownTarget } : {}),
        ...correctedChaseFields,
      },
    };
    setQueue(queue);
    refreshSummaryRoadtripConquests();
    return;
  }

  const cached = getCachedData();
  const idx = cached.sessions.findIndex((s) => s.id === id);
  const existing = idx !== -1 ? cached.sessions[idx] : null;
  const newSession = {
    ...(existing || {}),
    id: uuid(),
    user: existing?.user || state.currentUser,
    timestamp: existing?.timestamp || new Date().toISOString(),
    count: newTotal,
    avatar: existing?.avatar || state.currentAvatar,
    startedAt: existing?.startedAt,
    ...(weighted ? { rawCount: rawTotal, weightLbs: state.summaryWeightLbs } : {}),
    ...(existing?.countdownTarget ? { countdownBeat: newTotal >= existing.countdownTarget } : {}),
    ...correctedChaseFields,
  };
  if (idx !== -1) cached.sessions[idx] = newSession;
  else cached.sessions.push(newSession);
  cacheData(cached);
  state.summarySessionId = newSession.id;
  refreshSummaryRoadtripConquests();

  try {
    await deleteSessionRemote(id);
  } catch (e) {
    // best effort — worst case a stale duplicate lingers until the next reconcile
  }
  try {
    await commitSession(newSession);
  } catch (e) {
    enqueueSession(newSession);
  }
}

$("btn-missed-plus").addEventListener("click", () => adjustMissedReps(1));
$("btn-missed-minus").addEventListener("click", () => adjustMissedReps(-1));

$("btn-start").addEventListener("click", startWorkout);
$("btn-complete").addEventListener("click", completeWorkout);
$("fortune-cookie-tap").addEventListener("click", revealFortune);
$("btn-fortune-start-set").addEventListener("click", startWorkout);


// ---- Cards mode share ----

const SUIT_EMOJI = { spades: "♠️", hearts: "♥️", diamonds: "♦️", clubs: "♣️" };

// Summarises which cards were actually cleared this session so the share
// message can brag about the specific ones (kings, aces, face cards) rather
// than just a rep total.
function buildCardsShareContext() {
  const cleared = state.cardsCleared || [];
  const by = (fn) => cleared.filter(fn).length;
  const suits = {};
  for (const c of cleared) suits[c.suit] = (suits[c.suit] || 0) + 1;
  const topSuit = Object.keys(suits).sort((a, b) => suits[b] - suits[a])[0] || null;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  return {
    cards: cleared.length,
    cardsText: plural(cleared.length, "card"),
    kings: by((c) => c.label === "K"),
    queens: by((c) => c.label === "Q"),
    jacks: by((c) => c.label === "J"),
    aces: by((c) => c.label === "A"),
    faces: by((c) => ["J", "Q", "K"].includes(c.label)),
    topSuit,
    topSuitEmoji: topSuit ? SUIT_EMOJI[topSuit] : "",
    topSuitCount: topSuit ? suits[topSuit] : 0,
    plural,
  };
}

function buildPokerShareContext() {
  const hands = state.pokerHandsCompleted || [];
  const bestRank = bestPokerRank(hands);
  return {
    hands: hands.length,
    handsText: `${hands.length} hand${hands.length === 1 ? "" : "s"}`,
    bestRank,
    bestHand: POKER_HANDS[bestRank] || "High Card",
  };
}

// ---- Dice mode share ----

// Summarises the rolls actually cleared this session — craps-table trivia
// (doubles, snake eyes, boxcars, sevens) so the share message can brag about
// specifics instead of just a rep total. Mirrors buildCardsShareContext.
function buildDiceShareContext() {
  const cleared = state.diceRollsCleared || [];
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  return {
    rolls: cleared.length,
    rollsText: plural(cleared.length, "roll"),
    doubles: cleared.filter((d) => d.a === d.b).length,
    snakeEyes: cleared.filter((d) => d.sum === 2).length,
    boxcars: cleared.filter((d) => d.sum === 12).length,
    sevens: cleared.filter((d) => d.sum === 7).length,
    plural,
  };
}

// ---- Ladder mode share ----

// isNewBest compares against every other Ladder session (excluding the one
// that was just saved) so it doesn't trivially "beat" itself.
function buildLadderShareContext() {
  const maxRung = state.ladderMaxRungCleared || 0;
  const priorSessions = getAllSessionsForDisplay()
    .filter((s) => s.id !== state.summarySessionId);
  const priorBest = priorSessions
    .filter((s) => s.user === state.currentUser && s.mode === "ladder" && s.id !== state.summarySessionId)
    .reduce((max, s) => Math.max(max, s.ladderMaxRung || 0), 0);
  const passedRivals = buildLadderRivals(priorSessions, state.currentUser)
    .filter((rival) => rival.rung < maxRung)
    .sort((a, b) => b.rung - a.rung)
    .flatMap((rival) => rival.names);
  return { maxRung, isNewBest: maxRung > 0 && maxRung > priorBest, passedRivals };
}

function buildSharpshooterShareContext() {
  const targets = state.sharpshooterTargetsDestroyed || 0;
  return {
    targets,
    targetsText: `${targets} target${targets === 1 ? "" : "s"}`,
    longestShot: state.sharpshooterLongestShot || 0,
    currentTarget: state.sharpshooterTarget || 0,
    currentProgress: state.sharpshooterRepsDone || 0,
    remaining: Math.max(0, (state.sharpshooterTarget || 0) - (state.sharpshooterRepsDone || 0)),
  };
}

function buildPyramidShareContext() {
  const sizeLabel = (pyramidMode.PYRAMID_SIZES.find((tier) => tier.base === state.pyramidSize) || {}).label || "";
  return {
    pyramidSize: state.pyramidSize,
    pyramidSizeLabel: sizeLabel,
    pyramidDirectionLabel: state.pyramidDirection === "updown" ? "Up & down" : "Up only",
    completed: state.pyramidCompleted,
    peakReached: state.pyramidPeakReached,
  };
}

function renderSummaryRoadtripResult() {
  const cue = $("summary-roadtrip-cue");
  const wins = state.summaryRoadtripConquests || [];
  if (!wins.length) {
    cue.classList.add("hidden");
    cue.textContent = "";
    return;
  }
  cue.classList.remove("hidden");
  const label = wins.length === 1
    ? `${wins[0].flag ? `${wins[0].flag} ` : ""}${escapeHtml(wins[0].name)}`
    : `${wins.length} territories`;
  cue.innerHTML = `<span class="cue-icon" aria-hidden="true">🏆</span>${label} taken — tap to share`;
}

function refreshSummaryRoadtripConquests() {
  state.summaryRoadtripConquests = state.summarySessionId
    ? detectRoadtripConquests(getAllSessionsForDisplay(), state.summarySessionId)
    : [];
  renderSummaryRoadtripResult();
}

function buildShareContext(adjustedCount) {
  const isPlank = state.lastSessionType === "plank";
  const isSquat = state.lastSessionType === "squat";
  const isPushup = !isPlank && !isSquat;
  const mine = indexedSessionsForUser(state.currentUser, isPlank ? "planks" : isSquat ? "squats" : "pushups");
  const weekStart = periodStart("week");
  const weekStartTime = weekStart.getTime();
  const weekTotalRaw = mine
    .filter((s) => sessionTimestamp(s) >= weekStartTime)
    .reduce((sum, s) => sum + s.count, 0);
  return {
    mode: isPlank ? "plank" : isSquat ? "squat" : state.pushupMode,
    isPlank,
    isSquat,
    isZen: isPushup && state.pushupMode === "zen",
    streak: computeStreak(mine),
    weekTotalRaw,
    weekTotalDisplay: isPlank ? formatDuration(weekTotalRaw * 1000) : formatNumber(weekTotalRaw),
    cardsCtx: (isPushup && state.pushupMode === "cards") ? buildCardsShareContext() : null,
    pokerCtx: (isPushup && state.pushupMode === "poker") ? buildPokerShareContext() : null,
    diceCtx: (isPushup && state.pushupMode === "dice") ? buildDiceShareContext() : null,
    sharpshooterCtx: (isPushup && state.pushupMode === "sharpshooter") ? buildSharpshooterShareContext() : null,
    ladderCtx: (isPushup && state.pushupMode === "ladder") ? buildLadderShareContext() : null,
    pyramidCtx: (isPushup && state.pushupMode === "pyramid") ? buildPyramidShareContext() : null,
    countdownCtx: (isPushup && state.pushupMode === "countdown") ? {
      target: state.countdownTarget,
      beat: adjustedCount >= state.countdownTarget,
      margin: Math.max(0, adjustedCount - state.countdownTarget),
      remaining: Math.max(0, state.countdownTarget - adjustedCount),
    } : null,
    fortuneCtx: (isPushup && state.pushupMode === "fortune" && state.fortuneChallenge) ? {
      title: state.fortuneChallenge.challenge.title,
      target: state.fortuneChallenge.target,
      beatTarget: state.fortuneChallenge.target == null ? null : adjustedCount >= state.fortuneChallenge.target,
      remaining: state.fortuneChallenge.target == null ? 0 : Math.max(0, state.fortuneChallenge.target - adjustedCount),
      gripSide: state.fortuneChallenge.gripSide,
    } : null,
    weightedCtx: state.summaryMultiplier !== 1 ? {
      weightLbs: state.summaryWeightLbs,
      rawCount: state.summaryBaseCount + state.summaryExtra,
    } : null,
    prCtx: isPushup ? state.summaryPrAchieved : null,
  };
}

let workoutShareMessages = null;
let workoutShareMessagesPromise = null;
function preloadWorkoutShareMessages() {
  if (!workoutShareMessagesPromise) {
    workoutShareMessagesPromise = import("./share-messages.js?v=134").then((module) => {
      workoutShareMessages = module;
      return module;
    });
  }
  return workoutShareMessagesPromise;
}

async function shareFlex() {
  const { pickChaseShareMessage, pickShareMessage } = workoutShareMessages || await preloadWorkoutShareMessages();
  const count = $("summary-count").textContent;
  const adjustedCount = Number(count.replace(/,/g, ""));
  const ctx = buildShareContext(adjustedCount);
  const chase = state.summaryChaseResult;
  const message = chase ? pickChaseShareMessage(count, chase, ctx) : pickShareMessage(count, ctx);
  const url = location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Boys Pushup Bonanza", text: message, url });
    } catch (e) {
      // user cancelled the share sheet — not an error
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${message} ${url}`);
    toast("Copied to clipboard — paste it in the group chat!");
  } catch (e) {
    toast("Couldn't share automatically — copy your result manually.", 4000);
  }
}

async function shareRoadtripConquest() {
  const wins = state.summaryRoadtripConquests || [];
  if (!wins.length) return;
  const message = roadtripConquestShareMessage(state.currentUser, wins);
  const url = location.href;
  if (navigator.share) {
    try { await navigator.share({ title: "Roadtrip conquered", text: message, url }); } catch (e) { /* cancelled */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${message} ${url}`);
    toast("Conquest copied — go ruin someone's day.");
  } catch (e) {
    toast("Couldn't share automatically.", 4000);
  }
}

$("btn-summary-again").addEventListener("click", () => {
  const screenByType = { plank: "screen-plank-workout", squat: "screen-squat-workout" };
  showScreen(screenByType[state.lastSessionType] || "screen-workout");
});
$("btn-summary-share").addEventListener("click", shareFlex);
$("summary-roadtrip-cue").addEventListener("click", shareRoadtripConquest);

// ------------------- plank mode (hidden easter egg) -------------------

$("mascot-badge").addEventListener("click", () => {
  if (localStorage.getItem(LS.plankUnlocked) === "1") {
    showScreen("screen-plank-workout");
    return;
  }
  localStorage.setItem(LS.plankUnlocked, "1");
  showScreen("screen-plank-unlock");
  launchConfetti("plank-unlock-confetti", PLANK_EMOJI);
  if (soundIsEnabled()) unlockVoice();
  speak("Hidden plank mode unlocked!");
  setTimeout(() => showScreen("screen-plank-workout"), 2800);
});

function updatePlankThermometer(seconds) {
  const wrap = $("plank-thermometer-wrap");
  if (!state.plankBest) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  const fill = $("plank-thermometer-fill");
  const pct = Math.min(100, Math.round((seconds / state.plankBest) * 100));
  fill.style.width = `${pct}%`;
  fill.classList.toggle("thermometer-win", seconds > state.plankBest);
}

function updatePlankHighscoreMessage(seconds) {
  const el = $("plank-highscore-message");
  if (!state.plankBest) {
    el.textContent = "";
    return;
  }
  const remaining = state.plankBest - seconds;
  if (remaining > 0) {
    el.textContent = `${remaining} second${remaining === 1 ? "" : "s"} away from your best plank!`;
  } else if (remaining === 0) {
    el.textContent = "Tied your best plank — hold on!";
  } else {
    el.textContent = "New plank record! 🔥";
  }
}

function stopPlankInterval() {
  if (plankState.intervalId) {
    clearInterval(plankState.intervalId);
    plankState.intervalId = null;
  }
}

// Same shape as maybeEncourage, but for plank seconds instead of pushup reps,
// with a longer cooldown since ticks are once per second rather than per rep.
function maybeEncouragePlank(seconds) {
  if (!state.plankBest || state.plankBest <= 1) return null;
  if (seconds - plankState.lastCheerAtSecond < 5) return null;
  if (Math.random() < cheerProbability(seconds / state.plankBest)) {
    plankState.lastCheerAtSecond = seconds;
    return pickFrom(ENCOURAGE_LINES);
  }
  return null;
}

async function startPlank() {
  if (soundIsEnabled()) unlockVoice();
  state.plankSessionLocation = currentSessionLocationSnapshot();
  state.plankBest = getPlankBest(state.currentUser);
  plankState.seconds = 0;
  plankState.lastCheerAtSecond = 0;
  plankState.recordBroken = false;
  $("plank-timer").textContent = "0:00";
  updatePlankThermometer(0);
  updatePlankHighscoreMessage(0);
  hideStatusBanner();

  await acquireWakeLock();

  state.plankActive = true;
  state.plankStartedAt = new Date();
  $("plank-idle").classList.add("hidden");
  $("plank-active").classList.remove("hidden");
  setChromeMinimized(true);

  stopPlankInterval();
  plankState.intervalId = setInterval(() => {
    plankState.seconds += 1;
    $("plank-timer").textContent = formatDuration(plankState.seconds * 1000);
    updatePlankThermometer(plankState.seconds);
    updatePlankHighscoreMessage(plankState.seconds);
    if (state.plankBest && plankState.seconds === state.plankBest + 1 && !plankState.recordBroken) {
      plankState.recordBroken = true;
      launchConfetti("plank-confetti", PLANK_EMOJI);
      speak("New plank record! Absolute legend!");
    } else {
      const cheer = maybeEncouragePlank(plankState.seconds);
      if (cheer) speak(cheer);
    }
  }, 1000);
}

function stopPlankHard() {
  stopPlankInterval();
  releaseWakeLock();
  state.plankActive = false;
  $("plank-active").classList.add("hidden");
  $("plank-idle").classList.remove("hidden");
  setChromeMinimized(false);
}

let lastPlankFunMessageIndex = -1;
function pickPlankFunMessage(s) {
  let idx;
  do {
    idx = Math.floor(Math.random() * FUN_MESSAGES_PLANK.length);
  } while (idx === lastPlankFunMessageIndex && FUN_MESSAGES_PLANK.length > 1);
  lastPlankFunMessageIndex = idx;
  return FUN_MESSAGES_PLANK[idx](s);
}

async function completePlank() {
  const seconds = plankState.seconds;
  stopPlankInterval();
  await releaseWakeLock();
  state.plankActive = false;
  $("plank-active").classList.add("hidden");
  $("plank-idle").classList.remove("hidden");

  const session = {
    id: uuid(),
    user: state.currentUser,
    timestamp: new Date().toISOString(),
    count: seconds,
    avatar: state.currentAvatar,
    startedAt: state.plankStartedAt ? state.plankStartedAt.toISOString() : undefined,
    type: "plank",
    ...(state.plankSessionLocation ? { location: state.plankSessionLocation } : {}),
  };

  // Optimistically reflect it locally right away so it shows up immediately.
  const cached = getCachedData();
  cached.sessions.push(session);
  cacheData(cached);

  const message = pickPlankFunMessage(seconds);
  state.lastSessionType = "plank";
  state.summarySessionId = null;
  state.summaryMultiplier = 1;
  state.summaryWeightLbs = 0;
  state.summaryPrAchieved = null;
  state.summaryChaseResult = null;
  state.summaryRoadtripConquests = [];
  $("summary-count").textContent = formatDuration(seconds * 1000);
  $("missed-reps-wrap").classList.add("hidden");
  $("summary-weighted-note").classList.add("hidden");
  renderSummaryChaseResult();
  renderSummaryRoadtripResult();
  $("summary-sync-status").textContent = "";
  preloadWorkoutShareMessages();
  showScreen("screen-summary");
  launchConfetti("confetti", PLANK_EMOJI);
  speak(`Plank complete. ${message}`);

  try {
    await commitSession(session);
  } catch (e) {
    enqueueSession(session);
    $("summary-sync-status").textContent = "Saved on this device — will sync automatically when back online.";
  }
}

$("btn-plank-start").addEventListener("click", startPlank);
$("btn-plank-stop").addEventListener("click", completePlank);

// ------------------- squat mode -------------------
// Camera-counted free set, own screen (see docs/squat-mode-plan.md): a 2-tap
// calibration (stand tall, hold a squat) derives per-session thresholds —
// wall tilt/distance make an absolute default unreliable — then reuses
// createRepCounter unchanged, same as pushups, just fed bboxCenterY/
// videoHeight instead of face size. camera.js/rep-counter.js are shared
// modules, not forked; this is its own controller instance because
// createCameraController bakes its callbacks in at construction and the
// pushup/plank/squat screens are never active at the same time.

function updateSquatFaceBox(bbox) {
  const video = $("squat-camera-video");
  const container = document.querySelector("#screen-squat-workout .camera-wrap");
  const cw = container.clientWidth, ch = container.clientHeight;
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.max(cw / vw, ch / vh);
  const offsetX = (cw - vw * scale) / 2, offsetY = (ch - vh * scale) / 2;
  const box = $("squat-face-box");
  box.style.left = `${bbox.originX * scale + offsetX}px`;
  box.style.top = `${bbox.originY * scale + offsetY}px`;
  box.style.width = `${bbox.width * scale}px`;
  box.style.height = `${bbox.height * scale}px`;
  box.classList.remove("hidden");
}
function hideSquatFaceBox() { $("squat-face-box").classList.add("hidden"); }

function hideSquatStatusBanner() { $("squat-status-banner").classList.add("hidden"); }
function showSquatStatusBanner(text) {
  $("squat-status-banner").textContent = text;
  $("squat-status-banner").classList.remove("hidden");
  announce(text);
}

function checkSquatFaceLostTimeout() {
  if (squatState.paused || squatState.stage !== "counting") return;
  const now = performance.now();
  if (now - squatState.lastSeenAt > FACE_LOST_TIMEOUT_MS) {
    squatState.paused = true;
    showSquatStatusBanner("PAUSED — find your face");
    speak("Paused");
  }
}

function updateSquatPhaseIndicator(phase) {
  const el = $("squat-phase-indicator");
  el.textContent = phase === "down" ? "SQUATTING" : "STANDING";
  el.classList.toggle("is-down", phase === "down");
}

function updateSquatHighscoreMessage(count) {
  const el = $("squat-highscore-message");
  if (!state.squatBest) {
    el.textContent = "";
    return;
  }
  const remaining = state.squatBest - count;
  if (remaining > 0) {
    el.textContent = `${remaining} squat${remaining === 1 ? "" : "s"} away from your best!`;
  } else if (remaining === 0) {
    el.textContent = "Tied your best squat set — one more!";
  } else {
    el.textContent = "New squat record! 🔥";
  }
}

// Same shape as maybeEncourage/maybeEncouragePlank, but for squat reps.
function maybeEncourageSquat(count) {
  if (!state.squatBest || state.squatBest <= 1) return null;
  if (count - squatState.lastCheerAtCount < 3) return null;
  if (Math.random() < cheerProbability(count / state.squatBest)) {
    squatState.lastCheerAtCount = count;
    return pickFrom(SQUAT_CHEER_LINES);
  }
  return null;
}

function onSquatRepCounted(count) {
  $("squat-rep-count").textContent = String(count);
  setTimeout(() => {
    updateSquatHighscoreMessage(count);

    let spoken = null;
    let mustSpeak = false;
    if (state.squatBest && count === state.squatBest + 1 && !squatState.recordBroken) {
      squatState.recordBroken = true;
      spoken = SQUAT_RECORD_LINE;
      mustSpeak = true;
      launchConfetti("squat-confetti", CONFETTI_EMOJI);
    } else {
      spoken = maybeEncourageSquat(count);
      if (spoken) mustSpeak = true;
    }

    const now = performance.now();
    const fastPace = now - squatState.lastRepSpokenAt < REP_SPEECH_MIN_GAP_MS;
    if (mustSpeak || !fastPace || count % 5 === 0) {
      squatState.lastRepSpokenAt = now;
      speak(spoken || numberToWords(count));
    }
    vibrate(45);
  }, 0);
}

function processSquatRatio(ratio) {
  const now = performance.now();
  squatState.lastSeenAt = now;
  if (squatState.paused) {
    squatState.paused = false;
    hideSquatStatusBanner();
    speak("Back to it");
  }
  if (!squatState.counter) squatState.counter = createRepCounter({ down: squatState.down, up: squatState.up });
  const result = squatState.counter.advance(ratio, now);
  squatState.phase = result.phase;
  updateSquatPhaseIndicator(result.phase);
  if (result.counted) {
    squatState.count = result.count;
    onSquatRepCounted(result.count);
  }
}

const squatCamera = createCameraController({
  moduleUrl: FACE_DETECTOR_MODULE_URL,
  wasmUrl: FACE_DETECTOR_WASM_URL,
  modelUrl: FACE_DETECTOR_MODEL_URL,
  getVideo: () => $("squat-camera-video"),
  onDetection(bbox, inferenceMs) {
    const video = $("squat-camera-video");
    updateSquatFaceBox(bbox);
    const centerY = squatCenterY(bbox, video);
    if (squatState.stage === "cal-stand" || squatState.stage === "cal-squat") {
      squatState.calSamples.push(centerY);
    } else if (squatState.stage === "counting") {
      processSquatRatio(centerY);
    }
  },
  onNoDetection() {
    hideSquatFaceBox();
    checkSquatFaceLostTimeout();
  },
});

const SQUAT_CAL_STEPS = [
  { stage: "cal-stand", label: "Step 1 of 2", title: "Stand tall", instructions: "Stand up straight, whole body in frame, and hold still." },
  { stage: "cal-squat", label: "Step 2 of 2", title: "Hold a squat", instructions: "Drop into a full squat and hold it still." },
];
let squatCalStepIndex = 0;

function renderSquatCalStep(index) {
  const step = SQUAT_CAL_STEPS[index];
  $("squat-cal-step-label").textContent = step.label;
  $("squat-cal-title").textContent = step.title;
  $("squat-cal-instructions").textContent = step.instructions;
  $("squat-cal-error").classList.add("hidden");
  $("btn-squat-cal-capture").disabled = false;
  $("btn-squat-cal-capture").textContent = "Capture";
}

function beginSquatCalibration() {
  squatCalStepIndex = 0;
  squatState.calStandY = null;
  squatState.calSquatY = null;
  squatState.stage = "cal-stand";
  $("squat-cal-stage").classList.remove("hidden");
  $("squat-count-stage").classList.add("hidden");
  $("btn-squat-stop").classList.add("hidden");
  $("btn-squat-cancel").classList.remove("hidden");
  renderSquatCalStep(0);
}

function beginSquatCounting(thresholds) {
  squatState.down = thresholds.down;
  squatState.up = thresholds.up;
  squatState.counter = createRepCounter({ down: thresholds.down, up: thresholds.up });
  squatState.phase = "up";
  squatState.count = 0;
  squatState.lastSeenAt = performance.now();
  squatState.lastRepSpokenAt = 0;
  squatState.paused = false;
  squatState.lastCheerAtCount = 0;
  squatState.recordBroken = false;
  squatState.stage = "counting";
  state.squatBest = getSquatBest(state.currentUser);
  state.squatStartedAt = new Date();
  $("squat-rep-count").textContent = "0";
  updateSquatPhaseIndicator("up");
  updateSquatHighscoreMessage(0);
  hideSquatStatusBanner();
  $("squat-cal-stage").classList.add("hidden");
  $("squat-count-stage").classList.remove("hidden");
  $("btn-squat-cancel").classList.add("hidden");
  $("btn-squat-stop").classList.remove("hidden");
}

// Advances the wizard one capture at a time: step 1 records standY, step 2
// records squatY and (if the swing is big enough) derives thresholds,
// persists them, and drops straight into counting.
async function captureSquatCalStep() {
  const btn = $("btn-squat-cal-capture");
  btn.disabled = true;
  btn.textContent = "Hold still…";
  squatState.calSamples = [];
  await sleep(SQUAT_CAL_SAMPLE_MS);
  const sampleMedian = median(squatState.calSamples);

  if (squatCalStepIndex === 0) {
    squatState.calStandY = sampleMedian;
    squatState.stage = "cal-squat";
    squatCalStepIndex = 1;
    renderSquatCalStep(1);
    return;
  }

  squatState.calSquatY = sampleMedian;
  if (!squatCalibrationValid(squatState.calStandY, squatState.calSquatY)) {
    squatCalStepIndex = 0;
    squatState.stage = "cal-stand";
    renderSquatCalStep(0);
    $("squat-cal-error").textContent = "Not enough movement detected — stand closer to the phone and try again.";
    $("squat-cal-error").classList.remove("hidden");
    return;
  }

  const thresholds = deriveSquatThresholds(squatState.calStandY, squatState.calSquatY);
  saveSquatCalibration(squatState.calStandY, squatState.calSquatY, thresholds);
  speak(pickFrom(SQUAT_START_LINES));
  beginSquatCounting(thresholds);
}

let squatUseLastCalRequested = false;

async function startSquat() {
  if (soundIsEnabled()) unlockVoice();
  state.squatSessionLocation = currentSessionLocationSnapshot();

  let stream;
  try {
    stream = await squatCamera.requestStream();
  } catch (e) {
    toast("Camera access is required to count squats. Please allow camera permission.", 4000);
    return;
  }
  toast("Loading face detector…", 2000);
  try {
    await squatCamera.ensureDetector();
  } catch (e) {
    toast("Couldn't load the face detection model. Check your connection and try again.", 4500);
    stream.getTracks().forEach((t) => t.stop());
    return;
  }
  const video = $("squat-camera-video");
  video.srcObject = stream;
  try { await video.play(); } catch (e) { /* autoplay quirks */ }

  await acquireWakeLock();

  state.squatActive = true;
  $("squat-idle").classList.add("hidden");
  $("squat-in-progress").classList.remove("hidden");
  setChromeMinimized(true);
  squatCamera.startDetection();

  const savedCal = getSquatCalibration();
  if (squatUseLastCalRequested && savedCal) {
    speak(pickFrom(SQUAT_START_LINES));
    beginSquatCounting({ down: savedCal.down, up: savedCal.up });
  } else {
    beginSquatCalibration();
  }
}

function stopSquatHard() {
  squatCamera.stop();
  releaseWakeLock();
  state.squatActive = false;
  squatState.stage = "idle";
  hideSquatStatusBanner();
  $("squat-in-progress").classList.add("hidden");
  $("squat-idle").classList.remove("hidden");
  setChromeMinimized(false);
}

let lastSquatFunMessageIndex = -1;
function pickSquatFunMessage(n) {
  let idx;
  do {
    idx = Math.floor(Math.random() * FUN_MESSAGES_SQUAT.length);
  } while (idx === lastSquatFunMessageIndex && FUN_MESSAGES_SQUAT.length > 1);
  lastSquatFunMessageIndex = idx;
  return FUN_MESSAGES_SQUAT[idx](n);
}

async function completeSquat() {
  const count = squatState.count;
  squatCamera.stop();
  await releaseWakeLock();
  state.squatActive = false;
  squatState.stage = "idle";
  hideSquatStatusBanner();
  $("squat-in-progress").classList.add("hidden");
  $("squat-idle").classList.remove("hidden");
  setChromeMinimized(false);

  const session = {
    id: uuid(),
    user: state.currentUser,
    timestamp: new Date().toISOString(),
    count,
    avatar: state.currentAvatar,
    startedAt: state.squatStartedAt ? state.squatStartedAt.toISOString() : undefined,
    type: "squat",
    ...(state.squatSessionLocation ? { location: state.squatSessionLocation } : {}),
  };

  // Optimistically reflect it locally right away so it shows up immediately.
  const cached = getCachedData();
  cached.sessions.push(session);
  cacheData(cached);

  const message = pickSquatFunMessage(count);
  state.lastSessionType = "squat";
  state.summarySessionId = session.id;
  state.summaryBaseCount = count;
  state.summaryExtra = 0;
  state.summaryMultiplier = 1;
  state.summaryWeightLbs = 0;
  state.summaryPrAchieved = null;
  state.summaryChaseResult = null;
  state.summaryRoadtripConquests = [];
  $("summary-count").textContent = formatNumber(count);
  $("missed-reps-count").textContent = "0";
  $("missed-reps-wrap").classList.remove("hidden");
  $("summary-weighted-note").classList.add("hidden");
  renderSummaryChaseResult();
  renderSummaryRoadtripResult();
  $("summary-sync-status").textContent = "";
  preloadWorkoutShareMessages();
  showScreen("screen-summary");
  launchConfetti("confetti", CONFETTI_EMOJI);
  speak(`Session complete. ${message}`);

  try {
    await commitSession(session);
  } catch (e) {
    enqueueSession(session);
    $("summary-sync-status").textContent = "Saved on this device — will sync automatically when back online.";
  }
}

$("btn-squat-start").addEventListener("click", () => { squatUseLastCalRequested = false; startSquat(); });
$("btn-squat-use-last-cal").addEventListener("click", () => { squatUseLastCalRequested = true; startSquat(); });
$("btn-squat-cal-capture").addEventListener("click", captureSquatCalStep);
$("btn-squat-cancel").addEventListener("click", stopSquatHard);
$("btn-squat-stop").addEventListener("click", completeSquat);

// ------------------- init -------------------

// Best-effort native lock — only honored by browsers/contexts that support
// it (mainly installed Android PWAs). The CSS overlay in style.css is the
// real cross-platform lock; this just avoids the rotation flash where supported.
async function lockPortraitOrientation() {
  try {
    await screen.orientation?.lock?.("portrait");
  } catch (e) {
    // unsupported here — CSS overlay handles it
  }
}

// Warms the clips that any session can need, regardless of mode. The number
// range is warmed separately at start, since it depends on the personal best.
function preloadCommonVoice() {
  return preloadVoice([
    ...FIXED_PHRASES,
    ...ENCOURAGE_LINES,
    ...Object.values(CARD_RANK_SPOKEN),
  ]).catch(() => {});
}

async function init() {
  initTheme();
  lockPortraitOrientation();
  initVoice().then((ok) => { if (ok) preloadCommonVoice(); });
  showScreen(state.currentUser ? "screen-user" : "screen-user");
  refreshAutomaticDeviceLocation();
  await flushQueue().catch(() => {});
  renderPendingStatus();
  await loadChallenges();

  if (workerConfigured()) {
    try {
      const data = await workerFetchData();
      cacheData(data);
      renderUserList();
      renderStreakBadge();
      renderHorseBellDropdown();
    } catch (e) {
      // offline or Worker unreachable; cached data (if any) is already shown
    }
  }

  // A shared challenge link (#challenge=id) jumps straight to that challenge's
  // detail screen — but only if this device already has a remembered name;
  // otherwise fall back to the normal pick-a-name flow.
  const hashMatch = location.hash.match(/^#challenge=([a-z0-9-]+)$/);
  if (hashMatch && state.currentUser && challengeDefs.some((c) => c.id === hashMatch[1])) {
    openChallengeDetail(hashMatch[1]);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      // The browser only checks sw.js for changes on its own throttled
      // schedule (up to ~24h) — force a check every launch and every time
      // the app comes back to the foreground so a new deploy is picked up
      // immediately instead of sitting uninstalled for a day.
      reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    }).catch(() => {});

    // Even after a new SW installs and activates, the currently open page
    // keeps running the old cached JS/HTML until it reloads — this is why
    // updates could "not stick" without a manual force-quit. Reload once,
    // automatically, the moment the new SW actually takes control.
    let swRefreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (swRefreshing) return;
      swRefreshing = true;
      window.location.reload();
    });
  }
}

window.addEventListener("online", () => {
  flushQueue().catch(() => {});
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") flushQueue().catch(() => {});
});

// iOS PWA quirk: on a cold or resumed launch, WebKit can report
// env(safe-area-inset-bottom) as 0 for the very first layout pass, so the
// fixed tab bar renders as if there were no home indicator to clear — it
// still touches the true bottom edge (position:fixed; bottom:0), but its
// padding is too short for a frame, leaving a strip of mismatched background
// exposed below it. WebKit corrects the value shortly after, but nothing
// repaints using the corrected value until some other style change forces a
// fresh layout — which is exactly why tapping any nav item (its DOM changes
// force one) makes the gap disappear. Forcing that same kind of no-op style
// invalidation shortly after launch does it before it's ever visible, without
// waiting on the user to tap anything first.
function nudgeSafeAreaLayout() {
  document.body.classList.add("safe-area-nudge");
  void document.body.offsetHeight; // force the mutation above to actually apply before undoing it
  document.body.classList.remove("safe-area-nudge");
}
requestAnimationFrame(() => requestAnimationFrame(nudgeSafeAreaLayout));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    requestAnimationFrame(() => requestAnimationFrame(nudgeSafeAreaLayout));
  }
});
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", nudgeSafeAreaLayout);
}

init();
