// Grip mode (see docs/grip-mode-plan.md): a hand-gripper set timed with an
// open-ended clock. Squeezes aren't detected — at Stop the app suggests a
// count from the player's learned seconds-per-squeeze rate and the player
// confirms it. Pure helpers only; app.js owns the screen, timers and saving.

export const GRIP_DEFAULT_SEC_PER_SQUEEZE = 1.5;
export const GRIP_RATE_WINDOW = 5;
const MIN_SEC_PER_SQUEEZE = 0.3;
const MAX_SEC_PER_SQUEEZE = 10;

function sessionTime(session) {
  const t = new Date(session?.timestamp).getTime();
  return Number.isFinite(t) ? t : 0;
}

// Seconds per squeeze for `user`: the average of duration ÷ squeezes over
// their last GRIP_RATE_WINDOW confirmed Grip sessions. Each sample is
// clamped so one fat-fingered count can't wreck the next suggestion.
export function gripRateFor(sessions, user) {
  const samples = (sessions || [])
    .filter((s) => s?.type === "grip" && s.user === user && Number(s.count) > 0 && Number(s.gripDurationSeconds) > 0)
    .sort((a, b) => sessionTime(b) - sessionTime(a))
    .slice(0, GRIP_RATE_WINDOW)
    .map((s) => Math.min(MAX_SEC_PER_SQUEEZE, Math.max(MIN_SEC_PER_SQUEEZE, Number(s.gripDurationSeconds) / Number(s.count))));
  if (!samples.length) return GRIP_DEFAULT_SEC_PER_SQUEEZE;
  return samples.reduce((sum, n) => sum + n, 0) / samples.length;
}

export function gripSuggestedCount(durationSec, secPerSqueeze) {
  const seconds = Math.max(0, Number(durationSec) || 0);
  if (seconds < 1) return 0;
  const rate = Math.max(MIN_SEC_PER_SQUEEZE, Number(secPerSqueeze) || GRIP_DEFAULT_SEC_PER_SQUEEZE);
  return Math.max(1, Math.round(seconds / rate));
}

// Switch-hand marks (elapsed seconds at each tap) + the final elapsed
// seconds → per-lap durations. The first lap is the left hand. Lap ends are
// rounded before differencing so the laps always sum to the rounded total.
export function gripLapDurations(switchMarks, totalSec) {
  const ends = [...(switchMarks || []).filter((t) => t > 0 && t < totalSec), totalSec].map((t) => Math.round(t));
  const laps = [];
  let previous = 0;
  for (const end of ends) {
    laps.push(Math.max(0, end - previous));
    previous = end;
  }
  return laps;
}

export function gripLapHand(index) {
  return index % 2 === 0 ? "L" : "R";
}

// Laps (alternating L, R, L, …) → total seconds per hand.
export function gripHandTotals(laps) {
  const totals = { L: 0, R: 0 };
  (laps || []).forEach((seconds, i) => { totals[gripLapHand(i)] += Number(seconds) || 0; });
  return totals;
}
