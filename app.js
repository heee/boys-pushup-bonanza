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
  HOLLAND_27_LINE,
  HOLLAND_CIRCUIT_COMPLETE_LINE,
  HOLLAND_START_LINES,
  HOLLAND_TO_PULLUP_LINES,
  HOLLAND_TO_PUSHUP_LINES,
  HOLLAND_TO_SQUAT_LINES,
  HORSE_CLEAR_LINES,
  HORSE_ELIMINATED_LINES,
  HORSE_LETTER_LINES,
  HORSE_WIN_LINES,
  LADDER_CHEER_LINES,
  LADDER_RIVAL_APPROACHING_LINE,
  LADDER_RIVAL_MATCHED_LINE,
  LADDER_RIVAL_PASSED_LINE,
  POKER_CALLOUTS,
  PYRAMID_APEX_LINE,
  PYRAMID_COMPLETE_LINE,
  PYRAMID_ROW_CHEER_LINES,
  PYRAMID_TURNAROUND_LINE,
  PULLUP_CHEER_LINES,
  PULLUP_RECORD_LINE,
  PULLUP_START_LINES,
  FUN_MESSAGES_PULLUP,
  SHARPSHOOTER_HIT_LINES,
  SITUP_CHEER_LINES,
  SITUP_RECORD_LINE,
  SITUP_START_LINES,
  FUN_MESSAGES_SITUP,
  SQUAT_CHEER_LINES,
  SQUAT_RECORD_LINE,
  SQUAT_START_LINES,
  FUN_MESSAGES_SQUAT,
  TOW_PULL_LINES,
  TOW_WIN_LINES,
  VOICE_PRESETS,
  WHEEL_DOUBLE_PREFIX,
  WHEEL_BOSS_LINE,
  WHEEL_FREEBIE_LINE,
  WHEEL_BUST_LINE,
  WHEEL_TEMPO_LINE,
  numberToWords,
  zenCompletionLine,
} from "./voice-lines.js?v=140";
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
import { modeStatsModel } from "./screens/mode-stats.js?v=135";
import { modeBreakdownModel } from "./screens/mode-breakdown.js?v=4";
import { comparisonModel } from "./screens/comparison.js?v=132";
import { challengeActivityId, challengeLeaderboardRows, challengeOverviewStats, challengePrProgress, challengeShareContext, challengeStatus, challengeStatusLabel, challengeWindow, challengeWindowProgress, daysLeft, daysUntilStart, formatChallengeDates, progressThermometerModel, recentChallengeSessions } from "./screens/challenges.js?v=212";
import { weightModifierText } from "./screens/settings.js";
import { EXPLORE_MODES, exploreModesModel } from "./screens/explore-modes.js?v=142";
import { MODIFIERS, RESOLVABLE_MODIFIER_IDS, resolveModifier } from "./screens/modifiers.js?v=100";
import { orderedUserNames, renameCachedIdentity, userSelectionModel, visibleUserSessions } from "./screens/users.js";
import { sessionBadges, sessionKeyMetrics, sessionModeLabel, sessionRings } from "./screens/session-detail.js?v=6";
import { ladderRungRows, workoutHeroModel, workoutHudModel } from "./workout-modes.js?v=150";
import { applyTurn, chooseHorseTarget, createHorseGame, currentTurnPlayer, HORSE_TIME_LIMITS, horsePlayerRows, horseTargetLabel, isTimeUp } from "./horse.js";
import { horseChoiceCopy, horseInviteUrl, horseSummaryRows, horseSummaryStats, horseTargetWasLowered, horseTurnHeroCopy, horseWordChips, openHorseJoinModel } from "./screens/horse.js";
import { randomHorseWord } from "./horse-words.js";
import {
  applyBurst as applyTowBurst,
  autoBalanceTeams as towAutoBalanceTeams,
  cancelOpenGame as cancelOpenTowGameLocal,
  createTugOfWarGame,
  currentTurnPlayer as towCurrentTurnPlayer,
  currentTurnTeam as towCurrentTurnTeam,
  declinePlayer as declineTowPlayerLocal,
  joinOpenPlayer as joinOpenTowPlayerLocal,
  startOpenMatch as startOpenTowMatchLocal,
  swapPlayerSide as towSwapPlayerSide,
  teamOfPlayer as towTeamOfPlayer,
} from "./tug-of-war.js";
import {
  openTowJoinModel,
  towBurstResultCopy,
  towInviteUrl,
  towPlayerRows,
  towRemainingLabel,
  towRopeModel,
  towSummaryModel,
  towTurnStatusCopy,
} from "./screens/tug-of-war.js";
import { randomTeamNames as randomTowTeamNames } from "./tug-of-war-words.js";
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
import { deriveSquatThresholds, estimateSquatRange, replaySquatCalibration, squatCalibrationValid, squatSwing, SQUAT_MIN_SWING } from "./modes/squat.js";
import { deriveSitupThresholds, estimateSitupRange, situpCalibrationValid, situpFrameRatio, situpSwing, SITUP_MIN_SWING } from "./modes/situp.js";
import {
  HOLLAND_TARGETS,
  hollandAdvanceSegment,
  hollandApplyCorrection,
  hollandBuildSession,
  hollandComponentSessions,
  hollandCreateState,
  hollandCurrentExercise,
  hollandCyclesLabel,
  hollandDifficultyLabel,
  hollandFinish,
  hollandFormatCycles,
  hollandNormalizedCycles,
  hollandQualifiesForHolland27,
  hollandRecordReps,
  hollandSegmentTarget,
  hollandTotalReps,
} from "./modes/holland.js";

const FACE_DETECTOR_MODULE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";
const FACE_DETECTOR_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const FACE_DETECTOR_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
// Squat mode tracks the whole body, not the face: blaze_face_short_range is
// a selfie-distance model and simply can't see a face 6+ feet away, which is
// exactly where a squatter stands. Pose landmarks work at room scale.
const POSE_LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let pullupModeModule = null;
async function loadPullupMode() {
  if (!pullupModeModule) pullupModeModule = await import("./modes/pullup.js");
  return pullupModeModule;
}

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
  squatWeightedProfiles: "bpb-squat-weighted-profiles",
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
  hollandDifficulty: "bpb-holland-difficulty",
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
  { id: "pullups", label: "Pull-ups" },
  { id: "squats", label: "Squats" },
  { id: "situps", label: "Crunches" },
  { id: "planks", label: "Planks" },
  { id: "holland", label: "Holland" },
];
const LEADERBOARD_MODE_IDS = new Set(LEADERBOARD_MODE_OPTIONS.map((option) => option.id));

const MY_SESSIONS_MODE_OPTIONS = [
  { id: "all", label: "All" },
  { id: "pushups", label: "Pushups" },
  { id: "pullups", label: "Pull-ups" },
  { id: "situps", label: "Crunches" },
  { id: "squats", label: "Squats" },
  { id: "planks", label: "Planks" },
  { id: "holland", label: "Holland" },
];

function sessionActivity(s) {
  return s.type === "plank" ? "planks" : s.type === "pullup" ? "pullups" : s.type === "squat" ? "squats" : s.type === "situp" ? "situps" : s.type === "holland" ? "holland" : "pushups";
}

function leaderboardActivity(mode) {
  return ["planks", "pullups", "squats", "situps", "holland"].includes(mode) ? mode : "pushups";
}

function activityLabel(activity, singular = false) {
  const words = {
    pushups: singular ? "pushup" : "pushups",
    pullups: singular ? "pull-up" : "pull-ups",
    squats: singular ? "squat" : "squats",
    situps: singular ? "crunch" : "crunches",
    planks: singular ? "plank" : "planks",
    holland: singular ? "Holland cycle" : "Holland cycles",
  };
  return words[activity] || words.pushups;
}

function savedLeaderboardMode() {
  const saved = localStorage.getItem(LS.leaderboardMode) || "all";
  return LEADERBOARD_MODE_IDS.has(saved) ? saved : "all";
}

function savedHollandDifficulty() {
  const saved = localStorage.getItem(LS.hollandDifficulty);
  return HOLLAND_TARGETS[saved] ? saved : "normal";
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

function formatSessionRowDate(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} (${time})`;
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
async function workerJoinOpenHorseGame(gameId, user) {
  return workerApi.joinOpenHorseGame(gameId, user);
}
async function workerCancelOpenHorseGame(gameId, user) {
  return workerApi.cancelOpenHorseGame(gameId, user);
}
async function workerPostHorseTurn(payload) {
  return workerApi.postHorseTurn(payload);
}
async function workerChooseHorseTarget(payload) {
  return workerApi.chooseHorseTarget(payload);
}
async function workerTallyHorseGame(gameId) {
  return workerApi.tallyHorseGame(gameId);
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

async function workerCreateTowGame(input) {
  return workerApi.createTowGame(input);
}
async function workerJoinOpenTowGame(gameId, user) {
  return workerApi.joinOpenTowGame(gameId, user);
}
async function workerCancelOpenTowGame(gameId, user) {
  return workerApi.cancelOpenTowGame(gameId, user);
}
async function workerStartOpenTowGame(gameId, user) {
  return workerApi.startOpenTowGame(gameId, user);
}
async function workerPostTowBurst(payload) {
  return workerApi.postTowBurst(payload);
}
async function workerDeclineTowInvite(gameId, user) {
  return workerApi.declineTowInvite(gameId, user);
}

// Same immediate-local-splice pattern as upsertLocalHorseGame.
function upsertLocalTowGame(game) {
  const cached = getCachedData();
  const idx = cached.towGames.findIndex((g) => g.id === game.id);
  if (idx === -1) cached.towGames.push(game);
  else cached.towGames[idx] = game;
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
  const byActivity = { pushups: [], planks: [], pullups: [], squats: [], situps: [], holland: [] };
  const byUserActivity = new Map();
  const byLeaderboardMode = Object.fromEntries(LEADERBOARD_MODE_OPTIONS.map((option) => [option.id, []]));
  const byUserLeaderboardMode = new Map();
  const timestampBySession = new WeakMap();

  // Whole-body activities get independent leaderboard buckets; pushup
  // sessions continue to use All plus their selected pushup-mode bucket.
  // Shared by both the real session and (for Holland) its projected
  // pullup/pushup/squat component sessions, so Holland reps reach the
  // existing per-exercise leaderboards/personal-bests without a second
  // My Sessions row (byUser is only populated for the real session, below).
  function indexActivityAndLeaderboard(session, activity) {
    byActivity[activity].push(session);
    const leaderboardModes = session.type ? [activity] : ["all", session.mode || "classic"];
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

  for (const session of sessions) {
    const activity = sessionActivity(session);
    const timestamp = Date.parse(session.timestamp);
    timestampBySession.set(session, Number.isFinite(timestamp) ? timestamp : 0);

    if (!byUser.has(session.user)) byUser.set(session.user, []);
    byUser.get(session.user).push(session);

    indexActivityAndLeaderboard(session, activity);

    if (session.type === "holland") {
      for (const projected of hollandComponentSessions(session)) {
        indexActivityAndLeaderboard(projected, sessionActivity(projected));
      }
    }
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

// Squat weighted mode: its own added-weight (kettlebell) + enabled flag per
// user, since the load held during squats is usually different from the
// vest weight used for pushups on the same day. Bodyweight is still shared
// from the pushup profile above — one bodyweight, entered once.
function getSquatWeightedProfiles() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS.squatWeightedProfiles) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch (e) {
    return {};
  }
}
function getSquatWeightedProfile(user) {
  const profiles = getSquatWeightedProfiles();
  return profiles[user] || { addedWeightLbs: 0, enabled: false };
}
function saveSquatWeightedProfile(user, profile) {
  const profiles = getSquatWeightedProfiles();
  profiles[user] = profile;
  localStorage.setItem(LS.squatWeightedProfiles, JSON.stringify(profiles));
}
function getSquatWeightedMultiplierProfile(user) {
  const bodyweightLbs = getWeightedProfile(user).bodyweightLbs || 0;
  const squatProfile = getSquatWeightedProfile(user);
  return { bodyweightLbs, addedWeightLbs: squatProfile.addedWeightLbs || 0 };
}

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
  mySessionsShown: 10,
  mySessionsMode: "all",
  sessionStartedAt: null,
  challengeTab: "active",
  openChallengeId: null,
  leaderboardMode: savedLeaderboardMode(),
  activityType: leaderboardActivity(savedLeaderboardMode()),
  lastSessionType: "pushup",
  plankActive: false,
  plankBest: 0,
  plankStartedAt: null,
  squatActive: false,
  squatBest: 0,
  squatStartedAt: null,
  squatSessionLocation: null,
  pullupActive: false,
  pullupBest: 0,
  pullupStartedAt: null,
  pullupSessionLocation: null,
  situpActive: false,
  situpBest: 0,
  situpStartedAt: null,
  situpSessionLocation: null,
  hollandActive: false,
  hollandBest: 0,
  hollandDifficulty: savedHollandDifficulty(),
  hollandSessionLocation: null,
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
  // null means "A side is whoever's device this is" (the normal tap-to-compare
  // path). A shared #compare=A|B link that names someone other than the
  // current device's user sets this explicitly so both sides show the named
  // people instead of "me vs. X" — see openUserCompareFromLink.
  compareUserA: null,
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
  horseWord: "HORSE",
  horseSessionType: "live",
  horseTimeLimit: "48h",
  horseSetupPlayers: [],
  horseLetterEvent: null,
  towGame: null,
  towTarget: 300,
  towRounds: 5,
  towSessionType: "live",
  towSetupTeams: { a: [], b: [] },
  towTeamNames: { a: "", b: "" },
  towBurstEvent: null,
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
// Auto-warmup keeps sampling until it's seen a real stand->squat swing, but
// won't trust a lucky couple of early frames — needs both a minimum time
// and a minimum sample count before it'll even check.
const SQUAT_WARMUP_MIN_MS = 1200;
const SQUAT_WARMUP_MIN_SAMPLES = 10;
// Bound the sample buffer (~10s at ~30fps) so a slow-to-move boy doesn't
// grow it unbounded; percentile only needs a recent window anyway.
const SQUAT_WARMUP_MAX_SAMPLES = 300;
const SQUAT_WARMUP_HINT_MS = 8000;

const squatState = {
  counter: null,
  phase: "up",
  count: 0,
  lastSeenAt: 0,
  lastRepSpokenAt: 0,
  paused: false,
  lastCheerAtCount: 0,
  recordBroken: false,
  // "idle" | "warmup" | "counting" — read by the shared camera controller's
  // onDetection to decide what to do with each frame.
  stage: "idle",
  calSamples: [],
  warmupStartedAt: 0,
  down: DEFAULT_DOWN,
  up: DEFAULT_UP,
};

const PULLUP_WARMUP_MIN_MS = 1200;
const PULLUP_WARMUP_MIN_SAMPLES = 12;
const PULLUP_WARMUP_MAX_SAMPLES = 360;
const PULLUP_WARMUP_HINT_MS = 9000;

const pullupState = {
  counter: null,
  count: 0,
  phase: "waiting-for-hang",
  stage: "idle",
  calSamples: [],
  warmupStartedAt: 0,
  thresholds: null,
  lastSeenAt: 0,
  paused: false,
  lastRepSpokenAt: 0,
  lastCheerAtCount: 0,
  recordBroken: false,
};

// Same shape as the squat warmup constants — see docs/situp-mode-plan.md.
const SITUP_WARMUP_MIN_MS = 1200;
const SITUP_WARMUP_MIN_SAMPLES = 10;
const SITUP_WARMUP_MAX_SAMPLES = 300;
const SITUP_WARMUP_HINT_MS = 8000;

const situpState = {
  counter: null,
  phase: "up",
  count: 0,
  lastRepSpokenAt: 0,
  lastCheerAtCount: 0,
  recordBroken: false,
  // "idle" | "warmup" | "counting" — read by the shared camera controller's
  // onDetection/onNoDetection to decide what to do with each frame.
  stage: "idle",
  calSamples: [],
  warmupStartedAt: 0,
  down: DEFAULT_DOWN,
  up: DEFAULT_UP,
  // situpFrameRatio's caller-owned { lastRatio, lostSinceMs } tracking for
  // the face-dropout clamp/debounce — reset at the start of every warmup.
  dropoutTrack: {},
};

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
  "screen-horse-join": "btn-nav-home",
  "screen-horse-turn-order": "btn-nav-home",
  "screen-horse-letter": "btn-nav-home",
  "screen-horse-summary": "btn-nav-home",
  "screen-tow-setup": "btn-nav-home",
  "screen-tow-join": "btn-nav-home",
  "screen-tow-match": "btn-nav-home",
  "screen-tow-handoff": "btn-nav-home",
  "screen-tow-burst-complete": "btn-nav-home",
  "screen-tow-summary": "btn-nav-home",
  "screen-modifier-picker": "btn-nav-home",
  "screen-plank-workout": "btn-nav-home",
  "screen-plank-unlock": "btn-nav-home",
  "screen-squat-workout": "btn-nav-home",
  "screen-pullup-workout": "btn-nav-home",
  "screen-situp-workout": "btn-nav-home",
  "screen-holland-workout": "btn-nav-home",
  "screen-summary": "btn-nav-home",
  "screen-dashboard": "btn-nav-dashboard",
  "screen-user-compare": "btn-nav-dashboard",
  "screen-challenges": "btn-nav-challenges",
  "screen-challenge-detail": "btn-nav-challenges",
  "screen-challenge-create": "btn-nav-challenges",
  "screen-roadtrip": "btn-nav-roadtrip",
  "screen-roadtrip-detail": "btn-nav-roadtrip",
  "screen-settings": "btn-nav-settings",
  "screen-settings-profile": "btn-nav-settings",
  "screen-settings-mysessions": "btn-nav-settings",
  "screen-settings-workout": "btn-nav-settings",
  "screen-settings-appearance": "btn-nav-settings",
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
  if (id !== "screen-settings-workout" && squatTraceState.running) stopSquatCaptureTest();
  if (id !== "screen-settings-workout" && situpTraceState.running) stopSitupCaptureTest();
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
  state.screen = id;
  const minimized = (id === "screen-workout" && state.workoutActive) ||
    (id === "screen-plank-workout" && state.plankActive) ||
    (id === "screen-squat-workout" && state.squatActive) ||
    (id === "screen-pullup-workout" && state.pullupActive) ||
    (id === "screen-situp-workout" && state.situpActive) ||
    (id === "screen-holland-workout" && state.hollandActive);
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
  if (id === "screen-summary" && state.lastSessionType !== "holland") {
    $("summary-holland-result")?.classList.add("hidden");
  }
  if (id === "screen-dashboard") renderDashboard();
  if (id === "screen-session-detail") renderSessionDetail();
  if (id === "screen-challenges") renderChallengesScreen();
  if (id === "screen-roadtrip") renderRoadtrip();
  if (id === "screen-roadtrip-detail") renderRoadtripDetail();
  if (id === "screen-settings" || id === "screen-settings-profile" || id === "screen-settings-mysessions" ||
    id === "screen-settings-workout" || id === "screen-settings-appearance") renderSettings();
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
    renderSquatWeightedControls();
  }
  if (id === "screen-pullup-workout" && !state.pullupActive) {
    $("pullup-username").textContent = state.currentUser || "Friend";
    setAvatarEl($("pullup-avatar"), state.currentAvatar, "2rem");
  }
  if (id === "screen-situp-workout" && !state.situpActive) {
    $("situp-username").textContent = state.currentUser || "Friend";
    setAvatarEl($("situp-avatar"), state.currentAvatar, "2rem");
  }
  if (id === "screen-holland-workout" && !state.hollandActive) {
    $("holland-username").textContent = state.currentUser || "Friend";
    setAvatarEl($("holland-avatar"), state.currentAvatar, "2rem");
    renderHollandIdle();
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
  } else if (state.screen === "screen-pullup-workout" && state.pullupActive) {
    const ok = confirm("Leave this pull-up set? Your in-progress reps won't be saved.");
    if (!ok) return;
    stopPullupHard();
  } else if (state.screen === "screen-situp-workout" && state.situpActive) {
    const ok = confirm("Leave this crunch set? Your in-progress reps won't be saved.");
    if (!ok) return;
    stopSitupHard();
  } else if (state.screen === "screen-holland-workout" && state.hollandActive) {
    const ok = confirm("Leave this Holland workout? Your in-progress circuit won't be saved.");
    if (!ok) return;
    stopHollandHard();
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
  if (horseLinkGameId()) {
    openHorseGameFromHash();
    return;
  }
  if (towLinkGameId()) {
    openTowGameFromHash();
    return;
  }
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
  $("btn-download-situp-trace").classList.toggle("hidden", !situpTraceState.trace.length);
  renderWeightedSettings();
  renderSquatWeightedControls();

  renderManageUsers();
  state.mySessionsShown = 10;
  state.mySessionsMode = "all";
  syncMySessionsModeControl();
  renderMySessions();
  renderSettingsCategoryValues();
}

function renderSettingsCategoryValues() {
  const names = orderedUserNames(getAllSessionsForDisplay(), state.currentUser, { alphabetical: true });
  $("settings-category-profile-value").textContent = `${names.length} ${names.length === 1 ? "person" : "people"}`;
  const theme = document.documentElement.getAttribute("data-theme") === "light" ? "Light" : "Dark";
  $("settings-category-appearance-value").textContent = theme;
  const mySessionCount = getAllSessionsForDisplay().filter((s) => s.user === state.currentUser).length;
  $("settings-category-mysessions-value").textContent = `${mySessionCount} ${mySessionCount === 1 ? "session" : "sessions"}`;
}

$("settings-category-list").addEventListener("click", (e) => {
  const row = e.target.closest(".settings-category-row");
  if (!row || !row.dataset.settingsCategory) return;
  showScreen(`screen-settings-${row.dataset.settingsCategory}`);
});
$("btn-settings-profile-back").addEventListener("click", () => showScreen("screen-settings"));
$("btn-settings-mysessions-back").addEventListener("click", () => showScreen("screen-settings"));
$("btn-settings-workout-back").addEventListener("click", () => showScreen("screen-settings"));
$("btn-settings-appearance-back").addEventListener("click", () => showScreen("screen-settings"));

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

// Squat's kettlebell modifier: same multiplier math as pushup's weighted
// mode, but its own added-weight field, and a control both in Settings and
// inline on the Ready-to-squat screen (kept in sync — they share one
// profile). Bodyweight comes from the pushup weighted profile above.
function renderSquatWeightedControls() {
  const bodyweightLbs = getWeightedProfile(state.currentUser).bodyweightLbs || 0;
  const profile = getSquatWeightedProfile(state.currentUser);
  const enabled = !!profile.enabled && bodyweightLbs > 0;
  const readoutText = weightModifierText({ bodyweightLbs, addedWeightLbs: profile.addedWeightLbs || 0 }, getSquatWeightedMultiplierValue());

  $("squat-weight-amount-settings").textContent = String(profile.addedWeightLbs || 0);
  $("chk-squat-weighted-enabled-settings").checked = enabled;
  $("chk-squat-weighted-enabled-settings").disabled = !bodyweightLbs;
  $("squat-weight-modifier-readout").textContent = readoutText;

  // Unlike the pushup quick-toggle, this stays visible even without a
  // bodyweight on file — enabling it just won't scale the score yet
  // (weightedMultiplier returns 1 with no bodyweight), so nothing to hide.
  $("squat-weight-amount").textContent = String(profile.addedWeightLbs || 0);
  $("chk-squat-weighted-enabled").checked = enabled;
  $("chk-squat-weighted-enabled").disabled = !bodyweightLbs;
  $("squat-weight-readout").textContent = readoutText;
}
function getSquatWeightedMultiplierValue() {
  return weightedMultiplier(getSquatWeightedMultiplierProfile(state.currentUser));
}
function adjustSquatAddedWeight(delta) {
  const profile = getSquatWeightedProfile(state.currentUser);
  profile.addedWeightLbs = Math.max(0, (profile.addedWeightLbs || 0) + delta);
  saveSquatWeightedProfile(state.currentUser, profile);
  renderSquatWeightedControls();
}
function setSquatWeightedEnabled(checked) {
  const bodyweightLbs = getWeightedProfile(state.currentUser).bodyweightLbs || 0;
  const profile = getSquatWeightedProfile(state.currentUser);
  profile.enabled = checked && bodyweightLbs > 0;
  saveSquatWeightedProfile(state.currentUser, profile);
  renderSquatWeightedControls();
}
$("btn-squat-weight-plus-settings").addEventListener("click", () => adjustSquatAddedWeight(5));
$("btn-squat-weight-minus-settings").addEventListener("click", () => adjustSquatAddedWeight(-5));
$("chk-squat-weighted-enabled-settings").addEventListener("change", (e) => setSquatWeightedEnabled(e.target.checked));
$("btn-squat-weight-plus").addEventListener("click", () => adjustSquatAddedWeight(5));
$("btn-squat-weight-minus").addEventListener("click", () => adjustSquatAddedWeight(-5));
$("chk-squat-weighted-enabled").addEventListener("change", (e) => setSquatWeightedEnabled(e.target.checked));

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
  // These are whole separate activities/screens, not pushupMode toggles.
  if (modeId === "plank") {
    guardLeaveWorkout(() => showScreen("screen-plank-workout"));
    return;
  }
  if (modeId === "squat") {
    guardLeaveWorkout(() => showScreen("screen-squat-workout"));
    return;
  }
  if (modeId === "pullup") {
    await loadPullupMode();
    guardLeaveWorkout(() => showScreen("screen-pullup-workout"));
    return;
  }
  if (modeId === "situp") {
    guardLeaveWorkout(() => showScreen("screen-situp-workout"));
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
  // Tug of War needs a target/rounds/teams picked before it can start — see
  // screen-tow-setup — same reasoning as Horse above.
  if (modeId === "tow") {
    renderTowSetup();
    guardLeaveWorkout(() => showScreen("screen-tow-setup"));
    return;
  }
  if (modeId === "holland") {
    guardLeaveWorkout(() => showScreen("screen-holland-workout"));
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
  $("horse-word-preview").innerHTML = state.horseWord.split("").map((l) => `<span class="horse-word-chip">${escapeHtml(l)}</span>`).join("");
  $("btn-horse-reset-word").classList.toggle("hidden", state.horseWord === "HORSE");
}

function renderHorseSessionUI() {
  document.querySelectorAll("#horse-session-select .segment[data-horse-session]").forEach((s) => {
    s.classList.toggle("active", s.dataset.horseSession === state.horseSessionType);
  });
  const note = $("horse-session-note");
  note.classList.remove("hidden");
  note.textContent = state.horseSessionType === "open"
    ? "Create a private link. Up to three players can join in link order, even after play starts."
    : state.horseSessionType === "invite"
    ? "Other players get a bell notification on Home when it's their turn."
    : "Everyone plays in turn on this device, one shot after another.";
  // A match timer only makes sense for async play — Live is one shared
  // device, played through in a single sitting.
  $("horse-time-limit-section").classList.toggle("hidden", state.horseSessionType === "live");
}

function renderHorseTimeUI() {
  document.querySelectorAll("#horse-time-select .segment[data-horse-time]").forEach((s) => {
    s.classList.toggle("active", s.dataset.horseTime === state.horseTimeLimit);
  });
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
  const isOpen = state.horseSessionType === "open";
  $("btn-horse-invite-more").classList.toggle("hidden", isOpen);
  candidates.classList.toggle("hidden", isOpen || !horseInviteExpanded);
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
  const enoughPlayers = isOpen || state.horseSetupPlayers.length >= 2;
  startBtn.disabled = !enoughPlayers;
  startBtn.textContent = isOpen
    ? "Create open session"
    : enoughPlayers ? "Do your set — sets the bar" : "Add at least one more player";
}

// keepPlayers: true for Rematch, which reuses the same lineup instead of
// resetting to just the current user.
function renderHorseSetup(keepPlayers = false) {
  state.horseWord = "HORSE";
  state.horseSessionType = "live";
  state.horseTimeLimit = "48h";
  if (!keepPlayers || !state.horseSetupPlayers?.length) state.horseSetupPlayers = [state.currentUser];
  horseInviteExpanded = false;
  renderHorseWordUI();
  renderHorseSessionUI();
  renderHorseTimeUI();
  renderHorsePlayerList();
}

$("btn-horse-setup-back").addEventListener("click", () => {
  guardLeaveWorkout(() => showScreen("screen-explore-modes"));
});

$("btn-horse-randomize-word").addEventListener("click", () => {
  state.horseWord = randomHorseWord(state.horseWord);
  renderHorseWordUI();
});

$("btn-horse-reset-word").addEventListener("click", () => {
  state.horseWord = "HORSE";
  renderHorseWordUI();
});

$("horse-session-select").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment[data-horse-session]");
  if (!btn) return;
  state.horseSessionType = btn.dataset.horseSession;
  if (state.horseSessionType === "open") {
    state.horseSetupPlayers = [state.currentUser];
    horseInviteExpanded = false;
  }
  renderHorseSessionUI();
  renderHorsePlayerList();
});

$("horse-time-select").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment[data-horse-time]");
  if (!btn) return;
  state.horseTimeLimit = btn.dataset.horseTime;
  renderHorseTimeUI();
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
  if (state.horseSessionType !== "open" && state.horseSetupPlayers.length < 2) return;
  // Live is pass-the-phone, played through in one sitting — the match timer
  // only applies to async (invite/open) play, whatever the setup UI shows.
  const timeLimitKey = state.horseSessionType === "live" ? "unlimited" : state.horseTimeLimit;
  const input = {
    id: `hg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    word: state.horseWord,
    sessionType: state.horseSessionType,
    createdBy: state.currentUser,
    players: state.horseSetupPlayers,
    timeLimit: HORSE_TIME_LIMITS[timeLimitKey],
    timeLimitKey,
  };
  state.horseLetterEvent = null;
  // Invite games are server-authoritative from the start (other players read
  // them via /data on their own devices) — Live games stay purely local
  // until the game finishes, same as any other pushup mode's session.
  if (state.horseSessionType === "invite" || state.horseSessionType === "open") {
    const btn = $("btn-horse-start");
    btn.disabled = true;
    try {
      const { game } = await workerCreateHorseGame(input);
      state.horseGame = game;
      upsertLocalHorseGame(game);
      if (state.horseSessionType === "open") await openHorseTurnOrder();
      else beginHorseTurn(state.currentUser);
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

// Rounds down to the minute — a countdown/duration that ticked over every ms
// would be noise; the app only ever re-renders this on load/refetch anyway.
function horseFormatDuration(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "<1m";
}

function renderHorseTurnOrder() {
  const game = state.horseGame;
  const rows = horsePlayerRows(game);
  const isRemote = game.sessionType === "invite" || game.sessionType === "open";
  const timeUp = isRemote && isTimeUp(game, Date.now());
  const waitingForOpenChallenger = game.sessionType === "open" && game.turnOrder.length === 1 && game.target != null;
  $("horse-order-title").textContent = game.sessionType === "open" && game.turnOrder.length === 1
    ? "Horse · Open lobby"
    : `Horse · Round ${game.round}`;
  const target = horseTargetLabel(game);
  const targetModifierMeta = game.targetModifier ? MODIFIERS.find((m) => m.id === game.targetModifier) : null;
  const forcedReps = horseTargetWasLowered(game);
  const wentLowerNote = forcedReps ? ` · ${game.targetSetBy} could've forced ${forcedReps}` : "";
  $("horse-order-target-line").textContent = target
    ? waitingForOpenChallenger
      ? `${game.targetSetBy} set ${target}${targetModifierMeta ? ` (${targetModifierMeta.cueLabel})` : ""} · waiting for a challenger`
      : `Beat ${target}${targetModifierMeta ? ` (${targetModifierMeta.cueLabel})` : ""} to stay clean${wentLowerNote}`
    : `${escapeHtml(game.turnOrder[0])} sets the bar`;

  const timerLine = $("horse-order-timer-line");
  if (!isRemote || game.timeLimit == null) {
    timerLine.classList.add("hidden");
  } else if (timeUp) {
    timerLine.textContent = "⏰ Time's up — tally the scores below to crown a winner.";
    timerLine.classList.remove("hidden");
    timerLine.classList.add("horse-timer-line-urgent");
  } else if (game.timerStartedAt == null) {
    timerLine.textContent = "Match timer starts once the second player takes their first turn.";
    timerLine.classList.remove("hidden");
    timerLine.classList.remove("horse-timer-line-urgent");
  } else {
    const remaining = game.timeLimit - (Date.now() - game.timerStartedAt);
    timerLine.textContent = `${horseFormatDuration(remaining)} left on the clock`;
    timerLine.classList.remove("hidden");
    timerLine.classList.remove("horse-timer-line-urgent");
  }

  const playerRowsHTML = rows.map((row) => {
    const displayedUp = row.status === "up" && !waitingForOpenChallenger;
    const statusHTML = row.status === "out"
      ? '<span class="horse-player-status-out">OUT</span>'
      : displayedUp
        ? '<span class="horse-player-tag">Up now</span>'
        : '<span class="horse-player-status-waiting">Waiting</span>';
    return `
    <div class="tier1-row horse-player-row${displayedUp ? " horse-row-active" : ""}${row.status === "out" ? " horse-row-out" : ""}">
      <span class="avatar-circle horse-avatar" data-avatar="${avatarForUser(row.name).id}"></span>
      <span class="horse-player-name${row.status === "out" ? " horse-summary-name-out" : ""}">${escapeHtml(row.name)}</span>
      <span class="horse-mini-strip">${horseMiniStripHTML(game.word, row.letters)}</span>
      ${statusHTML}
    </div>`;
  }).join("");
  const openSlotsHTML = game.sessionType === "open"
    ? Array.from({ length: Math.max(0, 4 - rows.length) }, () => `
      <div class="tier1-row horse-player-row horse-open-slot">
        <span class="horse-open-slot-icon">＋</span>
        <span class="horse-player-name">Open player slot</span>
        <span class="horse-player-status-waiting">Invite link</span>
      </div>`).join("")
    : "";
  $("horse-turn-order-list").innerHTML = playerRowsHTML + openSlotsHTML;
  $("horse-turn-order-list").querySelectorAll(".horse-avatar").forEach((el) => setAvatarEl(el, el.dataset.avatar));
  const upNow = currentTurnPlayer(game);
  const canTakeTurn = !timeUp && !waitingForOpenChallenger && (game.sessionType === "live" || upNow === state.currentUser);
  $("btn-horse-take-turn").classList.toggle("hidden", !canTakeTurn);
  $("btn-horse-take-turn").textContent = upNow === state.currentUser ? "Do your set" : `Pass the phone to ${upNow} — do your set`;
  // Reminding only makes sense for async games where someone else is
  // dragging their feet — Live is a shared device, and there's no reason to
  // nag yourself.
  $("btn-horse-remind").classList.toggle("hidden", !isRemote || timeUp || upNow === state.currentUser);
  // Once the clock runs out, play stops — any player can tally the scores.
  $("btn-horse-tally").classList.toggle("hidden", !timeUp);

  const openControls = $("horse-open-controls");
  const isOpen = game.sessionType === "open";
  openControls.classList.toggle("hidden", !isOpen);
  if (isOpen) {
    const slotsLeft = 4 - game.turnOrder.length;
    $("horse-open-slots").textContent = `${game.turnOrder.length}/4 joined · ${slotsLeft} slot${slotsLeft === 1 ? "" : "s"} open`;
    $("horse-open-link").textContent = horseInviteUrl(game.id);
    $("btn-horse-open-share").classList.toggle("hidden", slotsLeft === 0);
    $("horse-open-link").classList.toggle("hidden", slotsLeft === 0);
    const exit = $("btn-horse-open-exit");
    const canCancel = state.currentUser === game.createdBy && game.turnOrder.length === 1;
    const canLeave = state.currentUser !== game.createdBy && !game.sets.some((set) => set.user === state.currentUser);
    exit.classList.toggle("hidden", !canCancel && !canLeave);
    exit.textContent = canCancel ? "Cancel session" : "Leave before my first turn";
    exit.dataset.action = canCancel ? "cancel" : "leave";
  }
}

async function shareHorseReminder() {
  const { pickHorseReminderMessage } = workoutShareMessages || await preloadWorkoutShareMessages();
  const game = state.horseGame;
  const name = currentTurnPlayer(game);
  const message = pickHorseReminderMessage({ name, targetLabel: horseTargetLabel(game) || "the bar" });
  const url = game.sessionType === "open" ? horseInviteUrl(game.id) : location.href;
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
    toast("Copied to clipboard — go nag them!");
  } catch (e) {
    toast("Couldn't share automatically — copy your reminder manually.", 4000);
  }
}

$("btn-horse-remind").addEventListener("click", shareHorseReminder);

async function shareOpenHorseInvite() {
  const game = state.horseGame;
  if (!game) return;
  const url = horseInviteUrl(game.id);
  const text = `Join ${game.createdBy}'s Open Horse push-up game.`;
  if (navigator.share) {
    try { await navigator.share({ title: "Open Horse", text, url }); } catch (e) { /* cancelled */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Invite link copied", 2500);
  } catch (e) {
    toast("Couldn't copy the link automatically.", 3500);
  }
}

$("btn-horse-open-share").addEventListener("click", shareOpenHorseInvite);

$("btn-horse-open-exit").addEventListener("click", async (e) => {
  const game = state.horseGame;
  if (!game) return;
  const button = e.currentTarget;
  const action = button.dataset.action;
  button.disabled = true;
  try {
    const res = action === "cancel"
      ? await workerCancelOpenHorseGame(game.id, state.currentUser)
      : await workerDeclineHorseInvite(game.id, state.currentUser);
    state.horseGame = res.game;
    upsertLocalHorseGame(res.game);
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    toast(action === "cancel" ? "Open session cancelled" : "You left the game", 2500);
    showScreen("screen-user");
  } catch (err) {
    toast(err.message || "Couldn't update the game.", 4000);
    button.disabled = false;
  }
});

function horseLinkGameId() {
  return location.hash.match(/^#horse=([a-z0-9-]{1,64})$/)?.[1] || null;
}

function renderOpenHorseJoin(game) {
  const model = openHorseJoinModel(game, state.currentUser);
  $("horse-join-title").textContent = model.title;
  $("horse-join-sub").textContent = model.state === "ready"
    ? `Joining as ${state.currentUser}. ${model.slotsLeft} player slot${model.slotsLeft === 1 ? "" : "s"} remaining.`
    : model.state === "joined" ? `You're joining as ${state.currentUser}.` : "Ask the host for a current Open session link.";
  const names = game?.turnOrder || [];
  const playerRows = names.map((name) => `
    <div class="tier1-row horse-player-row">
      <span class="avatar-circle horse-avatar" data-avatar="${avatarForUser(name).id}"></span>
      <span class="horse-player-name">${escapeHtml(name)}</span>
      <span class="horse-player-tag">${name === game.createdBy ? "Host" : "Joined"}</span>
    </div>`).join("");
  const slots = game?.sessionType === "open"
    ? Array.from({ length: Math.max(0, 4 - names.length) }, () => `
      <div class="tier1-row horse-player-row horse-open-slot">
        <span class="horse-open-slot-icon">＋</span><span class="horse-player-name">Open slot</span>
      </div>`).join("")
    : "";
  $("horse-join-player-list").innerHTML = playerRows + slots;
  $("horse-join-player-list").querySelectorAll(".horse-avatar").forEach((el) => setAvatarEl(el, el.dataset.avatar));
  $("btn-horse-confirm-join").classList.toggle("hidden", !model.canJoin);
  $("btn-horse-view-joined").classList.toggle("hidden", model.state !== "joined");
}

async function openHorseGameFromHash() {
  const gameId = horseLinkGameId();
  if (!gameId || !state.currentUser) return false;
  let game = getCachedData().horseGames.find((item) => item.id === gameId);
  if (!game && workerConfigured()) {
    try {
      await refreshFromRemote();
      game = getCachedData().horseGames.find((item) => item.id === gameId);
    } catch (e) { /* cached missing state below */ }
  }
  state.horseGame = game || null;
  renderOpenHorseJoin(game);
  showScreen("screen-horse-join");
  return true;
}

$("btn-horse-confirm-join").addEventListener("click", async (e) => {
  const game = state.horseGame;
  if (!game) return;
  e.currentTarget.disabled = true;
  try {
    const res = await workerJoinOpenHorseGame(game.id, state.currentUser);
    state.horseGame = res.game;
    upsertLocalHorseGame(res.game);
    await openHorseTurnOrder();
  } catch (err) {
    await refreshFromRemote().catch(() => {});
    const fresh = getCachedData().horseGames.find((item) => item.id === game.id);
    state.horseGame = fresh || game;
    renderOpenHorseJoin(fresh);
    toast(err.message || "Couldn't join the game.", 4000);
  } finally {
    e.currentTarget.disabled = false;
  }
});

$("btn-horse-view-joined").addEventListener("click", async () => {
  await openHorseTurnOrder();
});

$("btn-horse-join-back").addEventListener("click", () => {
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  showScreen("screen-user");
});

// Async (invite) games refresh from the server once on entry — see
// HORSE_PLAN.md's "in-app polling only" decision, no live interval polling.
async function openHorseTurnOrder() {
  const game = state.horseGame;
  if (game && (game.sessionType === "invite" || game.sessionType === "open")) {
    await refreshFromRemote();
    const fresh = getCachedData().horseGames.find((g) => g.id === game.id);
    if (fresh) state.horseGame = fresh;
  }
  if (state.horseGame.status === "complete") {
    renderHorseSummary();
    showScreen("screen-horse-summary");
    return;
  }
  // The match clock ran out but nobody's tallied yet — skip the turn-order
  // screen's "time's up" holding pattern (and any stuck target choice) and
  // go straight to the scores.
  if (state.horseGame.sessionType !== "live" && isTimeUp(state.horseGame)) {
    try {
      const res = await workerTallyHorseGame(state.horseGame.id);
      state.horseGame = res.game;
      upsertLocalHorseGame(res.game);
      renderHorseSummary();
      showScreen("screen-horse-summary");
      return;
    } catch (err) {
      // Fall through — still show whatever's next (choice screen or
      // turn-order) if the auto-tally couldn't reach the server.
    }
  }
  // A set just met/beat an existing bar and is waiting on the shooter's
  // target choice. The shooter gets the interactive picker; anyone else
  // reopening the game mid-choice gets a read-only "waiting on X" view —
  // see renderHorseChoiceScreen.
  if (state.horseGame.pendingChoice) {
    renderHorseChoiceScreen();
    showScreen("screen-horse-target-choice");
    return;
  }
  renderHorseTurnOrder();
  showScreen("screen-horse-turn-order");
}

function renderHorseChoiceScreen() {
  const game = state.horseGame;
  const copy = horseChoiceCopy(game);
  if (!copy) return;
  const isShooter = copy.user === state.currentUser;
  $("horse-choice-kicker").textContent = isShooter ? "YOU CLEARED IT" : `${copy.user.toUpperCase()} CLEARED IT`;
  $("horse-choice-reps").textContent = `${copy.reps}`;
  $("horse-choice-modifier").textContent = copy.modifierLabel ? `Match required: ${copy.modifierLabel}` : "";
  $("horse-choice-modifier").classList.toggle("hidden", !copy.modifierLabel);
  $("horse-choice-prompt").textContent = isShooter
    ? "How do you want to leave it for the next player?"
    : `Waiting on ${copy.user} to set the next target.`;
  $("btn-horse-choice-match").textContent = `Force the full ${copy.reps}`;
  $("btn-horse-choice-match").classList.toggle("hidden", !isShooter);
  const slider = $("horse-choice-slider");
  slider.min = "1";
  slider.max = String(copy.reps);
  slider.value = String(copy.reps);
  $("horse-choice-slider-value").textContent = String(copy.reps);
  // Nowhere to go lower than 1 — hide the custom picker entirely if the
  // shooter's reps were already 1, and always hide it for onlookers.
  $("horse-choice-custom-section").classList.toggle("hidden", !isShooter || copy.reps <= 1);
}

async function resolveHorseChoice(mode, customTarget) {
  const game = state.horseGame;
  if (!game?.pendingChoice) return;
  const user = game.pendingChoice.user;
  let updated;
  if (game.sessionType === "invite" || game.sessionType === "open") {
    try {
      const res = await workerChooseHorseTarget({ gameId: game.id, user, mode, customTarget });
      updated = res.game;
    } catch (e) {
      // Best-effort local fallback so this device's UI still progresses —
      // the server stays the source of truth and the next successful
      // refresh (see openHorseTurnOrder) reconciles it.
      toast("Couldn't sync your pick — check your connection. Your view may be out of date until it reconnects.", 5000);
      updated = chooseHorseTarget(game, { user, mode, customTarget, now: Date.now() });
    }
  } else {
    updated = chooseHorseTarget(game, { user, mode, customTarget, now: Date.now() });
  }
  state.horseGame = updated;
  upsertLocalHorseGame(updated);
  if (updated.status === "complete") {
    renderHorseSummary();
    showScreen("screen-horse-summary");
    launchConfetti("horse-summary-confetti");
    return;
  }
  await openHorseTurnOrder();
}

$("btn-horse-choice-match").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try { await resolveHorseChoice("match"); } finally { btn.disabled = false; }
});

$("btn-horse-choice-dec").addEventListener("click", () => {
  const slider = $("horse-choice-slider");
  slider.value = String(Math.max(Number(slider.min), Number(slider.value) - 1));
  $("horse-choice-slider-value").textContent = slider.value;
});
$("btn-horse-choice-inc").addEventListener("click", () => {
  const slider = $("horse-choice-slider");
  slider.value = String(Math.min(Number(slider.max), Number(slider.value) + 1));
  $("horse-choice-slider-value").textContent = slider.value;
});
$("horse-choice-slider").addEventListener("input", (e) => {
  $("horse-choice-slider-value").textContent = e.target.value;
});

$("btn-horse-choice-custom").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try { await resolveHorseChoice("custom", Number($("horse-choice-slider").value)); } finally { btn.disabled = false; }
});

$("btn-horse-take-turn").addEventListener("click", () => {
  beginHorseTurn(currentTurnPlayer(state.horseGame));
});

$("btn-horse-tally").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    const res = await workerTallyHorseGame(state.horseGame.id);
    state.horseGame = res.game;
    upsertLocalHorseGame(res.game);
    renderHorseSummary();
    showScreen("screen-horse-summary");
  } catch (err) {
    toast("Couldn't tally the scores — check your connection.", 3500);
  } finally {
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
  // This screen only ever shows on a failed set (missed the bar), so it
  // always gets the miss animation — re-triggered via remove/reflow/add the
  // same way updateModeCounterBadge restarts its pop.
  const badge = $("horse-letter-badge");
  badge.classList.remove("horse-letter-badge-fail");
  void badge.offsetWidth;
  badge.classList.add("horse-letter-badge-fail");
  vibrate(200);
}

$("btn-horse-letter-continue").addEventListener("click", async () => {
  if (state.horseGame.status === "complete") {
    renderHorseSummary();
    showScreen("screen-horse-summary");
  } else {
    await openHorseTurnOrder();
  }
});

$("btn-horse-letter-share").addEventListener("click", async () => {
  const { pickHorseLetterFailMessage } = workoutShareMessages || await preloadWorkoutShareMessages();
  const evt = state.horseLetterEvent;
  const game = state.horseGame;
  const nextName = game.status === "complete" ? null : currentTurnPlayer(game);
  const message = pickHorseLetterFailMessage({ name: evt.forUser, letter: game.word[4 - evt.lettersLeft], nextName });
  const url = game.sessionType === "open" ? horseInviteUrl(game.id) : location.href;
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
});

// Guards against re-announcing the same win if renderHorseSummary happens to
// run again for a game already on screen (e.g. re-entering via the bell).
let horseWinAnnouncedForGameId = null;

function renderHorseSummary() {
  const game = state.horseGame;
  if (game.winner?.includes(state.currentUser) && horseWinAnnouncedForGameId !== game.id) {
    horseWinAnnouncedForGameId = game.id;
    speak(pickFrom(HORSE_WIN_LINES));
  }
  const rows = horseSummaryRows(game);
  $("horse-summary-crown").innerHTML = `👑 ${game.winner.map(escapeHtml).join(" & ")} wins`;
  const stats = horseSummaryStats(game);
  const roundsLabel = `${stats.rounds} round${stats.rounds === 1 ? "" : "s"}`;
  $("horse-summary-stats").textContent = stats.durationMs == null ? roundsLabel : `${roundsLabel} · ${horseFormatDuration(stats.durationMs)}`;
  $("horse-summary-list").innerHTML = rows.map((row) => {
    // Elimination ends the game with the losers all OUT; a match-timer tally
    // can end it with non-winners still in play — "letters" reads truer than
    // a false "OUT" for them.
    const subtitle = row.isWinner
      ? `Winner${row.letters === 0 ? " · never spelled a letter" : ""}`
      : row.out ? `OUT · ${row.wordSoFar}` : `${row.letters} letter${row.letters === 1 ? "" : "s"} · ${row.wordSoFar}`;
    return `
    <div class="tier1-row horse-player-row${row.isWinner ? " horse-summary-row-winner" : ""}">
      <span class="avatar-circle horse-avatar" data-avatar="${avatarForUser(row.name).id}"></span>
      <span class="horse-summary-name-col">
        <span class="horse-summary-name${row.isWinner ? "" : " horse-summary-name-out"}">${escapeHtml(row.name)}</span>
        <span class="horse-summary-subtitle">${escapeHtml(subtitle)}</span>
      </span>
      <span class="horse-summary-total">${row.totalReps}</span>
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
  const stats = horseSummaryStats(game);
  const winners = game.winner || [];
  const { pickHorseCompleteMessage } = workoutShareMessages || await preloadWorkoutShareMessages();
  const intro = pickHorseCompleteMessage({
    winnerText: winners.join(" & "),
    winnerIsPlural: winners.length > 1,
    word: game.word,
    rounds: stats.rounds,
    durationText: stats.durationMs != null ? horseFormatDuration(stats.durationMs) : null,
    loserCount: Math.max(0, rows.length - winners.length),
    topTotal: Math.max(0, ...rows.map((r) => r.totalReps)),
  });
  const text = `${intro}\n${rows.map((r) => `${r.isWinner ? "👑" : "❌"} ${r.name} — ${r.isWinner ? "Winner" : r.out ? `OUT · ${r.wordSoFar}` : `${r.wordSoFar || "no letters"}`}`).join("\n")}`;
  if (navigator.share) {
    try { await navigator.share({ text }); } catch (e) { /* user cancelled the share sheet */ }
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    toast("Copied results to clipboard", 2500);
  }
});

// ------------------- Tug of War mode -------------------
// Mirrors the Horse section above structurally: pure rules live in
// tug-of-war.js, pure display helpers in screens/tug-of-war.js, and this
// section wires DOM + Worker calls exactly the way Horse's does. See the
// design doc for the full 7-screen spec.

let towInviteExpanded = false;

function towAllSetupPlayers() {
  return [...state.towSetupTeams.a, ...state.towSetupTeams.b];
}

function towTeamRowHTML(name, readOnly) {
  const isSelf = name === state.currentUser;
  const trailing = readOnly ? "" : `
    <span class="tow-swap-icon" aria-hidden="true">⇄</span>
    <button type="button" class="icon-btn" data-remove-tow-player="${escapeHtml(name)}" aria-label="Remove ${escapeHtml(name)}">✕</button>`;
  return `
  <div class="tier1-row tow-player-row${isSelf ? " tow-row-self" : ""}" data-tow-player-row="${escapeHtml(name)}">
    <span class="avatar-circle tow-avatar" data-avatar="${avatarForUser(name).id}"></span>
    <span class="tow-player-name">${escapeHtml(name)}${isSelf ? " (you)" : ""}</span>
    ${trailing}
  </div>`;
}

function towWaitingRowsHTML(count) {
  let html = "";
  for (let i = 0; i < count; i += 1) {
    html += `<div class="tier1-row tow-player-row tow-waiting-row"><span class="tow-waiting-icon" aria-hidden="true">＋</span><span class="tow-player-name tow-waiting-label">Waiting…</span></div>`;
  }
  return html;
}

function renderTowStatUI() {
  $("tow-target-value").textContent = String(state.towTarget);
  $("tow-rounds-value").textContent = String(state.towRounds);
}

function renderTowSessionUI() {
  document.querySelectorAll("#tow-session-select .segment[data-tow-session]").forEach((s) => {
    s.classList.toggle("active", s.dataset.towSession === state.towSessionType);
  });
  $("tow-session-note").textContent = state.towSessionType === "live"
    ? "Pass one phone around the room, turn by turn."
    : state.towSessionType === "online"
      ? "Everyone gets a turn notification, take your burst whenever."
      : "Share a join link, anyone taps in until both teams fill or you hit Start.";
}

// Renders the TEAMS section for both the normal setup state and the Open
// "filling up" lobby state (screen 1b) — same screen, different data source
// and a few toggled controls, per the spec.
function renderTowTeamsUI() {
  const game = state.towGame;
  const inLobby = !!(game && game.sessionType === "open" && game.status === "lobby");
  const isOpenSetup = state.towSessionType === "open";
  const isHost = inLobby ? game.createdBy === state.currentUser : true;
  const nameA = inLobby ? game.teams.a.name : state.towTeamNames.a;
  const nameB = inLobby ? game.teams.b.name : state.towTeamNames.b;
  const playersA = inLobby ? game.teams.a.players : state.towSetupTeams.a;
  const playersB = inLobby ? game.teams.b.players : state.towSetupTeams.b;
  const readOnly = inLobby;

  $("tow-team-a-name").textContent = nameA;
  $("tow-team-b-name").textContent = nameB;
  const mineA = playersA.includes(state.currentUser);
  const mineB = playersB.includes(state.currentUser);
  $("tow-team-a-name").classList.toggle("tow-team-name-mine", mineA);
  $("tow-team-b-name").classList.toggle("tow-team-name-mine", mineB);
  $("tow-team-a-card").classList.toggle("tow-team-card-mine", mineA);
  $("tow-team-b-card").classList.toggle("tow-team-card-mine", mineB);

  const perSide = inLobby ? Math.ceil(game.rosterSize / 2) : 0;
  $("tow-team-a-count").classList.toggle("hidden", !inLobby);
  $("tow-team-b-count").classList.toggle("hidden", !inLobby);
  if (inLobby) {
    $("tow-team-a-count").textContent = `${playersA.length}/${perSide}`;
    $("tow-team-b-count").textContent = `${playersB.length}/${perSide}`;
  }

  $("tow-team-a-list").innerHTML = playersA.map((n) => towTeamRowHTML(n, readOnly)).join("")
    + (inLobby ? towWaitingRowsHTML(Math.max(0, perSide - playersA.length)) : "");
  $("tow-team-b-list").innerHTML = playersB.map((n) => towTeamRowHTML(n, readOnly)).join("")
    + (inLobby ? towWaitingRowsHTML(Math.max(0, perSide - playersB.length)) : "");
  $("tow-team-a-list").querySelectorAll(".tow-avatar").forEach((el) => setAvatarEl(el, el.dataset.avatar));
  $("tow-team-b-list").querySelectorAll(".tow-avatar").forEach((el) => setAvatarEl(el, el.dataset.avatar));

  $("btn-tow-setup-share").classList.toggle("hidden", !(inLobby && isHost));
  $("tow-session-type-section").classList.toggle("hidden", inLobby);
  $("tow-name-note").classList.toggle("hidden", inLobby);
  $("btn-tow-invite-more").classList.toggle("hidden", inLobby || isOpenSetup);
  $("tow-invite-candidates").classList.add("hidden");
  $("tow-team-actions").classList.toggle("hidden", inLobby || isOpenSetup);
  $("tow-shuffle-hint").classList.toggle("hidden", inLobby || isOpenSetup);
  $("tow-open-hint").classList.toggle("hidden", !(isOpenSetup || inLobby));
  if (isOpenSetup || inLobby) {
    $("tow-open-hint").textContent = !inLobby || isHost
      ? "Joiners tap a link and land in whichever team has room"
      : `Waiting on ${game.createdBy} to start the match…`;
  }

  const startBtn = $("btn-tow-start");
  if (inLobby) {
    const total = playersA.length + playersB.length;
    startBtn.classList.toggle("hidden", !isHost);
    startBtn.textContent = `Start now (${total}/${game.rosterSize})`;
    startBtn.disabled = playersA.length < 1 || playersB.length < 1;
  } else {
    startBtn.classList.remove("hidden");
    startBtn.textContent = "Start match";
    startBtn.disabled = !isOpenSetup && (playersA.length < 1 || playersB.length < 1);
  }
}

// mode: "reset" (fresh setup, e.g. from the Explore card), "rematch" (seed
// from the just-finished game's settings/rosters), or "keep" (re-render only
// — used right after creating an Open lobby, so the fresh game stays put).
function renderTowSetup(mode = "reset") {
  if (mode === "reset") {
    state.towGame = null;
    state.towTarget = 300;
    state.towRounds = 5;
    state.towSessionType = "live";
    state.towSetupTeams = towAutoBalanceTeams([state.currentUser]);
    state.towTeamNames = randomTowTeamNames();
  } else if (mode === "rematch") {
    const finished = state.towGame;
    if (finished) {
      state.towTarget = finished.target;
      state.towRounds = finished.rounds;
      state.towSessionType = finished.sessionType === "open" ? "live" : finished.sessionType;
      state.towSetupTeams = { a: [...finished.teams.a.players], b: [...finished.teams.b.players] };
      state.towTeamNames = { a: finished.teams.a.name, b: finished.teams.b.name };
    }
    state.towGame = null;
  }
  towInviteExpanded = false;
  renderTowStatUI();
  renderTowSessionUI();
  renderTowTeamsUI();
}

$("btn-tow-setup-back").addEventListener("click", () => {
  guardLeaveWorkout(() => showScreen("screen-explore-modes"));
});

function towStepper(key, delta, min, max) {
  state[key] = Math.min(max, Math.max(min, state[key] + delta));
  renderTowStatUI();
}
$("btn-tow-target-dec").addEventListener("click", () => towStepper("towTarget", -10, 10, 5000));
$("btn-tow-target-inc").addEventListener("click", () => towStepper("towTarget", 10, 10, 5000));
$("btn-tow-rounds-dec").addEventListener("click", () => towStepper("towRounds", -1, 1, 30));
$("btn-tow-rounds-inc").addEventListener("click", () => towStepper("towRounds", 1, 1, 30));

$("tow-session-select").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment[data-tow-session]");
  if (!btn) return;
  state.towSessionType = btn.dataset.towSession;
  renderTowSessionUI();
  renderTowTeamsUI();
});

$("btn-tow-invite-more").addEventListener("click", () => {
  towInviteExpanded = !towInviteExpanded;
  const candidates = $("tow-invite-candidates");
  const known = orderedUserNames(getAllSessionsForDisplay(), state.currentUser)
    .filter((name) => !towAllSetupPlayers().includes(name));
  candidates.classList.toggle("hidden", !towInviteExpanded);
  if (towInviteExpanded) {
    candidates.innerHTML = known.length
      ? known.map((name) => `
        <button type="button" class="tier1-row tow-player-row tow-candidate-row" data-add-tow-player="${escapeHtml(name)}">
          <span class="avatar-circle tow-avatar" data-avatar="${avatarForUser(name).id}"></span>
          <span class="tow-player-name">${escapeHtml(name)}</span>
        </button>`).join("")
      : `<p class="screen-sub">Nobody else has flexed yet.</p>`;
    candidates.querySelectorAll(".tow-avatar").forEach((el) => setAvatarEl(el, el.dataset.avatar));
  }
});

$("tow-invite-candidates").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-add-tow-player]");
  if (!btn) return;
  const name = btn.dataset.addTowPlayer;
  if (!towAllSetupPlayers().includes(name)) {
    const side = state.towSetupTeams.a.length <= state.towSetupTeams.b.length ? "a" : "b";
    state.towSetupTeams = { ...state.towSetupTeams, [side]: [...state.towSetupTeams[side], name] };
  }
  towInviteExpanded = false;
  $("tow-invite-candidates").classList.add("hidden");
  renderTowTeamsUI();
});

function towTeamListClick(e) {
  if (state.towGame && state.towGame.status === "lobby") return; // read-only once real joins are live
  const removeBtn = e.target.closest("[data-remove-tow-player]");
  if (removeBtn) {
    const name = removeBtn.dataset.removeTowPlayer;
    state.towSetupTeams = { a: state.towSetupTeams.a.filter((n) => n !== name), b: state.towSetupTeams.b.filter((n) => n !== name) };
    renderTowTeamsUI();
    return;
  }
  const row = e.target.closest("[data-tow-player-row]");
  if (row) {
    state.towSetupTeams = towSwapPlayerSide(state.towSetupTeams, row.dataset.towPlayerRow);
    renderTowTeamsUI();
  }
}
$("tow-team-a-list").addEventListener("click", towTeamListClick);
$("tow-team-b-list").addEventListener("click", towTeamListClick);

$("btn-tow-reroll-names").addEventListener("click", () => {
  state.towTeamNames = randomTowTeamNames();
  renderTowTeamsUI();
});
$("btn-tow-shuffle-teams").addEventListener("click", () => {
  state.towSetupTeams = towAutoBalanceTeams(towAllSetupPlayers());
  renderTowTeamsUI();
});

async function shareTowInvite() {
  const game = state.towGame;
  if (!game) return;
  const url = towInviteUrl(game.id);
  const text = `Join ${game.createdBy}'s Tug of War.`;
  if (navigator.share) {
    try { await navigator.share({ title: "Tug of War", text, url }); } catch (e) { /* cancelled */ }
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast("Invite link copied", 2500);
  }
}
$("btn-tow-setup-share").addEventListener("click", shareTowInvite);

$("btn-tow-start").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const game = state.towGame;

  // Already-created Open lobby — this tap means "Start now".
  if (game && game.sessionType === "open" && game.status === "lobby") {
    btn.disabled = true;
    try {
      const res = await workerStartOpenTowGame(game.id, state.currentUser);
      state.towGame = res.game;
      upsertLocalTowGame(res.game);
      await openTowMatch({ skipRefresh: true });
    } catch (err) {
      toast(err.message || "Couldn't start the match — check your connection.", 4000);
    } finally {
      btn.disabled = false;
    }
    return;
  }

  if (state.towSessionType === "open") {
    btn.disabled = true;
    try {
      const res = await workerCreateTowGame({ target: state.towTarget, rounds: state.towRounds, sessionType: "open", createdBy: state.currentUser });
      state.towGame = res.game;
      upsertLocalTowGame(res.game);
      renderTowSetup("keep");
    } catch (err) {
      toast(err.message || "Couldn't create the game — check your connection and try again.", 4000);
    } finally {
      btn.disabled = false;
    }
    return;
  }

  if (state.towSetupTeams.a.length < 1 || state.towSetupTeams.b.length < 1) return;
  const input = {
    target: state.towTarget,
    rounds: state.towRounds,
    sessionType: state.towSessionType,
    createdBy: state.currentUser,
    teams: {
      a: { name: state.towTeamNames.a, players: state.towSetupTeams.a },
      b: { name: state.towTeamNames.b, players: state.towSetupTeams.b },
    },
  };

  if (state.towSessionType === "online") {
    btn.disabled = true;
    try {
      const res = await workerCreateTowGame(input);
      state.towGame = res.game;
      upsertLocalTowGame(res.game);
      await openTowMatch({ skipRefresh: true });
    } catch (err) {
      toast(err.message || "Couldn't create the game — check your connection and try again.", 4000);
    } finally {
      btn.disabled = false;
    }
    return;
  }

  state.towGame = createTugOfWarGame(input);
  showTowHandoff();
});

// ---- Join screen (a new player tapping the #tow= invite link) ----

function towLinkGameId() {
  return location.hash.match(/^#tow=([a-z0-9-]{1,64})$/)?.[1] || null;
}

function renderTowJoin(game) {
  const model = openTowJoinModel(game, state.currentUser);
  $("tow-join-title").textContent = model.title;
  $("tow-join-sub").textContent = model.state === "ready"
    ? `${model.slotsLeft} slot${model.slotsLeft === 1 ? "" : "s"} left`
    : model.state === "joined" ? "You're already in."
      : model.state === "full" ? "Both teams are full."
        : model.state === "started" ? "This match has already started."
          : model.state === "cancelled" ? "The host cancelled this game."
            : "";
  if (game && game.teams) {
    $("tow-join-team-a-name").textContent = game.teams.a.name;
    $("tow-join-team-b-name").textContent = game.teams.b.name;
    $("tow-join-team-a-list").innerHTML = game.teams.a.players.map((n) => towTeamRowHTML(n, true)).join("");
    $("tow-join-team-b-list").innerHTML = game.teams.b.players.map((n) => towTeamRowHTML(n, true)).join("");
    $("tow-join-team-a-list").querySelectorAll(".tow-avatar").forEach((el) => setAvatarEl(el, el.dataset.avatar));
    $("tow-join-team-b-list").querySelectorAll(".tow-avatar").forEach((el) => setAvatarEl(el, el.dataset.avatar));
  } else {
    $("tow-join-team-a-list").innerHTML = "";
    $("tow-join-team-b-list").innerHTML = "";
  }
  $("btn-tow-confirm-join").classList.toggle("hidden", !model.canJoin);
  $("btn-tow-view-joined").classList.toggle("hidden", model.state !== "joined");
}

async function openTowGameFromHash() {
  const gameId = towLinkGameId();
  if (!gameId || !state.currentUser) return false;
  let game = getCachedData().towGames.find((item) => item.id === gameId);
  if (!game && workerConfigured()) {
    try {
      await refreshFromRemote();
      game = getCachedData().towGames.find((item) => item.id === gameId);
    } catch (e) { /* offline or Worker unreachable; show what we have */ }
  }
  state.towGame = game || null;
  renderTowJoin(game);
  showScreen("screen-tow-join");
  return true;
}

$("btn-tow-confirm-join").addEventListener("click", async (e) => {
  const game = state.towGame;
  if (!game) return;
  const button = e.currentTarget;
  button.disabled = true;
  try {
    const res = await workerJoinOpenTowGame(game.id, state.currentUser);
    state.towGame = res.game;
    upsertLocalTowGame(res.game);
    renderTowSetup("keep");
    showScreen("screen-tow-setup");
  } catch (err) {
    toast(err.message || "Couldn't join — check your connection.", 4000);
    const fresh = getCachedData().towGames.find((item) => item.id === game.id);
    state.towGame = fresh || game;
    renderTowJoin(fresh);
  } finally {
    button.disabled = false;
  }
});

$("btn-tow-view-joined").addEventListener("click", async () => {
  await openTowMatch();
});

$("btn-tow-join-back").addEventListener("click", () => {
  guardLeaveWorkout(() => showScreen("screen-explore-modes"));
});

// ---- Match view (the rope) ----

function renderTowRopeInto(fillId, chevronId, game) {
  const rope = towRopeModel(game);
  const pct = rope.position * 100;
  const fill = $(fillId);
  const chevron = $(chevronId);
  fill.style.left = pct >= 50 ? "50%" : `${pct}%`;
  fill.style.width = `${Math.abs(pct - 50)}%`;
  fill.classList.toggle("tow-rope-fill-a", rope.leadingSide === "a");
  fill.classList.toggle("tow-rope-fill-b", rope.leadingSide === "b");
  chevron.style.left = `${pct}%`;
  chevron.textContent = rope.leadingSide === "a" ? "◀" : rope.leadingSide === "b" ? "▶" : "•";
  chevron.classList.toggle("tow-rope-chevron-a", rope.leadingSide === "a");
  chevron.classList.toggle("tow-rope-chevron-b", rope.leadingSide === "b");
}

function renderTowMatch() {
  const game = state.towGame;
  if (!game) return;
  $("tow-round-pill").textContent = game.sudden ? `Sudden death · Round ${game.round}` : `Round ${game.round}/${game.rounds}`;
  $("tow-match-team-a-name").textContent = game.teams.a.name;
  $("tow-match-team-b-name").textContent = game.teams.b.name;
  $("tow-match-team-a-score").textContent = String(game.scores.a);
  $("tow-match-team-b-score").textContent = String(game.scores.b);
  $("tow-match-target-value").textContent = String(game.target);
  renderTowRopeInto("tow-rope-fill", "tow-rope-chevron", game);
  $("tow-remaining-a").textContent = towRemainingLabel(game, "a");
  $("tow-remaining-b").textContent = towRemainingLabel(game, "b");

  const rows = towPlayerRows(game);
  $("tow-mini-tiles").innerHTML = rows.map((r) => `
    <div class="tow-mini-tile tow-mini-tile-${r.team}">
      <span class="avatar-circle tow-avatar" data-avatar="${avatarForUser(r.name).id}"></span>
      <span class="tow-mini-name">${escapeHtml(r.name)}</span>
      <span class="tow-mini-reps">${r.reps}</span>
    </div>`).join("");
  $("tow-mini-tiles").querySelectorAll(".tow-avatar").forEach((el) => setAvatarEl(el, el.dataset.avatar));

  const status = towTurnStatusCopy(game, state.currentUser);
  $("btn-tow-take-burst").classList.toggle("hidden", !status.cta);
  if (status.cta) $("btn-tow-take-burst").textContent = status.cta;
  $("tow-match-status").textContent = status.waiting || "";
  $("tow-match-status").classList.toggle("hidden", !status.waiting);
}

// Central re-render + navigation after any Tug of War state change — same
// role as Horse's openHorseTurnOrder.
async function openTowMatch({ skipRefresh = false } = {}) {
  const game = state.towGame;
  if (!game) return;
  if (!skipRefresh && game.sessionType !== "live") {
    const fresh = getCachedData().towGames.find((g) => g.id === game.id);
    if (fresh) state.towGame = fresh;
  }
  if (state.towGame.status === "complete" || state.towGame.status === "voided") {
    renderTowSummary();
    showScreen("screen-tow-summary");
    return;
  }
  if (state.towGame.status === "lobby") {
    renderTowSetup("keep");
    showScreen("screen-tow-setup");
    return;
  }
  renderTowMatch();
  showScreen("screen-tow-match");
}

$("btn-tow-match-back").addEventListener("click", () => {
  guardLeaveWorkout(() => showScreen("screen-explore-modes"));
});

$("btn-tow-take-burst").addEventListener("click", () => {
  const game = state.towGame;
  if (!game) return;
  if (game.sessionType === "live") {
    showTowHandoff();
  } else {
    beginTowBurst(state.currentUser);
  }
});

// ---- Live handoff (pass-the-phone) ----

function showTowHandoff() {
  const game = state.towGame;
  const name = towCurrentTurnPlayer(game);
  const team = towCurrentTurnTeam(game);
  $("tow-handoff-round").textContent = game.sudden ? `SUDDEN DEATH · ROUND ${game.round}` : `ROUND ${game.round} OF ${game.rounds}`;
  setAvatarEl($("tow-handoff-avatar"), avatarForUser(name).id, "4.5rem");
  $("tow-handoff-heading").textContent = `Pass to ${name}`;
  $("tow-handoff-sub").textContent = `${game.teams[team].name} · up next`;
  $("btn-tow-handoff-ready").textContent = `Ready, ${name}`;
  showScreen("screen-tow-handoff");
}

$("btn-tow-handoff-ready").addEventListener("click", () => {
  beginTowBurst(towCurrentTurnPlayer(state.towGame));
});

// Jumps screen-workout to a specific player's turn — same pass-the-phone
// relabeling trick as Horse's beginHorseTurn.
function beginTowBurst(name) {
  state.pushupMode = "tow";
  preserveNextModeSelection = true;
  guardLeaveWorkout(() => showScreen("screen-workout"));
  $("workout-username").textContent = name;
  setAvatarEl($("workout-avatar"), avatarForUser(name).id, "2rem");
  startWorkout();
}

// ---- Burst complete (the rope payoff) ----

function renderTowBurstComplete() {
  const game = state.towGame;
  const evt = state.towBurstEvent;
  if (!game || !evt) return;
  $("tow-burst-added").textContent = `+${evt.delta}`;
  $("tow-burst-team-line").textContent = `added to ${game.teams[evt.team].name}`;
  renderTowRopeInto("tow-burst-rope-fill", "tow-burst-rope-chevron", game);
  $("tow-burst-status").textContent = towBurstResultCopy(game, evt.team);
}

$("btn-tow-burst-continue").addEventListener("click", async () => {
  const game = state.towGame;
  if (!game) {
    showScreen("screen-explore-modes");
    return;
  }
  if (game.status === "complete" || game.status === "voided") {
    renderTowSummary();
    showScreen("screen-tow-summary");
    return;
  }
  if (game.sessionType === "live") {
    showTowHandoff();
  } else {
    await openTowMatch();
  }
});

// ---- Match summary ----

function renderTowSummary() {
  const game = state.towGame;
  if (!game) return;
  const model = towSummaryModel(game);
  $("tow-summary-winner").innerHTML = model.winnerName ? `${escapeHtml(model.winnerName)} wins 🎉` : "Match voided — not enough players";
  renderTowRopeInto("tow-summary-rope-fill", "tow-summary-rope-chevron", game);
  $("tow-summary-teams").innerHTML = model.teams.map((t) => `
    <div class="tow-summary-team-block${t.isWinner ? " tow-summary-team-winner" : ""}">
      <div class="tow-summary-team-header">
        <span class="tow-summary-team-name">${escapeHtml(t.name)}</span>
        <span class="tow-summary-team-total">${t.total}</span>
      </div>
      <div class="tow-summary-players">
        ${t.players.map((p) => `
        <div class="tier1-row tow-player-row">
          <span class="avatar-circle tow-avatar" data-avatar="${avatarForUser(p.name).id}"></span>
          <span class="tow-player-name">${escapeHtml(p.name)}</span>
          <span class="tow-player-reps">${p.reps}</span>
        </div>`).join("")}
      </div>
    </div>`).join("");
  $("tow-summary-teams").querySelectorAll(".tow-avatar").forEach((el) => setAvatarEl(el, el.dataset.avatar));
  if (game.winner) launchConfetti("tow-summary-confetti");
}

$("btn-tow-rematch").addEventListener("click", () => {
  renderTowSetup("rematch");
  guardLeaveWorkout(() => showScreen("screen-tow-setup"));
});

$("btn-tow-share").addEventListener("click", async () => {
  const game = state.towGame;
  if (!game) return;
  const model = towSummaryModel(game);
  const text = `🪢 TUG OF WAR IS OVER. ${model.winnerName ? `${model.winnerName} wins` : "No winner"} — ${model.teams.map((t) => `${t.name} ${t.total}`).join(" vs. ")}.\n`
    + model.teams.map((t) => `${t.isWinner ? "🎉" : "❌"} ${t.name} (${t.total}): ${t.players.map((p) => `${p.name} ${p.reps}`).join(", ")}`).join("\n");
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
// Every active invite game this user is part of — "turn"/"invite" are
// actionable (light the dot badge), "waiting" just means they're in a game
// that's progressing without them right now. The bell itself only shows at
// all when this list is non-empty (see renderHorseBellDropdown).
// Other players in the game besides `user` — appended to bell rows so two
// concurrent games (identical "Your turn in Horse" text otherwise) read as
// distinguishable at a glance instead of two copies of the same line.
function otherHorsePlayers(game, user) {
  return game.turnOrder.filter((name) => name !== user).join(", ");
}

function pendingHorseItems() {
  const user = state.currentUser;
  if (!user) return [];
  const games = getCachedData().horseGames || [];
  const items = [];
  for (const game of games) {
    if (game.status !== "active" || !["invite", "open"].includes(game.sessionType)) continue;
    if (!game.turnOrder.includes(user)) continue;
    const opponents = otherHorsePlayers(game, user);
    if (game.sessionType === "open" && game.turnOrder.length === 1 && game.target != null) continue;
    if (isTimeUp(game)) {
      items.push({ kind: "expired", gameId: game.id, opponents });
    } else if (game.pendingChoice && game.pendingChoice.user === user) {
      // currentTurnPlayer still resolves to the shooter while their choice
      // is pending — call it out separately from "turn" so the bell doesn't
      // say "do your set" when it's actually "pick the next target".
      items.push({ kind: "choosing", gameId: game.id, opponents });
    } else if (currentTurnPlayer(game) === user) {
      items.push({ kind: "turn", gameId: game.id, targetLabel: horseTargetLabel(game), opponents });
    } else if (game.sessionType === "invite" && user !== game.createdBy && !game.sets.some((s) => s.user === user)) {
      items.push({ kind: "invite", gameId: game.id, from: game.createdBy, opponents });
    } else if (game.sessionType === "open" && user === game.createdBy && game.turnOrder.length > 1) {
      const newest = game.turnOrder.slice(1).sort((a, b) => (game.players[b]?.joinedAt || 0) - (game.players[a]?.joinedAt || 0))[0];
      items.push({ kind: "joined", gameId: game.id, name: newest, opponents });
    } else {
      items.push({ kind: "waiting", gameId: game.id, upNow: currentTurnPlayer(game), opponents });
    }
  }
  return items;
}

// Tug of War's async (Online/Open, post-start) equivalent of pendingHorseItems
// above — Live pass-the-phone games never need a bell entry, same reasoning.
function otherTowPlayers(game, user) {
  return [...game.teams.a.players, ...game.teams.b.players].filter((n) => n !== user).join(", ");
}

function pendingTowItems() {
  const user = state.currentUser;
  if (!user) return [];
  const games = getCachedData().towGames || [];
  const items = [];
  for (const game of games) {
    if (game.sessionType === "live" || game.status !== "active" || !game.teams) continue;
    const inGame = game.teams.a.players.includes(user) || game.teams.b.players.includes(user);
    if (!inGame) continue;
    const opponents = otherTowPlayers(game, user);
    const side = towTeamOfPlayer(game, user);
    const teamName = game.teams[side]?.name || "Your team";
    if (towCurrentTurnPlayer(game) === user) {
      const other = side === "a" ? "b" : "a";
      const trailBy = game.scores[other] - game.scores[side];
      const trailLabel = trailBy > 0 ? `${teamName} trails by ${trailBy}` : trailBy < 0 ? `${teamName} leads by ${-trailBy}` : `${teamName} is tied`;
      items.push({ mode: "tow", kind: "turn", gameId: game.id, creator: game.createdBy, round: game.round, rounds: game.rounds, trailLabel, opponents });
    } else if (!game.bursts.some((b) => b.user === user) && user !== game.createdBy) {
      items.push({ mode: "tow", kind: "invite", gameId: game.id, creator: game.createdBy, from: game.createdBy, teamName, target: game.target, opponents });
    } else {
      items.push({ mode: "tow", kind: "waiting", gameId: game.id, creator: game.createdBy, upNow: towCurrentTurnPlayer(game), opponents });
    }
  }
  return items;
}

function towBellRowHTML(item) {
  const avatar = avatarForUser(item.creator).id;
  if (item.kind === "turn") {
    return `<button type="button" class="tier1-row horse-player-row horse-bell-row" data-bell-tow-turn="${item.gameId}">
        <span class="avatar-circle tow-bell-avatar" data-avatar="${avatar}"></span>
        <span class="horse-player-name">Your turn · Tug of war · Round ${item.round} of ${item.rounds} · ${escapeHtml(item.trailLabel)}</span>
      </button>`;
  }
  if (item.kind === "invite") {
    return `
      <div class="tier1-row horse-player-row">
        <span class="avatar-circle tow-bell-avatar" data-avatar="${avatar}"></span>
        <span class="horse-player-name">${escapeHtml(item.from)} invited you to Tug of war · ${escapeHtml(item.teamName)} · target ${item.target}</span>
        <button type="button" class="icon-btn" data-bell-tow-view="${item.gameId}" aria-label="View">→</button>
        <button type="button" class="icon-btn" data-bell-tow-decline="${item.gameId}" aria-label="Decline">✕</button>
      </div>`;
  }
  return `<button type="button" class="tier1-row horse-player-row horse-bell-row" data-bell-tow-view="${item.gameId}">
        <span class="avatar-circle tow-bell-avatar" data-avatar="${avatar}"></span>
        <span class="horse-player-name horse-player-status-waiting">Waiting on ${escapeHtml(item.upNow)} in Tug of war</span>
      </button>`;
}

function horseBellRowHTML(item) {
  {
    if (item.kind === "turn") {
      return `<button type="button" class="tier1-row horse-player-row horse-bell-row" data-bell-turn="${item.gameId}">
        <span aria-hidden="true">🐴</span>
        <span class="horse-player-name">Your turn in Horse${item.opponents ? ` vs. ${escapeHtml(item.opponents)}` : " · set the opening bar"}${item.targetLabel ? ` · beat ${escapeHtml(item.targetLabel)}` : ""}</span>
      </button>`;
    }
    if (item.kind === "invite") {
      // opponents already includes the inviter (item.from) — drop it here so
      // the line doesn't repeat their name right after naming them.
      const others = item.opponents.split(", ").filter((name) => name && name !== item.from).join(", ");
      return `
      <div class="tier1-row horse-player-row">
        <span aria-hidden="true">🐴</span>
        <span class="horse-player-name">${escapeHtml(item.from)} invited you to Horse${others ? ` vs. ${escapeHtml(others)}` : ""}</span>
        <button type="button" class="icon-btn" data-bell-join="${item.gameId}" aria-label="Join">→</button>
        <button type="button" class="icon-btn" data-bell-decline="${item.gameId}" aria-label="Decline">✕</button>
      </div>`;
    }
    if (item.kind === "choosing") {
      return `<button type="button" class="tier1-row horse-player-row horse-bell-row" data-bell-view="${item.gameId}">
        <span aria-hidden="true">🐴</span>
        <span class="horse-player-name">Your turn to set the target in Horse${item.opponents ? ` vs. ${escapeHtml(item.opponents)}` : ""}</span>
      </button>`;
    }
    if (item.kind === "expired") {
      return `<button type="button" class="tier1-row horse-player-row horse-bell-row" data-bell-view="${item.gameId}">
        <span aria-hidden="true">⏰</span>
        <span class="horse-player-name">Horse challenge${item.opponents ? ` vs. ${escapeHtml(item.opponents)}` : ""} ended — tally the scores</span>
      </button>`;
    }
    if (item.kind === "joined") {
      return `<button type="button" class="tier1-row horse-player-row horse-bell-row" data-bell-view="${item.gameId}">
        <span aria-hidden="true">🐴</span>
        <span class="horse-player-name">${escapeHtml(item.name)} joined your Open Horse game</span>
      </button>`;
    }
    const otherWaiting = item.opponents.split(", ").filter((name) => name && name !== item.upNow).join(", ");
    return `<button type="button" class="tier1-row horse-player-row horse-bell-row" data-bell-view="${item.gameId}">
        <span aria-hidden="true">🐴</span>
        <span class="horse-player-name horse-player-status-waiting">Waiting on ${escapeHtml(item.upNow)}${otherWaiting ? ` (vs. ${escapeHtml(otherWaiting)})` : ""} in Horse</span>
      </button>`;
  }
}

// Both Horse and Tug of War render into this same dropdown/list, per the
// spec ("reuse the same list/dropdown component Horse already renders
// into"). Individual unread dots already exist on rows, so there's no
// "mark all read" control here.
function renderHorseBellDropdown() {
  const items = [...pendingHorseItems(), ...pendingTowItems()];
  $("btn-horse-bell").classList.toggle("hidden", items.length === 0);
  // "turn"/"choosing" (your move right now) get the full urgent treatment —
  // opaque + wiggling. "invite"/"waiting" still light the dot, but stay calm.
  $("btn-horse-bell").classList.toggle("urgent", items.some((item) => item.kind === "turn" || item.kind === "choosing"));
  $("horse-bell-dot").classList.toggle("hidden", !items.some((item) => item.kind !== "waiting"));
  const list = $("horse-bell-list");
  list.innerHTML = items.length
    ? items.map((item) => (item.mode === "tow" ? towBellRowHTML(item) : horseBellRowHTML(item))).join("")
    : `<p class="screen-sub horse-bell-empty">Nothing pending.</p>`;
  list.querySelectorAll(".tow-bell-avatar").forEach((el) => setAvatarEl(el, el.dataset.avatar));
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
  const viewBtn = e.target.closest("[data-bell-view]");
  if (viewBtn) {
    const game = getCachedData().horseGames.find((g) => g.id === viewBtn.dataset.bellView);
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
    return;
  }
  const towTurnBtn = e.target.closest("[data-bell-tow-turn]");
  if (towTurnBtn) {
    const game = getCachedData().towGames.find((g) => g.id === towTurnBtn.dataset.bellTowTurn);
    if (game) {
      state.towGame = game;
      $("horse-bell-dropdown").classList.add("hidden");
      beginTowBurst(state.currentUser);
    }
    return;
  }
  const towViewBtn = e.target.closest("[data-bell-tow-view]");
  if (towViewBtn) {
    const game = getCachedData().towGames.find((g) => g.id === towViewBtn.dataset.bellTowView);
    if (game) {
      state.towGame = game;
      $("horse-bell-dropdown").classList.add("hidden");
      await openTowMatch();
    }
    return;
  }
  const towDeclineBtn = e.target.closest("[data-bell-tow-decline]");
  if (towDeclineBtn) {
    towDeclineBtn.disabled = true;
    try {
      const res = await workerDeclineTowInvite(towDeclineBtn.dataset.bellTowDecline, state.currentUser);
      upsertLocalTowGame(res.game);
      renderHorseBellDropdown();
    } catch (err) {
      toast("Couldn't decline — check your connection.", 3500);
      towDeclineBtn.disabled = false;
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

let mySessionsHasMore = false;

function renderMySessions() {
  const filtered = getAllSessionsForDisplay().filter((s) => state.mySessionsMode === "all" || sessionActivity(s) === state.mySessionsMode);
  const model = visibleUserSessions(filtered, state.currentUser, state.mySessionsShown);
  mySessionsHasMore = model.hasMore;
  const list = $("my-sessions-list");
  list.innerHTML = "";
  if (!model.total) {
    list.innerHTML = '<p class="settings-hint">No sessions yet.</p>';
    return;
  }
  for (const s of model.sessions) {
    const row = document.createElement("div");
    row.className = "my-session-row compare-clickable";
    row.innerHTML = `
      <span class="my-session-date">${formatSessionRowDate(s.timestamp)}</span>
      <span class="session-badge my-session-mode-badge">${sessionModeLabel(s)}</span>
      <span class="my-session-count">${s.type === "plank" ? formatDuration(s.count * 1000) : formatNumber(s.count)}</span>
      <button type="button" class="icon-btn my-session-details-btn" aria-label="Session details">›</button>
    `;
    const open = () => openSessionDetail(s, "screen-settings");
    row.querySelector(".my-session-details-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      open();
    });
    row.addEventListener("click", open);
    list.appendChild(row);
  }
}

function syncMySessionsModeControl() {
  const selected = MY_SESSIONS_MODE_OPTIONS.find((option) => option.id === state.mySessionsMode) || MY_SESSIONS_MODE_OPTIONS[0];
  $("mysessions-mode-label").textContent = selected.label;
  document.querySelectorAll("#mysessions-mode-menu .leaderboard-mode-option").forEach((option) => {
    const isSelected = option.dataset.mysessionsMode === selected.id;
    option.classList.toggle("selected", isSelected);
    option.setAttribute("aria-selected", String(isSelected));
  });
}

function setMySessionsModeMenuOpen(open, focusSelected = false) {
  $("mysessions-mode-trigger").setAttribute("aria-expanded", String(open));
  $("mysessions-mode-menu").classList.toggle("hidden", !open);
  if (open && focusSelected) {
    $("mysessions-mode-menu").querySelector(`[data-mysessions-mode="${state.mySessionsMode}"]`)?.focus();
  }
}

function selectMySessionsMode(mode) {
  if (!MY_SESSIONS_MODE_OPTIONS.some((option) => option.id === mode)) return;
  state.mySessionsMode = mode;
  state.mySessionsShown = 10;
  syncMySessionsModeControl();
  setMySessionsModeMenuOpen(false);
  renderMySessions();
}

$("mysessions-mode-trigger").addEventListener("click", () => {
  const open = $("mysessions-mode-trigger").getAttribute("aria-expanded") !== "true";
  setMySessionsModeMenuOpen(open, open);
});

$("mysessions-mode-trigger").addEventListener("keydown", (event) => {
  if (["ArrowDown", "Enter", " "].includes(event.key)) {
    event.preventDefault();
    setMySessionsModeMenuOpen(true, true);
  }
});

$("mysessions-mode-menu").addEventListener("click", (event) => {
  const option = event.target.closest(".leaderboard-mode-option");
  if (option) selectMySessionsMode(option.dataset.mysessionsMode);
});

$("mysessions-mode-menu").addEventListener("keydown", (event) => {
  const options = Array.from(document.querySelectorAll("#mysessions-mode-menu .leaderboard-mode-option"));
  const current = options.indexOf(document.activeElement);
  if (event.key === "Escape") {
    event.preventDefault();
    setMySessionsModeMenuOpen(false);
    $("mysessions-mode-trigger").focus();
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
    selectMySessionsMode(options[current].dataset.mysessionsMode);
    $("mysessions-mode-trigger").focus();
  }
});

$("app-main").addEventListener("scroll", () => {
  if (state.screen !== "screen-settings-mysessions" || !mySessionsHasMore) return;
  const el = $("app-main");
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 150) {
    state.mySessionsShown += 10;
    renderMySessions();
  }
});

// Returns whether the session was actually deleted, so callers outside My
// Sessions (e.g. the session-detail delete button) know whether to navigate
// away afterward.
async function confirmDeleteSession(id) {
  const ok = confirm("Delete this session from the shared leaderboard? This can't be undone.");
  if (!ok) return false;
  if (!navigator.onLine) {
    toast("Deleting a session requires a live connection.", 4000);
    return false;
  }
  try {
    await deleteSessionRemote(id);
  } catch (e) {
    toast("Couldn't delete right now — check your connection.", 4000);
    return false;
  }
  const cached = getCachedData();
  cached.sessions = cached.sessions.filter((s) => s.id !== id);
  cacheData(cached);
  setQueue(getQueue().filter((operation) => !(operation.type === "session" && operation.payload?.id === id)));
  toast("Session deleted.");
  renderMySessions();
  renderStreakBadge();
  return true;
}

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

// ------------------- situp mode: Phase 0 capture-test spike -------------------
// Standalone camera controller for the Settings "Situp capture test" row,
// independent of the live Situp workout screen's own controller — answers
// the go/no-go question (face detected reliably at ~1-1.5m from the feet,
// crunch<->lie swing big enough) before the real screen is trusted, per
// docs/situp-mode-plan.md. Uses the same face detector as pushups (phone at
// the feet is well within blaze_face_short_range's range) — the signal is
// face SIZE, like pushups, not position like squats. Logs bboxHeight AND
// centerY for diagnostics even though only bboxHeight (inverted) feeds the
// live counter; centerY helps spot framing drift in the downloaded trace.
const situpTraceState = { trace: [], running: false };

function situpCenterY(bbox, video) {
  return (bbox.originY + bbox.height / 2) / video.videoHeight;
}

function updateSitupTestFaceBox(bbox) {
  const video = $("situp-capture-test-video");
  const container = $("situp-capture-test-wrap");
  const cw = container.clientWidth, ch = container.clientHeight;
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.max(cw / vw, ch / vh);
  const offsetX = (cw - vw * scale) / 2, offsetY = (ch - vh * scale) / 2;
  const box = $("situp-capture-test-face-box");
  box.style.left = `${bbox.originX * scale + offsetX}px`;
  box.style.top = `${bbox.originY * scale + offsetY}px`;
  box.style.width = `${bbox.width * scale}px`;
  box.style.height = `${bbox.height * scale}px`;
  box.classList.remove("hidden");
}

const situpTestCamera = createCameraController({
  moduleUrl: FACE_DETECTOR_MODULE_URL,
  wasmUrl: FACE_DETECTOR_WASM_URL,
  modelUrl: FACE_DETECTOR_MODEL_URL,
  getVideo: () => $("situp-capture-test-video"),
  onDetection(bbox, inferenceMs) {
    const video = $("situp-capture-test-video");
    updateSitupTestFaceBox(bbox);
    situpTraceState.trace.push({
      t: Math.round(performance.now()),
      bboxHeight: +(bbox.height / video.videoHeight).toFixed(4),
      centerY: +situpCenterY(bbox, video).toFixed(4),
      detected: true,
      inferenceMs: Math.round(inferenceMs || 0),
    });
    if (situpTraceState.trace.length > TRACE_MAX_SAMPLES) situpTraceState.trace.shift();
  },
  onNoDetection(inferenceMs, startedAt) {
    $("situp-capture-test-face-box").classList.add("hidden");
    situpTraceState.trace.push({ t: Math.round(startedAt), bboxHeight: null, centerY: null, detected: false, inferenceMs: Math.round(inferenceMs || 0) });
    if (situpTraceState.trace.length > TRACE_MAX_SAMPLES) situpTraceState.trace.shift();
  },
});

async function startSitupCaptureTest() {
  if (situpTraceState.running) return;
  $("situp-capture-test-status").textContent = "Requesting camera…";
  let stream;
  try {
    stream = await situpTestCamera.requestStream();
  } catch (e) {
    $("situp-capture-test-status").textContent = "Camera access denied.";
    return;
  }
  $("situp-capture-test-status").textContent = "Loading face detector…";
  try {
    await situpTestCamera.ensureDetector();
  } catch (e) {
    $("situp-capture-test-status").textContent = "Couldn't load the face detection model.";
    stream.getTracks().forEach((t) => t.stop());
    return;
  }
  const video = $("situp-capture-test-video");
  video.srcObject = stream;
  try { await video.play(); } catch (e) { /* autoplay quirks */ }
  situpTraceState.trace = [];
  situpTraceState.running = true;
  $("situp-capture-test-wrap").classList.remove("hidden");
  $("btn-situp-capture-test").textContent = "Stop capture test";
  $("situp-capture-test-status").textContent = "Capturing — prop at your feet, do ten crunches.";
  $("btn-download-situp-trace").classList.add("hidden");
  situpTestCamera.startDetection();
}

function stopSitupCaptureTest() {
  if (!situpTraceState.running) return;
  situpTestCamera.stop();
  situpTraceState.running = false;
  $("situp-capture-test-wrap").classList.add("hidden");
  $("btn-situp-capture-test").textContent = "Crunch capture test";
  const total = situpTraceState.trace.length;
  const detected = situpTraceState.trace.filter((s) => s.detected).length;
  const rate = total ? Math.round((detected / total) * 100) : 0;
  $("situp-capture-test-status").textContent = total
    ? `Captured ${total} samples, ${rate}% with a detected face.`
    : "";
  $("btn-download-situp-trace").classList.toggle("hidden", !total);
}

$("btn-situp-capture-test").addEventListener("click", () => {
  if (situpTraceState.running) stopSitupCaptureTest();
  else startSitupCaptureTest();
});

$("btn-download-situp-trace").addEventListener("click", () => {
  if (!situpTraceState.trace.length) return;
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), samples: situpTraceState.trace }, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `bpb-situp-trace-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// ------------------- dashboard / leaderboard -------------------

async function renderDashboard() {
  await flushQueue().catch(() => {});
  const sessions = await refreshFromRemote();
  state.lastSessions = sessions;
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
  state.activityType = leaderboardActivity(mode);
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
  if (!event.target.closest("#mysessions-mode-picker")) setMySessionsModeMenuOpen(false);
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
// user's sessions, cumulative) — same 7-bar chart + trend-vs-prior-window
// line, just fed a different session set.
// The chart always shows 7 bars; each bar is one calendar unit of the
// selected period (one day, one week, one month, one quarter, one year),
// with the rightmost bar always the current, in-progress unit — so
// switching periods reframes the same chart at a different zoom level
// instead of the chart growing without bound.
const CHART_PERIOD_BUCKETS = {
  day: { headerLabel: "Last 7 days" },
  week: { headerLabel: "Last 7 weeks" },
  month: { headerLabel: "Last 7 months" },
  quarter: { headerLabel: "Last 7 quarters" },
  year: { headerLabel: "Last 7 years" },
};

// Start of the calendar unit for `period` that is `offset` units away from
// the current one (offset 0 = the unit containing `now`, -1 = the previous
// unit, etc). Built on the same period-start convention used everywhere
// else (e.g. Monday-start weeks), so bucket boundaries always agree with
// the rest of the app's "this week/month/quarter/year" math.
function periodBoundary(period, now, offset) {
  const d = new Date(periodStart(period, now));
  switch (period) {
    case "week": d.setDate(d.getDate() + offset * 7); break;
    case "month": d.setMonth(d.getMonth() + offset); break;
    case "quarter": d.setMonth(d.getMonth() + offset * 3); break;
    case "year": d.setFullYear(d.getFullYear() + offset); break;
    default: d.setDate(d.getDate() + offset); break;
  }
  return d;
}

const CHART_BUCKET_LABEL_FORMAT = {
  day: { weekday: "short" },
  week: { month: "numeric", day: "numeric" },
  month: { month: "short" },
  quarter: { month: "short" },
  year: { year: "numeric" },
};

function renderWeekChart(sessions, chartElId, trendElId, isPlank, isHolland = false, period = "day", headerElId = null) {
  const metricOf = (session) => (isHolland ? Number(session.hollandCycles) || 0 : Number(session.count) || 0);
  const config = CHART_PERIOD_BUCKETS[period] || CHART_PERIOD_BUCKETS.day;
  const bucketCount = 7;
  const now = new Date();

  const buckets = [];
  for (let i = bucketCount - 1; i >= 0; i--) {
    const offset = -i;
    buckets.push({ start: periodBoundary(period, now, offset), end: periodBoundary(period, now, offset + 1), total: 0 });
  }
  const windowStart = buckets[0].start.getTime();
  const windowEnd = buckets[bucketCount - 1].end.getTime();
  const priorWindowStart = periodBoundary(period, now, -(2 * bucketCount - 1)).getTime();

  let priorWindowTotal = 0;
  for (const session of sessions) {
    const timestamp = sessionTimestamp(session);
    if (timestamp >= priorWindowStart && timestamp < windowStart) {
      priorWindowTotal += metricOf(session);
    } else if (timestamp >= windowStart && timestamp < windowEnd) {
      const bucket = buckets.find((b) => timestamp >= b.start.getTime() && timestamp < b.end.getTime());
      if (bucket) bucket.total += metricOf(session);
    }
  }
  const maxTotal = Math.max(1, ...buckets.map((b) => b.total));

  $(chartElId).innerHTML = buckets.map((bucket, i) => {
    const isCurrent = i === bucketCount - 1;
    const label = isCurrent
      ? (period === "day" ? "Today" : "This")
      : bucket.start.toLocaleDateString(undefined, CHART_BUCKET_LABEL_FORMAT[period] || CHART_BUCKET_LABEL_FORMAT.day);
    const heightPct = bucket.total > 0 ? Math.max(6, Math.round((bucket.total / maxTotal) * 100)) : 3;
    const valueDisplay = bucket.total > 0 ? (isPlank ? formatDuration(bucket.total * 1000) : isHolland ? bucket.total.toFixed(1) : formatNumber(bucket.total)) : "";
    return `
      <div class="week-bar-col${isCurrent ? " week-bar-col-today" : ""}">
        <div class="week-bar-value">${valueDisplay}</div>
        <div class="week-bar" style="height:${heightPct}%"></div>
        <div class="week-bar-label">${label}</div>
      </div>
    `;
  }).join("");

  // Trend vs the same-length window immediately before this one — "are we improving".
  const windowTotal = buckets.reduce((sum, b) => sum + b.total, 0);
  const trendEl = $(trendElId);
  if (priorWindowTotal > 0) {
    const pct = Math.round(((windowTotal - priorWindowTotal) / priorWindowTotal) * 100);
    trendEl.textContent = `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs prior period`;
    trendEl.classList.toggle("week-trend-up", pct >= 0);
    trendEl.classList.toggle("week-trend-down", pct < 0);
    trendEl.classList.remove("hidden");
  } else {
    trendEl.classList.add("hidden");
  }

  if (headerElId) $(headerElId).textContent = config.headerLabel;
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
  state.compareUserA = null;
  state.compareMode = state.leaderboardMode;
  renderUserCompare();
  showScreen("screen-user-compare");
}

// Entry point for a shared #compare=A|B link. If the device's own user is
// one of the two named people, this behaves exactly like the normal
// tap-to-compare flow (self always renders as the "A" side). Otherwise —
// a third person's device, or nobody's picked a name yet — both sides show
// the named users explicitly instead of assuming "me vs. X".
function openUserCompareFromLink(nameA, nameB) {
  if (!nameA || !nameB || nameA === nameB) return;
  let a = nameA, b = nameB;
  if (state.currentUser && b === state.currentUser && a !== state.currentUser) [a, b] = [b, a];
  state.compareUser = b;
  state.compareUserA = a === state.currentUser ? null : a;
  state.compareMode = state.leaderboardMode || "all";
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
  const selfUser = state.compareUserA || state.currentUser;
  if (!otherUser || !selfUser) return;
  renderCompareModeControl();
  const model = comparisonModel(state.lastSessions || [], {
    userA: selfUser,
    userB: otherUser,
    mode: state.compareMode,
    periodStartMs: periodStart(state.dashboardPeriod).getTime(),
    now: new Date(),
  });

  const avatarA = avatarForUser(selfUser);
  const avatarB = avatarForUser(otherUser);
  $("compare-avatar-a").textContent = avatarA.emoji;
  $("compare-avatar-a").style.background = avatarA.bg;
  $("compare-avatar-b").textContent = avatarB.emoji;
  $("compare-avatar-b").style.background = avatarB.bg;
  $("compare-name-a").textContent = selfUser;
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
    const leader = model.aWins > model.bWins ? selfUser : otherUser;
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

// Same over-the-top voice as the leaderboard/roadtrip share pools (see
// SHARE_MESSAGES_MY_BONANZA) — leader/trailer/tied variants so the line
// actually reacts to who's winning instead of reading generic either way.
const COMPARE_SHARE_LEADING = [
  (ctx) => `${ctx.leader} leads ${ctx.trailer} ${ctx.leaderWins}-${ctx.trailerWins} in ${ctx.activityWord} categories 👑 It's not close.`,
  (ctx) => `${ctx.leader} vs ${ctx.trailer}: ${ctx.leaderWins} categories to ${ctx.trailerWins} 🩸 ${ctx.trailer} should see someone about that.`,
  (ctx) => `Head-to-head: ${ctx.leader} ${ctx.leaderWins}, ${ctx.trailer} ${ctx.trailerWins} 🏛️ History will remember this correctly.`,
  (ctx) => `${ctx.leader} is up ${ctx.leaderWins}-${ctx.trailerWins} on ${ctx.trailer} 😤 ${ctx.trailer}, this is your villain arc, use it.`,
  (ctx) => `${ctx.leaderWins} categories to ${ctx.trailerWins} — ${ctx.leader} over ${ctx.trailer} 🎯 The numbers have spoken and they are savage.`,
  (ctx) => `${ctx.leader} ${ctx.leaderWins}, ${ctx.trailer} ${ctx.trailerWins} 🫡 Somebody check on ${ctx.trailer}'s will to live.`,
];
const COMPARE_SHARE_TIED = [
  (ctx) => `${ctx.leader} and ${ctx.trailer} are dead even, ${ctx.leaderWins} categories apiece ⚖️ Somebody's about to snap.`,
  (ctx) => `${ctx.leaderWins}-${ctx.leaderWins}. ${ctx.leader} vs ${ctx.trailer} 🪢 A rivalry for the ages, tragically unresolved.`,
  (ctx) => `${ctx.leader} and ${ctx.trailer}, tied at ${ctx.leaderWins} each 🤝 Somebody needs to do a set right now and end this.`,
];

async function shareUserCompare() {
  const otherUser = state.compareUser;
  const selfUser = state.compareUserA || state.currentUser;
  if (!otherUser || !selfUser) return;
  const model = comparisonModel(state.lastSessions || [], {
    userA: selfUser,
    userB: otherUser,
    mode: state.compareMode,
    periodStartMs: periodStart(state.dashboardPeriod).getTime(),
    now: new Date(),
  });
  const activityWord = activityLabel(state.activityType, true);
  let message;
  if (model.aWins === model.bWins) {
    message = pickFrom(COMPARE_SHARE_TIED)({ leader: selfUser, trailer: otherUser, leaderWins: model.aWins, activityWord });
  } else {
    const leading = model.aWins > model.bWins;
    message = pickFrom(COMPARE_SHARE_LEADING)({
      leader: leading ? selfUser : otherUser,
      trailer: leading ? otherUser : selfUser,
      leaderWins: Math.max(model.aWins, model.bWins),
      trailerWins: Math.min(model.aWins, model.bWins),
      activityWord,
    });
  }
  const url = `${location.origin}${location.pathname}#compare=${encodeURIComponent(selfUser)}|${encodeURIComponent(otherUser)}`;
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
$("btn-compare-share").addEventListener("click", shareUserCompare);

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
  const isPullup = session.type === "pullup";
  const isSquat = session.type === "squat";
  const isSitup = session.type === "situp";
  const isHolland = session.type === "holland";

  $("session-detail-user").textContent = `${session.user}'s session`;
  $("session-detail-date").textContent = formatDateTime(session.timestamp);
  $("session-detail-count").textContent = isPlank ? formatDuration(session.count * 1000)
    : isHolland ? hollandFormatCycles(Number(session.hollandCycles) || 0)
    : formatNumber(session.count);
  $("session-detail-count-label").textContent = isPlank ? "PLANK HOLD" : isPullup ? "TOTAL PULL-UPS" : isSquat ? "TOTAL SQUATS" : isSitup ? "TOTAL CRUNCHES" : isHolland ? "HOLLAND CYCLES" : "TOTAL PUSHUPS";

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

  // Matches the old My Sessions delete button's scope — only your own
  // sessions, never someone else's viewed from the leaderboard/challenges.
  $("btn-session-detail-delete").classList.toggle("hidden", session.user !== state.currentUser);
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
  const isPullup = session.type === "pullup";
  const isSquat = session.type === "squat";
  const isSitup = session.type === "situp";
  const isHolland = session.type === "holland";
  const hollandDifficultyLabel = (d) => (d ? d.charAt(0).toUpperCase() + d.slice(1) : "Normal");
  const countText = isPlank ? `${formatDuration(session.count * 1000)} plank` : isPullup ? `${formatNumber(session.count)} pull-ups` : isSquat ? `${formatNumber(session.count)} squats` : isSitup ? `${formatNumber(session.count)} crunches` : isHolland ? `${(Number(session.hollandCycles) || 0).toFixed(1)} Holland cycles (${hollandDifficultyLabel(session.hollandDifficulty)})` : `${formatNumber(session.count)} pushups`;
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
$("btn-session-detail-delete").addEventListener("click", async () => {
  const session = state.sessionDetailSession;
  if (!session) return;
  const deleted = await confirmDeleteSession(session.id);
  if (deleted) showScreen(state.sessionDetailOrigin || "screen-dashboard");
});

function paintMyBonanza(sessions) {
  const isPlank = state.activityType === "planks";
  const isHolland = state.activityType === "holland";
  const activityWord = activityLabel(state.activityType);
  const mine = sessionIndex && sessions === sessionIndex.byLeaderboardMode[state.leaderboardMode]
    ? indexedSessionsForUserMode(state.currentUser)
    : sessions.filter((s) => s.user === state.currentUser);

  renderWeekChart(mine, "week-chart", "week-trend", isPlank, isHolland, state.dashboardPeriod, "week-header");

  const tilesEl = $("personal-stats-tiles");
  const statsEl = $("personal-stats");
  if (!mine.length) {
    tilesEl.innerHTML = "";
    statsEl.innerHTML = `<p class="leaderboard-empty">No sessions yet — go do some ${activityWord}! 💪</p>`;
    return;
  }
  const streak = computeStreak(mine);
  const metricOf = isHolland ? (s) => Number(s.hollandCycles) || 0 : (s) => s.count;
  const { allTimeTotal, personalBest, avgPerSession } = personalStatsModel(mine, streak, metricOf, !isHolland);
  const fmt = isPlank ? (n) => formatDuration(n * 1000) : isHolland ? (n) => n.toFixed(1) : formatNumber;

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
    <div class="stats-table-row"><span class="stats-table-label">${challengeStatIconHTML(modeStatIcon(metric.format))}<span>${metric.label}</span></span><span class="stats-table-value">${formatModeMetric(metric)}</span></div>
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
    const valueFits = pct > 22;
    const wide = pct > 38;
    const usersLabel = `${row.users} user${row.users === 1 ? "" : "s"}`;
    const valueMarkup = formatNumber(row.reps);
    const outsideBits = [
      !valueFits ? `<span class="mode-breakdown-bar-value outside">${valueMarkup}</span>` : "",
      showUsers && !wide ? `<span class="mode-breakdown-bar-users outside">${usersLabel}</span>` : "",
    ].filter(Boolean).join("");
    return `<div class="mode-breakdown-row">
      <div class="mode-breakdown-row-head">
        <span class="mode-breakdown-row-name"><span class="mode-breakdown-rank${i === 0 ? " gold" : ""}">${i + 1}</span>${escapeHtml(row.label)}</span>
        <span class="mode-breakdown-row-meta">${row.sessions} session${row.sessions === 1 ? "" : "s"}</span>
      </div>
      <div class="mode-breakdown-bar-track">
        <div class="mode-breakdown-bar-fill" style="width:${pct}%">
          ${valueFits ? `<span class="mode-breakdown-bar-value">${valueMarkup}</span>` : ""}
          ${showUsers && wide ? `<span class="mode-breakdown-bar-users">${usersLabel}</span>` : ""}
        </div>
        ${outsideBits ? `<span class="mode-breakdown-bar-outside" style="left:${pct}%">${outsideBits}</span>` : ""}
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
    const icon = challengeStatIconHTML(modeStatIcon(metric.format));
    if (!metric.available) return `<div class="boys-mode-stat"><span class="boys-mode-stat-label">${icon}<span>${metric.label}</span></span><span class="boys-mode-stat-value">—</span></div>`;
    const avatars = metric.leaders.slice(0, 3).map((entry) => avatarCircleHTML(avatarForUser(entry.user), "0.95rem")).join("");
    const leaderValue = metric.leaders.length ? formatModeMetric(metric, metric.leaders[0].value) : "—";
    return `<div class="boys-mode-stat">
      <span class="boys-mode-stat-label">${icon}<span>${metric.label}</span></span>
      <span class="boys-mode-stat-values">
        <span class="boys-mode-stat-value">${formatModeMetric(metric)}</span>
        <span class="boys-mode-stat-avatars">${avatars}</span>
        <span class="boys-mode-stat-leader-value">${leaderValue}</span>
      </span>
    </div>`;
  }).join("");
}

function paintDashboard(sessions) {
  const isPlank = state.activityType === "planks";
  const isHolland = state.activityType === "holland";
  const activityWord = activityLabel(state.activityType);
  const metricOf = (s) => (isHolland ? Number(s.hollandCycles) || 0 : Number(s.count) || 0);
  const fmtCount = (n) => (isPlank ? formatDuration(n * 1000) : isHolland ? n.toFixed(1) : formatNumber(n));

  renderWeekChart(sessions, "boys-week-chart", "boys-week-trend", isPlank, isHolland, state.dashboardPeriod, "boys-week-header");

  const start = periodStart(state.dashboardPeriod);
  const startTime = start.getTime();
  const filtered = sessions.filter((s) => sessionTimestamp(s) >= startTime);

  const totals = new Map();
  for (const s of filtered) {
    totals.set(s.user, (totals.get(s.user) || 0) + metricOf(s));
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
        sessionRow.innerHTML = `<span>${formatDateTime(s.timestamp)}</span><span class="history-session-count">${fmtCount(metricOf(s))}</span>`;
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
  const isHolland = state.activityType === "holland";
  const currentActivity = activityLabel(state.activityType);
  const recentList = $("recent-list");
  const recent = [...sessions].sort((a, b) => sessionTimestamp(b) - sessionTimestamp(a)).slice(0, 10);
  recentList.innerHTML = "";
  if (!recent.length) {
    recentList.innerHTML = `<p class="history-empty">No ${currentActivity} logged yet. Get moving! 💪</p>`;
    return;
  }
  for (const s of recent) {
    const row = document.createElement("div");
    row.className = "recent-row compare-clickable";
    row.innerHTML = `
      ${avatarCircleHTML(avatarForUser(s.user), "1.8rem")}
      <div class="recent-name">${escapeHtml(s.user)}</div>
      <div class="recent-count">${isPlank ? formatDuration(s.count * 1000) : isHolland ? (Number(s.hollandCycles) || 0).toFixed(1) : formatNumber(s.count)}</div>
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

// Which logged-session bucket a challenge tracks. plankGauntlet is always
// planks; everything else defaults to pushups unless the config says
// otherwise (e.g. "squats" for a squat-tracking challenge).
function challengeActivity(c) {
  return challengeActivityId(c);
}

function challengeSessions(c) {
  const cached = challengeSessionCache.get(c.id);
  if (cached) return cached;
  const participants = new Set(challengeParticipantsOf(c));
  if (!participants.size) return [];
  const { startDate, endDate } = challengeWindow(c);
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const activity = challengeActivity(c);
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
function userPriorBestSet(name, beforeDate, activity = "pushups") {
  const beforeTime = beforeDate.getTime();
  return indexedSessionsForUser(name, activity)
    .filter((s) => sessionTimestamp(s) < beforeTime)
    .reduce((max, s) => Math.max(max, s.count), 0);
}

// Per-participant standing for a "pr" challenge: baseline is their best set
// before the window started; achieved flips true at the first in-window
// session that beats it (walked chronologically); bestThisWeek tracks their
// best single-session set anywhere in the window regardless of achievement.
function userPrStanding(c, name) {
  const { startDate } = challengeWindow(c);
  const baseline = userPriorBestSet(name, startDate, challengeActivity(c));
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
    el.appendChild(buildChallengeCard(c, now));
  }
}

// Floating confirmation above the tab bar, instead of a banner inserted
// inline between cards. Checkmark glyph built from CSS borders.
function showChallengeJoinToast(c, now) {
  const el = $("challenge-join-toast");
  const text = challengeStatus(c, now) === "upcoming"
    ? `You're in — first flex logs when it starts in ${daysUntilStart(c, now)} day${daysUntilStart(c, now) === 1 ? "" : "s"}`
    : "You're in — first flex logs today";
  el.innerHTML = `
    <span class="join-success-check" aria-hidden="true"></span>
    <span>${text}</span>
  `;
  clearTimeout(showChallengeJoinToast._fadeT);
  clearTimeout(showChallengeJoinToast._hideT);
  el.classList.remove("hidden", "challenge-join-toast-fade");
  showChallengeJoinToast._fadeT = setTimeout(() => {
    el.classList.add("challenge-join-toast-fade");
    showChallengeJoinToast._hideT = setTimeout(() => el.classList.add("hidden"), 400);
  }, 2600);
}

// Challenge stats use the same simple, rounded, stroke-only visual language
// as the bottom navigation. Hero and celebration emoji remain expressive
// artwork; these icons are strictly for compact data labels.
function challengeStatIconHTML(icon) {
  const drawings = {
    participants: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    total: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    duration: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    status: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    time: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
    pace: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>',
    percent: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    trend: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    award: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  };
  return `<svg class="challenge-stat-icon challenge-stat-icon-${icon}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[icon] || drawings.total}</svg>`;
}

// Maps a mode-stat's numeric format to the stroke icon that best represents
// it, so every leaderboard mode (not just the default) gets a sensible glyph.
function modeStatIcon(format) {
  return { integer: "total", duration: "time", seconds: "time", pace: "pace", percent: "percent", decimal: "trend", decimalPoints: "trend", pokerHand: "award" }[format] || "total";
}

function buildChallengeCard(c, now) {
  const status = challengeStatus(c, now);
  const participants = challengeParticipantsOf(c);
  const joined = participants.includes(state.currentUser);
  const total = challengeTotal(c);

  const card = document.createElement("div");
  card.className = "challenge-card";
  card.style.setProperty("--challenge-color", c.gradient[0]);
  card.addEventListener("click", () => openChallengeDetail(c.id));

  let dateLabel;
  if (status === "active") {
    const d = daysLeft(c, now);
    dateLabel = `${d} day${d === 1 ? "" : "s"} left`;
  } else if (status === "upcoming") {
    const d = daysUntilStart(c, now);
    dateLabel = `in ${d} day${d === 1 ? "" : "s"}`;
  }

  let metaLine;
  let prAchievedCount = 0;
  if (c.goalType === "pr") {
    prAchievedCount = challengeLeaderboard(c).filter((row) => row.achieved).length;
    metaLine = `${challengeStatIconHTML("participants")}${participants.length} joined · ${prAchievedCount} new PR${prAchievedCount === 1 ? "" : "s"} this week`;
  } else if (c.goalType === "plankGauntlet") {
    metaLine = `${challengeStatIconHTML("participants")}${participants.length} joined · ${formatDuration(total * 1000)} total plank time logged`;
  } else {
    metaLine = `${challengeStatIconHTML("participants")}${participants.length} joined · ${formatNumber(total)} total ${challengeActivity(c)} so far`;
  }

  let winnerChipHTML = "";
  if (status === "past") {
    const winners = challengeWinners(c);
    if (winners.length) {
      const board = challengeLeaderboard(c);
      const scoreText = c.goalType === "streak" ? `${formatNumber(board[0].score)} days` : c.goalType === "plankGauntlet" ? formatDuration(board[0].score * 1000) : formatNumber(board[0].score);
      winnerChipHTML = `<span class="challenge-winner-chip">🥇 ${winners.map(escapeHtml).join(" & ")} — ${scoreText}</span>`;
    }
  }

  // The top-right badge already shows the date label once the user has joined
  // (see challenge-joined-chip below), and past challenges get no date pill
  // at all (their top-right badge shows the winner instead) — so skip the
  // inline chip in both cases to avoid showing the same text twice.
  const showInlineChip = status !== "past" && !joined;
  let html = `
    <div class="challenge-card-header${winnerChipHTML ? " challenge-card-header-winner" : ""}">
      <div class="challenge-card-emoji">${c.emoji}</div>
      <div class="challenge-card-heading">
        <div class="challenge-card-title">${escapeHtml(c.title)}</div>
        <div class="challenge-card-dates">${formatChallengeDates(c, undefined, { includeYear: status === "past" })}${showInlineChip ? ` <span class="challenge-status-chip">${dateLabel}</span>` : ""}</div>
      </div>
    </div>
    <div class="challenge-card-meta">${metaLine}</div>
  `;

  // Mini progress bar so status is scannable from the list without opening.
  // PR bars show group success rate; Plank has no fixed target, so it shows elapsed time.
  const isPrProgress = c.goalType === "pr";
  const isWindowProgress = c.goalType === "plankGauntlet";
  const progressCurrent = isPrProgress ? challengePrProgress(prAchievedCount, participants.length)
    : isWindowProgress ? challengeWindowProgress(c, now)
    : challengeListProgress(c);
  const progressGoal = isPrProgress || isWindowProgress ? 100 : c.goal;
  const progressLabel = isPrProgress ? `${prAchievedCount} of ${participants.length} participants set a new PR`
    : isWindowProgress ? `${progressCurrent}% of challenge window elapsed`
    : `${formatNumber(progressCurrent)} of ${formatNumber(progressGoal)}`;
  html += `<div class="challenge-card-progress" role="progressbar" aria-label="${escapeHtml(progressLabel)}" aria-valuemin="0" aria-valuemax="${progressGoal}" aria-valuenow="${Math.min(progressCurrent, progressGoal)}">${buildProgressThermometer(progressCurrent, progressGoal)}</div>`;

  if (status !== "past" && joined) {
    html += `<span class="challenge-joined-chip">${dateLabel}</span>`;
  } else if (winnerChipHTML) {
    html += winnerChipHTML;
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
  return challengeShareContext(c, challengeLeaderboard(c), {
    formatNumber,
    formatDuration: (seconds) => formatDuration(seconds * 1000),
    activityLabel: challengeActivity(c),
    groupTotal: c.goalType === "collective" ? challengeTotal(c) : undefined,
  });
}

const CHALLENGE_INVITE_MESSAGES = [
  (ctx) => `Yo, come join ${ctx.titleWithEmoji} 🎯 ${ctx.goalAmountText} by ${ctx.deadlineText}${ctx.hasLeader ? ` — ${ctx.leaderName}'s leading with ${ctx.leaderScoreText} (${ctx.leaderPct}%)` : ""}. Let's go!`,
  (ctx) => `Just jumped into ${ctx.titleWithEmoji} — you in? 💪 ${ctx.goalAmountText} by ${ctx.deadlineText}.`,
  (ctx) => ctx.exceeded
    ? `${ctx.titleWithEmoji} is live and ${ctx.leaderName} already smashed the ${ctx.goalAmountText} goal with ${ctx.leaderScoreText} (${ctx.leaderPct}%) 🔥 Go beat them before it's over!`
    : `${ctx.titleWithEmoji} is live. Get in before it's over 🔥 ${ctx.goalAmountText} by ${ctx.deadlineText}.`,
  (ctx) => ctx.hasRemaining
    ? `Boys, ${ctx.titleWithEmoji} needs you 🚀 ${ctx.remainingText} left ${ctx.urgencyPhrase}${ctx.hasLeader ? ` — don't let ${ctx.leaderName} run away with it` : ""}. Tap in before ${ctx.deadlineText}.`
    : `Boys, ${ctx.titleWithEmoji} needs you 🚀 ${ctx.hasLeader ? `${ctx.leaderName}'s out front with ${ctx.leaderScoreText} (${ctx.leaderPct}%) — ` : ""}tap in before ${ctx.deadlineText}.`,
  (ctx) => ctx.hasRemaining
    ? `${ctx.remainingText} left on ${ctx.titleWithEmoji} ${ctx.urgencyPhrase} 🏆${ctx.hasLeader ? ` Don't let ${ctx.leaderName} take the crown!` : ""}`
    : `Don't sleep on ${ctx.titleWithEmoji} 🏆 ${ctx.goalAmountText} by ${ctx.deadlineText}${ctx.hasLeader ? `, ${ctx.leaderName} leading at ${ctx.leaderPct}%` : ""}.`,
  (ctx) => ctx.exceeded
    ? `${ctx.leaderName} already crushed ${ctx.titleWithEmoji}'s goal (${ctx.leaderScoreText}, ${ctx.leaderPct}%) 😤 Go beat them before it's over!`
    : `${ctx.titleWithEmoji}: ${ctx.goalAmountText} by ${ctx.deadlineText}. Join the bonanza before it's too late 👀`,
  (ctx) => ctx.hasRemaining
    ? `⛰️ ${ctx.remainingText} left ${ctx.urgencyPhrase} on ${ctx.titleWithEmoji}${ctx.hasLeader ? ` — ${ctx.leaderName}'s wearing the crown for now` : ""}. Let's close it out, boys!`
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
  const activityWord = activityLabel(state.activityType);
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
    totalLabel: c.goalType === "plankGauntlet" ? "Total plank time" : `Total ${challengeActivity(c)}`,
  }).map((stat) => ({ ...stat, value: typeof stat.value === "number" ? formatNumber(stat.value) : stat.value }));

  html += `
    <div class="stats-table">
      ${challengeStats.map((s) => `
        <div class="stats-table-row">
          <span class="stats-table-label">${challengeStatIconHTML(s.icon)}<span>${s.label}</span></span>
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
    queued = true;
  }
  if (state.screen === "screen-challenge-detail") {
    toast(queued ? "Joined on this device — waiting to sync." : "You're in! 💪");
    renderChallengeDetail();
  } else {
    paintChallengeList();
    const c = challengeDefs.find((x) => x.id === id);
    if (c) showChallengeJoinToast(c, new Date());
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
  // Rep updates run this after every detection, so honor the centralized HUD
  // visibility rule here as well as during initial screen setup. Otherwise
  // Horse's hidden personal-best meter reappears after rep one beneath its
  // opponent-overtake meter.
  const hud = workoutHudModel(state.pushupMode, state.highScore, state.fortuneChallenge);
  if (hud.hideThermometer) {
    wrap.classList.add("hidden");
    return;
  }
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

// Horse's live-count meter tracks the bar to beat (game.target), not the
// player's own personal best — reuses the same goal/excess thermometer as
// the Challenges detail screen (see buildProgressThermometer) so clearing
// the bar reads the same "exceeded the goal" way everywhere else in the app.
function updateHorseMeter(count) {
  const meter = $("horse-meter");
  const target = state.horseGame?.target;
  if (target == null) {
    meter.classList.add("hidden");
    return;
  }
  meter.classList.remove("hidden");
  meter.innerHTML = buildProgressThermometer(count, target);
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

function getPullupBest(name) {
  return bestFor(indexedSessionsForUser(name, "pullups"), name, () => true);
}

function getHollandBest(name) {
  return bestFor(indexedSessionsForUser(name, "holland"), name, () => true, "hollandCycles");
}

function getSitupBest(name) {
  return bestFor(indexedSessionsForUser(name, "situps"), name, () => true);
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
    // number rendered once by renderHorseTurnHero(); the live running count
    // shows both as a persistent subordinate line and as the same
    // pop-on-each-rep badge Cards/Dice/Ladder/Pyramid use, since the small
    // text line alone is easy to miss mid-set.
    $("horse-session-total").textContent = `Live count: ${formatNumber(count)}`;
    updateModeCounterBadge("horse-counter-badge", count);
    updateHorseMeter(count);
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
  // Horse is the one exception to "whatever's picked on Home": once a
  // target has been set with a modifier, every subsequent player is
  // required to match it (a beat-the-number-only comparison isn't fair if
  // the grip changed), so their own Home selection is overridden for that
  // turn only — see horseTurnHeroCopy in screens/horse.js for the matching
  // "Match required" copy shown alongside it.
  state.resolvedModifier = state.pushupMode === "zen"
    ? null
    : state.pushupMode === "horse" && state.horseGame?.targetModifier
      ? state.horseGame.targetModifier
      : resolveModifier(state.modifier);
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
  if (isHorse) updateHorseMeter(0); else $("horse-meter").classList.add("hidden");

  // Tug of War's burst screen is otherwise the plain Active Session shell —
  // the only addition is a "Round N/5" pill in the header, see the spec.
  const isTow = state.pushupMode === "tow";
  $("tow-workout-round-pill").classList.toggle("hidden", !isTow);
  if (isTow && state.towGame) {
    $("tow-workout-round-pill").textContent = state.towGame.sudden
      ? `Sudden death · Round ${state.towGame.round}`
      : `Round ${state.towGame.round}/${state.towGame.rounds}`;
  }

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
  const targetBeforeTurn = game.target;

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
    ...(state.resolvedModifier ? { modifier: state.resolvedModifier } : {}),
    ...(state.sessionLocation ? { location: state.sessionLocation } : {}),
  };
  const cached = getCachedData();
  cached.sessions.push(session);
  cacheData(cached);
  try { await commitSession(session); } catch (e) { enqueueSession(session); }

  let updated;
  if (game.sessionType === "invite" || game.sessionType === "open") {
    try {
      const res = await workerPostHorseTurn({ gameId: game.id, user, reps: rawCount, modifier: state.resolvedModifier });
      updated = res.game;
    } catch (e) {
      // Best-effort local fallback so this device's UI still progresses —
      // the server stays the source of truth and the next successful
      // refresh (see openHorseTurnOrder) reconciles it.
      toast("Couldn't sync your set — check your connection. Your view may be out of date until it reconnects.", 5000);
      updated = applyTurn(game, { user, reps: rawCount, modifier: state.resolvedModifier, now: Date.now() });
    }
  } else {
    updated = applyTurn(game, { user, reps: rawCount, modifier: state.resolvedModifier, now: Date.now() });
  }
  state.horseGame = updated;
  upsertLocalHorseGame(updated);

  const gotLetter = updated.players[user].letters > lettersBefore;
  if (gotLetter) {
    speak(pickFrom(updated.players[user].out ? HORSE_ELIMINATED_LINES : HORSE_LETTER_LINES));
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
  speak(pickFrom(HORSE_CLEAR_LINES));
  // Only a real celebration if there was a bar to beat — the very first set
  // of the game (targetBeforeTurn == null) just sets it, nothing was cleared.
  const beatTheBar = targetBeforeTurn != null;
  if (updated.status === "complete") {
    renderHorseSummary();
    showScreen("screen-horse-summary");
    if (beatTheBar) launchConfetti("horse-summary-confetti");
    return;
  }
  await openHorseTurnOrder();
  if (beatTheBar) {
    const confettiId = state.screen === "screen-horse-summary" ? "horse-summary-confetti"
      : state.screen === "screen-horse-target-choice" ? "horse-choice-confetti"
      : "horse-turnorder-confetti";
    launchConfetti(confettiId);
  }
}

// Tug of War's completion flow branches off completeWorkout entirely, same
// reasoning as Horse's completeHorseTurn just above: it saves a real session
// (mode: "tow", counts toward stats/streaks like every other mode) but then
// routes into the game's own burst-complete/handoff/summary screens instead
// of the shared screen-summary.
async function completeTowBurst(rawCount) {
  clearTimeout(state.sharpshooterAnimationTimer);
  state.sharpshooterAnimationTimer = null;
  stopCameraAndDetection();
  await releaseWakeLock();
  state.workoutActive = false;
  $("workout-active").classList.add("hidden");
  $("workout-idle").classList.remove("hidden");

  const game = state.towGame;
  const user = towCurrentTurnPlayer(game);
  const team = towCurrentTurnTeam(game);

  const session = {
    id: uuid(),
    user,
    timestamp: new Date().toISOString(),
    count: rawCount,
    avatar: avatarForUser(user).id,
    startedAt: state.sessionStartedAt ? state.sessionStartedAt.toISOString() : undefined,
    mode: "tow",
    towGameId: game.id,
    ...(state.sessionLocation ? { location: state.sessionLocation } : {}),
  };
  const cached = getCachedData();
  cached.sessions.push(session);
  cacheData(cached);
  try { await commitSession(session); } catch (e) { enqueueSession(session); }

  let updated;
  if (game.sessionType !== "live") {
    try {
      const res = await workerPostTowBurst({ gameId: game.id, user, reps: rawCount });
      updated = res.game;
    } catch (e) {
      // Best-effort local fallback so this device's UI still progresses —
      // the server stays the source of truth and the next successful
      // refresh (see openTowMatch) reconciles it.
      toast("Couldn't sync your burst — check your connection. Your view may be out of date until it reconnects.", 5000);
      updated = applyTowBurst(game, { user, reps: rawCount, now: Date.now() });
    }
  } else {
    updated = applyTowBurst(game, { user, reps: rawCount, now: Date.now() });
  }
  state.towGame = updated;
  upsertLocalTowGame(updated);

  speak(pickFrom(updated.status === "complete" && updated.winner === team ? TOW_WIN_LINES : TOW_PULL_LINES));

  state.towBurstEvent = { team, delta: rawCount };
  renderTowBurstComplete();
  showScreen("screen-tow-burst-complete");
  if (updated.status === "complete" && updated.winner === team) launchConfetti("tow-burst-confetti");
}

async function completeWorkout() {
  const rawCount = repState.count;
  if (state.pushupMode === "horse") {
    await completeHorseTurn(rawCount);
    return;
  }
  if (state.pushupMode === "tow") {
    await completeTowBurst(rawCount);
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
  const isPullup = state.lastSessionType === "pullup";
  const isSquat = state.lastSessionType === "squat";
  const isSitup = state.lastSessionType === "situp";
  const isPushup = !isPlank && !isPullup && !isSquat && !isSitup;
  const mine = indexedSessionsForUser(state.currentUser, isPlank ? "planks" : isPullup ? "pullups" : isSquat ? "squats" : isSitup ? "situps" : "pushups");
  const weekStart = periodStart("week");
  const weekStartTime = weekStart.getTime();
  const weekTotalRaw = mine
    .filter((s) => sessionTimestamp(s) >= weekStartTime)
    .reduce((sum, s) => sum + s.count, 0);
  return {
    mode: isPlank ? "plank" : isPullup ? "pullup" : isSquat ? "squat" : isSitup ? "situp" : state.pushupMode,
    isPlank,
    isPullup,
    isSquat,
    isSitup,
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
    workoutShareMessagesPromise = import("./share-messages.js?v=139").then((module) => {
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
  const screenByType = { plank: "screen-plank-workout", pullup: "screen-pullup-workout", squat: "screen-squat-workout", situp: "screen-situp-workout" };
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
// Camera-counted free set, own screen (see docs/squat-mode-plan.md): an
// automatic warmup (watch a rolling sample window until it's seen a real
// stand<->squat swing) derives per-session thresholds — wall tilt/distance
// make an absolute default unreliable — then reuses createRepCounter
// unchanged, same as pushups, just fed normalized hip-midpoint height from
// pose landmarks instead of face size (the short-range face model can't
// see a face at squatting distance at all). camera.js/rep-counter.js are
// shared modules, not forked; this is its own controller instance because
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
    showSquatStatusBanner("PAUSED — get your whole body in frame");
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

// Pose landmark indices (MediaPipe 33-point model) and the visibility floor
// below which a hip is treated as out of frame rather than tracked.
const POSE_LEFT_HIP = 23;
const POSE_RIGHT_HIP = 24;
const POSE_MIN_VISIBILITY = 0.5;

// Hip midpoint height (normalized 0..1 of frame height) — drops when the
// boy squats, same monotonic "rises on the way down" shape the counter
// expects, but far more direct than inferring depth from where the face is.
function squatHipY(landmarks) {
  const lh = landmarks[POSE_LEFT_HIP], rh = landmarks[POSE_RIGHT_HIP];
  if (!lh || !rh) return null;
  if ((lh.visibility ?? 1) < POSE_MIN_VISIBILITY || (rh.visibility ?? 1) < POSE_MIN_VISIBILITY) return null;
  return (lh.y + rh.y) / 2;
}

// Body bounding box in video pixel coords from the visible landmarks, so
// the existing overlay box drawing (which expects a face-detector-style
// bbox) can frame the whole tracked body instead.
function squatBodyBBox(landmarks, video) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const lm of landmarks) {
    if ((lm.visibility ?? 1) < POSE_MIN_VISIBILITY) continue;
    if (lm.x < minX) minX = lm.x;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.y > maxY) maxY = lm.y;
  }
  if (minX === Infinity) return null;
  return {
    originX: minX * video.videoWidth,
    originY: minY * video.videoHeight,
    width: (maxX - minX) * video.videoWidth,
    height: (maxY - minY) * video.videoHeight,
  };
}

const squatCamera = createCameraController({
  moduleUrl: FACE_DETECTOR_MODULE_URL,
  wasmUrl: FACE_DETECTOR_WASM_URL,
  modelUrl: POSE_LANDMARKER_MODEL_URL,
  detectorType: "pose",
  getVideo: () => $("squat-camera-video"),
  onDetection(landmarks, inferenceMs) {
    const video = $("squat-camera-video");
    const hipY = squatHipY(landmarks);
    if (hipY == null) {
      // A pose was returned but the hips aren't confidently in frame (e.g.
      // phone picked up, boy half out of view) — don't feed the counter
      // garbage; treat it like a lost detection.
      hideSquatFaceBox();
      checkSquatFaceLostTimeout();
      return;
    }
    const bbox = squatBodyBBox(landmarks, video);
    if (bbox) updateSquatFaceBox(bbox);
    if (squatState.stage === "warmup") {
      squatState.calSamples.push({ ratio: hipY, t: performance.now() });
      if (squatState.calSamples.length > SQUAT_WARMUP_MAX_SAMPLES) squatState.calSamples.shift();
      tickSquatWarmup();
    } else if (squatState.stage === "counting") {
      processSquatRatio(hipY);
    }
  },
  onNoDetection() {
    hideSquatFaceBox();
    checkSquatFaceLostTimeout();
  },
});

// No taps, no "stand still" / "hold a squat" steps — the boy just starts
// squatting in frame and this watches a rolling sample window until it's
// seen a real stand<->squat swing, then derives thresholds and starts
// counting automatically. See docs/squat-mode-plan.md for why the old
// 2-tap wizard didn't work standing 2m from the phone.
function renderSquatWarmup() {
  $("squat-cal-title").textContent = "Get your range";
  $("squat-cal-instructions").textContent = "Squat up and down a couple of times — we'll start counting automatically.";
  $("squat-cal-error").classList.add("hidden");
}

function beginSquatWarmup() {
  squatState.calSamples = [];
  squatState.warmupStartedAt = performance.now();
  squatState.stage = "warmup";
  $("squat-cal-stage").classList.remove("hidden");
  $("squat-count-stage").classList.add("hidden");
  $("btn-squat-stop").classList.add("hidden");
  $("btn-squat-cancel").classList.remove("hidden");
  renderSquatWarmup();
}

// Checked on every warmup sample. Requires both a minimum sampling time and
// sample count before trusting the observed range (guards against a lucky
// couple of noisy frames looking like a valid swing).
function tickSquatWarmup() {
  const elapsed = performance.now() - squatState.warmupStartedAt;
  if (elapsed < SQUAT_WARMUP_MIN_MS || squatState.calSamples.length < SQUAT_WARMUP_MIN_SAMPLES) return;

  const { standY, squatY } = estimateSquatRange(squatState.calSamples);
  if (squatCalibrationValid(standY, squatY)) {
    $("squat-cal-error").classList.add("hidden");
    const thresholds = deriveSquatThresholds(standY, squatY);
    speak(pickFrom(SQUAT_START_LINES));
    beginSquatCounting(thresholds);
    return;
  }

  if (elapsed > SQUAT_WARMUP_HINT_MS) {
    const pct = Math.min(99, Math.round((squatSwing(standY, squatY) / SQUAT_MIN_SWING) * 100));
    $("squat-cal-error").textContent = `Still watching (${pct}%) — squat a little deeper, or step back so your whole body is in frame.`;
    $("squat-cal-error").classList.remove("hidden");
  }
}

function beginSquatCounting(thresholds) {
  squatState.down = thresholds.down;
  squatState.up = thresholds.up;
  squatState.counter = replaySquatCalibration(
    squatState.calSamples,
    (config) => createRepCounter(config),
    { down: thresholds.down, up: thresholds.up },
  );
  squatState.phase = "up";
  squatState.count = squatState.counter.count;
  squatState.lastSeenAt = performance.now();
  squatState.lastRepSpokenAt = 0;
  squatState.paused = false;
  squatState.lastCheerAtCount = 0;
  squatState.recordBroken = false;
  squatState.stage = "counting";
  state.squatBest = getSquatBest(state.currentUser);
  $("squat-rep-count").textContent = String(squatState.count);
  updateSquatPhaseIndicator("up");
  updateSquatHighscoreMessage(squatState.count);
  hideSquatStatusBanner();
  $("squat-cal-stage").classList.add("hidden");
  $("squat-count-stage").classList.remove("hidden");
  $("btn-squat-cancel").classList.add("hidden");
  $("btn-squat-stop").classList.remove("hidden");
}

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
  toast("Loading body tracker…", 2000);
  try {
    await squatCamera.ensureDetector();
  } catch (e) {
    toast("Couldn't load the body tracking model. Check your connection and try again.", 4500);
    stream.getTracks().forEach((t) => t.stop());
    return;
  }
  const video = $("squat-camera-video");
  video.srcObject = stream;
  try { await video.play(); } catch (e) { /* autoplay quirks */ }

  await acquireWakeLock();

  state.squatActive = true;
  state.squatStartedAt = new Date();
  $("squat-idle").classList.add("hidden");
  $("squat-in-progress").classList.remove("hidden");
  setChromeMinimized(true);
  squatCamera.startDetection();
  beginSquatWarmup();
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
  const rawCount = squatState.count;
  squatCamera.stop();
  await releaseWakeLock();
  state.squatActive = false;
  squatState.stage = "idle";
  hideSquatStatusBanner();
  $("squat-in-progress").classList.add("hidden");
  $("squat-idle").classList.remove("hidden");
  setChromeMinimized(false);

  const squatProfile = getSquatWeightedProfile(state.currentUser);
  const multiplierProfile = getSquatWeightedMultiplierProfile(state.currentUser);
  const weighted = squatProfile.enabled && multiplierProfile.bodyweightLbs > 0;
  const multiplier = weighted ? weightedMultiplier(multiplierProfile) : 1;
  const count = weighted ? Math.round(rawCount * multiplier) : rawCount;

  const session = {
    id: uuid(),
    user: state.currentUser,
    timestamp: new Date().toISOString(),
    count,
    avatar: state.currentAvatar,
    startedAt: state.squatStartedAt ? state.squatStartedAt.toISOString() : undefined,
    type: "squat",
    ...(weighted ? { rawCount, weightLbs: multiplierProfile.addedWeightLbs || 0 } : {}),
    ...(state.squatSessionLocation ? { location: state.squatSessionLocation } : {}),
  };

  // Optimistically reflect it locally right away so it shows up immediately.
  const cached = getCachedData();
  cached.sessions.push(session);
  cacheData(cached);

  const message = pickSquatFunMessage(count);
  state.lastSessionType = "squat";
  state.summarySessionId = session.id;
  state.summaryBaseCount = rawCount;
  state.summaryExtra = 0;
  state.summaryMultiplier = multiplier;
  state.summaryWeightLbs = weighted ? (multiplierProfile.addedWeightLbs || 0) : 0;
  state.summaryPrAchieved = null;
  state.summaryChaseResult = null;
  state.summaryRoadtripConquests = [];
  $("summary-count").textContent = formatNumber(count);
  $("missed-reps-count").textContent = "0";
  $("missed-reps-wrap").classList.remove("hidden");
  renderSummaryWeightedNote(rawCount, count);
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

$("btn-squat-start").addEventListener("click", startSquat);
$("btn-squat-cancel").addEventListener("click", stopSquatHard);
$("btn-squat-stop").addEventListener("click", completeSquat);

// ------------------- pull-ups mode -------------------
// The posture math/state machine lives in modes/pullup.js and is loaded only
// when this activity is selected. This block is DOM and session orchestration.

function updatePullupPoseBox(bbox) {
  const video = $("pullup-camera-video");
  const container = document.querySelector("#screen-pullup-workout .camera-wrap");
  const scale = Math.max(container.clientWidth / video.videoWidth, container.clientHeight / video.videoHeight);
  const offsetX = (container.clientWidth - video.videoWidth * scale) / 2;
  const offsetY = (container.clientHeight - video.videoHeight * scale) / 2;
  const box = $("pullup-pose-box");
  box.style.left = `${bbox.originX * scale + offsetX}px`;
  box.style.top = `${bbox.originY * scale + offsetY}px`;
  box.style.width = `${bbox.width * scale}px`;
  box.style.height = `${bbox.height * scale}px`;
  box.classList.remove("hidden");
}

function hidePullupPoseBox() { $("pullup-pose-box").classList.add("hidden"); }
function hidePullupStatusBanner() { $("pullup-status-banner").classList.add("hidden"); }
function showPullupStatusBanner(text) {
  $("pullup-status-banner").textContent = text;
  $("pullup-status-banner").classList.remove("hidden");
  announce(text);
}

function checkPullupLostTimeout() {
  if (pullupState.paused || pullupState.stage !== "counting") return;
  if (performance.now() - pullupState.lastSeenAt > FACE_LOST_TIMEOUT_MS) {
    pullupState.paused = true;
    showPullupStatusBanner("PAUSED — get your upper body in frame");
    speak("Paused");
  }
}

function updatePullupPhaseIndicator(phase) {
  const labels = {
    "waiting-for-hang": "FIND DEAD HANG",
    pulling: "PULL — CHIN OVER BAR",
    returning: "RETURN TO DEAD HANG",
  };
  const el = $("pullup-phase-indicator");
  el.textContent = labels[phase] || "DEAD HANG";
  el.classList.toggle("is-down", phase === "returning");
}

function updatePullupHighscoreMessage(count) {
  const el = $("pullup-highscore-message");
  if (!state.pullupBest) { el.textContent = ""; return; }
  const remaining = state.pullupBest - count;
  if (remaining > 0) el.textContent = `${remaining} pull-up${remaining === 1 ? "" : "s"} away from your best!`;
  else if (remaining === 0) el.textContent = "Tied your best pull-up set — one more!";
  else el.textContent = "New pull-up record! 🔥";
}

function maybeEncouragePullup(count) {
  if (!state.pullupBest || state.pullupBest <= 1 || count - pullupState.lastCheerAtCount < 2) return null;
  if (Math.random() < cheerProbability(count / state.pullupBest)) {
    pullupState.lastCheerAtCount = count;
    return pickFrom(PULLUP_CHEER_LINES);
  }
  return null;
}

function onPullupRepCounted(count) {
  $("pullup-rep-count").textContent = String(count);
  updatePullupHighscoreMessage(count);
  let spoken = null;
  let mustSpeak = false;
  if (state.pullupBest && count === state.pullupBest + 1 && !pullupState.recordBroken) {
    pullupState.recordBroken = true;
    spoken = PULLUP_RECORD_LINE;
    mustSpeak = true;
    launchConfetti("pullup-confetti", CONFETTI_EMOJI);
  } else {
    spoken = maybeEncouragePullup(count);
    mustSpeak = Boolean(spoken);
  }
  const now = performance.now();
  const fastPace = now - pullupState.lastRepSpokenAt < REP_SPEECH_MIN_GAP_MS;
  if (mustSpeak || !fastPace || count % 5 === 0) {
    pullupState.lastRepSpokenAt = now;
    speak(spoken || numberToWords(count));
  }
  vibrate(45);
}

function processPullupMetrics(metrics) {
  pullupState.lastSeenAt = performance.now();
  if (pullupState.paused) {
    pullupState.paused = false;
    hidePullupStatusBanner();
    speak("Back to it");
  }
  const result = pullupState.counter.advance(metrics);
  pullupState.phase = result.phase;
  updatePullupPhaseIndicator(result.phase);
  if (result.counted) {
    pullupState.count = result.count;
    onPullupRepCounted(result.count);
  }
}

function tickPullupWarmup() {
  const elapsed = performance.now() - pullupState.warmupStartedAt;
  if (elapsed < PULLUP_WARMUP_MIN_MS || pullupState.calSamples.length < PULLUP_WARMUP_MIN_SAMPLES) return;
  if (pullupModeModule.pullupCalibrationValid(pullupState.calSamples)) {
    pullupState.thresholds = pullupModeModule.derivePullupThresholds(pullupState.calSamples);
    pullupState.counter = pullupModeModule.replayPullupSamples(pullupState.calSamples, pullupState.thresholds);
    pullupState.count = pullupState.counter.count;
    pullupState.phase = pullupState.counter.phase;
    pullupState.stage = "counting";
    pullupState.lastSeenAt = performance.now();
    pullupState.paused = false;
    state.pullupBest = getPullupBest(state.currentUser);
    $("pullup-cal-error").classList.add("hidden");
    $("pullup-cal-stage").classList.add("hidden");
    $("pullup-count-stage").classList.remove("hidden");
    $("btn-pullup-cancel").classList.add("hidden");
    $("btn-pullup-stop").classList.remove("hidden");
    $("pullup-rep-count").textContent = String(pullupState.count);
    updatePullupPhaseIndicator(pullupState.phase);
    updatePullupHighscoreMessage(pullupState.count);
    speak(pickFrom(PULLUP_START_LINES));
    return;
  }
  if (elapsed > PULLUP_WARMUP_HINT_MS) {
    $("pullup-cal-error").textContent = "Still watching — show a straight-arm dead hang, put your chin clearly over the bar, then return to hang.";
    $("pullup-cal-error").classList.remove("hidden");
  }
}

const pullupCamera = createCameraController({
  moduleUrl: FACE_DETECTOR_MODULE_URL,
  wasmUrl: FACE_DETECTOR_WASM_URL,
  modelUrl: POSE_LANDMARKER_MODEL_URL,
  detectorType: "pose",
  getVideo: () => $("pullup-camera-video"),
  onDetection(landmarks) {
    const metrics = pullupModeModule?.pullupFrameMetrics(landmarks);
    if (!metrics) { hidePullupPoseBox(); checkPullupLostTimeout(); return; }
    const bbox = squatBodyBBox(landmarks.slice(0, 25), $("pullup-camera-video"));
    if (bbox) updatePullupPoseBox(bbox);
    if (pullupState.stage === "warmup") {
      pullupState.calSamples.push({ ...metrics, t: performance.now() });
      if (pullupState.calSamples.length > PULLUP_WARMUP_MAX_SAMPLES) pullupState.calSamples.shift();
      tickPullupWarmup();
    } else if (pullupState.stage === "counting") processPullupMetrics(metrics);
  },
  onNoDetection() { hidePullupPoseBox(); checkPullupLostTimeout(); },
});

async function startPullup() {
  if (soundIsEnabled()) unlockVoice();
  await loadPullupMode();
  state.pullupSessionLocation = currentSessionLocationSnapshot();
  let stream;
  try { stream = await pullupCamera.requestStream(); }
  catch { toast("Camera access is required to count pull-ups. Please allow camera permission.", 4000); return; }
  toast("Loading body tracker…", 2000);
  try { await pullupCamera.ensureDetector(); }
  catch {
    toast("Couldn't load the body tracking model. Check your connection and try again.", 4500);
    stream.getTracks().forEach((track) => track.stop());
    return;
  }
  const video = $("pullup-camera-video");
  video.srcObject = stream;
  try { await video.play(); } catch { /* autoplay quirks */ }
  await acquireWakeLock();
  state.pullupActive = true;
  state.pullupStartedAt = new Date();
  pullupState.stage = "warmup";
  pullupState.calSamples = [];
  pullupState.warmupStartedAt = performance.now();
  pullupState.count = 0;
  pullupState.lastCheerAtCount = 0;
  pullupState.recordBroken = false;
  $("pullup-idle").classList.add("hidden");
  $("pullup-in-progress").classList.remove("hidden");
  $("pullup-cal-stage").classList.remove("hidden");
  $("pullup-count-stage").classList.add("hidden");
  $("btn-pullup-stop").classList.add("hidden");
  $("btn-pullup-cancel").classList.remove("hidden");
  setChromeMinimized(true);
  pullupCamera.startDetection();
}

function stopPullupHard() {
  pullupCamera.stop();
  releaseWakeLock();
  state.pullupActive = false;
  pullupState.stage = "idle";
  hidePullupStatusBanner();
  $("pullup-in-progress").classList.add("hidden");
  $("pullup-idle").classList.remove("hidden");
  setChromeMinimized(false);
}

let lastPullupFunMessageIndex = -1;
function pickPullupFunMessage(count) {
  let index;
  do { index = Math.floor(Math.random() * FUN_MESSAGES_PULLUP.length); }
  while (index === lastPullupFunMessageIndex && FUN_MESSAGES_PULLUP.length > 1);
  lastPullupFunMessageIndex = index;
  return FUN_MESSAGES_PULLUP[index](count);
}

async function completePullup() {
  const count = pullupState.count;
  if (count <= 0) {
    toast("Complete one full dead-hang pull-up before stopping.", 3000);
    return;
  }
  pullupCamera.stop();
  await releaseWakeLock();
  state.pullupActive = false;
  pullupState.stage = "idle";
  hidePullupStatusBanner();
  $("pullup-in-progress").classList.add("hidden");
  $("pullup-idle").classList.remove("hidden");
  setChromeMinimized(false);
  const session = {
    id: uuid(), user: state.currentUser, timestamp: new Date().toISOString(), count,
    avatar: state.currentAvatar,
    startedAt: state.pullupStartedAt?.toISOString(),
    type: "pullup",
    ...(state.pullupSessionLocation ? { location: state.pullupSessionLocation } : {}),
  };
  const cached = getCachedData();
  cached.sessions.push(session);
  cacheData(cached);
  state.lastSessionType = "pullup";
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
  renderSummaryWeightedNote(count, count);
  renderSummaryChaseResult();
  renderSummaryRoadtripResult();
  $("summary-sync-status").textContent = "";
  preloadWorkoutShareMessages();
  showScreen("screen-summary");
  launchConfetti("confetti", CONFETTI_EMOJI);
  speak(`Session complete. ${pickPullupFunMessage(count)}`);
  try { await commitSession(session); }
  catch {
    enqueueSession(session);
    $("summary-sync-status").textContent = "Saved on this device — will sync automatically when back online.";
  }
}

$("btn-pullup-start").addEventListener("click", startPullup);
$("btn-pullup-cancel").addEventListener("click", stopPullupHard);
$("btn-pullup-stop").addEventListener("click", completePullup);

// ------------------- Holland mode -------------------
// Continuous pull-up/pushup/squat circuit (see AGENTS.md "Holland mode").
// Reuses each existing mode's own calibration math through
// modes/holland-adapter.js rather than re-deriving it, and modes/holland.js
// for the difficulty catalog/segment state machine/normalized-cycle math.
// Pull-ups and squats share one pose-tracking camera pipeline; pushups use
// the app's own face-tracking pipeline and its already-calibrated Settings
// thresholds — the live camera controller is only recreated when the
// detector type actually needs to change between segments.

const HOLLAND_WARMUP_MIN_MS = 1200;
const HOLLAND_WARMUP_MIN_SAMPLES = 10;
const HOLLAND_WARMUP_MAX_SAMPLES = 300;
const HOLLAND_WARMUP_HINT_MS = 8000;

const HOLLAND_LABELS = { pullup: "PULL-UPS", pushup: "PUSHUPS", squat: "SQUATS" };
const HOLLAND_CAL_INSTRUCTIONS = {
  pullup: "Do a full pull-up: dead hang, chin over the bar, then back to dead hang. It will count.",
  pushup: "Do a couple of pushups — we'll start counting automatically.",
  squat: "Squat up and down a couple of times — we'll start counting automatically.",
};
const HOLLAND_REPOSITION_HINTS = {
  pullup: "Face the phone and frame your hands, head, shoulders, elbows, and hips.",
  pushup: "Prop the phone so your face fills the frame.",
  squat: "Prop the phone against a wall and stand back so your whole body is in frame.",
};
const HOLLAND_TRANSITION_LINES = {
  pullup: HOLLAND_TO_PULLUP_LINES,
  pushup: HOLLAND_TO_PUSHUP_LINES,
  squat: HOLLAND_TO_SQUAT_LINES,
};

let hollandAdapterModule = null;
let hollandAdapterPromise = null;
function loadHollandAdapter() {
  if (!hollandAdapterPromise) {
    hollandAdapterPromise = Promise.all([loadPullupMode(), import("./modes/holland-adapter.js")])
      .then(([, adapterModule]) => { hollandAdapterModule = adapterModule; });
  }
  return hollandAdapterPromise;
}

const hollandState = {
  stage: "idle", // idle | warmup | counting | transition
  rules: null,
  detectorType: null, // "pose" | "face" currently backing hollandCamera
  calSamples: [],
  warmupStartedAt: 0,
  counter: null,
  lastSeenAt: 0,
  paused: false,
  lastRepSpokenAt: 0,
  startedAt: null,
  holland27Announced: false,
  calibratedThresholds: { pullup: null, pushup: null, squat: null },
};

let hollandCamera = null;
async function ensureHollandCamera(detectorType) {
  if (hollandCamera && hollandState.detectorType === detectorType) return hollandCamera;
  if (hollandCamera) hollandCamera.stop();
  hollandCamera = createCameraController({
    moduleUrl: FACE_DETECTOR_MODULE_URL,
    wasmUrl: FACE_DETECTOR_WASM_URL,
    modelUrl: detectorType === "pose" ? POSE_LANDMARKER_MODEL_URL : FACE_DETECTOR_MODEL_URL,
    detectorType,
    getVideo: () => $("holland-camera-video"),
    onDetection: detectorType === "pose" ? hollandOnPoseDetection : hollandOnFaceDetection,
    onNoDetection: hollandOnNoDetection,
  });
  const stream = await hollandCamera.requestStream();
  await hollandCamera.ensureDetector();
  const video = $("holland-camera-video");
  video.srcObject = stream;
  try { await video.play(); } catch { /* autoplay quirks */ }
  hollandState.detectorType = detectorType;
  hollandCamera.startDetection();
  return hollandCamera;
}

function updateHollandBox(bbox) {
  const video = $("holland-camera-video");
  const container = document.querySelector("#screen-holland-workout .camera-wrap");
  const cw = container.clientWidth, ch = container.clientHeight;
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.max(cw / vw, ch / vh);
  const offsetX = (cw - vw * scale) / 2, offsetY = (ch - vh * scale) / 2;
  const box = $("holland-pose-box");
  box.style.left = `${bbox.originX * scale + offsetX}px`;
  box.style.top = `${bbox.originY * scale + offsetY}px`;
  box.style.width = `${bbox.width * scale}px`;
  box.style.height = `${bbox.height * scale}px`;
  box.classList.remove("hidden");
}
function hideHollandBox() { $("holland-pose-box").classList.add("hidden"); }
function hideHollandStatusBanner() { $("holland-status-banner").classList.add("hidden"); }
function showHollandStatusBanner(text) {
  $("holland-status-banner").textContent = text;
  $("holland-status-banner").classList.remove("hidden");
  announce(text);
}
function checkHollandLostTimeout() {
  if (hollandState.paused || hollandState.stage !== "counting") return;
  const now = performance.now();
  if (now - hollandState.lastSeenAt > FACE_LOST_TIMEOUT_MS) {
    hollandState.paused = true;
    showHollandStatusBanner("PAUSED — get back in frame");
    speak("Paused");
  }
}

function processHollandRatio(ratio) {
  const now = performance.now();
  hollandState.lastSeenAt = now;
  if (hollandState.paused) {
    hollandState.paused = false;
    hideHollandStatusBanner();
    speak("Back to it");
  }
  if (!hollandState.counter) return;
  const result = hollandState.counter.advance(ratio, now);
  if (result.counted) onHollandRepCounted();
}

function processHollandPullupMetrics(metrics) {
  const now = performance.now();
  hollandState.lastSeenAt = now;
  if (hollandState.paused) {
    hollandState.paused = false;
    hideHollandStatusBanner();
    speak("Back to it");
  }
  if (!hollandState.counter) return;
  const result = hollandState.counter.advance(metrics);
  if (result.counted) onHollandRepCounted();
}

function hollandOnPoseDetection(landmarks) {
  const exercise = hollandCurrentExercise(hollandState.rules);
  const video = $("holland-camera-video");
  if (exercise === "pullup") {
    const metrics = pullupModeModule?.pullupFrameMetrics(landmarks);
    if (!metrics) { hideHollandBox(); checkHollandLostTimeout(); return; }
    const bbox = squatBodyBBox(landmarks.slice(0, 25), video);
    if (bbox) updateHollandBox(bbox);
    if (hollandState.stage === "warmup") {
      hollandState.calSamples.push({ ...metrics, t: performance.now() });
      if (hollandState.calSamples.length > HOLLAND_WARMUP_MAX_SAMPLES) hollandState.calSamples.shift();
      tickHollandWarmup();
    } else if (hollandState.stage === "counting") {
      processHollandPullupMetrics(metrics);
    }
    return;
  }
  // squat
  const hipY = squatHipY(landmarks);
  if (hipY == null) { hideHollandBox(); checkHollandLostTimeout(); return; }
  const bbox = squatBodyBBox(landmarks, video);
  if (bbox) updateHollandBox(bbox);
  if (hollandState.stage === "warmup") {
    hollandState.calSamples.push({ ratio: hipY, t: performance.now() });
    if (hollandState.calSamples.length > HOLLAND_WARMUP_MAX_SAMPLES) hollandState.calSamples.shift();
    tickHollandWarmup();
  } else if (hollandState.stage === "counting") {
    processHollandRatio(hipY);
  }
}

function hollandOnFaceDetection(bbox) {
  const video = $("holland-camera-video");
  updateHollandBox(bbox);
  if (hollandState.stage === "counting") processHollandRatio(bbox.height / video.videoHeight);
}

function hollandOnNoDetection() {
  hideHollandBox();
  checkHollandLostTimeout();
}

function renderHollandRepDisplay() {
  const exercise = hollandCurrentExercise(hollandState.rules);
  const target = hollandSegmentTarget(hollandState.rules);
  $("holland-rep-count").textContent = String(hollandState.rules.segmentReps);
  $("holland-rep-label").textContent = HOLLAND_LABELS[exercise];
  $("holland-rep-target").textContent = `${hollandState.rules.segmentReps} / ${target} this circuit`;
  renderHollandHUD();
}

function renderHollandHUD() {
  const cycles = hollandNormalizedCycles(hollandState.rules.totals);
  $("holland-hud-difficulty").textContent = hollandDifficultyLabel(hollandState.rules.difficulty);
  $("holland-hud-circuit").textContent = `Circuit ${hollandState.rules.circuitsCompleted + 1}`;
  $("holland-hud-cycles").textContent = `${hollandFormatCycles(cycles)} cycles`;
}

let hollandTimerInterval = null;
function startHollandTimer() {
  stopHollandTimer();
  hollandTimerInterval = setInterval(() => {
    if (!hollandState.startedAt) return;
    $("holland-hud-timer").textContent = formatDuration(Date.now() - hollandState.startedAt.getTime());
  }, 1000);
}
function stopHollandTimer() {
  if (hollandTimerInterval) { clearInterval(hollandTimerInterval); hollandTimerInterval = null; }
}

function onHollandRepCounted() {
  const result = hollandRecordReps(hollandState.rules, 1);
  renderHollandRepDisplay();
  if (soundIsEnabled()) {
    const now = performance.now();
    const fastPace = now - hollandState.lastRepSpokenAt < REP_SPEECH_MIN_GAP_MS;
    if (!fastPace) {
      hollandState.lastRepSpokenAt = now;
      speak(numberToWords(hollandState.rules.segmentReps));
    }
  }
  vibrate(45);
  if (result.reachedTarget) triggerHollandTransition();
}

function triggerHollandTransition() {
  hollandState.stage = "transition";
  hollandCamera?.stop();
  const completedExercise = hollandCurrentExercise(hollandState.rules);
  const completedTarget = hollandSegmentTarget(hollandState.rules);
  hollandAdvanceSegment(hollandState.rules);
  const nextExercise = hollandCurrentExercise(hollandState.rules);
  const nextTarget = hollandSegmentTarget(hollandState.rules);
  const cycles = hollandNormalizedCycles(hollandState.rules.totals);

  $("holland-transition-title").textContent = `${completedTarget} ${HOLLAND_LABELS[completedExercise]} done!`;
  $("holland-transition-body").textContent = `Next up: ${nextTarget} ${HOLLAND_LABELS[nextExercise]}. ${HOLLAND_REPOSITION_HINTS[nextExercise]}`;
  $("holland-transition-cycles").textContent = hollandCyclesLabel(cycles, hollandState.rules.difficulty);
  $("holland-cal-stage").classList.add("hidden");
  $("holland-count-stage").classList.add("hidden");
  $("holland-transition-stage").classList.remove("hidden");
  hideHollandStatusBanner();
  renderHollandHUD();

  const newlyQualified = hollandQualifiesForHolland27(cycles) && !hollandState.holland27Announced;
  if (newlyQualified) {
    hollandState.holland27Announced = true;
    launchConfetti("holland-confetti", CONFETTI_EMOJI);
  }
  const justCompletedCircuit = nextExercise === "pullup" && hollandState.rules.circuitsCompleted > 0 && hollandState.rules.segmentReps === 0;
  if (soundIsEnabled()) {
    const line = newlyQualified ? HOLLAND_27_LINE
      : justCompletedCircuit ? HOLLAND_CIRCUIT_COMPLETE_LINE
      : pickFrom(HOLLAND_TRANSITION_LINES[nextExercise]);
    speak(line);
  }
}

function beginHollandCounting(exercise, thresholds, calSamples = null) {
  const counter = calSamples
    ? hollandAdapterModule.hollandReplayCalibration(exercise, calSamples, thresholds)
    : hollandAdapterModule.hollandCreateCounter(exercise, thresholds);
  hollandState.counter = counter;
  hollandState.stage = "counting";
  hollandState.lastSeenAt = performance.now();
  hollandState.paused = false;
  $("holland-cal-stage").classList.add("hidden");
  $("holland-count-stage").classList.remove("hidden");
  hideHollandStatusBanner();
  if (counter.count > 0) {
    const result = hollandRecordReps(hollandState.rules, counter.count);
    if (result.reachedTarget) { triggerHollandTransition(); return; }
  }
  renderHollandRepDisplay();
}

function renderHollandWarmup(exercise) {
  $("holland-cal-title").textContent = "Get your range";
  $("holland-cal-instructions").textContent = HOLLAND_CAL_INSTRUCTIONS[exercise];
  $("holland-cal-error").classList.add("hidden");
}

function beginHollandWarmup(exercise) {
  hollandState.stage = "warmup";
  hollandState.calSamples = [];
  hollandState.warmupStartedAt = performance.now();
  $("holland-cal-stage").classList.remove("hidden");
  $("holland-count-stage").classList.add("hidden");
  hideHollandStatusBanner();
  renderHollandWarmup(exercise);
}

function tickHollandWarmup() {
  const exercise = hollandCurrentExercise(hollandState.rules);
  const elapsed = performance.now() - hollandState.warmupStartedAt;
  if (elapsed < HOLLAND_WARMUP_MIN_MS || hollandState.calSamples.length < HOLLAND_WARMUP_MIN_SAMPLES) return;
  if (!hollandAdapterModule.hollandCalibrationValid(exercise, hollandState.calSamples)) {
    if (elapsed > HOLLAND_WARMUP_HINT_MS) {
      $("holland-cal-error").textContent = "Still watching — keep going, or reposition so you're fully in frame.";
      $("holland-cal-error").classList.remove("hidden");
    }
    return;
  }
  $("holland-cal-error").classList.add("hidden");
  const thresholds = hollandAdapterModule.hollandDeriveThresholds(exercise, hollandState.calSamples);
  hollandState.calibratedThresholds[exercise] = thresholds;
  beginHollandCounting(exercise, thresholds, hollandState.calSamples);
}

// Only warms up the first time an exercise comes up in this workout —
// later circuits reuse the thresholds captured then. Pushup has no warmup
// at all; it reuses whatever's already calibrated in Settings.
async function beginHollandSegment(exercise) {
  const detectorType = exercise === "pushup" ? "face" : "pose";
  try {
    await ensureHollandCamera(detectorType);
  } catch {
    toast("Camera error — check camera permission and try again.", 4500);
    return false;
  }
  const cached = hollandState.calibratedThresholds[exercise];
  if (exercise === "pushup") beginHollandCounting(exercise, { down: getThresholdDown(), up: getThresholdUp() });
  else if (cached) beginHollandCounting(exercise, cached);
  else beginHollandWarmup(exercise);
  return true;
}

async function hollandReadyForNextSegment() {
  $("holland-transition-stage").classList.add("hidden");
  await beginHollandSegment(hollandCurrentExercise(hollandState.rules));
}

function selectHollandDifficulty(difficulty) {
  if (!HOLLAND_TARGETS[difficulty]) return;
  state.hollandDifficulty = difficulty;
  localStorage.setItem(LS.hollandDifficulty, difficulty);
  renderHollandIdle();
}

function renderHollandIdle() {
  document.querySelectorAll("#holland-difficulty-cards .holland-difficulty-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.difficulty === state.hollandDifficulty);
  });
  state.hollandBest = getHollandBest(state.currentUser);
  $("holland-personal-best").textContent = state.hollandBest > 0
    ? `Personal best: ${hollandFormatCycles(state.hollandBest)} Holland cycles`
    : "";
}

async function startHolland() {
  if (soundIsEnabled()) unlockVoice();
  await loadHollandAdapter();
  state.hollandSessionLocation = currentSessionLocationSnapshot();
  hollandState.rules = hollandCreateState(state.hollandDifficulty);
  hollandState.startedAt = new Date();
  hollandState.holland27Announced = false;
  hollandState.calibratedThresholds = { pullup: null, pushup: null, squat: null };
  hollandState.paused = false;
  hollandState.lastRepSpokenAt = 0;
  hollandState.detectorType = null;
  hollandState.counter = null;

  const ok = await beginHollandSegment(hollandCurrentExercise(hollandState.rules));
  if (!ok) return;

  await acquireWakeLock();
  state.hollandActive = true;
  $("holland-idle").classList.add("hidden");
  $("holland-in-progress").classList.remove("hidden");
  $("holland-transition-stage").classList.add("hidden");
  setChromeMinimized(true);
  startHollandTimer();
  renderHollandHUD();
  if (soundIsEnabled()) speak(pickFrom(HOLLAND_START_LINES));
}

function stopHollandHard() {
  hollandCamera?.stop();
  stopHollandTimer();
  releaseWakeLock();
  state.hollandActive = false;
  hollandState.stage = "idle";
  hollandState.counter = null;
  hideHollandStatusBanner();
  $("holland-in-progress").classList.add("hidden");
  $("holland-idle").classList.remove("hidden");
  setChromeMinimized(false);
}

function renderSummaryHollandResult(session) {
  const el = $("summary-holland-result");
  if (!el) return;
  if (!session || session.type !== "holland") {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }
  const achievementMarkup = session.hollandAchievement === "holland27"
    ? `<div class="holland-27-badge">🕷️ Holland 27 unlocked!</div>` : "";
  el.innerHTML = `
    <div class="holland-summary-difficulty">${escapeHtml(hollandCyclesLabel(session.hollandCycles, session.hollandDifficulty))}</div>
    <div class="holland-summary-breakdown">${session.hollandPullups} pull-ups · ${session.hollandPushups} pushups · ${session.hollandSquats} squats</div>
    ${achievementMarkup}
  `;
  el.classList.remove("hidden");
}

async function completeHolland() {
  hollandCamera?.stop();
  stopHollandTimer();
  await releaseWakeLock();
  state.hollandActive = false;
  hollandState.stage = "idle";
  hideHollandStatusBanner();
  $("holland-in-progress").classList.add("hidden");
  $("holland-idle").classList.remove("hidden");
  setChromeMinimized(false);

  hollandFinish(hollandState.rules, new Date());
  const cycles = hollandNormalizedCycles(hollandState.rules.totals);
  const session = hollandBuildSession(hollandState.rules, {
    id: uuid(),
    user: state.currentUser,
    avatar: state.currentAvatar,
    location: state.hollandSessionLocation,
  });
  const cached = getCachedData();
  cached.sessions.push(session);
  cacheData(cached);
  state.lastSessionType = "holland";
  state.summarySessionId = session.id;
  state.summaryBaseCount = session.count;
  state.summaryExtra = 0;
  state.summaryMultiplier = 1;
  state.summaryWeightLbs = 0;
  state.summaryPrAchieved = null;
  state.summaryChaseResult = null;
  state.summaryRoadtripConquests = [];
  $("summary-count").textContent = `${hollandFormatCycles(cycles)} cycles`;
  $("missed-reps-wrap").classList.add("hidden");
  renderSummaryWeightedNote(0, 0);
  renderSummaryChaseResult();
  renderSummaryRoadtripResult();
  renderSummaryHollandResult(session);
  $("summary-sync-status").textContent = "";
  preloadWorkoutShareMessages();
  showScreen("screen-summary");
  launchConfetti("confetti", CONFETTI_EMOJI);
  speak(session.hollandAchievement === "holland27"
    ? HOLLAND_27_LINE
    : `Session complete. ${hollandCyclesLabel(cycles, session.hollandDifficulty)}.`);
  try { await commitSession(session); }
  catch {
    enqueueSession(session);
    $("summary-sync-status").textContent = "Saved on this device — will sync automatically when back online.";
  }
}

async function confirmFinishHolland() {
  if (!hollandState.rules || hollandTotalReps(hollandState.rules.totals) <= 0) {
    toast("Complete at least one rep before finishing.", 3000);
    return;
  }
  if (!confirm("Finish this Holland workout? Your completed and partial progress will be saved.")) return;
  await completeHolland();
}

function applyHollandCorrection(delta) {
  if (!hollandState.rules || hollandState.stage !== "counting") return;
  hollandApplyCorrection(hollandState.rules, delta);
  renderHollandRepDisplay();
  if (delta > 0 && hollandState.rules.segmentReps >= hollandSegmentTarget(hollandState.rules)) {
    triggerHollandTransition();
  }
}

$("btn-holland-start").addEventListener("click", startHolland);
$("btn-holland-cancel").addEventListener("click", stopHollandHard);
$("btn-holland-finish").addEventListener("click", confirmFinishHolland);
$("btn-holland-ready").addEventListener("click", hollandReadyForNextSegment);
$("btn-holland-minus").addEventListener("click", () => applyHollandCorrection(-1));
$("btn-holland-plus").addEventListener("click", () => applyHollandCorrection(1));
$("holland-difficulty-cards").addEventListener("click", (e) => {
  const card = e.target.closest(".holland-difficulty-card");
  if (!card) return;
  selectHollandDifficulty(card.dataset.difficulty);
});

// ------------------- situp mode -------------------
// Camera-counted free set, own screen (see docs/situp-mode-plan.md): phone
// propped at the boy's feet facing him, auto-warmup derives per-session
// crunch/lie thresholds the same way squat derives stand/squat ones. Unlike
// squat, the signal is face SIZE (blaze_face_short_range, same detector
// pushups use) fed through modes/situp.js's inverted-ratio mapping, and a
// face dropout is the EXPECTED reading while lying flat — not a "pause and
// wait" signal like squat's whole-body-left-frame case — so there's no
// status banner/pause here, just a clamped ratio (see situpFrameRatio).

function updateSitupFaceBox(bbox) {
  const video = $("situp-camera-video");
  const container = document.querySelector("#screen-situp-workout .camera-wrap");
  const cw = container.clientWidth, ch = container.clientHeight;
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.max(cw / vw, ch / vh);
  const offsetX = (cw - vw * scale) / 2, offsetY = (ch - vh * scale) / 2;
  const box = $("situp-face-box");
  box.style.left = `${bbox.originX * scale + offsetX}px`;
  box.style.top = `${bbox.originY * scale + offsetY}px`;
  box.style.width = `${bbox.width * scale}px`;
  box.style.height = `${bbox.height * scale}px`;
  box.classList.remove("hidden");
}
function hideSitupFaceBox() { $("situp-face-box").classList.add("hidden"); }

function updateSitupPhaseIndicator(phase) {
  const el = $("situp-phase-indicator");
  el.textContent = phase === "down" ? "LYING BACK" : "CRUNCHED";
}

function updateSitupHighscoreMessage(count) {
  const el = $("situp-highscore-message");
  if (!state.situpBest) {
    el.textContent = "";
    return;
  }
  const remaining = state.situpBest - count;
  if (remaining > 0) {
    el.textContent = `${remaining} crunch${remaining === 1 ? "" : "es"} away from your best!`;
  } else if (remaining === 0) {
    el.textContent = "Tied your best crunch set — one more!";
  } else {
    el.textContent = "New crunch record! 🔥";
  }
}

// Same shape as maybeEncourageSquat, but for situp reps.
function maybeEncourageSitup(count) {
  if (!state.situpBest || state.situpBest <= 1) return null;
  if (count - situpState.lastCheerAtCount < 3) return null;
  if (Math.random() < cheerProbability(count / state.situpBest)) {
    situpState.lastCheerAtCount = count;
    return pickFrom(SITUP_CHEER_LINES);
  }
  return null;
}

function onSitupRepCounted(count) {
  $("situp-rep-count").textContent = String(count);
  if (localStorage.getItem(LS.showHighscore) !== "0") {
    updateSitupHighscoreMessage(count);
  }
  if (soundIsEnabled()) {
    let spoken;
    if (state.situpBest && count === state.situpBest + 1 && !situpState.recordBroken) {
      situpState.recordBroken = true;
      spoken = SITUP_RECORD_LINE;
      speak(spoken);
      launchConfetti("situp-confetti", CONFETTI_EMOJI);
    } else {
      spoken = maybeEncourageSitup(count);
    }
    const now = performance.now();
    const fastPace = now - situpState.lastRepSpokenAt < REP_SPEECH_MIN_GAP_MS;
    if (!fastPace || count % 5 === 0) {
      situpState.lastRepSpokenAt = now;
      speak(spoken || numberToWords(count));
    }
  }
}

// Turns one detection/no-detection frame into the ratio fed to the counter
// (or, during warmup, into the calibration sample window) — same function
// drives both stages, since a dropout is handled identically in either.
function situpRatioForFrame(detected, normalizedFaceSize) {
  return situpFrameRatio({
    detected,
    normalizedFaceSize,
    nowMs: performance.now(),
    trackState: situpState.dropoutTrack,
  });
}

function processSitupRatio(ratio) {
  if (!situpState.counter) situpState.counter = createRepCounter({ down: situpState.down, up: situpState.up });
  const now = performance.now();
  const result = situpState.counter.advance(ratio, now);
  situpState.phase = result.phase;
  updateSitupPhaseIndicator(result.phase);
  if (result.counted) {
    situpState.count = result.count;
    onSitupRepCounted(result.count);
  }
}

const situpCamera = createCameraController({
  moduleUrl: FACE_DETECTOR_MODULE_URL,
  wasmUrl: FACE_DETECTOR_WASM_URL,
  modelUrl: FACE_DETECTOR_MODEL_URL,
  getVideo: () => $("situp-camera-video"),
  onDetection(bbox, inferenceMs) {
    const video = $("situp-camera-video");
    updateSitupFaceBox(bbox);
    const ratio = situpRatioForFrame(true, bbox.height / video.videoHeight);
    if (situpState.stage === "warmup") {
      situpState.calSamples.push(ratio);
      if (situpState.calSamples.length > SITUP_WARMUP_MAX_SAMPLES) situpState.calSamples.shift();
      tickSitupWarmup();
    } else if (situpState.stage === "counting") {
      processSitupRatio(ratio);
    }
  },
  onNoDetection() {
    hideSitupFaceBox();
    // Undetected is the expected reading while lying flat (see header
    // comment) — still feed the (clamped) ratio through the same pipeline
    // instead of pausing, so a lying-flat stretch behaves like any other
    // low-face-size frame. During warmup, only once we've actually seen his
    // face at least once — otherwise "not detected yet because he isn't in
    // frame/positioned" (before dropoutTrack has a lastRatio) reads as
    // "lying flat" and can lock calibration onto pure setup noise before he's
    // even started (see bug: counted immediately, kept counting lying still).
    const ratio = situpRatioForFrame(false, null);
    if (situpState.stage === "warmup") {
      if (situpState.dropoutTrack.lastRatio != null) {
        situpState.calSamples.push(ratio);
        if (situpState.calSamples.length > SITUP_WARMUP_MAX_SAMPLES) situpState.calSamples.shift();
        tickSitupWarmup();
      }
    } else if (situpState.stage === "counting") {
      processSitupRatio(ratio);
    }
  },
});

// No taps, no calibration steps — the boy just starts doing situps in frame
// and this watches a rolling sample window until it's seen a real
// crunch<->lie swing, then derives thresholds and starts counting
// automatically. See docs/situp-mode-plan.md.
function renderSitupWarmup() {
  $("situp-cal-title").textContent = "Get your range";
  $("situp-cal-instructions").textContent = "Do a couple of situps — we'll start counting automatically.";
  $("situp-cal-error").classList.add("hidden");
}

function beginSitupWarmup() {
  situpState.calSamples = [];
  situpState.dropoutTrack = {};
  situpState.warmupStartedAt = performance.now();
  situpState.stage = "warmup";
  $("situp-cal-stage").classList.remove("hidden");
  $("situp-count-stage").classList.add("hidden");
  $("btn-situp-stop").classList.add("hidden");
  $("btn-situp-cancel").classList.remove("hidden");
  renderSitupWarmup();
}

function tickSitupWarmup() {
  const elapsed = performance.now() - situpState.warmupStartedAt;
  if (elapsed < SITUP_WARMUP_MIN_MS || situpState.calSamples.length < SITUP_WARMUP_MIN_SAMPLES) return;

  const { crunchRatio, lieRatio } = estimateSitupRange(situpState.calSamples);
  if (situpCalibrationValid(crunchRatio, lieRatio)) {
    $("situp-cal-error").classList.add("hidden");
    const thresholds = deriveSitupThresholds(crunchRatio, lieRatio);
    speak(pickFrom(SITUP_START_LINES));
    beginSitupCounting(thresholds);
    return;
  }

  if (elapsed > SITUP_WARMUP_HINT_MS) {
    const pct = Math.min(99, Math.round((situpSwing(crunchRatio, lieRatio) / SITUP_MIN_SWING) * 100));
    $("situp-cal-error").textContent = `Still watching (${pct}%) — move the phone closer to your feet, or crunch up higher.`;
    $("situp-cal-error").classList.remove("hidden");
  }
}

function beginSitupCounting(thresholds) {
  situpState.down = thresholds.down;
  situpState.up = thresholds.up;
  situpState.counter = createRepCounter({ down: thresholds.down, up: thresholds.up });
  situpState.phase = "up";
  situpState.count = 0;
  situpState.lastRepSpokenAt = 0;
  situpState.lastCheerAtCount = 0;
  situpState.recordBroken = false;
  situpState.stage = "counting";
  state.situpBest = getSitupBest(state.currentUser);
  state.situpStartedAt = new Date();
  $("situp-rep-count").textContent = "0";
  updateSitupPhaseIndicator("up");
  updateSitupHighscoreMessage(0);
  $("situp-cal-stage").classList.add("hidden");
  $("situp-count-stage").classList.remove("hidden");
  $("btn-situp-cancel").classList.add("hidden");
  $("btn-situp-stop").classList.remove("hidden");
}

async function startSitup() {
  if (soundIsEnabled()) unlockVoice();
  state.situpSessionLocation = currentSessionLocationSnapshot();

  let stream;
  try {
    stream = await situpCamera.requestStream();
  } catch (e) {
    toast("Camera access is required to count crunches. Please allow camera permission.", 4000);
    return;
  }
  toast("Loading face detector…", 2000);
  try {
    await situpCamera.ensureDetector();
  } catch (e) {
    toast("Couldn't load the face detection model. Check your connection and try again.", 4500);
    stream.getTracks().forEach((t) => t.stop());
    return;
  }
  const video = $("situp-camera-video");
  video.srcObject = stream;
  try { await video.play(); } catch (e) { /* autoplay quirks */ }

  await acquireWakeLock();

  state.situpActive = true;
  $("situp-idle").classList.add("hidden");
  $("situp-in-progress").classList.remove("hidden");
  setChromeMinimized(true);
  situpCamera.startDetection();
  beginSitupWarmup();
}

function stopSitupHard() {
  situpCamera.stop();
  releaseWakeLock();
  state.situpActive = false;
  situpState.stage = "idle";
  $("situp-in-progress").classList.add("hidden");
  $("situp-idle").classList.remove("hidden");
  setChromeMinimized(false);
}

let lastSitupFunMessageIndex = -1;
function pickSitupFunMessage(n) {
  let idx;
  do {
    idx = Math.floor(Math.random() * FUN_MESSAGES_SITUP.length);
  } while (idx === lastSitupFunMessageIndex && FUN_MESSAGES_SITUP.length > 1);
  lastSitupFunMessageIndex = idx;
  return FUN_MESSAGES_SITUP[idx](n);
}

async function completeSitup() {
  const count = situpState.count;
  situpCamera.stop();
  await releaseWakeLock();
  state.situpActive = false;
  situpState.stage = "idle";
  $("situp-in-progress").classList.add("hidden");
  $("situp-idle").classList.remove("hidden");
  setChromeMinimized(false);

  const session = {
    id: uuid(),
    user: state.currentUser,
    timestamp: new Date().toISOString(),
    count,
    avatar: state.currentAvatar,
    startedAt: state.situpStartedAt ? state.situpStartedAt.toISOString() : undefined,
    type: "situp",
    ...(state.situpSessionLocation ? { location: state.situpSessionLocation } : {}),
  };

  // Optimistically reflect it locally right away so it shows up immediately.
  const cached = getCachedData();
  cached.sessions.push(session);
  cacheData(cached);

  const message = pickSitupFunMessage(count);
  state.lastSessionType = "situp";
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
  renderSummaryWeightedNote(count, count);
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

$("btn-situp-start").addEventListener("click", startSitup);
$("btn-situp-cancel").addEventListener("click", stopSitupHard);
$("btn-situp-stop").addEventListener("click", completeSitup);

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

  // Open Horse links use the remembered app profile. New devices stay on the
  // normal profile picker; selecting or creating a profile resumes this link.
  if (state.currentUser) await openHorseGameFromHash();
  if (state.currentUser) await openTowGameFromHash();

  // A shared challenge link (#challenge=id) jumps straight to that challenge's
  // detail screen — but only if this device already has a remembered name;
  // otherwise fall back to the normal pick-a-name flow.
  const hashMatch = location.hash.match(/^#challenge=([a-z0-9-]+)$/);
  if (hashMatch && state.currentUser && challengeDefs.some((c) => c.id === hashMatch[1])) {
    openChallengeDetail(hashMatch[1]);
  }

  // A shared head-to-head link (#compare=NameA|NameB) is read-only and names
  // both people explicitly, so — unlike the challenge link above — it works
  // even for a device that's never picked a name (see openUserCompareFromLink).
  // location.hash is NOT auto-decoded (the "|" comes through as literal
  // %7C), so decode the whole fragment before matching against it.
  const compareMatch = decodeURIComponent(location.hash).match(/^#compare=([^|]+)\|([^|]+)$/);
  if (compareMatch) {
    openUserCompareFromLink(compareMatch[1], compareMatch[2]);
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
