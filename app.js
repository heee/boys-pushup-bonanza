// ===========================================================
// Boys Push Up Bonanza — app logic
// Vanilla JS, no build step. Face detection via MediaPipe Tasks Vision (CDN).
// ===========================================================

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

const LS = {
  theme: "bpb-theme",
  lastUser: "bpb-last-user",
  lastAvatar: "bpb-last-avatar",
  thresholdDown: "bpb-threshold-down",
  thresholdUp: "bpb-threshold-up",
  calibrationReadout: "bpb-calibration-readout",
  showHighscore: "bpb-show-highscore",
  pendingQueue: "bpb-pending-queue",
  cacheData: "bpb-cache-data",
  plankUnlocked: "bpb-plank-unlocked",
  soundEnabled: "bpb-sound-enabled",
};

const DEFAULT_DOWN = 0.55;
const DEFAULT_UP = 0.32;
const FACE_LOST_TIMEOUT_MS = 3000;

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
  try {
    const res = await fetch(CHALLENGES_URL, { cache: "no-cache" });
    const json = await res.json();
    challengeDefs = Array.isArray(json.challenges) ? json.challenges : [];
  } catch (e) {
    // keep whatever we had before; an empty list just renders empty states
  }
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
  const sessions = getAllSessionsForDisplay()
    .filter((s) => s.user === name && s.avatar)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function numberToWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + numberToWords(n % 100) : "");
  return String(n);
}

function speak(text) {
  if (localStorage.getItem(LS.soundEnabled) === "0") return;
  if (!("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
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
  return !WORKER_URL.includes("YOUR-SUBDOMAIN");
}

async function workerFetchData() {
  if (!workerConfigured()) throw new Error("Worker URL not configured yet.");
  const res = await fetch(`${WORKER_URL}/data`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fetch failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!Array.isArray(data.sessions)) data.sessions = [];
  if (!data.avatars || typeof data.avatars !== "object") data.avatars = {};
  if (!data.challengeParticipants || typeof data.challengeParticipants !== "object") data.challengeParticipants = {};
  return data;
}

async function workerSetAvatar(user, avatar) {
  if (!workerConfigured()) throw new Error("Worker URL not configured yet.");
  const res = await fetch(`${WORKER_URL}/set-avatar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Key": APP_KEY },
    body: JSON.stringify({ user, avatar }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Update failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function workerPostSession(session) {
  if (!workerConfigured()) throw new Error("Worker URL not configured yet.");
  const res = await fetch(`${WORKER_URL}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Key": APP_KEY },
    body: JSON.stringify(session),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Save failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function deleteUserRemote(name) {
  if (!workerConfigured()) throw new Error("Worker URL not configured yet.");
  const res = await fetch(`${WORKER_URL}/delete-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Key": APP_KEY },
    body: JSON.stringify({ user: name }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Delete failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function deleteSessionRemote(id) {
  if (!workerConfigured()) throw new Error("Worker URL not configured yet.");
  const res = await fetch(`${WORKER_URL}/delete-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Key": APP_KEY },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Delete failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function workerJoinChallenge(user, challengeId) {
  if (!workerConfigured()) throw new Error("Worker URL not configured yet.");
  const res = await fetch(`${WORKER_URL}/join-challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Key": APP_KEY },
    body: JSON.stringify({ user, challengeId }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Join failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

function cacheData(data) {
  localStorage.setItem(LS.cacheData, JSON.stringify(data));
}
function getCachedData() {
  try {
    const raw = localStorage.getItem(LS.cacheData);
    if (!raw) return { sessions: [], avatars: {}, challengeParticipants: {} };
    const data = JSON.parse(raw);
    if (!Array.isArray(data.sessions)) data.sessions = [];
    if (!data.avatars || typeof data.avatars !== "object") data.avatars = {};
    if (!data.challengeParticipants || typeof data.challengeParticipants !== "object") data.challengeParticipants = {};
    return data;
  } catch (e) {
    return { sessions: [], avatars: {}, challengeParticipants: {} };
  }
}

function getQueue() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS.pendingQueue) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch (e) { return []; }
}
function setQueue(q) { localStorage.setItem(LS.pendingQueue, JSON.stringify(q)); }
function enqueueSession(session) {
  const q = getQueue();
  q.push(session);
  setQueue(q);
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
async function flushQueue() {
  if (!workerConfigured()) return { flushed: 0, remaining: getQueue().length };
  const q = getQueue();
  if (!q.length) return { flushed: 0, remaining: 0 };
  const stillPending = [];
  let flushed = 0;
  for (const session of q) {
    try {
      await commitSession(session);
      flushed++;
    } catch (e) {
      stillPending.push(session);
    }
  }
  setQueue(stillPending);
  return { flushed, remaining: stillPending.length };
}

// All sessions currently known to this device: last successful remote fetch,
// unioned with anything still queued (not yet confirmed written remotely).
function getAllSessionsForDisplay() {
  const cached = getCachedData().sessions;
  const queued = getQueue();
  const byId = new Map();
  for (const s of cached) byId.set(s.id, s);
  for (const s of queued) byId.set(s.id, s);
  return Array.from(byId.values());
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

// ------------------- app state -------------------

const state = {
  currentUser: localStorage.getItem(LS.lastUser) || "",
  currentAvatar: "",
  screen: "screen-user",
  workoutActive: false,
  faceDetector: null,
  faceDetectorLoading: null,
  stream: null,
  wakeLock: null,
  detectionRunning: false,
  lastSessionResult: null,
  dashboardPeriod: "day",
  historyView: "recent",
  highScore: 0,
  bonanzaMode: "mine",
  lastSessions: [],
  mySessionsShown: 5,
  sessionStartedAt: null,
  challengeTab: "active",
  openChallengeId: null,
  activityType: "pushups",
  lastSessionType: "pushup",
  plankActive: false,
  plankBest: 0,
  plankStartedAt: null,
  homeActivityMode: "pushups",
};

const repState = {
  phase: "up",
  count: 0,
  smoothedRatio: null,
  lastSeenAt: 0,
  paused: false,
  lastCheerAtCount: 0,
  recordBroken: false,
};

const plankState = {
  seconds: 0,
  lastCheerAtSecond: 0,
  intervalId: null,
  recordBroken: false,
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
  const mine = getAllSessionsForDisplay().filter((s) => s.user === state.currentUser && s.type !== "plank");
  const streak = computeStreak(mine);
  el.classList.remove("hidden");
  if (streak > 0) {
    el.innerHTML = `🔥<span class="streak-num">${streak}</span>`;
  } else {
    el.innerHTML = `❄️<span class="streak-num streak-zero">0</span>`;
  }
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
  state.screen = id;
  const minimized = (id === "screen-workout" && state.workoutActive) ||
    (id === "screen-plank-workout" && state.plankActive);
  $("app-header").classList.toggle("minimized", minimized);
  renderStreakBadge();

  if (id === "screen-user") renderUserList();
  if (id === "screen-dashboard") renderDashboard();
  if (id === "screen-challenges") renderChallengesScreen();
  if (id === "screen-settings") renderSettings();
  if (id === "screen-workout" && !state.workoutActive) {
    $("workout-username").textContent = state.currentUser || "Friend";
    setAvatarEl($("workout-avatar"), state.currentAvatar, "2rem");
  }
  if (id === "screen-plank-workout" && !state.plankActive) {
    $("plank-username").textContent = state.currentUser || "Friend";
    setAvatarEl($("plank-avatar"), state.currentAvatar, "2rem");
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
$("streak-badge").addEventListener("click", () => guardLeaveWorkout(() => goToDashboard("mine")));
$("btn-nav-challenges").addEventListener("click", () => guardLeaveWorkout(() => showScreen("screen-challenges")));
$("btn-nav-dashboard").addEventListener("click", () => guardLeaveWorkout(() => goToDashboard("boys")));
$("btn-nav-settings").addEventListener("click", () => guardLeaveWorkout(() => showScreen("screen-settings")));

// ------------------- user select screen -------------------

function renderUserList() {
  const sessions = getAllSessionsForDisplay();
  const allNames = Array.from(new Set(sessions.map((s) => s.user)));
  const others = shuffleArray(allNames.filter((n) => n !== state.currentUser));
  const names = allNames.includes(state.currentUser) ? [state.currentUser, ...others] : others;
  const list = $("user-list");
  list.innerHTML = "";
  if (!names.length) {
    const p = document.createElement("p");
    p.className = "screen-sub";
    p.textContent = "No one's flexed yet — be the first!";
    list.appendChild(p);
  }
  for (const name of names) {
    const avatar = avatarForUser(name);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "user-chip" + (name === state.currentUser ? " selected" : "");
    btn.innerHTML = `${avatarCircleHTML(avatar, "1.7rem")}<span>${escapeHtml(name)}</span>`;
    btn.addEventListener("click", () => selectUser(name));
    list.appendChild(btn);
  }

  if (names.length) {
    const newBtn = document.createElement("button");
    newBtn.type = "button";
    newBtn.className = "user-chip new-user-chip";
    newBtn.innerHTML = `<span class="new-user-plus">＋</span><span>New user</span>`;
    newBtn.addEventListener("click", () => {
      $("new-user-form").classList.remove("hidden");
      $("new-user-input").focus();
    });
    list.appendChild(newBtn);
    $("new-user-form").classList.add("hidden");
  } else {
    $("new-user-form").classList.remove("hidden");
  }

  $("new-user-input").value = "";
  populateAvatarSelect();

  // Plank mode stays a hidden easter egg until unlocked once; the picker
  // always resets to Pushups when you land back on this screen.
  state.homeActivityMode = "pushups";
  document.querySelectorAll("#home-activity-select .segment").forEach((s, i) => s.classList.toggle("active", i === 0));
  $("home-activity-select").classList.toggle("hidden", localStorage.getItem(LS.plankUnlocked) !== "1");
}

$("home-activity-select").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment");
  if (!btn) return;
  document.querySelectorAll("#home-activity-select .segment").forEach((s) => s.classList.remove("active"));
  btn.classList.add("active");
  state.homeActivityMode = btn.dataset.activity;
});

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
  showScreen(state.homeActivityMode === "planks" ? "screen-plank-workout" : "screen-workout");
}

$("new-user-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("new-user-input").value.trim();
  if (!name) return;
  selectUser(name, $("new-user-avatar").value);
});

// ------------------- settings screen -------------------

function renderSettings() {
  $("range-down").value = getThresholdDown();
  $("range-up").value = getThresholdUp();
  $("val-down").textContent = getThresholdDown().toFixed(2);
  $("val-up").textContent = getThresholdUp().toFixed(2);
  $("chk-calibration-readout").checked = localStorage.getItem(LS.calibrationReadout) === "1";
  $("chk-highscore-message").checked = localStorage.getItem(LS.showHighscore) !== "0";
  $("chk-sound-enabled").checked = localStorage.getItem(LS.soundEnabled) !== "0";

  renderPendingStatus();
  testSyncConnection();
  renderManageUsers();
  state.mySessionsShown = 5;
  renderMySessions();
}

function renderManageUsers() {
  const sessions = getAllSessionsForDisplay();
  const names = Array.from(new Set(sessions.map((s) => s.user))).sort((a, b) => a.localeCompare(b));
  const list = $("manage-users-list");
  list.innerHTML = "";
  if (!names.length) {
    list.innerHTML = '<p class="settings-hint">No users yet.</p>';
    return;
  }
  for (const name of names) {
    const avatar = avatarForUser(name);
    const row = document.createElement("div");
    row.className = "manage-user-row";
    row.innerHTML = `
      <select class="avatar-select manage-avatar-select" aria-label="Change ${escapeHtml(name)}'s avatar"></select>
      <span class="manage-user-name">${escapeHtml(name)}</span>
      <button type="button" class="btn-delete-user" aria-label="Delete ${escapeHtml(name)}">🗑️</button>
    `;
    const avatarSelect = row.querySelector(".manage-avatar-select");
    avatarSelect.innerHTML = AVATARS.map((a) => `<option value="${a.id}">${a.emoji}</option>`).join("");
    avatarSelect.value = avatar.id;
    avatarSelect.style.background = avatar.bg;
    avatarSelect.addEventListener("change", () => {
      avatarSelect.style.background = getAvatar(avatarSelect.value).bg;
      changeUserAvatar(name, avatarSelect.value);
    });
    row.querySelector(".btn-delete-user").addEventListener("click", () => confirmDeleteUser(name));
    list.appendChild(row);
  }
}

async function changeUserAvatar(name, avatarId) {
  try {
    await workerSetAvatar(name, avatarId);
  } catch (e) {
    toast(`Couldn't update avatar — check your connection.`, 4000);
    renderManageUsers();
    return;
  }
  const cached = getCachedData();
  cached.avatars[name] = avatarId;
  cacheData(cached);
  toast(`Updated ${name}'s avatar.`);
}

async function confirmDeleteUser(name) {
  const ok = confirm(`Delete all of ${name}'s sessions from the shared leaderboard? This can't be undone.`);
  if (!ok) return;
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
  setQueue(getQueue().filter((s) => s.user !== name));
  if (state.currentUser === name) {
    state.currentUser = "";
    localStorage.removeItem(LS.lastUser);
  }
  toast(`Deleted ${name}'s sessions.`);
  renderManageUsers();
}

function renderMySessions() {
  const mine = getAllSessionsForDisplay()
    .filter((s) => s.user === state.currentUser)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const list = $("my-sessions-list");
  list.innerHTML = "";
  if (!mine.length) {
    list.innerHTML = '<p class="settings-hint">No sessions yet.</p>';
    $("btn-my-sessions-more").classList.add("hidden");
    return;
  }
  for (const s of mine.slice(0, state.mySessionsShown)) {
    const row = document.createElement("div");
    row.className = "my-session-row";
    row.innerHTML = `
      <span>${formatDateTime(s.timestamp)}</span>
      <span class="my-session-count">${s.type === "plank" ? `🪵 ${formatDuration(s.count * 1000)}` : s.count}</span>
      <button type="button" class="btn-delete-user" aria-label="Delete session">🗑️</button>
    `;
    row.querySelector(".btn-delete-user").addEventListener("click", () => confirmDeleteSession(s.id));
    list.appendChild(row);
  }
  $("btn-my-sessions-more").classList.toggle("hidden", mine.length <= state.mySessionsShown);
}

$("btn-my-sessions-more").addEventListener("click", () => {
  state.mySessionsShown += 5;
  renderMySessions();
});

async function confirmDeleteSession(id) {
  const ok = confirm("Delete this session from the shared leaderboard? This can't be undone.");
  if (!ok) return;
  try {
    await deleteSessionRemote(id);
  } catch (e) {
    toast("Couldn't delete right now — check your connection.", 4000);
    return;
  }
  const cached = getCachedData();
  cached.sessions = cached.sessions.filter((s) => s.id !== id);
  cacheData(cached);
  setQueue(getQueue().filter((s) => s.id !== id));
  toast("Session deleted.");
  renderMySessions();
  renderStreakBadge();
}

function renderPendingStatus() {
  const n = getQueue().length;
  $("pending-status").textContent = n > 0
    ? `${n} session${n === 1 ? "" : "s"} saved locally, waiting to sync…`
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
    if (flushResult.flushed) toast(`Synced ${flushResult.flushed} queued session(s).`);
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
$("chk-calibration-readout").addEventListener("change", (e) => {
  localStorage.setItem(LS.calibrationReadout, e.target.checked ? "1" : "0");
});
$("chk-highscore-message").addEventListener("change", (e) => {
  localStorage.setItem(LS.showHighscore, e.target.checked ? "1" : "0");
});
$("chk-sound-enabled").addEventListener("change", (e) => {
  localStorage.setItem(LS.soundEnabled, e.target.checked ? "1" : "0");
});
$("btn-calibration-defaults").addEventListener("click", () => {
  localStorage.setItem(LS.thresholdDown, DEFAULT_DOWN);
  localStorage.setItem(LS.thresholdUp, DEFAULT_UP);
  renderSettings();
});

// ------------------- dashboard / leaderboard -------------------

function periodStart(period) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "day": return d;
    case "week": {
      const day = d.getDay();
      const diff = day === 0 ? 6 : day - 1;
      d.setDate(d.getDate() - diff);
      return d;
    }
    case "month": return new Date(now.getFullYear(), now.getMonth(), 1);
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), q * 3, 1);
    }
    case "year": return new Date(now.getFullYear(), 0, 1);
    default: return d;
  }
}

const TROPHIES = ["🥇", "🥈", "🥉"];

async function renderDashboard() {
  await flushQueue().catch(() => {});
  const sessions = await refreshFromRemote();
  state.lastSessions = sessions;
  renderPendingStatus();
  $("activity-type-select").classList.toggle("hidden", localStorage.getItem(LS.plankUnlocked) !== "1");
  paintActiveBonanzaView();
  renderStreakBadge();
}

// Plank sessions and pushup sessions are stored in the same array; every
// dashboard view is scoped to whichever activity type is currently selected.
function filterByActivityType(sessions) {
  const wantPlank = state.activityType === "planks";
  return sessions.filter((s) => (s.type === "plank") === wantPlank);
}

function paintActiveBonanzaView() {
  const typed = filterByActivityType(state.lastSessions);
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

$("activity-type-select").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment");
  if (!btn) return;
  document.querySelectorAll("#activity-type-select .segment").forEach((s) => s.classList.remove("active"));
  btn.classList.add("active");
  state.activityType = btn.dataset.activity;
  paintActiveBonanzaView();
});

function computeStreak(sessionsForUser) {
  const daySet = new Set(sessionsForUser.map((s) => new Date(s.timestamp).toDateString()));
  let streak = 0;
  const cursor = new Date();
  if (!daySet.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (daySet.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function paintMyBonanza(sessions) {
  const isPlank = state.activityType === "planks";
  const activityWord = isPlank ? "planks" : "pushups";
  const mine = sessions.filter((s) => s.user === state.currentUser);

  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
  }
  const dayTotals = days.map((d) => {
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const total = mine
      .filter((s) => { const t = new Date(s.timestamp); return t >= d && t < next; })
      .reduce((sum, s) => sum + s.count, 0);
    return { date: d, total };
  });
  const maxTotal = Math.max(1, ...dayTotals.map((d) => d.total));

  $("week-chart").innerHTML = dayTotals.map(({ date, total }) => {
    const isToday = date.toDateString() === now.toDateString();
    const label = isToday ? "Today" : date.toLocaleDateString(undefined, { weekday: "short" });
    const heightPct = total > 0 ? Math.max(6, Math.round((total / maxTotal) * 100)) : 3;
    const valueDisplay = total > 0 ? (isPlank ? formatDuration(total * 1000) : total) : "";
    return `
      <div class="week-bar-col">
        <div class="week-bar-value">${valueDisplay}</div>
        <div class="week-bar" style="height:${heightPct}%"></div>
        <div class="week-bar-label">${label}</div>
      </div>
    `;
  }).join("");

  const statsEl = $("personal-stats");
  if (!mine.length) {
    statsEl.innerHTML = `<p class="leaderboard-empty">No sessions yet — go do some ${activityWord}! 💪</p>`;
    return;
  }
  const allTimeTotal = mine.reduce((sum, s) => sum + s.count, 0);
  const personalBest = Math.max(...mine.map((s) => s.count));
  const avgPerSession = Math.round(allTimeTotal / mine.length);
  const streak = computeStreak(mine);

  if (isPlank) {
    const stats = [
      { icon: "🔢", label: "All-time total", value: formatDuration(allTimeTotal * 1000) },
      { icon: "🏆", label: "Personal best", value: formatDuration(personalBest * 1000) },
      { icon: "🔥", label: "Current streak", value: `${streak} day${streak === 1 ? "" : "s"}` },
      { icon: "📊", label: "Avg per session", value: formatDuration(avgPerSession * 1000) },
      { icon: "📅", label: "Sessions logged", value: mine.length },
    ];
    statsEl.innerHTML = stats.map((s) => `
      <div class="stats-table-row">
        <span class="stats-table-label">${s.icon} ${s.label}</span>
        <span class="stats-table-value">${s.value}</span>
      </div>
    `).join("");
    return;
  }

  // Duration-based stats only use sessions that recorded both a start and
  // end time, and only sane durations (protects against a backgrounded app
  // making a session look like it took an hour).
  const timedSessions = mine.filter((s) => {
    if (!s.startedAt) return false;
    const ms = new Date(s.timestamp) - new Date(s.startedAt);
    return ms > 0 && ms < 30 * 60 * 1000;
  });
  let avgDurationMs = null;
  let avgPace = null;
  if (timedSessions.length) {
    const durationsMs = timedSessions.map((s) => new Date(s.timestamp) - new Date(s.startedAt));
    avgDurationMs = durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length;
    const totalTimedReps = timedSessions.reduce((sum, s) => sum + s.count, 0);
    const totalMinutes = durationsMs.reduce((a, b) => a + b, 0) / 60000;
    avgPace = totalMinutes > 0 ? totalTimedReps / totalMinutes : null;
  }

  const stats = [
    { icon: "🔢", label: "All-time total", value: allTimeTotal },
    { icon: "🏆", label: "Personal best", value: personalBest },
    { icon: "🔥", label: "Current streak", value: `${streak} day${streak === 1 ? "" : "s"}` },
    { icon: "📊", label: "Avg per session", value: avgPerSession },
    { icon: "📅", label: "Sessions logged", value: mine.length },
  ];
  if (avgDurationMs != null) {
    stats.push({ icon: "⏱️", label: "Avg session time", value: formatDuration(avgDurationMs) });
  }
  if (avgPace != null) {
    stats.push({ icon: "⚡", label: "Avg pace", value: `${avgPace.toFixed(1)}/min` });
  }
  statsEl.innerHTML = stats.map((s) => `
    <div class="stats-table-row">
      <span class="stats-table-label">${s.icon} ${s.label}</span>
      <span class="stats-table-value">${s.value}</span>
    </div>
  `).join("");
}

function paintDashboard(sessions) {
  const isPlank = state.activityType === "planks";
  const activityWord = isPlank ? "planks" : "pushups";
  const fmtCount = (n) => (isPlank ? formatDuration(n * 1000) : n);
  const start = periodStart(state.dashboardPeriod);
  const filtered = sessions.filter((s) => new Date(s.timestamp) >= start);

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
        <div class="leaderboard-trophy">${TROPHIES[i] || ""}</div>
        ${avatarCircleHTML(avatarForUser(user), "1.8rem")}
        <div class="leaderboard-name">${escapeHtml(user)}</div>
        <div class="leaderboard-total">${fmtCount(total)}</div>
      `;
      lbList.appendChild(row);
    });
  }

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
      const userSessions = byUser.get(user).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const group = document.createElement("div");
      group.className = "history-user-group";
      const header = document.createElement("div");
      header.className = "history-user-header";
      header.innerHTML = `<span class="history-user-label">${avatarCircleHTML(avatarForUser(user), "1.7rem")}<span>${escapeHtml(user)} — ${fmtCount(totals.get(user))} total</span></span><span class="chev">▸</span>`;
      header.addEventListener("click", () => group.classList.toggle("open"));
      const sessionsWrap = document.createElement("div");
      sessionsWrap.className = "history-sessions";
      sessionsWrap.innerHTML = userSessions
        .map((s) => `<div class="history-session-row"><span>${formatDateTime(s.timestamp)}</span><span class="history-session-count">${fmtCount(s.count)}</span></div>`)
        .join("");
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
  const recent = [...sessions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);
  recentList.innerHTML = "";
  if (!recent.length) {
    recentList.innerHTML = `<p class="history-empty">No ${isPlank ? "planks" : "pushups"} logged yet. Get moving! 💪</p>`;
    return;
  }
  for (const s of recent) {
    const row = document.createElement("div");
    row.className = "recent-row";
    row.innerHTML = `
      ${avatarCircleHTML(avatarForUser(s.user), "1.8rem")}
      <div class="recent-name">${escapeHtml(s.user)}</div>
      <div class="recent-count">${isPlank ? formatDuration(s.count * 1000) : s.count}</div>
      <div class="recent-time">${formatDateTime(s.timestamp)}</div>
    `;
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
  paintDashboard(filterByActivityType(state.lastSessions));
});

// ------------------- challenges -------------------

// Dates are YYYY-MM-DD, inclusive, in the device's local timezone.
function challengeWindow(c) {
  const [sy, sm, sd] = c.start.split("-").map(Number);
  const [ey, em, ed] = c.end.split("-").map(Number);
  return {
    startDate: new Date(sy, sm - 1, sd, 0, 0, 0, 0),
    endDate: new Date(ey, em - 1, ed, 23, 59, 59, 999),
  };
}

function challengeStatus(c, now = new Date()) {
  const { startDate, endDate } = challengeWindow(c);
  if (now < startDate) return "upcoming";
  if (now > endDate) return "past";
  return "active";
}

function challengeParticipantsOf(c) {
  return getCachedData().challengeParticipants[c.id] || [];
}

function challengeSessions(c) {
  const participants = new Set(challengeParticipantsOf(c));
  if (!participants.size) return [];
  const { startDate, endDate } = challengeWindow(c);
  return getAllSessionsForDisplay().filter((s) => {
    if (s.type === "plank") return false; // challenges are pushup-rep goals only
    if (!participants.has(s.user)) return false;
    const t = new Date(s.timestamp);
    return t >= startDate && t <= endDate;
  });
}

function challengeTotal(c) {
  return challengeSessions(c).reduce((sum, s) => sum + s.count, 0);
}

function userChallengeTotal(c, name) {
  return challengeSessions(c)
    .filter((s) => s.user === name)
    .reduce((sum, s) => sum + s.count, 0);
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

function challengeLeaderboard(c) {
  const participants = challengeParticipantsOf(c);
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
  if (!board.length || board[0].score <= 0) return [];
  const top = board[0].score;
  return board.filter((row) => row.score === top).map((row) => row.name);
}

function daysLeft(c, now = new Date()) {
  const { endDate } = challengeWindow(c);
  return Math.max(0, Math.ceil((endDate - now) / (24 * 60 * 60 * 1000)));
}

function daysUntilStart(c, now = new Date()) {
  const { startDate } = challengeWindow(c);
  return Math.max(0, Math.ceil((startDate - now) / (24 * 60 * 60 * 1000)));
}

function formatChallengeDates(c) {
  const { startDate, endDate } = challengeWindow(c);
  const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return startDate.toDateString() === endDate.toDateString() ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}

async function renderChallengesScreen() {
  await loadChallenges();
  await flushQueue().catch(() => {});
  await refreshFromRemote();
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
  for (const c of list) el.appendChild(buildChallengeCard(c, now));
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

  let html = `
    <div class="challenge-card-emoji">${c.emoji}</div>
    <div class="challenge-card-title">${escapeHtml(c.title)}</div>
    <div class="challenge-card-dates">${formatChallengeDates(c)} <span class="challenge-status-chip">${dateLabel}</span></div>
    <div class="challenge-card-meta">👥 ${participants.length} joined · ${total} total pushups so far</div>
  `;

  if (status !== "past" && joined) {
    html += `<span class="challenge-joined-chip">✓ In</span>`;
  } else if (status === "past") {
    const winners = challengeWinners(c);
    if (winners.length) {
      const board = challengeLeaderboard(c);
      const scoreText = c.goalType === "streak" ? `${board[0].score} days` : `${board[0].score}`;
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
  renderChallengeDetail();
  showScreen("screen-challenge-detail");
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

  let statusLabel;
  if (status === "active") statusLabel = `${daysLeft(c, now)} day${daysLeft(c, now) === 1 ? "" : "s"} left`;
  else if (status === "upcoming") statusLabel = `Starts in ${daysUntilStart(c, now)} day${daysUntilStart(c, now) === 1 ? "" : "s"}`;
  else statusLabel = "Ended";

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
    const daysLeftLabel = status === "active"
      ? `${daysLeft(c, now)} days left`
      : status === "upcoming"
        ? `starts in ${daysUntilStart(c, now)} days`
        : "ended";
    if (c.goalType === "individual") {
      const mine = userChallengeTotal(c, state.currentUser);
      const pct = Math.min(100, Math.round((mine / c.goal) * 100));
      html += `
        <div class="challenge-progress-card">
          <div class="challenge-progress-label">${mine} / ${c.goal} · ${daysLeftLabel}</div>
          <div class="thermometer-wrap">
            <div class="thermometer-track">
              <div class="thermometer-fill${mine >= c.goal ? " thermometer-win" : ""}" style="width:${pct}%"></div>
            </div>
          </div>
        </div>
      `;
    } else if (c.goalType === "collective") {
      const mine = userChallengeTotal(c, state.currentUser);
      const pct = Math.min(100, Math.round((total / c.goal) * 100));
      html += `
        <div class="challenge-progress-card">
          <div class="challenge-progress-label">${total} / ${c.goal} together · ${daysLeftLabel}</div>
          <div class="thermometer-wrap">
            <div class="thermometer-track">
              <div class="thermometer-fill${total >= c.goal ? " thermometer-win" : ""}" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="challenge-contribution">Your contribution: ${mine}</div>
        </div>
      `;
    } else {
      const { best, current } = windowStreak(sessions, state.currentUser, startDate, endDate);
      const pct = Math.min(100, Math.round((best / c.goal) * 100));
      html += `
        <div class="challenge-progress-card">
          <div class="challenge-progress-label">Current streak: ${current} day${current === 1 ? "" : "s"} · Best: ${best} / ${c.goal} days</div>
          <div class="thermometer-wrap">
            <div class="thermometer-track">
              <div class="thermometer-fill${best >= c.goal ? " thermometer-win" : ""}" style="width:${pct}%"></div>
            </div>
          </div>
        </div>
      `;
    }
  }

  const overviewValue = status === "past" ? "Ended" : status === "upcoming" ? daysUntilStart(c, now) : daysLeft(c, now);
  const overviewLabel = status === "past" ? "Status" : status === "upcoming" ? "Days until start" : "Days left";

  html += `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value stat-value-sm">${formatChallengeDates(c)}</div><div class="stat-label">Duration</div></div>
      <div class="stat-card"><div class="stat-value">${participants.length}</div><div class="stat-label">Participants</div></div>
      <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total pushups</div></div>
      <div class="stat-card"><div class="stat-value">${overviewValue}</div><div class="stat-label">${overviewLabel}</div></div>
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
  board.forEach((row, i) => {
    const scoreText = c.goalType === "streak" ? `${row.score} day${row.score === 1 ? "" : "s"}` : `${row.score}`;
    const rowEl = document.createElement("div");
    rowEl.className = "leaderboard-row" + (i < 3 ? ` rank-${i + 1}` : "");
    rowEl.innerHTML = `
      <div class="leaderboard-rank">${i + 1}</div>
      <div class="leaderboard-trophy">${TROPHIES[i] || ""}</div>
      ${avatarCircleHTML(avatarForUser(row.name), "1.8rem")}
      <div class="leaderboard-name">${escapeHtml(row.name)}</div>
      <div class="leaderboard-total">${scoreText}</div>
    `;
    el.appendChild(rowEl);
  });
}

function paintChallengeRecent(sessions) {
  const el = $("challenge-recent-list");
  const recent = [...sessions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);
  el.innerHTML = "";
  if (!recent.length) {
    el.innerHTML = '<p class="history-empty">No sessions yet.</p>';
    return;
  }
  for (const s of recent) {
    const row = document.createElement("div");
    row.className = "recent-row";
    row.innerHTML = `
      ${avatarCircleHTML(avatarForUser(s.user), "1.8rem")}
      <div class="recent-name">${escapeHtml(s.user)}</div>
      <div class="recent-count">${s.count}</div>
      <div class="recent-time">${formatDateTime(s.timestamp)}</div>
    `;
    el.appendChild(row);
  }
}

async function joinChallenge(id) {
  if (!state.currentUser) {
    toast("Pick your name on the home screen first.");
    return;
  }
  try {
    await workerJoinChallenge(state.currentUser, id);
  } catch (e) {
    toast("Couldn't join — check your connection.", 4000);
    return;
  }
  const cached = getCachedData();
  if (!cached.challengeParticipants[id]) cached.challengeParticipants[id] = [];
  if (!cached.challengeParticipants[id].includes(state.currentUser)) {
    cached.challengeParticipants[id].push(state.currentUser);
  }
  cacheData(cached);
  toast("You're in! 💪");
  if (state.screen === "screen-challenge-detail") renderChallengeDetail();
  else paintChallengeList();
}

$("challenge-tab-select").addEventListener("click", (e) => {
  const btn = e.target.closest(".segment");
  if (!btn) return;
  document.querySelectorAll("#challenge-tab-select .segment").forEach((s) => s.classList.remove("active"));
  btn.classList.add("active");
  state.challengeTab = btn.dataset.ctab;
  paintChallengeList();
});

$("btn-challenge-back").addEventListener("click", () => showScreen("screen-challenges"));

// ------------------- workout screen: camera + face detection -------------------

async function ensureFaceDetector() {
  if (state.faceDetector) return state.faceDetector;
  if (state.faceDetectorLoading) return state.faceDetectorLoading;
  state.faceDetectorLoading = (async () => {
    const visionModule = await import(FACE_DETECTOR_MODULE_URL);
    const { FaceDetector, FilesetResolver } = visionModule;
    const vision = await FilesetResolver.forVisionTasks(FACE_DETECTOR_WASM_URL);
    const detector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: FACE_DETECTOR_MODEL_URL,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
    });
    state.faceDetector = detector;
    return detector;
  })();
  return state.faceDetectorLoading;
}

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
  repState.phase = "up";
  repState.count = 0;
  repState.smoothedRatio = null;
  repState.lastSeenAt = performance.now();
  repState.paused = false;
  repState.lastCheerAtCount = 0;
  repState.recordBroken = false;
  $("rep-count").textContent = "0";
  updateHighscoreMessage(0);
  updateThermometer(0);
  hideStatusBanner();
}

const ENCOURAGE_LINES = [
  "Keep grinding!",
  "Let's gooo!",
  "Don't you dare stop now!",
  "Push through!",
  "Almost there — you can smell the record!",
  "Just a few more! You're so close!",
  "Finish strong!",
  "You've got this!",
  "Dig deep!",
  "One more! One more!",
];

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
  if (!state.highScore) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  const fill = $("thermometer-fill");
  const pct = Math.min(100, Math.round((count / state.highScore) * 100));
  fill.style.width = `${pct}%`;
  fill.classList.toggle("thermometer-win", count > state.highScore);
}

function getHighScore(name) {
  return getAllSessionsForDisplay()
    .filter((s) => s.user === name && s.type !== "plank")
    .reduce((max, s) => Math.max(max, s.count), 0);
}

function getPlankBest(name) {
  return getAllSessionsForDisplay()
    .filter((s) => s.user === name && s.type === "plank")
    .reduce((max, s) => Math.max(max, s.count), 0);
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

function processRatio(ratio) {
  const now = performance.now();
  repState.lastSeenAt = now;

  if (repState.smoothedRatio == null) repState.smoothedRatio = ratio;
  else repState.smoothedRatio = repState.smoothedRatio * 0.7 + ratio * 0.3;

  if (repState.paused) {
    repState.paused = false;
    repState.smoothedRatio = ratio;
    hideStatusBanner();
    speak("Back to it");
  }

  if (localStorage.getItem(LS.calibrationReadout) === "1") {
    $("calibration-readout").textContent =
      `ratio ${repState.smoothedRatio.toFixed(2)} · phase ${repState.phase}`;
    $("calibration-readout").classList.remove("hidden");
  } else {
    $("calibration-readout").classList.add("hidden");
  }

  const down = getThresholdDown();
  const up = getThresholdUp();

  if (repState.phase === "up" && repState.smoothedRatio >= down) {
    repState.phase = "down";
  } else if (repState.phase === "down" && repState.smoothedRatio <= up) {
    repState.phase = "up";
    repState.count += 1;
    onRepCounted(repState.count);
  }
}

function onRepCounted(count) {
  $("rep-count").textContent = String(count);
  updateHighscoreMessage(count);
  updateThermometer(count);

  let spoken = null;
  if (state.highScore && count === state.highScore + 1 && !repState.recordBroken) {
    repState.recordBroken = true;
    spoken = "New personal record! Absolute legend!";
    launchConfetti("workout-confetti");
  } else {
    spoken = maybeEncourage(count);
  }
  speak(spoken || numberToWords(count));
  vibrate(45);
}

function checkFaceLostTimeout() {
  if (repState.paused) return;
  const now = performance.now();
  if (now - repState.lastSeenAt > FACE_LOST_TIMEOUT_MS) {
    repState.paused = true;
    showStatusBanner("PAUSED — find your face");
    speak("Paused");
  }
}

function runDetectionOnce() {
  const video = $("camera-video");
  if (!state.faceDetector || !video.videoWidth) return;
  let result;
  try {
    result = state.faceDetector.detectForVideo(video, performance.now());
  } catch (e) {
    return;
  }
  if (result && result.detections && result.detections.length > 0) {
    const bbox = result.detections[0].boundingBox;
    updateFaceBox(bbox);
    processRatio(bbox.height / video.videoHeight);
  } else {
    hideFaceBox();
    checkFaceLostTimeout();
  }
}

function startDetectionLoop() {
  const video = $("camera-video");
  const useRVFC = typeof video.requestVideoFrameCallback === "function";
  let lastProcessed = 0;
  const minIntervalMs = 100;

  function onFrame(now) {
    if (!state.detectionRunning) return;
    if (now - lastProcessed >= minIntervalMs) {
      lastProcessed = now;
      runDetectionOnce();
    }
    if (useRVFC) video.requestVideoFrameCallback(onFrame);
    else requestAnimationFrame(onFrame);
  }
  if (useRVFC) video.requestVideoFrameCallback(onFrame);
  else requestAnimationFrame(onFrame);
}

async function startWorkout() {
  speak("Let's go");

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch (e) {
    toast("Camera access is required to count reps. Please allow camera permission.", 4000);
    return;
  }

  toast("Loading face detector…", 2000);
  let detector;
  try {
    detector = await ensureFaceDetector();
  } catch (e) {
    toast("Couldn't load the face detection model. Check your connection and try again.", 4500);
    stream.getTracks().forEach((t) => t.stop());
    return;
  }

  state.stream = stream;
  const video = $("camera-video");
  video.srcObject = stream;
  try { await video.play(); } catch (e) { /* autoplay quirks */ }

  await acquireWakeLock();

  state.highScore = getHighScore(state.currentUser);
  resetRepState();
  state.workoutActive = true;
  state.detectionRunning = true;
  state.sessionStartedAt = new Date();
  $("workout-idle").classList.add("hidden");
  $("workout-active").classList.remove("hidden");
  $("app-header").classList.add("minimized");

  startDetectionLoop();
}

function stopCameraAndDetection() {
  state.detectionRunning = false;
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }
  $("camera-video").srcObject = null;
}

function stopWorkoutHard() {
  stopCameraAndDetection();
  releaseWakeLock();
  state.workoutActive = false;
  $("workout-active").classList.add("hidden");
  $("workout-idle").classList.remove("hidden");
  $("app-header").classList.remove("minimized");
}

const FUN_MESSAGES = [
  (n) => `${n} pushups down. Somewhere, a gym bro just shed a single tear.`,
  (n) => `That's ${n} reps of pure bonanza energy.`,
  (n) => `${n}! The floor never stood a chance.`,
  (n) => `Boom. ${n} pushups. Tell your friends before they check the leaderboard.`,
  (n) => `${n} reps in the books. Absolute unit behavior.`,
  (n) => `${n} pushups. Certified gym bro moment.`,
  (n) => `The floor is filing a restraining order after ${n} pushups.`,
  (n) => `${n} reps deep. Somebody get this man a protein shake.`,
  (n) => `Legendary. ${n} pushups and not a single excuse.`,
  (n) => `${n} down. Your future self just texted "thank you."`,
  (n) => `That's ${n} reps of chaotic gains energy.`,
  (n) => `${n} pushups. The gains gremlins are pleased.`,
  (n) => `Absolute unit alert: ${n} pushups completed.`,
  (n) => `${n} reps. Somewhere a protein shake shed a single tear of joy.`,
  (n) => `${n} pushups in. You may now flex responsibly.`,
  (n) => `${n} down. The leaderboard trembles.`,
];
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
function launchConfetti(targetId = "confetti", emojiSet = CONFETTI_EMOJI) {
  const el = $(targetId);
  el.innerHTML = "";
  for (let i = 0; i < 24; i++) {
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

async function completeWorkout() {
  const count = repState.count;
  stopCameraAndDetection();
  await releaseWakeLock();
  state.workoutActive = false;
  $("workout-active").classList.add("hidden");
  $("workout-idle").classList.remove("hidden");

  const session = {
    id: uuid(),
    user: state.currentUser,
    timestamp: new Date().toISOString(),
    count,
    avatar: state.currentAvatar,
    startedAt: state.sessionStartedAt ? state.sessionStartedAt.toISOString() : undefined,
  };

  // Optimistically reflect it locally right away so it shows up immediately.
  const cached = getCachedData();
  cached.sessions.push(session);
  cacheData(cached);

  const message = pickFunMessage(count);
  state.lastSessionType = "pushup";
  $("summary-count").textContent = String(count);
  $("summary-unit-label").textContent = "pushups";
  $("summary-user").textContent = state.currentUser;
  setAvatarEl($("summary-avatar"), state.currentAvatar, "1.6rem");
  $("summary-message").textContent = message;
  $("summary-sync-status").textContent = "";
  showScreen("screen-summary");
  launchConfetti();
  speak(`Session complete. ${message}`);

  try {
    await commitSession(session);
  } catch (e) {
    enqueueSession(session);
    $("summary-sync-status").textContent = "Saved on this device — will sync automatically when back online.";
  }
}

$("btn-start").addEventListener("click", startWorkout);
$("btn-complete").addEventListener("click", completeWorkout);
const SHARE_MESSAGES = [
  (n) => `${n} pushups! 💪 Come beat my pump 🔥`,
  (n) => `Just banged out ${n} pushups 😤 Who's next?`,
  (n) => `${n} reps in the bank 🏦 Leaderboard's calling your name 🏆`,
  (n) => `${n} pushups down 📉 Beat that, if you can 😏`,
  (n) => `${n} reps deep 💦 Your move, boys 👀`,
  (n) => `${n} pushups logged ✅ The bonanza continues 🚀`,
];
const SHARE_MESSAGES_PLANK = [
  (t) => `Held a ${t} plank! 🪵 Beat that 💪`,
  (t) => `${t} plank in the books 🧱 Your move, boys 👀`,
  (t) => `Just planked for ${t} 😤 Who's next?`,
  (t) => `${t} of pure core chaos 🔥 Come get some`,
  (t) => `${t} plank logged ✅ The bonanza continues 🚀`,
];
const SHARE_MESSAGES_STREAK = [
  (n, ctx) => `${n} pushups and a ${ctx.streak}-day streak going 🔥 Who's catching up?`,
  (n, ctx) => `${ctx.streak} days straight, ${n} pushups today 😤 Consistency is the cheat code.`,
  (n, ctx) => `Day ${ctx.streak} of the streak. ${n} pushups banked 💪`,
];
const SHARE_MESSAGES_PLANK_STREAK = [
  (t, ctx) => `${t} plank and a ${ctx.streak}-day streak going 🔥 Who's catching up?`,
  (t, ctx) => `Day ${ctx.streak} of the streak, held ${t} today 💪`,
];
const SHARE_MESSAGES_WEEK = [
  (n, ctx) => `${n} pushups today, ${ctx.weekTotalDisplay} this week 📈 The bonanza never sleeps.`,
  (n, ctx) => `${ctx.weekTotalDisplay} pushups this week and counting 🚀 Today's ${n} of them.`,
];
const SHARE_MESSAGES_PLANK_WEEK = [
  (t, ctx) => `${t} today, ${ctx.weekTotalDisplay} of plank time this week 📈 The bonanza never sleeps.`,
];
const BREAD_EMOJI = ["🍞", "🥖", "🥯", "🫓", "🥨"];
const SHARE_MESSAGES_BREAD = [
  (n) => `${n} pushups. Time to get the bread ${pickFrom(BREAD_EMOJI)}`,
  (n) => `Getting that bread ${pickFrom(BREAD_EMOJI)} — ${n} pushups deep.`,
  (n) => `${n} reps, ${pickFrom(BREAD_EMOJI)} secured. Who's hungry?`,
];
const SHARE_MESSAGES_PLANK_BREAD = [
  (t) => `${t} plank. Time to get the bread ${pickFrom(BREAD_EMOJI)}`,
  (t) => `Getting that bread ${pickFrom(BREAD_EMOJI)} — ${t} plank held.`,
];

// Streak + this-week totals for whichever activity type the just-finished
// session belongs to (pushup sessions and plank sessions each get their own
// streak/weekly total, same as the My Bonanza dashboard).
function buildShareContext() {
  const isPlank = state.lastSessionType === "plank";
  const mine = getAllSessionsForDisplay().filter((s) => s.user === state.currentUser && (s.type === "plank") === isPlank);
  const weekStart = periodStart("week");
  const weekTotalRaw = mine
    .filter((s) => new Date(s.timestamp) >= weekStart)
    .reduce((sum, s) => sum + s.count, 0);
  return {
    isPlank,
    streak: computeStreak(mine),
    weekTotalRaw,
    weekTotalDisplay: isPlank ? formatDuration(weekTotalRaw * 1000) : String(weekTotalRaw),
  };
}

// Randomly weaves in streak/weekly-total callouts and "get the bread" jokes
// alongside the plain messages, when there's a meaningful streak/week to brag about.
function pickShareMessage(count, ctx) {
  const pools = [
    ctx.isPlank ? SHARE_MESSAGES_PLANK : SHARE_MESSAGES,
    ctx.isPlank ? SHARE_MESSAGES_PLANK_BREAD : SHARE_MESSAGES_BREAD,
  ];
  if (ctx.streak >= 2) pools.push(ctx.isPlank ? SHARE_MESSAGES_PLANK_STREAK : SHARE_MESSAGES_STREAK);
  if (ctx.weekTotalRaw > 0) pools.push(ctx.isPlank ? SHARE_MESSAGES_PLANK_WEEK : SHARE_MESSAGES_WEEK);
  const template = pickFrom(pools.flat());
  return template(count, ctx);
}

async function shareFlex() {
  const count = $("summary-count").textContent;
  const ctx = buildShareContext();
  const message = pickShareMessage(count, ctx);
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

$("btn-summary-again").addEventListener("click", () => {
  showScreen(state.lastSessionType === "plank" ? "screen-plank-workout" : "screen-workout");
});
$("btn-summary-share").addEventListener("click", shareFlex);

// ------------------- plank mode (hidden easter egg) -------------------

$("mascot-badge").addEventListener("click", () => {
  if (localStorage.getItem(LS.plankUnlocked) === "1") {
    showScreen("screen-plank-workout");
    return;
  }
  localStorage.setItem(LS.plankUnlocked, "1");
  showScreen("screen-plank-unlock");
  launchConfetti("plank-unlock-confetti", PLANK_EMOJI);
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
  $("app-header").classList.add("minimized");

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
  $("app-header").classList.remove("minimized");
}

const FUN_MESSAGES_PLANK = [
  (s) => `${s} second plank! Somewhere, a yoga instructor sheds a single tear.`,
  (s) => `Held it for ${s} seconds. Absolute plank behavior.`,
  (s) => `${s} seconds of pure core chaos.`,
  (s) => `${s} seconds down. The floor is still shaking.`,
  (s) => `That's ${s} seconds of plank supremacy.`,
  (s) => `${s} seconds. Your abs just filed a complaint.`,
];
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
  };

  // Optimistically reflect it locally right away so it shows up immediately.
  const cached = getCachedData();
  cached.sessions.push(session);
  cacheData(cached);

  const message = pickPlankFunMessage(seconds);
  state.lastSessionType = "plank";
  $("summary-count").textContent = formatDuration(seconds * 1000);
  $("summary-unit-label").textContent = "plank";
  $("summary-user").textContent = state.currentUser;
  setAvatarEl($("summary-avatar"), state.currentAvatar, "1.6rem");
  $("summary-message").textContent = message;
  $("summary-sync-status").textContent = "";
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

// ------------------- init -------------------

async function init() {
  initTheme();
  showScreen(state.currentUser ? "screen-user" : "screen-user");
  await flushQueue().catch(() => {});
  renderPendingStatus();
  loadChallenges();

  if (workerConfigured()) {
    try {
      const data = await workerFetchData();
      cacheData(data);
      renderUserList();
      renderStreakBadge();
    } catch (e) {
      // offline or Worker unreachable; cached data (if any) is already shown
    }
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
