// Reps Bingo — a recurring, biweekly (14-day) challenge layered onto the
// Challenges module. Unlike the curated `challenges.json` entries, a bingo
// cycle's 5x5 board is NOT hand-authored: it is derived deterministically
// from the cycle id via a seeded PRNG, so every client/user computes the
// identical shared board with zero server storage and zero Worker changes —
// joining reuses the existing generic `/join-challenge` endpoint (a bingo
// cycle id like "bingo-2026-09-06" already satisfies its
// /^[a-z0-9-]+$/ id validation). Completion is derived purely from existing
// session records (mode/type/modifier + count + timestamp + user) within the
// cycle window, matching the "no new logging" principle used by the rest of
// the Challenges module (see challenges.js / app.js's challengeSessions).

const CYCLE_DAYS = 14;
const GRID_SIZE = 5;
const CENTER_INDEX = 12; // 0-based, row-major, middle of a 5x5 grid

// Arbitrary local-midnight anchor for cycle 0. Cycle boundaries are computed
// with calendar-date arithmetic (setDate-style), not raw ms multiples, so
// DST transitions can't drift a cycle off its intended local midnight —
// same spirit as challengeWindow's local-timezone convention.
// Anchored to 2026-09-07 so the first cycle starts that day (duration
// unchanged at CYCLE_DAYS) rather than the arbitrary Jan 1 epoch, which had
// cycles landing on off dates like Aug 27 – Sep 9.
const BINGO_EPOCH = new Date(2026, 8, 7);

// The combined square pool: existing game-format modes (workout-modes.js /
// the VALID_MODES the Worker accepts on a session), plain loggable exercise
// types, and the two modifier-ish session fields that exist today. Horse and
// Tug of War are deliberately excluded — those are turn-based mini-games
// (horse_games/tow_games tables) that never produce a plain `sessions` row
// with a matching mode, so there is nothing to derive completion from
// without adding new logging (out of scope per the module's own rule).
export const BINGO_POOL = [
  { kind: "mode", key: "cards", label: "Cards", emoji: "🃏" },
  { kind: "mode", key: "poker", label: "Poker", emoji: "🂡" },
  { kind: "mode", key: "dice", label: "Dice", emoji: "🎲" },
  { kind: "mode", key: "wheel", label: "Wheel", emoji: "🎡" },
  { kind: "mode", key: "ladder", label: "Ladder", emoji: "🪜" },
  { kind: "mode", key: "sharpshooter", label: "Shooter", emoji: "🎯" },
  { kind: "mode", key: "pyramid", label: "Pyramid", emoji: "▲" },
  { kind: "mode", key: "pulse", label: "Pulse", emoji: "❤️‍🔥" },
  { kind: "mode", key: "cock", label: "Cock Mode", emoji: "🐓" },
  { kind: "mode", key: "fortune", label: "Fortune", emoji: "🥠" },
  { kind: "mode", key: "chase", label: "Chase", emoji: "🏃" },
  { kind: "mode", key: "zen", label: "Zen", emoji: "🧘" },
  { kind: "mode", key: "countdown", label: "Countdown", emoji: "⏱️" },
  { kind: "exercise", key: "pushups", label: "Pushups", emoji: "💪" },
  { kind: "exercise", key: "squats", label: "Squats", emoji: "🦵" },
  { kind: "exercise", key: "situps", label: "Crunches", emoji: "🙇" },
  { kind: "exercise", key: "planks", label: "Planks", emoji: "🪵" },
  { kind: "modifier", key: "location", label: "On Location", emoji: "📍" },
];

function hashStringToSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 — small, fast, deterministic PRNG; good enough for a shuffled
// board, no cryptographic need here.
function mulberry32(seed) {
  let state = seed >>> 0;
  return function rng() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function localMidnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function cycleIdFor(startDate) {
  return `bingo-${startDate.getFullYear()}-${pad2(startDate.getMonth() + 1)}-${pad2(startDate.getDate())}`;
}

function cycleFromStart(startDate) {
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + CYCLE_DAYS - 1, 23, 59, 59, 999);
  return { id: cycleIdFor(startDate), startDate, endDate };
}

// The cycle containing `now` (defaults to the current moment).
export function bingoCycleForDate(now = new Date()) {
  const epoch = localMidnight(BINGO_EPOCH);
  const today = localMidnight(now);
  const daysSince = Math.round((today - epoch) / 86400000);
  const cycleIndex = Math.floor(daysSince / CYCLE_DAYS);
  const startDate = new Date(epoch.getFullYear(), epoch.getMonth(), epoch.getDate() + cycleIndex * CYCLE_DAYS);
  return cycleFromStart(startDate);
}

// Parses a cycle id ("bingo-YYYY-MM-DD") back into its window — used to
// re-derive a past/upcoming cycle's window from just its id (e.g. after a
// page reload with only `state.openChallengeId` in hand).
export function bingoCycleById(id) {
  const m = /^bingo-(\d{4})-(\d{2})-(\d{2})$/.exec(id || "");
  if (!m) return null;
  const startDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return cycleFromStart(startDate);
}

// The cycle `deltaCycles` windows away from `cycle` (negative = earlier).
export function adjacentBingoCycle(cycle, deltaCycles) {
  const startDate = new Date(cycle.startDate.getFullYear(), cycle.startDate.getMonth(), cycle.startDate.getDate() + deltaCycles * CYCLE_DAYS);
  return cycleFromStart(startDate);
}

export function isBingoCycleId(id) {
  return typeof id === "string" && id.startsWith("bingo-");
}

// Builds the multiset of pool items to fill the 24 non-FREE squares: each
// item appears at least once; if the pool is short of 24 (it is, by design —
// see BINGO_POOL's comment), a seed-chosen subset of items gets one extra
// copy to make up the difference.
function buildPoolBag(pool, count, rng) {
  const base = Math.floor(count / pool.length);
  const extra = count - base * pool.length;
  const bag = [];
  for (const item of pool) for (let n = 0; n < base; n++) bag.push(item);
  const order = shuffleInPlace(pool.map((_, i) => i), rng);
  for (let i = 0; i < extra; i++) bag.push(pool[order[i]]);
  return shuffleInPlace(bag, rng);
}

function neighborsOf(index) {
  const row = Math.floor(index / GRID_SIZE);
  const col = index % GRID_SIZE;
  const out = [];
  if (row > 0) out.push(index - GRID_SIZE);
  if (row < GRID_SIZE - 1) out.push(index + GRID_SIZE);
  if (col > 0) out.push(index - 1);
  if (col < GRID_SIZE - 1) out.push(index + 1);
  return out;
}

// Generates the shared 25-square board for a cycle id — pure function of the
// id, so it needs no persistence: every participant (and a late joiner)
// derives the exact same board client-side. Square 13 (index 12, center) is
// always FREE. Best-effort de-clustering: one pass swaps a cell that's
// orthogonally adjacent to an identical item with a later distinct-item cell
// when a safe swap exists — not a hard guarantee, intentionally not
// over-engineered.
export function generateBingoBoard(cycleId) {
  const rng = mulberry32(hashStringToSeed(cycleId));
  const cells = new Array(GRID_SIZE * GRID_SIZE).fill(null);
  cells[CENTER_INDEX] = { index: CENTER_INDEX, free: true, item: null };

  const nonCenterIndexes = shuffleInPlace(
    cells.map((_, i) => i).filter((i) => i !== CENTER_INDEX),
    rng
  );
  const bag = buildPoolBag(BINGO_POOL, nonCenterIndexes.length, rng);
  nonCenterIndexes.forEach((cellIndex, n) => {
    cells[cellIndex] = { index: cellIndex, free: false, item: bag[n] };
  });

  for (const idx of nonCenterIndexes) {
    const cell = cells[idx];
    const clashes = neighborsOf(idx).some((n) => !cells[n].free && cells[n].item.key === cell.item.key);
    if (!clashes) continue;
    const swapIdx = nonCenterIndexes.find((other) => {
      if (other === idx || cells[other].item.key === cell.item.key) return false;
      // Only swap if doing so doesn't just relocate the clash: the other
      // cell's item must not collide with idx's neighbors, and cell's item
      // must not collide with other's neighbors.
      const otherWouldClash = neighborsOf(other).some((n) => n !== idx && !cells[n].free && cells[n].item.key === cell.item.key);
      const idxWouldClash = neighborsOf(idx).some((n) => n !== other && !cells[n].free && cells[n].item.key === cells[other].item.key);
      return !otherWouldClash && !idxWouldClash;
    });
    if (swapIdx !== undefined) {
      const tmp = cells[idx];
      cells[idx] = { ...cells[swapIdx], index: idx };
      cells[swapIdx] = { ...tmp, index: swapIdx };
    }
  }

  return cells;
}

function toMs(value, timestampOf) {
  if (timestampOf) return timestampOf(value);
  return value?.timestamp instanceof Date ? value.timestamp.getTime() : Date.parse(value?.timestamp);
}

// Whether a logged session matches a bingo pool item.
export function sessionMatchesBingoItem(session, item) {
  if (!item) return false;
  if (item.kind === "mode") return session.mode === item.key;
  if (item.kind === "exercise") {
    if (item.key === "pushups") return !session.type && !session.mode;
    if (item.key === "squats") return session.type === "squat";
    if (item.key === "situps") return session.type === "situp";
    if (item.key === "planks") return session.type === "plank";
    return false;
  }
  if (item.kind === "modifier") {
    if (item.key === "location") return !!session.location;
    return false;
  }
  return false;
}

function inWindow(session, window, timestampOf) {
  const t = toMs(session, timestampOf);
  return Number.isFinite(t) && t >= window.startDate.getTime() && t <= window.endDate.getTime();
}

// Per-user completion state for every square on the board. FREE is always
// done. `sessions` may be any user's sessions — this filters to `userName`
// and the cycle window itself, so callers can pass one shared full session
// list for every participant.
export function bingoCompletionForUser(board, sessions, userName, window, timestampOf) {
  const inWindowSessions = sessions.filter((s) => s.user === userName && inWindow(s, window, timestampOf));
  return board.map((cell) =>
    cell.free
      ? { ...cell, done: true }
      : { ...cell, done: inWindowSessions.some((s) => sessionMatchesBingoItem(s, cell.item)) }
  );
}

export function bingoSquaresChecked(completedBoard) {
  return completedBoard.filter((c) => c.done).length;
}

export function bingoIsFullCard(completedBoard) {
  return completedBoard.every((c) => c.done);
}

// Total reps a user logged in-window matching one pool item — the basis for
// the category-point tiebreak.
export function repsForItem(sessions, userName, item, window, timestampOf) {
  return sessions
    .filter((s) => s.user === userName && inWindow(s, window, timestampOf) && sessionMatchesBingoItem(s, item))
    .reduce((sum, s) => sum + (s.count || 0), 0);
}

// For each non-FREE square, whichever candidate logged the most in-window
// reps for that square's item gets one category point; ties share the
// point. A square nobody logged anything for awards no point.
export function bingoCategoryPoints(board, candidateNames, sessions, window, timestampOf) {
  const points = Object.fromEntries(candidateNames.map((n) => [n, 0]));
  for (const cell of board) {
    if (cell.free) continue;
    const totals = candidateNames.map((name) => ({ name, total: repsForItem(sessions, name, cell.item, window, timestampOf) }));
    const max = Math.max(...totals.map((t) => t.total));
    if (max <= 0) continue;
    for (const t of totals) if (t.total === max) points[t.name] += 1;
  }
  return points;
}

// Squares-checked leaderboard for the detail view — every joined
// participant, ranked by squares completed (ties keep full-card finishers
// ahead of non-finishers at the same count).
export function bingoLeaderboard(board, participants, sessions, window, timestampOf) {
  return participants
    .map((name) => {
      const completedBoard = bingoCompletionForUser(board, sessions, name, window, timestampOf);
      return { name, squares: bingoSquaresChecked(completedBoard), fullCard: bingoIsFullCard(completedBoard) };
    })
    .sort((a, b) => b.squares - a.squares || Number(b.fullCard) - Number(a.fullCard));
}

// Cycle-end result: who won and how.
//  - One or more participants completed the full 25/25 card: among just
//    those finishers, tally category points across all 25 squares; the
//    top-points finisher(s) win (ties share the win).
//  - Nobody finished: most squares checked wins; a tie at the max count is
//    broken by category points computed across just the tied participants.
export function bingoWinners(board, participants, sessions, window, timestampOf) {
  const standings = participants.map((name) => {
    const completedBoard = bingoCompletionForUser(board, sessions, name, window, timestampOf);
    return { name, squares: bingoSquaresChecked(completedBoard), fullCard: bingoIsFullCard(completedBoard) };
  });
  if (!standings.length) return { winners: [], categoryPoints: {}, finishers: [], mode: "none" };

  const finishers = standings.filter((s) => s.fullCard);
  if (finishers.length) {
    const names = finishers.map((f) => f.name);
    const categoryPoints = bingoCategoryPoints(board, names, sessions, window, timestampOf);
    const maxPoints = Math.max(...names.map((n) => categoryPoints[n]));
    const winners = names.filter((n) => categoryPoints[n] === maxPoints);
    return { winners, categoryPoints, finishers: names, mode: "categoryPoints" };
  }

  const maxSquares = Math.max(...standings.map((s) => s.squares));
  const top = standings.filter((s) => s.squares === maxSquares);
  if (top.length === 1) return { winners: [top[0].name], categoryPoints: {}, finishers: [], mode: "squares" };

  const names = top.map((t) => t.name);
  const categoryPoints = bingoCategoryPoints(board, names, sessions, window, timestampOf);
  const maxPoints = Math.max(...names.map((n) => categoryPoints[n]));
  const winners = names.filter((n) => categoryPoints[n] === maxPoints);
  return { winners, categoryPoints, finishers: [], mode: "squaresTiebreak" };
}
