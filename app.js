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

function cacheData(data) {
  localStorage.setItem(LS.cacheData, JSON.stringify(data));
}
function getCachedData() {
  try {
    const raw = localStorage.getItem(LS.cacheData);
    if (!raw) return { sessions: [], avatars: {} };
    const data = JSON.parse(raw);
    if (!Array.isArray(data.sessions)) data.sessions = [];
    if (!data.avatars || typeof data.avatars !== "object") data.avatars = {};
    return data;
  } catch (e) {
    return { sessions: [], avatars: {} };
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
};

const repState = {
  phase: "up",
  count: 0,
  smoothedRatio: null,
  lastSeenAt: 0,
  paused: false,
  halfHit: false,
  threeQuarterHit: false,
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
  const mine = getAllSessionsForDisplay().filter((s) => s.user === state.currentUser);
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
  $("app-header").classList.toggle("minimized", id === "screen-workout" && state.workoutActive);
  renderStreakBadge();

  if (id === "screen-user") renderUserList();
  if (id === "screen-dashboard") renderDashboard();
  if (id === "screen-settings") renderSettings();
  if (id === "screen-workout" && !state.workoutActive) {
    $("workout-username").textContent = state.currentUser || "Friend";
    setAvatarEl($("workout-avatar"), state.currentAvatar, "2rem");
  }
}

function guardLeaveWorkout(next) {
  if (state.screen === "screen-workout" && state.workoutActive) {
    const ok = confirm("Leave this workout? Your in-progress reps won't be saved.");
    if (!ok) return;
    stopWorkoutHard();
  }
  next();
}

$("btn-home").addEventListener("click", () => guardLeaveWorkout(() => showScreen("screen-user")));
$("btn-nav-dashboard").addEventListener("click", () => guardLeaveWorkout(() => showScreen("screen-dashboard")));
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

// ------------------- settings screen -------------------

function renderSettings() {
  $("range-down").value = getThresholdDown();
  $("range-up").value = getThresholdUp();
  $("val-down").textContent = getThresholdDown().toFixed(2);
  $("val-up").textContent = getThresholdUp().toFixed(2);
  $("chk-calibration-readout").checked = localStorage.getItem(LS.calibrationReadout) === "1";
  $("chk-highscore-message").checked = localStorage.getItem(LS.showHighscore) !== "0";

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
      <span class="my-session-count">${s.count}</span>
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
  paintActiveBonanzaView();
  renderStreakBadge();
}

function paintActiveBonanzaView() {
  if (state.bonanzaMode === "mine") paintMyBonanza(state.lastSessions);
  else paintDashboard(state.lastSessions);
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
    return `
      <div class="week-bar-col">
        <div class="week-bar-value">${total || ""}</div>
        <div class="week-bar" style="height:${heightPct}%"></div>
        <div class="week-bar-label">${label}</div>
      </div>
    `;
  }).join("");

  const statsEl = $("personal-stats");
  if (!mine.length) {
    statsEl.innerHTML = '<p class="leaderboard-empty">No sessions yet — go do some pushups! 💪</p>';
    return;
  }
  const allTimeTotal = mine.reduce((sum, s) => sum + s.count, 0);
  const personalBest = Math.max(...mine.map((s) => s.count));
  const avgPerSession = Math.round(allTimeTotal / mine.length);
  const streak = computeStreak(mine);

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
    { label: "All-time total", value: allTimeTotal },
    { label: "Personal best", value: personalBest },
    { label: "Current streak", value: `${streak} day${streak === 1 ? "" : "s"}` },
    { label: "Avg per session", value: avgPerSession },
    { label: "Sessions logged", value: mine.length },
  ];
  if (avgDurationMs != null) {
    stats.push({ label: "Avg session time", value: formatDuration(avgDurationMs) });
  }
  if (avgPace != null) {
    stats.push({ label: "Avg pace", value: `${avgPace.toFixed(1)}/min` });
  }
  statsEl.innerHTML = stats.map((s) => `
    <div class="stat-card">
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join("");
}

function paintDashboard(sessions) {
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
    lbList.innerHTML = '<p class="leaderboard-empty">No pushups logged for this period yet. Get moving! 💪</p>';
  } else {
    ranked.forEach(([user, total], i) => {
      const row = document.createElement("div");
      row.className = "leaderboard-row" + (i < 3 ? ` rank-${i + 1}` : "");
      row.innerHTML = `
        <div class="leaderboard-rank">${i + 1}</div>
        <div class="leaderboard-trophy">${TROPHIES[i] || ""}</div>
        ${avatarCircleHTML(avatarForUser(user), "1.8rem")}
        <div class="leaderboard-name">${escapeHtml(user)}</div>
        <div class="leaderboard-total">${total}</div>
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
      header.innerHTML = `<span class="history-user-label">${avatarCircleHTML(avatarForUser(user), "1.7rem")}<span>${escapeHtml(user)} — ${totals.get(user)} total</span></span><span class="chev">▸</span>`;
      header.addEventListener("click", () => group.classList.toggle("open"));
      const sessionsWrap = document.createElement("div");
      sessionsWrap.className = "history-sessions";
      sessionsWrap.innerHTML = userSessions
        .map((s) => `<div class="history-session-row"><span>${formatDateTime(s.timestamp)}</span><span class="history-session-count">${s.count}</span></div>`)
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
  const recentList = $("recent-list");
  const recent = [...sessions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);
  recentList.innerHTML = "";
  if (!recent.length) {
    recentList.innerHTML = '<p class="history-empty">No pushups logged yet. Get moving! 💪</p>';
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
  paintDashboard(state.lastSessions);
});

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
  repState.halfHit = false;
  repState.threeQuarterHit = false;
  repState.recordBroken = false;
  $("rep-count").textContent = "0";
  updateHighscoreMessage(0);
  updateThermometer(0);
  hideStatusBanner();
}

const ENCOURAGE_HALF = [
  "Halfway to your personal best — keep grinding!",
  "That's the halfway mark! Let's gooo!",
  "Halfway there, don't you dare stop now!",
  "Halfway to a new record. Push through!",
];
const ENCOURAGE_THREE_QUARTER = [
  "Three quarters to your best — almost there!",
  "Seventy five percent! You can smell the record now!",
  "Just a few more! You're so close!",
  "Three quarters done. Finish strong!",
];

function pickFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Returns an encouragement line the first time a rep crosses the halfway or
// three-quarter mark of the user's personal best for this session, else null.
function maybeEncourage(count) {
  if (!state.highScore || state.highScore <= 1) return null;
  const half = state.highScore / 2;
  const threeQuarter = state.highScore * 0.75;
  if (!repState.threeQuarterHit && count >= threeQuarter) {
    repState.threeQuarterHit = true;
    repState.halfHit = true;
    return pickFrom(ENCOURAGE_THREE_QUARTER);
  }
  if (!repState.halfHit && count >= half) {
    repState.halfHit = true;
    return pickFrom(ENCOURAGE_HALF);
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
    .filter((s) => s.user === name)
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
function launchConfetti(targetId = "confetti") {
  const el = $(targetId);
  el.innerHTML = "";
  for (let i = 0; i < 24; i++) {
    const span = document.createElement("span");
    span.className = "confetti-piece";
    span.textContent = CONFETTI_EMOJI[Math.floor(Math.random() * CONFETTI_EMOJI.length)];
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
  $("summary-count").textContent = String(count);
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
  (n) => `${n} pushups! Come beat my pump 💪`,
  (n) => `Just banged out ${n} pushups. Who's next?`,
  (n) => `${n} reps in the bank. Leaderboard's calling your name.`,
  (n) => `${n} pushups down. Beat that, if you can.`,
  (n) => `${n} reps deep. Your move, boys.`,
  (n) => `${n} pushups logged. The bonanza continues.`,
];

async function shareFlex() {
  const count = $("summary-count").textContent;
  const message = pickFrom(SHARE_MESSAGES)(count);
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

$("btn-summary-again").addEventListener("click", () => showScreen("screen-workout"));
$("btn-summary-share").addEventListener("click", shareFlex);

// ------------------- init -------------------

async function init() {
  initTheme();
  showScreen(state.currentUser ? "screen-user" : "screen-user");
  await flushQueue().catch(() => {});
  renderPendingStatus();

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
